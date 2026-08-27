import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BREAKDOWN_KEYS,
  CATEGORY_WEIGHTS,
  clampToRange,
  getWeakestCategory,
  legacyBreakdownToWeighted,
  roundToOne,
  sumBreakdown,
} from "./scoringConfig";
import type {
  CrawlPageRole,
  CrawlSummary,
  ReportUnlockSource,
  RoastClaim,
  RoastClaimSeverity,
  RoastClaimSource,
  RoastResultPayload,
  ScoreAdjustment,
  ScoreBreakdown,
  ScoringAnalysisMeta,
  ScrapeQuality,
  ScrapedWebsiteData,
  StoredRoastReport,
  VisualAudit,
  VisualSummaryScores,
  VisualViewportMetrics,
  WebsiteScoring,
} from "./types";
import {
  findRoastReportByUrlAndHashFromSupabase,
  getRoastReportsByUserIdFromSupabase,
  getRoastReportByIdFromSupabase,
  isSupabaseConfigured,
  saveRoastReportToSupabase,
} from "./supabase";
import { normalizeRoastAccess } from "./reportAccess";
import { createUnlockedAccess, getRoastAccess, withRoastAccess } from "./reportAccess";

type RoastStoreFile = {
  reports: StoredRoastReport[];
};

const MAX_REPORTS = 200;
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "roasts.json");
const SCORE_LABELS: RoastResultPayload["score_label"][] = [
  "Brutal",
  "Needs Work",
  "Decent but Leaking",
  "Strong Foundation",
  "Conversion Ready",
];

let writeQueue: Promise<void> = Promise.resolve();

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

function toScoreLabel(score: number): RoastResultPayload["score_label"] {
  if (score <= 2.5) return "Brutal";
  if (score <= 4.5) return "Needs Work";
  if (score <= 6.5) return "Decent but Leaking";
  if (score <= 8.5) return "Strong Foundation";
  return "Conversion Ready";
}

function clampInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }

  return Math.round(clampToRange(value, min, max));
}

function clampOne(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return min;
  }

  return roundToOne(clampToRange(value, min, max));
}

function isScoreLabel(value: unknown): value is RoastResultPayload["score_label"] {
  return (
    typeof value === "string" &&
    SCORE_LABELS.includes(value as RoastResultPayload["score_label"])
  );
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCrawlRole(value: unknown): CrawlPageRole {
  if (
    value === "home" ||
    value === "contact" ||
    value === "about" ||
    value === "services" ||
    value === "pricing" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function normalizeCrawl(
  value: unknown,
  fallbackUrl: string,
): CrawlSummary | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<CrawlSummary>;
  const pages = Array.isArray(raw.pages)
    ? raw.pages
        .flatMap((page) => {
          if (!page || typeof page !== "object") {
            return [];
          }
          const parsed = page as Partial<CrawlSummary["pages"][number]>;
          const url =
            typeof parsed.url === "string" && parsed.url.trim()
              ? parsed.url.trim().slice(0, 500)
              : "";
          if (!url) {
            return [];
          }

          return [
            {
              url,
              role: normalizeCrawlRole(parsed.role),
              title:
                typeof parsed.title === "string" && parsed.title.trim()
                  ? parsed.title.trim().slice(0, 180)
                  : "No title found.",
              contentLength: clampInteger(parsed.contentLength, 0, 150000),
              headingCount: clampInteger(parsed.headingCount, 0, 200),
            },
          ];
        })
        .slice(0, 8)
    : [];

  const visitedFromPayload = normalizeStringList(raw.visitedUrls)
    .map((item) => item.slice(0, 500))
    .filter(Boolean)
    .slice(0, 12);

  const visitedUrls = visitedFromPayload.length > 0
    ? visitedFromPayload
    : pages.length > 0
      ? pages.map((page) => page.url)
      : [fallbackUrl];

  const strategy =
    raw.strategy === "multi_page" || raw.strategy === "single_page"
      ? raw.strategy
      : visitedUrls.length > 1
        ? "multi_page"
        : "single_page";

  return {
    strategy,
    pageCount: clampInteger(raw.pageCount ?? visitedUrls.length, 1, 8),
    visitedUrls,
    failedUrls: normalizeStringList(raw.failedUrls)
      .map((item) => item.slice(0, 500))
      .filter(Boolean)
      .slice(0, 8),
    pages,
  };
}

function leakFromBreakdown(breakdown: ScoreBreakdown): string {
  switch (getWeakestCategory(breakdown)) {
    case "clarity":
      return "Your homepage talks, but it does not make a clear offer.";
    case "trust":
      return "You ask people to believe you without giving proof.";
    case "CTA":
      return "Visitors can read your page and still not know what to do next.";
    case "differentiation":
      return "Your copy sounds like everyone else, so buyers keep scrolling.";
    case "design_hint":
      return "Your structure is doing explanation work, not conversion work.";
    default:
      return "The page does not convert intent into action.";
  }
}

function normalizeBreakdown(value: unknown, legacyMode: boolean): ScoreBreakdown {
  if (!value || typeof value !== "object") {
    return {
      clarity: 0,
      trust: 0,
      CTA: 0,
      differentiation: 0,
      design_hint: 0,
    };
  }

  const raw = value as Partial<Record<keyof ScoreBreakdown, unknown>>;
  const candidate: ScoreBreakdown = {
    clarity: clampOne(raw.clarity, 0, CATEGORY_WEIGHTS.clarity),
    trust: clampOne(raw.trust, 0, CATEGORY_WEIGHTS.trust),
    CTA: clampOne(raw.CTA, 0, CATEGORY_WEIGHTS.CTA),
    differentiation: clampOne(raw.differentiation, 0, CATEGORY_WEIGHTS.differentiation),
    design_hint: clampOne(raw.design_hint, 0, CATEGORY_WEIGHTS.design_hint),
  };

  if (!legacyMode) {
    return candidate;
  }

  const looksLegacy = BREAKDOWN_KEYS.every((key) => candidate[key] <= 2);
  return looksLegacy ? legacyBreakdownToWeighted(candidate) : candidate;
}

function normalizeHeadings(value: unknown): ScrapedWebsiteData["headings"] {
  if (Array.isArray(value)) {
    return {
      h1: normalizeStringList(value).slice(0, 12),
      h2: [],
    };
  }

  if (!value || typeof value !== "object") {
    return {
      h1: [],
      h2: [],
    };
  }

  const raw = value as Partial<ScrapedWebsiteData["headings"]>;
  return {
    h1: normalizeStringList(raw.h1).slice(0, 12),
    h2: normalizeStringList(raw.h2).slice(0, 20),
  };
}

function inferScrapeQuality(contentLength: number): ScrapeQuality {
  if (contentLength >= 1200) {
    return "high";
  }
  if (contentLength >= 350) {
    return "medium";
  }
  return "low";
}

function normalizeVisualViewport(
  value: unknown,
  viewport: VisualViewportMetrics["viewport"],
): VisualViewportMetrics | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<VisualViewportMetrics>;

  const width = clampInteger(raw.width, 200, 3000);
  const height = clampInteger(raw.height, 200, 3000);
  const sampledElementCount = clampInteger(raw.sampledElementCount, 0, 5000);
  const aboveFoldElementCount = clampInteger(raw.aboveFoldElementCount, 0, 5000);

  return {
    viewport,
    width,
    height,
    sampledElementCount,
    aboveFoldElementCount,
    ctaCount: clampInteger(raw.ctaCount, 0, 200),
    primaryCtaText:
      typeof raw.primaryCtaText === "string" && raw.primaryCtaText.trim()
        ? raw.primaryCtaText.trim().slice(0, 120)
        : undefined,
    primaryCtaAboveFold: Boolean(raw.primaryCtaAboveFold),
    primaryCtaContrast: clampOne(raw.primaryCtaContrast, 0, 21),
    primaryCtaAreaRatio: clampOne(raw.primaryCtaAreaRatio, 0, 1),
    averageTextContrast: clampOne(raw.averageTextContrast, 0, 21),
    lowContrastTextShare: clampOne(raw.lowContrastTextShare, 0, 1),
    averageFontSize: clampOne(raw.averageFontSize, 0, 80),
    headingCountAboveFold: clampInteger(raw.headingCountAboveFold, 0, 100),
    uniqueColorBuckets: clampInteger(raw.uniqueColorBuckets, 0, 256),
    uniqueFontFamilies: clampInteger(raw.uniqueFontFamilies, 0, 40),
    animatedElementShare: clampOne(raw.animatedElementShare, 0, 1),
    autoplayMediaCount: clampInteger(raw.autoplayMediaCount, 0, 50),
  };
}

function normalizeVisualSummary(value: unknown): VisualSummaryScores | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<VisualSummaryScores>;

  return {
    ctaProminence: clampInteger(raw.ctaProminence, 0, 100),
    readability: clampInteger(raw.readability, 0, 100),
    hierarchy: clampInteger(raw.hierarchy, 0, 100),
    consistency: clampInteger(raw.consistency, 0, 100),
    motionDistraction: clampInteger(raw.motionDistraction, 0, 100),
  };
}

function normalizeVisualAudit(value: unknown): VisualAudit | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<VisualAudit>;
  const available = Boolean(raw.available);
  const desktop = normalizeVisualViewport(raw.desktop, "desktop");
  const mobile = normalizeVisualViewport(raw.mobile, "mobile");

  return {
    available,
    sampledAt:
      typeof raw.sampledAt === "string" && raw.sampledAt.trim()
        ? raw.sampledAt
        : new Date(0).toISOString(),
    reason:
      typeof raw.reason === "string" && raw.reason.trim()
        ? raw.reason.trim().slice(0, 400)
        : undefined,
    desktop,
    mobile,
    summary: normalizeVisualSummary(raw.summary),
    findings: normalizeStringList(raw.findings).slice(0, 12),
    evidence: normalizeStringList(raw.evidence).slice(0, 12),
  };
}

function normalizeScraped(
  scraped: unknown,
  fallbackUrl: string,
): ScrapedWebsiteData | null {
  if (!scraped || typeof scraped !== "object") {
    return null;
  }

  const value = scraped as Partial<ScrapedWebsiteData> & {
    headings?: unknown;
    visualHints?: Partial<ScrapedWebsiteData["visualHints"]>;
    visualAudit?: unknown;
  };
  const headings = normalizeHeadings(value.headings);
  const content = typeof value.content === "string" ? value.content : "";
  const normalizedUrl =
    typeof value.url === "string" && value.url.trim() ? value.url : fallbackUrl;
  const contentLength =
    typeof value.contentLength === "number" && Number.isFinite(value.contentLength)
      ? clampInteger(value.contentLength, 0, 120000)
      : content.length;
  const ctas = normalizeStringList(value.ctas);
  const trustSignals = normalizeStringList(value.trustSignals);
  const crawl = normalizeCrawl(value.crawl, normalizedUrl);

  return {
    url: normalizedUrl,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title
        : "No title found.",
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description
        : "No meta description found.",
    headings,
    content,
    contentSnippet:
      typeof value.contentSnippet === "string" && value.contentSnippet.trim()
        ? value.contentSnippet
        : content.slice(0, 1500),
    ctas,
    trustSignals,
    contactSignals: normalizeStringList(value.contactSignals),
    genericPhrasesFound: normalizeStringList(value.genericPhrasesFound),
    visualHints: {
      aboveFoldCtaLikely:
        typeof value.visualHints?.aboveFoldCtaLikely === "boolean"
          ? value.visualHints.aboveFoldCtaLikely
          : ctas.length > 0,
      heroHeadingEarly:
        typeof value.visualHints?.heroHeadingEarly === "boolean"
          ? value.visualHints.heroHeadingEarly
          : headings.h1.length > 0,
      formAboveFoldLikely:
        typeof value.visualHints?.formAboveFoldLikely === "boolean"
          ? value.visualHints.formAboveFoldLikely
          : false,
      trustTokenAboveFold:
        typeof value.visualHints?.trustTokenAboveFold === "boolean"
          ? value.visualHints.trustTokenAboveFold
          : trustSignals.length > 0,
      buttonCount: clampInteger(value.visualHints?.buttonCount, 0, 500),
      linkCount: clampInteger(value.visualHints?.linkCount, 0, 3000),
    },
    visualAudit: normalizeVisualAudit(value.visualAudit),
    crawl,
    contentLength,
    retryUsed: Boolean(value.retryUsed),
    usedRelaxedFallback: Boolean(value.usedRelaxedFallback),
    scrapeQuality:
      value.scrapeQuality === "high" ||
      value.scrapeQuality === "medium" ||
      value.scrapeQuality === "low"
        ? value.scrapeQuality
        : inferScrapeQuality(contentLength),
  };
}

function normalizeAdjustments(value: unknown): ScoreAdjustment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const raw = item as Partial<ScoreAdjustment>;
      const label =
        typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : null;
      const reason =
        typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : null;
      const points =
        typeof raw.points === "number" && Number.isFinite(raw.points)
          ? Math.max(0, Math.round(raw.points))
          : null;

      if (!label || !reason || points === null) {
        return [];
      }

      return [{ label, reason, points }];
    })
    .slice(0, 12);
}

function normalizeClaimSource(value: unknown): RoastClaimSource {
  if (
    value === "title" ||
    value === "meta" ||
    value === "h1" ||
    value === "h2" ||
    value === "content" ||
    value === "cta" ||
    value === "trust" ||
    value === "contact" ||
    value === "visual" ||
    value === "crawl" ||
    value === "scoring"
  ) {
    return value;
  }
  return "content";
}

function normalizeClaimSeverity(value: unknown): RoastClaimSeverity {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

function normalizeClaimContract(value: unknown): RoastClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const raw = item as Partial<RoastClaim>;
      const claim =
        typeof raw.claim === "string" && raw.claim.trim()
          ? raw.claim.trim().slice(0, 240)
          : null;
      const evidence =
        typeof raw.evidence === "string" && raw.evidence.trim()
          ? raw.evidence.trim().slice(0, 220)
          : null;
      if (!claim || !evidence) {
        return [];
      }

      return [
        {
          claim,
          evidence,
          source: normalizeClaimSource(raw.source),
          severity: normalizeClaimSeverity(raw.severity),
        } satisfies RoastClaim,
      ];
    })
    .slice(0, 10);
}

function normalizeAnalysisMeta(
  value: unknown,
  fallbackSourcePageCount: number,
): ScoringAnalysisMeta | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<ScoringAnalysisMeta>;
  const engineVersion =
    typeof raw.engineVersion === "string" && raw.engineVersion.trim()
      ? raw.engineVersion.trim().slice(0, 80)
      : null;
  const generatedAt =
    typeof raw.generatedAt === "string" && raw.generatedAt.trim()
      ? raw.generatedAt
      : new Date(0).toISOString();
  const freshness = raw.freshness === "cached" ? "cached" : "fresh";
  const sourcePageCount = clampInteger(
    raw.sourcePageCount ?? fallbackSourcePageCount,
    1,
    8,
  );
  const crawlStrategy = raw.crawlStrategy === "multi_page"
    ? "multi_page"
    : "single_page";

  if (!engineVersion) {
    return undefined;
  }

  return {
    engineVersion,
    generatedAt,
    freshness,
    sourcePageCount,
    crawlStrategy,
  };
}

function normalizeRoast(roast: unknown): RoastResultPayload | null {
  if (!roast || typeof roast !== "object") {
    return null;
  }

  const value = roast as Partial<RoastResultPayload>;
  const numericScore = clampOne(value.score, 0, 10);
  const mistakes = normalizeStringList(value.mistakes);
  const quickFixes = normalizeStringList(value.quick_fixes);
  const evidence = normalizeStringList(value.evidence);
  const claimContract = normalizeClaimContract(value.claim_contract);
  const leak =
    typeof value.single_biggest_leak === "string" && value.single_biggest_leak.trim()
      ? value.single_biggest_leak.trim()
      : "The page does not convert intent into action.";

  return {
    score: numericScore,
    score_label: isScoreLabel(value.score_label)
      ? value.score_label
      : toScoreLabel(numericScore),
    first_impression:
      typeof value.first_impression === "string" && value.first_impression.trim()
        ? value.first_impression.trim()
        : "The page does not clearly communicate value in its current form.",
    single_biggest_leak: leak,
    mistakes:
      mistakes.length > 0
        ? mistakes
        : ["The current messaging is weak and undercutting conversion intent."],
    lost_customers:
      typeof value.lost_customers === "string" && value.lost_customers.trim()
        ? value.lost_customers.trim()
        : "Buyers are likely bouncing due to weak clarity, trust, or next-step direction.",
    quick_fixes:
      quickFixes.length > 0
        ? quickFixes
        : ["Add one clear outcome-led CTA and supporting proof above the fold."],
    high_impact:
      typeof value.high_impact === "string" && value.high_impact.trim()
        ? value.high_impact.trim()
        : "Clarify the offer and show evidence before asking for action.",
    tone_summary:
      typeof value.tone_summary === "string" && value.tone_summary.trim()
        ? value.tone_summary.trim()
        : "The message exists, but the pitch is soft.",
    evidence:
      evidence.length > 0
        ? evidence
        : ["No detailed evidence captured in this report version."],
    claim_contract: claimContract.length > 0 ? claimContract : undefined,
    access: normalizeRoastAccess(value.access),
  };
}

function fallbackScoring(
  score: number,
  singleBiggestLeak: string,
): WebsiteScoring {
  const breakdown: ScoreBreakdown = {
    clarity: 0,
    trust: 0,
    CTA: 0,
    differentiation: 0,
    design_hint: 0,
  };

  return {
    score: clampOne(score, 0, 10),
    rawScore: clampOne(score, 0, 10) * 10,
    confidence: 40,
    analysisMeta: {
      engineVersion: "legacy-report",
      generatedAt: new Date(0).toISOString(),
      freshness: "cached",
      sourcePageCount: 1,
      crawlStrategy: "single_page",
    },
    breakdown,
    findings: ["Scoring details unavailable for this legacy report."],
    evidence: ["No scoring evidence available for this legacy report."],
    penalties: [],
    bonuses: [],
    singleBiggestLeak: singleBiggestLeak || leakFromBreakdown(breakdown),
  };
}

function normalizeScoring(
  scoring: unknown,
  fallbackScore: number,
  fallbackLeak: string,
  fallbackSourcePageCount: number,
): WebsiteScoring {
  if (!scoring || typeof scoring !== "object") {
    return fallbackScoring(fallbackScore, fallbackLeak);
  }

  const value = scoring as Partial<WebsiteScoring>;
  const hasRawScore = typeof value.rawScore === "number" && Number.isFinite(value.rawScore);
  const hasConfidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence);
  const hasAdjustments =
    Array.isArray(value.penalties) || Array.isArray(value.bonuses);
  const legacyMode = !hasRawScore && !hasConfidence && !hasAdjustments;
  const breakdown = normalizeBreakdown(value.breakdown, legacyMode);
  const breakdownSum = roundToOne(sumBreakdown(breakdown));

  let rawScore =
    typeof value.rawScore === "number" && Number.isFinite(value.rawScore)
      ? clampOne(value.rawScore, 0, 100)
      : clampOne(fallbackScore * 10, 0, 100);

  const hasScore = typeof value.score === "number" && Number.isFinite(value.score);

  if (!hasRawScore && hasScore) {
    rawScore = clampOne((value.score as number) * 10, 0, 100);
  }

  if (!hasRawScore && !hasScore && breakdownSum > 0) {
    rawScore = clampOne(breakdownSum, 0, 100);
  }

  let score =
    typeof value.score === "number" && Number.isFinite(value.score)
      ? clampOne(value.score, 0, 10)
      : roundToOne(rawScore / 10);

  if (!hasScore && rawScore > 0) {
    score = roundToOne(rawScore / 10);
  }

  const findings = normalizeStringList(value.findings);
  const evidence = normalizeStringList(value.evidence);
  const penalties = normalizeAdjustments(value.penalties);
  const bonuses = normalizeAdjustments(value.bonuses);
  const analysisMeta = normalizeAnalysisMeta(
    value.analysisMeta,
    fallbackSourcePageCount,
  );
  const singleBiggestLeak =
    typeof value.singleBiggestLeak === "string" && value.singleBiggestLeak.trim()
      ? value.singleBiggestLeak.trim()
      : fallbackLeak || leakFromBreakdown(breakdown);
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? clampInteger(value.confidence, 20, 100)
      : 60;

  return {
    score,
    rawScore,
    confidence,
    analysisMeta,
    breakdown,
    findings:
      findings.length > 0
        ? findings
        : ["Scoring details unavailable for this legacy report."],
    evidence:
      evidence.length > 0
        ? evidence
        : ["No scoring evidence available for this legacy report."],
    penalties,
    bonuses,
    singleBiggestLeak,
  };
}

function parseReport(report: unknown): StoredRoastReport | null {
  if (!report || typeof report !== "object") {
    return null;
  }

  const value = report as Partial<StoredRoastReport>;
  const normalizedRoast = normalizeRoast(value.roast);
  const normalizedScraped = normalizeScraped(value.scraped, value.url ?? "");

  if (
    typeof value.id !== "string" ||
    typeof value.url !== "string" ||
    typeof value.createdAt !== "string" ||
    !normalizedScraped ||
    !normalizedRoast
  ) {
    return null;
  }

  const normalizedScoring = normalizeScoring(
    value.scoring,
    normalizedRoast.score,
    normalizedRoast.single_biggest_leak,
    normalizedScraped.crawl?.pageCount ?? 1,
  );

  return {
    id: value.id,
    url: value.url,
    userId:
      typeof value.userId === "string" && value.userId.trim()
        ? value.userId.trim()
        : undefined,
    createdAt: value.createdAt,
    scrapeHash: typeof value.scrapeHash === "string" ? value.scrapeHash : "",
    scraped: normalizedScraped,
    scoring: normalizedScoring,
    roast: normalizedRoast,
  };
}

async function readStoreFile(): Promise<RoastStoreFile> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<RoastStoreFile>;
    if (!Array.isArray(parsed.reports)) {
      return { reports: [] };
    }

    return {
      reports: parsed.reports.flatMap((report) => {
        const parsedReport = parseReport(report);
        return parsedReport ? [parsedReport] : [];
      }),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { reports: [] };
    }

    throw error;
  }
}

async function writeStoreFile(data: RoastStoreFile): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function saveRoastResult(report: StoredRoastReport): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    if (isSupabaseConfigured()) {
      const savedRemote = await saveRoastReportToSupabase(report);
      if (savedRemote) {
        return;
      }

      if (isVercelRuntime()) {
        throw new Error("Failed to save report to Supabase.");
      }
    } else if (isVercelRuntime()) {
      throw new Error("Supabase must be configured for report persistence on Vercel.");
    }

    const current = await readStoreFile();
    const nextReports = [
      report,
      ...current.reports.filter((item) => item.id !== report.id),
    ].slice(0, MAX_REPORTS);

    await writeStoreFile({ reports: nextReports });
  });

  await writeQueue;
}

export async function getRoastResult(id: string): Promise<StoredRoastReport | null> {
  await writeQueue.catch(() => undefined);

  if (isSupabaseConfigured()) {
    const remote = await getRoastReportByIdFromSupabase(id);
    const parsedRemote = parseReport(remote);
    if (parsedRemote) {
      return parsedRemote;
    }
  }

  const current = await readStoreFile();
  return current.reports.find((item) => item.id === id) ?? null;
}

export async function findRoastByUrlAndHash(
  url: string,
  scrapeHash: string,
): Promise<StoredRoastReport | null> {
  await writeQueue.catch(() => undefined);

  if (isSupabaseConfigured()) {
    const remote = await findRoastReportByUrlAndHashFromSupabase(url, scrapeHash);
    const parsedRemote = parseReport(remote);
    if (parsedRemote) {
      return parsedRemote;
    }
  }

  const current = await readStoreFile();
  return (
    current.reports.find(
      (item) => item.url === url && item.scrapeHash === scrapeHash,
    ) ?? null
  );
}

export async function getRoastResultsByUserId(
  userId: string,
  limit = 100,
): Promise<StoredRoastReport[]> {
  await writeQueue.catch(() => undefined);

  const current = await readStoreFile();
  const localUserReports = current.reports.filter((item) => item.userId === userId);

  if (isSupabaseConfigured()) {
    const remote = await getRoastReportsByUserIdFromSupabase(userId, limit);
    if (remote) {
      const remoteReports = remote.flatMap((row) => {
        const parsed = parseReport(row);
        return parsed ? [parsed] : [];
      });

      if (remoteReports.length > 0) {
        const remoteIds = new Set(remoteReports.map((report) => report.id));
        const merged = [
          ...remoteReports,
          ...localUserReports.filter((report) => !remoteIds.has(report.id)),
        ];
        return merged.slice(0, limit);
      }
    }
  }

  return localUserReports.slice(0, limit);
}

export async function unlockRoastResult(
  reportId: string,
  source: ReportUnlockSource,
): Promise<StoredRoastReport | null> {
  const report = await getRoastResult(reportId);
  if (!report) {
    return null;
  }

  const currentAccess = getRoastAccess(report.roast);
  if (currentAccess.tier === "full_unlocked") {
    return report;
  }

  const unlocked = {
    ...report,
    roast: withRoastAccess(report.roast, createUnlockedAccess(currentAccess, source)),
  };
  await saveRoastResult(unlocked);
  return unlocked;
}
