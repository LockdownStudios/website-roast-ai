import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyticsEvent,
  AnalyticsEventName,
  LandingVariant,
} from "./types";
import {
  getAnalyticsEventsFromSupabase,
  isSupabaseConfigured,
  saveAnalyticsEventToSupabase,
} from "./supabase";
import { getRoastFeedbackEntries } from "./feedback";

type AnalyticsStoreFile = {
  events: AnalyticsEvent[];
};

type TrackEventInput = {
  name: AnalyticsEventName;
  sessionId: string;
  variant?: LandingVariant;
  metadata?: Record<string, string | number | boolean>;
};

type ConfidenceBucket = "high" | "medium" | "low" | "unknown";
type ScrapeQualityBucket = "high" | "medium" | "low" | "unknown";
type ScoreBucket = "under4" | "from4to6" | "from6to8" | "above8";
type ToneTrendDay = {
  date: string;
  tooSoft: number;
  balanced: number;
  tooHarsh: number;
  total: number;
};

export type AnalyticsSummary = {
  generatedAt: string;
  totalEvents: number;
  uniqueSessions: number;
  eventsByName: Record<AnalyticsEventName, number>;
  variants: { A: number; B: number; unknown: number };
  funnel: {
    landingViews: number;
    submits: number;
    successes: number;
    resultViews: number;
    submitToSuccessRate: number;
    successToResultViewRate: number;
    landingToSubmitRate: number;
  };
  quality: {
    roastSuccesses: number;
    avgConfidence: number;
    confidenceBuckets: Record<ConfidenceBucket, number>;
    scrapeQuality: Record<ScrapeQualityBucket, number>;
    cacheHitRate: number;
    relaxedFallbackRate: number;
    retryRate: number;
  };
  feedback: {
    total: number;
    avgScoreAccuracy: number;
    scoreAccuracyByBucket: Record<
      ScoreBucket,
      {
        avgAccuracy: number;
        count: number;
      }
    >;
    toneBreakdown: {
      tooSoft: number;
      balanced: number;
      tooHarsh: number;
    };
    mostMiscalibratedDomains: string[];
    harshnessTrend: ToneTrendDay[];
  };
  topHostnames: string[];
  topErrors: string[];
};

const MAX_EVENTS = 5000;
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "analytics.json");
const EVENT_NAMES: AnalyticsEventName[] = [
  "landing_view",
  "roast_submit",
  "roast_success",
  "roast_error",
  "result_view",
];

let writeQueue: Promise<void> = Promise.resolve();

function isEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && EVENT_NAMES.includes(value as AnalyticsEventName);
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, 128);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVariant(value: unknown): LandingVariant | undefined {
  return value === "A" || value === "B" ? value : undefined;
}

function normalizeMetadata(
  metadata: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const entries = Object.entries(metadata).filter((entry) => {
    const value = entry[1];
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.slice(0, 20));
}

function normalizeEvent(input: unknown): AnalyticsEvent | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = input as Partial<AnalyticsEvent>;
  const sessionId = normalizeSessionId(value.sessionId);
  if (!isEventName(value.name) || !sessionId) {
    return null;
  }

  const timestamp =
    typeof value.timestamp === "string" && value.timestamp.trim()
      ? value.timestamp
      : new Date().toISOString();

  return {
    name: value.name,
    sessionId,
    timestamp,
    variant: normalizeVariant(value.variant),
    metadata: normalizeMetadata(value.metadata),
  };
}

async function readStoreFile(): Promise<AnalyticsStoreFile> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AnalyticsStoreFile>;
    if (!Array.isArray(parsed.events)) {
      return { events: [] };
    }

    return {
      events: parsed.events.flatMap((event) => {
        const normalized = normalizeEvent(event);
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
      return { events: [] };
    }

    throw error;
  }
}

async function writeStoreFile(data: AnalyticsStoreFile): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readEvents(): Promise<AnalyticsEvent[]> {
  if (isSupabaseConfigured()) {
    const remote = await getAnalyticsEventsFromSupabase(MAX_EVENTS);
    if (remote) {
      return remote;
    }
  }

  const local = await readStoreFile();
  return local.events;
}

function percent(part: number, total: number): number {
  if (!total) {
    return 0;
  }

  return Math.round((part / total) * 1000) / 10;
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeConfidenceBucket(value: unknown): ConfidenceBucket {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "unknown";
}

function normalizeScrapeQuality(value: unknown): ScrapeQualityBucket {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "unknown";
}

function toScoreBucket(score: number): ScoreBucket {
  if (score < 4) {
    return "under4";
  }
  if (score < 6) {
    return "from4to6";
  }
  if (score < 8) {
    return "from6to8";
  }
  return "above8";
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function trackAnalyticsEvent(input: TrackEventInput): Promise<void> {
  const event = normalizeEvent({
    ...input,
    timestamp: new Date().toISOString(),
  });
  if (!event) {
    return;
  }

  if (isSupabaseConfigured()) {
    const savedRemote = await saveAnalyticsEventToSupabase(event);
    if (savedRemote) {
      return;
    }
  }

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const current = await readStoreFile();
    const nextEvents = [...current.events, event].slice(-MAX_EVENTS);
    await writeStoreFile({ events: nextEvents });
  });

  await writeQueue;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  await writeQueue.catch(() => undefined);
  const events = await readEvents();
  const feedbackEntries = await getRoastFeedbackEntries(5000);

  const eventsByName: Record<AnalyticsEventName, number> = {
    landing_view: 0,
    roast_submit: 0,
    roast_success: 0,
    roast_error: 0,
    result_view: 0,
  };
  const variants = { A: 0, B: 0, unknown: 0 };
  const errorCounts = new Map<string, number>();
  const hostnameCounts = new Map<string, number>();
  const sessionIds = new Set<string>();
  const confidenceBuckets: Record<ConfidenceBucket, number> = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  const scrapeQuality: Record<ScrapeQualityBucket, number> = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  };
  let confidenceSum = 0;
  let confidenceCount = 0;
  let cachedCount = 0;
  let relaxedFallbackCount = 0;
  let retryCount = 0;
  let feedbackAccuracySum = 0;
  const scoreAccuracyByBucketRaw: Record<ScoreBucket, { sum: number; count: number }> = {
    under4: { sum: 0, count: 0 },
    from4to6: { sum: 0, count: 0 },
    from6to8: { sum: 0, count: 0 },
    above8: { sum: 0, count: 0 },
  };
  const toneBreakdown = {
    tooSoft: 0,
    balanced: 0,
    tooHarsh: 0,
  };
  const domainAccuracy = new Map<string, { sum: number; count: number }>();
  const trendByDay = new Map<string, ToneTrendDay>();

  for (const event of events) {
    eventsByName[event.name] += 1;
    sessionIds.add(event.sessionId);

    if (event.variant === "A") {
      variants.A += 1;
    } else if (event.variant === "B") {
      variants.B += 1;
    } else {
      variants.unknown += 1;
    }

    if (event.name === "roast_error" && typeof event.metadata?.reason === "string") {
      const reason = event.metadata.reason.trim();
      if (!reason) {
        continue;
      }
      errorCounts.set(reason, (errorCounts.get(reason) ?? 0) + 1);
    }

    if (event.name === "roast_submit" && typeof event.metadata?.hostname === "string") {
      const hostname = event.metadata.hostname.trim().toLowerCase();
      if (hostname) {
        hostnameCounts.set(hostname, (hostnameCounts.get(hostname) ?? 0) + 1);
      }
    }

    if (event.name === "roast_success") {
      const bucket = normalizeConfidenceBucket(event.metadata?.confidence_bucket);
      confidenceBuckets[bucket] += 1;

      const qualityBucket = normalizeScrapeQuality(event.metadata?.scrape_quality);
      scrapeQuality[qualityBucket] += 1;

      const confidence = Number(event.metadata?.confidence);
      if (Number.isFinite(confidence)) {
        confidenceSum += confidence;
        confidenceCount += 1;
      }

      if (isTrue(event.metadata?.cached)) {
        cachedCount += 1;
      }
      if (isTrue(event.metadata?.scrape_relaxed_fallback)) {
        relaxedFallbackCount += 1;
      }
      if (isTrue(event.metadata?.scrape_retry_used)) {
        retryCount += 1;
      }
    }
  }

  for (const feedback of feedbackEntries) {
    feedbackAccuracySum += feedback.scoreAccuracy;
    const bucket = toScoreBucket(feedback.scoreAtReview);
    scoreAccuracyByBucketRaw[bucket].sum += feedback.scoreAccuracy;
    scoreAccuracyByBucketRaw[bucket].count += 1;

    if (feedback.toneAccuracy === "too_soft") {
      toneBreakdown.tooSoft += 1;
    } else if (feedback.toneAccuracy === "too_harsh") {
      toneBreakdown.tooHarsh += 1;
    } else {
      toneBreakdown.balanced += 1;
    }

    const hostname = extractHostname(feedback.url);
    if (hostname) {
      const existing = domainAccuracy.get(hostname) ?? { sum: 0, count: 0 };
      existing.sum += feedback.scoreAccuracy;
      existing.count += 1;
      domainAccuracy.set(hostname, existing);
    }

    const dayKey = feedback.createdAt.slice(0, 10);
    const trend = trendByDay.get(dayKey) ?? {
      date: dayKey,
      tooSoft: 0,
      balanced: 0,
      tooHarsh: 0,
      total: 0,
    };

    if (feedback.toneAccuracy === "too_soft") {
      trend.tooSoft += 1;
    } else if (feedback.toneAccuracy === "too_harsh") {
      trend.tooHarsh += 1;
    } else {
      trend.balanced += 1;
    }
    trend.total += 1;
    trendByDay.set(dayKey, trend);
  }

  const topErrors = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason} (${count})`);
  const topHostnames = [...hostnameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([host, count]) => `${host} (${count})`);
  const roastSuccesses = eventsByName.roast_success;
  const scoreAccuracyByBucket: AnalyticsSummary["feedback"]["scoreAccuracyByBucket"] = {
    under4: {
      avgAccuracy:
        scoreAccuracyByBucketRaw.under4.count > 0
          ? Math.round(
              (scoreAccuracyByBucketRaw.under4.sum /
                scoreAccuracyByBucketRaw.under4.count) *
                10,
            ) / 10
          : 0,
      count: scoreAccuracyByBucketRaw.under4.count,
    },
    from4to6: {
      avgAccuracy:
        scoreAccuracyByBucketRaw.from4to6.count > 0
          ? Math.round(
              (scoreAccuracyByBucketRaw.from4to6.sum /
                scoreAccuracyByBucketRaw.from4to6.count) *
                10,
            ) / 10
          : 0,
      count: scoreAccuracyByBucketRaw.from4to6.count,
    },
    from6to8: {
      avgAccuracy:
        scoreAccuracyByBucketRaw.from6to8.count > 0
          ? Math.round(
              (scoreAccuracyByBucketRaw.from6to8.sum /
                scoreAccuracyByBucketRaw.from6to8.count) *
                10,
            ) / 10
          : 0,
      count: scoreAccuracyByBucketRaw.from6to8.count,
    },
    above8: {
      avgAccuracy:
        scoreAccuracyByBucketRaw.above8.count > 0
          ? Math.round(
              (scoreAccuracyByBucketRaw.above8.sum /
                scoreAccuracyByBucketRaw.above8.count) *
                10,
            ) / 10
          : 0,
      count: scoreAccuracyByBucketRaw.above8.count,
    },
  };

  const mostMiscalibratedDomains = [...domainAccuracy.entries()]
    .map(([domain, value]) => ({
      domain,
      avgAccuracy: value.sum / value.count,
      count: value.count,
    }))
    .filter((item) => item.count >= 1)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy || b.count - a.count)
    .slice(0, 8)
    .map(
      (item) =>
        `${item.domain} (avg ${Math.round(item.avgAccuracy * 10) / 10}/5, n=${item.count})`,
    );

  const harshnessTrend = [...trendByDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-21);

  return {
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    uniqueSessions: sessionIds.size,
    eventsByName,
    variants,
    funnel: {
      landingViews: eventsByName.landing_view,
      submits: eventsByName.roast_submit,
      successes: eventsByName.roast_success,
      resultViews: eventsByName.result_view,
      submitToSuccessRate: percent(eventsByName.roast_success, eventsByName.roast_submit),
      successToResultViewRate: percent(eventsByName.result_view, eventsByName.roast_success),
      landingToSubmitRate: percent(eventsByName.roast_submit, eventsByName.landing_view),
    },
    quality: {
      roastSuccesses,
      avgConfidence:
        confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 10) / 10 : 0,
      confidenceBuckets,
      scrapeQuality,
      cacheHitRate: percent(cachedCount, roastSuccesses),
      relaxedFallbackRate: percent(relaxedFallbackCount, roastSuccesses),
      retryRate: percent(retryCount, roastSuccesses),
    },
    feedback: {
      total: feedbackEntries.length,
      avgScoreAccuracy:
        feedbackEntries.length > 0
          ? Math.round((feedbackAccuracySum / feedbackEntries.length) * 10) / 10
          : 0,
      scoreAccuracyByBucket,
      toneBreakdown,
      mostMiscalibratedDomains,
      harshnessTrend,
    },
    topHostnames,
    topErrors,
  };
}
