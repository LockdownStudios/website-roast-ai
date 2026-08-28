import { NextRequest, NextResponse } from "next/server";
import { generateRoast } from "@/lib/ai";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { buildTeaserRoast, createFreeTeaserAccess, getRoastAccess, isRoastUnlocked, withRoastAccess } from "@/lib/reportAccess";
import { scrapeWebsite } from "@/lib/scrape";
import { scoreWebsite } from "@/lib/scoring";
import { analyzeVisualSignals } from "@/lib/visual";
import {
  findRoastByUrlAndHash,
  getRoastResult,
  saveRoastResult,
} from "@/lib/store";
import {
  createScrapeHash,
  createUserScopedScrapeHash,
  ROAST_ENGINE_VERSION,
} from "@/lib/fingerprint";
import {
  sanitizeRoastPayload,
  sanitizeWebsiteScoring,
} from "@/lib/reportSanitizer";
import { clientIpFromHeaders, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import type { ScrapedWebsiteData, StoredRoastReport, WebsiteScoring } from "@/lib/types";

export const dynamic = "force-dynamic";

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

function buildScrapeMeta(scraped: ScrapedWebsiteData, scoring: WebsiteScoring) {
  return {
    quality: scraped.scrapeQuality,
    retryUsed: scraped.retryUsed,
    usedRelaxedFallback: scraped.usedRelaxedFallback,
    contentLength: scraped.contentLength,
    confidence: scoring.confidence,
    sourcePageCount: scraped.crawl?.pageCount ?? 1,
    crawlStrategy: scraped.crawl?.strategy ?? "single_page",
  };
}

function isWebsiteFetchError(message: string) {
  return message.toLowerCase().includes("could not fetch website content");
}

function toClientRoastError(message: string) {
  if (/enotfound|getaddrinfo/i.test(message)) {
    return "That domain could not be found. Check the spelling, or try the live website URL with the right .com or .co.za ending.";
  }

  const httpStatus = message.match(/HTTP\s+(\d{3})/i)?.[1];
  if (httpStatus) {
    return `That website rejected the scan with HTTP ${httpStatus}. Try the full homepage URL or another public page.`;
  }

  if (isWebsiteFetchError(message)) {
    return "Could not fetch that website. Check the URL and try again.";
  }

  return message;
}

function toClientReportPayload(
  report: StoredRoastReport,
  freshness: "fresh" | "cached",
  options: { authExpired?: boolean } = {},
) {
  const unlocked = isRoastUnlocked(report.roast);
  const roast = unlocked ? report.roast : buildTeaserRoast(report.roast);
  const fallbackSourcePageCount = report.scraped.crawl?.pageCount ?? 1;
  const fallbackCrawlStrategy =
    report.scraped.crawl?.strategy ?? (fallbackSourcePageCount > 1 ? "multi_page" : "single_page");
  const scoringWithMeta = {
    ...report.scoring,
    analysisMeta: {
      engineVersion:
        report.scoring.analysisMeta?.engineVersion ?? ROAST_ENGINE_VERSION,
      generatedAt:
        report.scoring.analysisMeta?.generatedAt ?? report.createdAt,
      freshness,
      sourcePageCount:
        report.scoring.analysisMeta?.sourcePageCount ?? fallbackSourcePageCount,
      crawlStrategy:
        report.scoring.analysisMeta?.crawlStrategy ?? fallbackCrawlStrategy,
    },
  };

  const safeRoast = sanitizeRoastPayload(roast);
  const scoring = unlocked
    ? scoringWithMeta
    : {
        ...scoringWithMeta,
        findings: scoringWithMeta.findings.slice(0, 3),
        evidence: [],
        penalties: [],
        bonuses: [],
      };
  const safeScoring = sanitizeWebsiteScoring(scoring);

  return {
    id: report.id,
    url: report.url,
    scoring: safeScoring,
    roast: safeRoast,
    access: getRoastAccess(report.roast),
    unlocked,
    authExpired: options.authExpired ? true : undefined,
    scrapeMeta: buildScrapeMeta(report.scraped, safeScoring),
  };
}

export async function POST(request: NextRequest) {
  const rate = rateLimit(`public-roast:${clientIpFromHeaders(request.headers)}`, {
    limit: 8,
    windowMs: 60_000,
  });

  if (rate.limited) {
    return NextResponse.json(
      { error: "Too many roast requests. Give it a minute and try again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }

  try {
    const body = (await request.json()) as { url?: string };
    const normalizedUrl = normalizeUrl(body.url ?? "");
    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await getSupabaseUserFromAccessToken(token) : null;
    const authExpired = Boolean(token && !user);
    const userId = user?.id;

    if (!normalizedUrl) {
      return NextResponse.json(
        { error: "Invalid URL. Use a full website URL." },
        { status: 400 },
      );
    }

    const scrapedBase = await scrapeWebsite(normalizedUrl);
    const visualAudit = await analyzeVisualSignals(normalizedUrl);
    const scraped = {
      ...scrapedBase,
      visualAudit,
    };
    const scoring = scoreWebsite(scraped);
    const scrapeHash = createScrapeHash(scraped);
    const userScopedScrapeHash = userId
      ? createUserScopedScrapeHash(scrapeHash, userId)
      : null;
    const existing =
      (userScopedScrapeHash
        ? await findRoastByUrlAndHash(normalizedUrl, userScopedScrapeHash)
        : null) ?? (await findRoastByUrlAndHash(normalizedUrl, scrapeHash));

    if (existing) {
      const existingWithAccess = existing.roast.access
        ? existing
        : {
            ...existing,
            roast: withRoastAccess(existing.roast, getRoastAccess(existing.roast)),
          };
      const needsOwnershipClone = Boolean(userId) && existing.userId !== userId;
      const report = needsOwnershipClone
        ? {
            ...existingWithAccess,
            id: crypto.randomUUID(),
            scrapeHash: userScopedScrapeHash ?? scrapeHash,
            userId,
            roast: withRoastAccess(
              existingWithAccess.roast,
              createFreeTeaserAccess(
                getRoastAccess(existingWithAccess.roast).priceZar,
              ),
            ),
            createdAt: new Date().toISOString(),
          }
        : existingWithAccess;

      // Backfill cached/local reports into Supabase when configured.
      if (needsOwnershipClone || !existing.roast.access) {
        await saveRoastResult(report);
      }

      return NextResponse.json({
        cached: true,
        ...toClientReportPayload(report, "cached", { authExpired }),
      });
    }

    const roast = withRoastAccess(
      await generateRoast(scraped, scoring),
      createFreeTeaserAccess(),
    );
    const id = crypto.randomUUID();

    const report = {
      id,
      url: normalizedUrl,
      userId,
      scrapeHash: userScopedScrapeHash ?? scrapeHash,
      roast,
      scoring,
      scraped,
      createdAt: new Date().toISOString(),
    };
    await saveRoastResult(report);

    return NextResponse.json(toClientReportPayload(report, "fresh", { authExpired }));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to roast this website. Try another URL.";
    const status = isWebsiteFetchError(message) ? 400 : 500;
    const clientMessage = toClientRoastError(message);

    console.error("[api/roast] failed", {
      message,
      status,
    });

    return NextResponse.json({ error: clientMessage }, { status });
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing report id." }, { status: 400 });
  }

  const result = await getRoastResult(id);
  if (!result) {
    return NextResponse.json(
      { error: "Roast report not found. Generate a new one." },
      { status: 404 },
    );
  }

  return NextResponse.json(toClientReportPayload(result, "cached"));
}
