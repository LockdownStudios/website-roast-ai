import { createHash } from "node:crypto";
import type { ScrapedWebsiteData } from "./types";

export const ROAST_ENGINE_VERSION = "v28-business-profile-phase-three";

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
    siteFacts: data.siteFacts
      ? {
          companyName: data.siteFacts.companyName
            ? normalizeText(data.siteFacts.companyName)
            : undefined,
          services: data.siteFacts.services.map((fact) => normalizeText(fact.value)),
          productCategories: (data.siteFacts.productCategories ?? []).map((fact) =>
            normalizeText(fact.value),
          ),
          exclusions: (data.siteFacts.exclusions ?? []).map((fact) =>
            normalizeText(fact.value),
          ),
          locations: data.siteFacts.locations.map((fact) => normalizeText(fact.value)),
          copyIssues: data.siteFacts.copyIssues.map((fact) => normalizeText(fact.value)),
          pagesReviewed: data.siteFacts.pagesReviewed
            .map((fact) => normalizeText(fact.value))
            .slice(0, 8),
        }
      : undefined,
    businessProfile: data.businessProfile,
    journeys: data.journeys,
    visualHints: data.visualHints,
    visualAudit: data.visualAudit?.available
      ? {
          summary: data.visualAudit.summary,
          desktopCta: data.visualAudit.desktop?.primaryCtaText,
          mobileCta: data.visualAudit.mobile?.primaryCtaText,
          desktopScreenshot: data.visualAudit.desktop?.screenshotHash,
          mobileScreenshot: data.visualAudit.mobile?.screenshotHash,
          keyPageScreenshots: data.visualAudit.keyPages?.map((page) => ({
            url: normalizeText(page.url),
            hash: page.desktop.screenshotHash,
          })),
        }
      : { available: false },
    crawl: data.crawl
      ? {
          strategy: data.crawl.strategy,
          pageCount: data.crawl.pageCount,
          visitedUrls: data.crawl.visitedUrls.map(normalizeText).slice(0, 6),
          coverage: data.crawl.coverage
            ? {
                discoveredPageCount: data.crawl.coverage.discoveredPageCount,
                attemptedPageCount: data.crawl.coverage.attemptedPageCount,
                reviewedPageCount: data.crawl.coverage.reviewedPageCount,
                selectionMode: data.crawl.coverage.selectionMode,
                truncated: data.crawl.coverage.truncated,
              }
            : undefined,
          pages: data.crawl.pages
            .map((page) => ({
              url: normalizeText(page.url),
              role: page.role,
              title: normalizeText(page.title),
              primaryHeading: page.primaryHeading
                ? normalizeText(page.primaryHeading)
                : undefined,
              contentSnippet: page.contentSnippet
                ? normalizeText(page.contentSnippet)
                : undefined,
              ctas: (page.ctas ?? []).map(normalizeText),
              trustSignals: (page.trustSignals ?? []).map(normalizeText),
              contactSignals: (page.contactSignals ?? []).map(normalizeText),
            }))
            .slice(0, 10),
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
