import { buildBusinessProfile, buildCustomerJourneys } from "../lib/businessProfile";
import { diagnoseWebsite } from "../lib/diagnosis";
import { withoutVisualImageData } from "../lib/visual";
import type { ScrapedWebsiteData, WebsiteScoring } from "../lib/types";

function scraped(overrides: Partial<ScrapedWebsiteData>): ScrapedWebsiteData {
  return {
    url: "https://example.test/",
    title: "Example Company",
    description: "A real business website.",
    headings: { h1: ["Example Company"], h2: [] },
    content: "A real business website with clear information.",
    contentSnippet: "A real business website with clear information.",
    ctas: [],
    trustSignals: [],
    contactSignals: [],
    genericPhrasesFound: [],
    visualHints: {
      aboveFoldCtaLikely: true,
      heroHeadingEarly: true,
      formAboveFoldLikely: false,
      trustTokenAboveFold: false,
      buttonCount: 2,
      linkCount: 8,
    },
    contentLength: 52,
    retryUsed: false,
    usedRelaxedFallback: false,
    scrapeQuality: "high",
    ...overrides,
  };
}

const scoring: WebsiteScoring = {
  score: 7,
  rawScore: 7,
  confidence: 80,
  breakdown: { clarity: 20, trust: 15, CTA: 15, differentiation: 10, design_hint: 10 },
  findings: [],
  evidence: [],
  penalties: [],
  bonuses: [],
  singleBiggestLeak: "No material leak established.",
};

function enrich(input: ScrapedWebsiteData): ScrapedWebsiteData {
  const journeys = buildCustomerJourneys(input);
  return { ...input, journeys, businessProfile: buildBusinessProfile(input, journeys) };
}

const resort = enrich(scraped({
  title: "Forest Resort",
  crawl: {
    strategy: "multi_page",
    pageCount: 2,
    visitedUrls: ["https://example.test/rooms", "https://example.test/dining"],
    failedUrls: [],
    pages: [
      {
        url: "https://example.test/rooms",
        role: "services",
        title: "Rooms and suites",
        description: "Stay in our forest rooms and suites.",
        headings: ["Rooms and suites"],
        ctaEvidence: [{ label: "Check Availability", destination: "https://booking.example.com", destinationType: "external", sourceUrl: "https://example.test/rooms" }],
        contentLength: 300,
        headingCount: 1,
      },
      {
        url: "https://example.test/dining",
        role: "services",
        title: "Restaurant",
        description: "Restaurant dining and seasonal menus.",
        headings: ["Forest Restaurant"],
        ctaEvidence: [{ label: "Reserve a Table", destination: "https://tables.example.com", destinationType: "external", sourceUrl: "https://example.test/dining" }],
        contentLength: 280,
        headingCount: 1,
      },
    ],
  },
}));

if (!resort.businessProfile?.mixedBusiness) throw new Error("Mixed resort journeys were collapsed into one path.");
if (!resort.businessProfile.revenueIntents.includes("book_stay") || !resort.businessProfile.revenueIntents.includes("reserve_table")) {
  throw new Error("Accommodation and restaurant journeys were not preserved separately.");
}
if (diagnoseWebsite(resort, scoring).siteGoal !== "drive_direct_bookings") {
  throw new Error("Observed primary stay journey did not drive the diagnosis goal.");
}

const unfamiliar = enrich(scraped({
  title: "Specialist Materials Lab",
  crawl: {
    strategy: "single_page",
    pageCount: 1,
    visitedUrls: ["https://example.test/"],
    failedUrls: [],
    pages: [{
      url: "https://example.test/",
      role: "home",
      title: "Specialist Materials Lab",
      description: "Independent material characterization.",
      headings: ["Independent material characterization"],
      ctaEvidence: [{ label: "Contact the lab", destination: "mailto:lab@example.test", destinationType: "email", sourceUrl: "https://example.test/" }],
      contentLength: 320,
      headingCount: 1,
    }],
  },
}));

if (unfamiliar.businessProfile?.offerings.some((item) => /landscap|construction|shop/i.test(item.name))) {
  throw new Error("Unfamiliar company profile invented a known-industry offering.");
}
if (unfamiliar.journeys?.[0]?.destinationType !== "email") {
  throw new Error("Observed contact destination was not retained.");
}

const strippedVisual = withoutVisualImageData({
  available: true,
  sampledAt: new Date(0).toISOString(),
  findings: [],
  evidence: [],
  desktop: {
    viewport: "desktop", width: 1440, height: 900, sampledElementCount: 1,
    aboveFoldElementCount: 1, ctaCount: 1, primaryCtaAboveFold: true,
    primaryCtaContrast: 5, primaryCtaAreaRatio: 0.02, averageTextContrast: 7,
    lowContrastTextShare: 0, averageFontSize: 18, headingCountAboveFold: 1,
    uniqueColorBuckets: 3, uniqueFontFamilies: 1, animatedElementShare: 0,
    autoplayMediaCount: 0, screenshotHash: "a".repeat(64),
    screenshotDataUrl: "data:image/jpeg;base64,private",
  },
});
if (strippedVisual.desktop?.screenshotDataUrl || strippedVisual.desktop?.screenshotHash !== "a".repeat(64)) {
  throw new Error("Visual persistence did not remove image data while retaining its fingerprint.");
}

console.log("Phase 3 business profile and mixed-journey checks passed.");
