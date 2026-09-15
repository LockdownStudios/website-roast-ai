import { validateRoastClaimContract } from "../lib/ai";
import type { ScrapedWebsiteData, WebsiteScoring } from "../lib/types";

const url = "https://example.test/";
const scraped: ScrapedWebsiteData = {
  url,
  title: "Northstar Tax Advisory",
  description: "Tax compliance and SARS dispute support for South African businesses.",
  headings: { h1: ["Resolve complex tax matters with a clear plan"], h2: [] },
  content: "Tax compliance and SARS dispute support for South African businesses.",
  contentSnippet: "Tax compliance and SARS dispute support for South African businesses.",
  ctas: ["Book a tax consultation"],
  trustSignals: ["Registered tax practitioner"],
  contactSignals: ["hello@example.test"],
  genericPhrasesFound: [],
  visualHints: { aboveFoldCtaLikely: true, heroHeadingEarly: true, formAboveFoldLikely: false, trustTokenAboveFold: true, buttonCount: 2, linkCount: 6 },
  crawl: {
    strategy: "multi_page", pageCount: 2, visitedUrls: [url, `${url}services/`], failedUrls: [],
    pages: [
      { url, role: "home", title: "Northstar Tax Advisory", headings: ["Resolve complex tax matters with a clear plan"], ctas: ["Book a tax consultation"], contentSnippet: "Tax compliance and SARS dispute support for South African businesses.", contentLength: 300, headingCount: 1 },
      { url: `${url}services/`, role: "services", title: "SARS disputes", headings: ["SARS dispute resolution"], ctas: ["Book a tax consultation"], contentSnippet: "Support for SARS disputes and voluntary disclosure applications.", contentLength: 280, headingCount: 1 },
    ],
  },
  contentLength: 120,
  retryUsed: false,
  usedRelaxedFallback: false,
  scrapeQuality: "high",
};
const scoring: WebsiteScoring = {
  score: 6.5, rawScore: 6.5, confidence: 80,
  breakdown: { clarity: 15, trust: 14, CTA: 14, differentiation: 10, design_hint: 10 },
  findings: [], evidence: [], penalties: [], bonuses: [], singleBiggestLeak: "Proof needs work.",
};

const valid = validateRoastClaimContract([
  { claim: "The offer is clear but proof is thin.", source: "title", evidence: "Northstar Tax Advisory", severity: "high", target: "first_impression", sourceUrl: url, certainty: "observed" },
  { claim: "The service page needs clearer reassurance.", source: "h2", evidence: "SARS dispute resolution", severity: "medium", target: "mistake", sourceUrl: `${url}services/`, certainty: "observed" },
  { claim: "The score reflects the measured conversion signals.", source: "scoring", evidence: "Breakdown Clarity 15/25", severity: "low", target: "score", sourceUrl: url, certainty: "inference" },
], scraped, scoring);
if (valid.length !== 3) throw new Error("Valid page-level evidence contract was rejected.");

const unsupported = validateRoastClaimContract([
  { claim: "The site hides construction pricing.", source: "content", evidence: "Construction projects need quotes", severity: "high", target: "single_biggest_leak", sourceUrl: url, certainty: "observed" },
  { claim: "Visitors cannot find rooms.", source: "content", evidence: "Room availability is missing", severity: "medium", target: "mistake", sourceUrl: url, certainty: "observed" },
  { claim: "The score is weak.", source: "scoring", evidence: "Breakdown Clarity 15/25", severity: "low", target: "score", sourceUrl: url, certainty: "inference" },
], scraped, scoring);
if (unsupported.length !== 0) throw new Error("Unsupported cross-industry claim passed evidence verification.");

console.log("Phase 4 claim verification checks passed.");
