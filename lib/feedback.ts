import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RoastFeedbackEntry, RoastFeedbackInput } from "./types";
import {
  getRoastFeedbackFromSupabase,
  isSupabaseConfigured,
  saveRoastFeedbackToSupabase,
} from "./supabase";

type FeedbackStoreFile = {
  entries: RoastFeedbackEntry[];
};

const MAX_FEEDBACK_ENTRIES = 10000;
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "feedback.json");

let writeQueue: Promise<void> = Promise.resolve();

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function clampOneDecimal(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
}

function normalizeToneAccuracy(value: unknown): RoastFeedbackEntry["toneAccuracy"] | null {
  return value === "too_soft" || value === "balanced" || value === "too_harsh"
    ? value
    : null;
}

function normalizeFeedback(
  input: RoastFeedbackInput | RoastFeedbackEntry,
): RoastFeedbackEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const reportId =
    typeof input.reportId === "string" ? input.reportId.trim().slice(0, 128) : "";
  const sessionId =
    typeof input.sessionId === "string" ? input.sessionId.trim().slice(0, 128) : "";
  const userId =
    typeof input.userId === "string" && input.userId.trim()
      ? input.userId.trim().slice(0, 128)
      : undefined;
  const url = typeof input.url === "string" ? input.url.trim().slice(0, 2000) : "";
  const scoreAtReview = Number(input.scoreAtReview);
  const scoreAccuracy = Number(input.scoreAccuracy);
  const toneAccuracy = normalizeToneAccuracy(input.toneAccuracy);

  if (
    !reportId ||
    !sessionId ||
    !url ||
    !Number.isFinite(scoreAtReview) ||
    !Number.isFinite(scoreAccuracy) ||
    !toneAccuracy
  ) {
    return null;
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim()
      ? input.notes.trim().slice(0, 1000)
      : undefined;
  const createdAt =
    "createdAt" in input && typeof input.createdAt === "string" && input.createdAt.trim()
      ? input.createdAt
      : new Date().toISOString();

  return {
    reportId,
    sessionId,
    userId,
    url,
    scoreAtReview: clampOneDecimal(scoreAtReview, 0, 10),
    scoreAccuracy: clampInteger(scoreAccuracy, 1, 5),
    toneAccuracy,
    notes,
    createdAt,
  };
}

async function readStoreFile(): Promise<FeedbackStoreFile> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<FeedbackStoreFile>;
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] };
    }

    return {
      entries: parsed.entries.flatMap((entry) => {
        const normalized = normalizeFeedback(entry);
        return normalized ? [normalized] : [];
      }),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { entries: [] };
    }

    throw error;
  }
}

async function writeStoreFile(data: FeedbackStoreFile): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function submitRoastFeedback(
  input: RoastFeedbackInput,
): Promise<RoastFeedbackEntry | null> {
  const entry = normalizeFeedback(input);
  if (!entry) {
    return null;
  }

  if (isSupabaseConfigured()) {
    const savedRemote = await saveRoastFeedbackToSupabase(entry);
    if (savedRemote) {
      return entry;
    }
  }

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const current = await readStoreFile();
    const nextEntries = [
      entry,
      ...current.entries.filter(
        (item) =>
          !(item.reportId === entry.reportId && item.sessionId === entry.sessionId),
      ),
    ].slice(0, MAX_FEEDBACK_ENTRIES);
    await writeStoreFile({ entries: nextEntries });
  });

  await writeQueue;
  return entry;
}

export async function getRoastFeedbackEntries(
  limit = MAX_FEEDBACK_ENTRIES,
): Promise<RoastFeedbackEntry[]> {
  await writeQueue.catch(() => undefined);

  if (isSupabaseConfigured()) {
    const remote = await getRoastFeedbackFromSupabase(limit);
    if (remote) {
      return remote;
    }
  }

  const local = await readStoreFile();
  return local.entries.slice(-limit);
}
