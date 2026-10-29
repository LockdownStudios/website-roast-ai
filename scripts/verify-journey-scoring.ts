import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAuditContext } from "../lib/auditContext";
import { scoreWebsite } from "../lib/scoring";
import type { ScrapedWebsiteData } from "../lib/types";

async function main() {
const fixture = JSON.parse(await readFile("fixtures/roast-report-sample.json", "utf8"));
const base: ScrapedWebsiteData = fixture.scraped;
for (const [label, destination] of [
  ["Book now", "https://booking.example.com/"],
  ["Make a Booking", "https://example.com/elements/pages/contact/"],
  ["Find a Dealer", "https://example.com/find-a-dealer/"],
  ["Check availability", "https://example.com/book/"],
]) {
  const site: ScrapedWebsiteData = {
    ...base, ctas: [],
    crawl: {
      strategy: "multi_page", pageCount: 1, visitedUrls: [base.url], failedUrls: [],
      pages: [{ url: base.url, role: "home", title: "Example business", contentSnippet: "Customer action", ctas: [],
        ctaEvidence: [{ label, destination, destinationType: "external", sourceUrl: base.url }],
        extractionMode: "static", discoveredFrom: "entry", contentLength: 200, headingCount: 1 }],
    },
  };
  const context = buildAuditContext(site);
  assert.ok(context.actionLabels.includes(label));
  const score = scoreWebsite(site);
  assert.ok(!score.penalties.some(item => /Weak CTA Path|No CTA|Mismatched CTA Goal/.test(item.label)), label);
  assert.ok(context.scope.visualScope.includes("No booking"));
}
const visuals = scoreWebsite(base).visualDesign;
assert.deepEqual(scoreWebsite({ ...base, trustSignals: [], ctas: [] }).visualDesign, visuals,
  "Visual design must not change just because business-copy evidence changes");
const phoneOnly = scoreWebsite({ ...base, title: "Example business", description: "Contact our team for assistance",
  headings: { h1: ["Welcome to our local business"], h2: [] }, content: "Call 0821234567 for help",
  contentSnippet: "Call 0821234567 for help", ctas: ["Get a quote", "Call now"], crawl: undefined });
assert.ok(!phoneOnly.bonuses.some(item => item.label === "Quantified Offer + CTA"), "Phone digits are not a quantified offer");
console.log("Journey scoring checks passed: booking, dealer, availability and independent visual scoring.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
