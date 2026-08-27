import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { submitRoastFeedback } from "@/lib/feedback";
import type { ToneAccuracy } from "@/lib/types";

export const dynamic = "force-dynamic";

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeToneAccuracy(value: unknown): ToneAccuracy | null {
  return value === "too_soft" || value === "balanced" || value === "too_harsh"
    ? value
    : null;
}

function normalizeScoreAccuracy(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) {
    return null;
  }

  return rounded;
}

function normalizeScoreAtReview(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric < 0 || numeric > 10) {
    return null;
  }

  return Math.round(numeric * 10) / 10;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      reportId?: unknown;
      sessionId?: unknown;
      url?: unknown;
      scoreAtReview?: unknown;
      scoreAccuracy?: unknown;
      toneAccuracy?: unknown;
      notes?: unknown;
    };

    const reportId = normalizeString(body.reportId, 128);
    const sessionId = normalizeString(body.sessionId, 128);
    const url = normalizeString(body.url, 2000);
    const scoreAtReview = normalizeScoreAtReview(body.scoreAtReview);
    const scoreAccuracy = normalizeScoreAccuracy(body.scoreAccuracy);
    const toneAccuracy = normalizeToneAccuracy(body.toneAccuracy);
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, 1000)
        : undefined;
    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await getSupabaseUserFromAccessToken(token) : null;

    if (
      !reportId ||
      !sessionId ||
      !url ||
      scoreAtReview === null ||
      scoreAccuracy === null ||
      !toneAccuracy
    ) {
      return NextResponse.json({ error: "Invalid feedback payload." }, { status: 400 });
    }

    const saved = await submitRoastFeedback({
      reportId,
      sessionId,
      userId: user?.id,
      url,
      scoreAtReview,
      scoreAccuracy,
      toneAccuracy,
      notes,
    });

    if (!saved) {
      return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
  }
}
