import type {
  LiveCalibrationRun,
  LiveCalibrationSiteInput,
  LiveCalibrationSiteResult,
} from "./types";
import { scrapeWebsite } from "./scrape";
import { scoreWebsite } from "./scoring";

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeSiteInput(site: LiveCalibrationSiteInput): {
  url: string | null;
  expectedScoreRange?: [number, number];
  label?: string;
} {
  if (typeof site === "string") {
    return { url: normalizeUrl(site) };
  }

  const expected: [number, number] | undefined =
    Array.isArray(site.expectedScoreRange) &&
    site.expectedScoreRange.length === 2 &&
    Number.isFinite(site.expectedScoreRange[0]) &&
    Number.isFinite(site.expectedScoreRange[1])
      ? [
          Math.max(0, Math.min(10, site.expectedScoreRange[0])),
          Math.max(0, Math.min(10, site.expectedScoreRange[1])),
        ] as [number, number]
      : undefined;

  return {
    url: normalizeUrl(site.url),
    expectedScoreRange: expected,
    label: typeof site.label === "string" && site.label.trim() ? site.label.trim() : undefined,
  };
}

function toBuckets(scores: number[]): {
  under4: number;
  from4to6: number;
  from6to8: number;
  above8: number;
} {
  return scores.reduce(
    (acc, score) => {
      if (score < 4) acc.under4 += 1;
      else if (score < 6) acc.from4to6 += 1;
      else if (score < 8) acc.from6to8 += 1;
      else acc.above8 += 1;
      return acc;
    },
    { under4: 0, from4to6: 0, from6to8: 0, above8: 0 },
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
  }
  return sorted[middle];
}

function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

export async function runLiveCalibration(
  sites: LiveCalibrationSiteInput[],
  options?: { presetUsed?: boolean },
): Promise<LiveCalibrationRun> {
  const normalized = sites.map(normalizeSiteInput);
  const results: LiveCalibrationSiteResult[] = [];

  for (const site of normalized) {
    if (!site.url) {
      results.push({
        url: "",
        label: site.label,
        ok: false,
        error: "Invalid URL format.",
        expectedScoreRange: site.expectedScoreRange,
      });
      continue;
    }

    try {
      const scraped = await scrapeWebsite(site.url);
      const scoring = scoreWebsite(scraped);
      const expectedPass = site.expectedScoreRange
        ? scoring.score >= site.expectedScoreRange[0] &&
          scoring.score <= site.expectedScoreRange[1]
        : undefined;

      results.push({
        url: site.url,
        label: site.label,
        ok: true,
        expectedScoreRange: site.expectedScoreRange,
        expectedPass,
        score: scoring.score,
        rawScore: scoring.rawScore,
        confidence: scoring.confidence,
        breakdown: scoring.breakdown,
        penalties: scoring.penalties,
        bonuses: scoring.bonuses,
        findings: scoring.findings.slice(0, 8),
        singleBiggestLeak: scoring.singleBiggestLeak,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to scrape or score this site.";
      results.push({
        url: site.url,
        label: site.label,
        ok: false,
        error: message,
        expectedScoreRange: site.expectedScoreRange,
      });
    }
  }

  const successful = results.filter((item) => item.ok && typeof item.score === "number");
  const scores = successful.map((item) => item.score as number);
  const expectedChecks = successful.filter(
    (item) => typeof item.expectedPass === "boolean",
  );
  const expectedPassCount = expectedChecks.filter((item) => item.expectedPass).length;

  return {
    runAt: new Date().toISOString(),
    summary: {
      total: results.length,
      succeeded: successful.length,
      failed: results.length - successful.length,
      averageScore: average(scores),
      medianScore: median(scores),
      minScore: min(scores),
      maxScore: max(scores),
      buckets: toBuckets(scores),
      expectedPassRate:
        expectedChecks.length > 0
          ? Math.round((expectedPassCount / expectedChecks.length) * 1000) / 10
          : undefined,
      presetUsed: Boolean(options?.presetUsed),
    },
    results,
  };
}
