import { buildBusinessProfile, buildCustomerJourneys } from "./businessProfile";
import type { ObservedCta, ScrapedWebsiteData } from "./types";

export function isSecondarySource(url: string): boolean {
  try { return /\/(?:elements|demos?|sample-page|test)(?:\/|$)/i.test(new URL(url).pathname); }
  catch { return false; }
}

export function buildAuditContext(scraped: ScrapedWebsiteData) {
  const pages = scraped.crawl?.pages ?? [];
  const secondaryUrls = new Set(pages.filter(page => page.discoveredFrom === "sitemap" && isSecondarySource(page.url)).map(page => page.url));
  const actions = pages.filter(page => !secondaryUrls.has(page.url)).flatMap(page => page.ctaEvidence ?? []);
  const seen = new Set<string>();
  const observedActions: ObservedCta[] = actions.filter(action => {
    const key = `${action.label.toLowerCase()}|${action.destination || ""}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const journeys = buildCustomerJourneys(scraped).filter(journey => !secondaryUrls.has(journey.sourceUrl));
  return {
    technicalLimitations: scraped.technicalChecks?.filter(check => check.status === "not_tested"),
    profile: buildBusinessProfile(scraped, journeys), journeys, observedActions,
    actionLabels: [...new Set([...observedActions.map(action => action.label), ...scraped.ctas])],
    scope: {
      reviewedPages: pages.length || 1,
      sampled: Boolean(scraped.crawl?.coverage?.truncated),
      staticPages: pages.filter(page => page.extractionMode !== "rendered").map(page => page.url),
      secondaryPages: [...secondaryUrls],
      visualScope: "Captured viewports only. Static HTML does not establish visibility. No booking, payment or form submission was completed.",
    },
  };
}
