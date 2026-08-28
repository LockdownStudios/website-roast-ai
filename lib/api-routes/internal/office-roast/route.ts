import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken } from "@/lib/auth";
import { generateRoastWithUsage } from "@/lib/ai";
import {
  createFreeTeaserAccess,
  createUnlockedAccess,
  getRoastAccess,
  withRoastAccess,
} from "@/lib/reportAccess";
import { createScrapeHash, ROAST_ENGINE_VERSION } from "@/lib/fingerprint";
import { scrapeWebsite } from "@/lib/scrape";
import { scoreWebsite } from "@/lib/scoring";
import {
  findRoastByUrlAndHash,
  saveRoastResult,
} from "@/lib/store";
import { analyzeVisualSignals } from "@/lib/visual";
import type {
  ScrapedWebsiteData,
  StoredRoastReport,
  WebsiteScoring,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getOfficeRoastSecret(): string | null {
  const value = process.env.OFFICE_ROAST_API_SECRET?.trim();
  return value ? value : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^127\.|^10\.|^0\.|^169\.254\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;

  return false;
}

function normalizePublicUrl(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2000) {
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
    if (isBlockedHost(parsed.hostname)) {
      return null;
    }
    parsed.hash = "";
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

function withScoringMeta(
  report: StoredRoastReport,
  freshness: "fresh" | "cached",
): WebsiteScoring {
  const sourcePageCount = report.scraped.crawl?.pageCount ?? 1;
  const crawlStrategy =
    report.scraped.crawl?.strategy ??
    (sourcePageCount > 1 ? "multi_page" : "single_page");

  return {
    ...report.scoring,
    analysisMeta: {
      engineVersion:
        report.scoring.analysisMeta?.engineVersion ?? ROAST_ENGINE_VERSION,
      generatedAt:
        report.scoring.analysisMeta?.generatedAt ?? report.createdAt,
      freshness,
      sourcePageCount:
        report.scoring.analysisMeta?.sourcePageCount ?? sourcePageCount,
      crawlStrategy:
        report.scoring.analysisMeta?.crawlStrategy ?? crawlStrategy,
    },
  };
}

function toOfficePayload(input: {
  report: StoredRoastReport;
  freshness: "fresh" | "cached";
  aiUsed: boolean;
  fallbackUsed: boolean;
  siteUrl: string;
  generationError?: string;
}) {
  const scoring = withScoringMeta(input.report, input.freshness);
  const access = createUnlockedAccess(getRoastAccess(input.report.roast), "office");

  return {
    id: input.report.id,
    url: input.report.url,
    reportUrl: new URL(`/result/${input.report.id}`, input.siteUrl).toString(),
    cached: input.freshness === "cached",
    unlocked: true,
    aiUsed: input.aiUsed,
    fallbackUsed: input.fallbackUsed,
    generationError: input.generationError,
    source: "web-roast",
    scoring,
    roast: withRoastAccess(input.report.roast, access),
    access,
    scrapeMeta: buildScrapeMeta(input.report.scraped, scoring),
  };
}

function unauthorized() {
  return NextResponse.json({ error: "Not authorized." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const expectedSecret = getOfficeRoastSecret();

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "OFFICE_ROAST_API_SECRET is not configured." },
      { status: 503 },
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token || !safeEqual(token, expectedSecret)) {
    return unauthorized();
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      url?: unknown;
    } | null;
    const normalizedUrl = normalizePublicUrl(body?.url);

    if (!normalizedUrl) {
      return NextResponse.json(
        { error: "Invalid public website URL." },
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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;

    if (existing) {
      return NextResponse.json(
        toOfficePayload({
          report: existing,
          freshness: "cached",
          aiUsed: false,
          fallbackUsed: false,
          siteUrl,
        }),
      );
    }

    const generation = await generateRoastWithUsage(scraped, scoring);
    const report: StoredRoastReport = {
      id: crypto.randomUUID(),
      url: normalizedUrl,
      scrapeHash,
      roast: withRoastAccess(generation.roast, createFreeTeaserAccess()),
      scoring,
      scraped,
      createdAt: new Date().toISOString(),
    };

    await saveRoastResult(report);

    return NextResponse.json(
      toOfficePayload({
        report,
        freshness: "fresh",
        aiUsed: generation.aiUsed,
        fallbackUsed: generation.fallbackUsed,
        siteUrl,
        generationError: generation.error,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run the office roast.",
      },
      { status: 500 },
    );
  }
}
