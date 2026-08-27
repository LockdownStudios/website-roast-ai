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
import { createScrapeHash, ROAST_ENGINE_VERSION } from "@/lib/fingerprint";
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

function toClientReportPayload(
  report: StoredRoastReport,
  freshness: "fresh" | "cached",
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

  const scoring = unlocked
    ? scoringWithMeta
    : {
        ...scoringWithMeta,
        findings: scoringWithMeta.findings.slice(0, 3),
        evidence: [],
        penalties: [],
        bonuses: [],
      };
  return {
    id: report.id,
    url: report.url,
    scoring,
    roast,
    access: getRoastAccess(report.roast),
    unlocked,
    scrapeMeta: buildScrapeMeta(report.scraped, scoringWithMeta),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const normalizedUrl = normalizeUrl(body.url ?? "");
    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await getSupabaseUserFromAccessToken(token) : null;
    if (token && !user) {
      return NextResponse.json(
        { error: "Your login session expired. Sign in again to save reports." },
        { status: 401 },
      );
    }
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
    const existing = await findRoastByUrlAndHash(normalizedUrl, scrapeHash);

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
            userId,
            createdAt: new Date().toISOString(),
          }
        : existingWithAccess;

      // Backfill cached/local reports into Supabase when configured.
      await saveRoastResult(report);

      return NextResponse.json({
        cached: true,
        ...toClientReportPayload(report, "cached"),
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
      scrapeHash,
      roast,
      scoring,
      scraped,
      createdAt: new Date().toISOString(),
    };
    await saveRoastResult(report);

    return NextResponse.json(toClientReportPayload(report, "fresh"));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to roast this website. Try another URL.";

    return NextResponse.json({ error: message }, { status: 500 });
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
