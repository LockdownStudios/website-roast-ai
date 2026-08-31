import { createHash } from "node:crypto";
import type { ScrapedWebsiteData } from "./types";

export const ROAST_ENGINE_VERSION = "v18-visual-design-split";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function createScrapeHash(data: ScrapedWebsiteData): string {
  const normalized = {
    version: ROAST_ENGINE_VERSION,
    url: normalizeText(data.url),
    title: normalizeText(data.title),
    description: normalizeText(data.description),
    headings: {
      h1: data.headings.h1.map(normalizeText),
      h2: data.headings.h2.map(normalizeText),
    },
    content: normalizeText(data.content).slice(0, 4000),
    ctas: data.ctas.map(normalizeText),
    trustSignals: data.trustSignals.map(normalizeText),
    contactSignals: data.contactSignals.map(normalizeText),
    genericPhrasesFound: data.genericPhrasesFound.map(normalizeText),
    visualHints: data.visualHints,
    crawl: data.crawl
      ? {
          strategy: data.crawl.strategy,
          pageCount: data.crawl.pageCount,
          visitedUrls: data.crawl.visitedUrls.map(normalizeText).slice(0, 6),
        }
      : undefined,
  };

  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

export function createUserScopedScrapeHash(
  scrapeHash: string,
  userId: string,
): string {
  const userHash = createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 24);

  return `${scrapeHash}:user:${userHash}`;
}
