import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { labelledReviewImages, parseReportReview } from "../lib/reportReview";
import { isClientReadyReport, REPORT_REVIEW_VERSION } from "../lib/reportQuality";
import type { RoastResultPayload } from "../lib/types";
import { scoreWebsite } from "../lib/scoring";
import { parseBusinessDiagnosis } from "../lib/diagnosis";
import { hasMalformedNarrative } from "../lib/ai";

async function main() {
  const fixture = JSON.parse(await readFile("fixtures/roast-report-sample.json", "utf8"));
  const report = fixture.roast as RoastResultPayload;
  assert.equal(isClientReadyReport(report), false, "Unreviewed legacy report must not be reused for a new scan");
  const review = parseReportReview({ evidenceSupported: true, businessAppropriate: true, scopeHonest: true, actionsUseful: true, issues: [] });
  const reviewed = { ...report, claim_contract: Array.from({ length: 3 }, () => ({ claim: "Observed CTA", source: "cta" as const, evidence: "Book", severity: "medium" as const })), generation: { mode: "ai" as const, review } };
  assert.equal(isClientReadyReport(reviewed), true);
  for (const mode of ["hybrid", "fallback"] as const) assert.equal(isClientReadyReport({ ...reviewed, generation: { mode, review } }), false);
  assert.equal(isClientReadyReport({ ...reviewed, generation: { mode: "ai", review: { ...review, version: "old" } } }), false);
  assert.equal(parseReportReview({ evidenceSupported: "true", businessAppropriate: true, scopeHonest: true, actionsUseful: true, issues: [] }).passed, false);
  assert.equal(parseReportReview({ evidenceSupported: true, businessAppropriate: true, scopeHonest: false, actionsUseful: true, issues: [] }).passed, false);
  assert.equal(parseReportReview(null).passed, false);
  assert.equal(review.version, REPORT_REVIEW_VERSION);
  const images = labelledReviewImages(["desktop-data", "mobile-data"], [{label: "Desktop homepage",sourceUrl:"https://example.com/"},{label:"Mobile homepage",sourceUrl:"https://example.com/"}]);
  assert.match(images[0].text!, /imageIndex=0 .*Desktop homepage/);
  assert.equal(images[1].image_url!.url, "desktop-data");
  assert.match(images[2].text!, /imageIndex=1 .*Mobile homepage/);
  assert.equal(images[3].image_url!.url, "mobile-data");
  assert.equal(isClientReadyReport({ ...reviewed, claim_contract: [] }), false);
  assert.equal(scoreWebsite({ ...fixture.scraped, visualAudit: undefined }).visualDesign, undefined);
  assert.equal(parseBusinessDiagnosis({ businessModel: "invented" }), null);
  assert.equal(hasMalformedNarrative('Existing labels "Discuss Your Website" "Discuss an App" lead to distinct enquiry routes.'), false);
  assert.equal(hasMalformedNarrative('The "Contact"asks visitors to guess.'), true);
  const weakCtas = scoreWebsite({ ...fixture.scraped, ctas: ["Contact", "Learn more"] });
  assert.ok(weakCtas.penalties.some((item) => item.label === "Weak CTA Path"));
  assert.ok(!weakCtas.bonuses.some((item) => item.label === "Quantified Offer + CTA"));
  for (const cta of ["Discuss Your Website", "Discuss an App", "Discuss a Game", "Check Availability", "Reserve a Table", "View Product Range"]) {
    const specificCtas = scoreWebsite({ ...fixture.scraped, ctas: [cta, "Contact"] });
    assert.ok(!specificCtas.penalties.some((item) => item.label === "Weak CTA Path"), `${cta} must not be treated as generic wording`);
  }
  console.log("Report quality checks passed: AI review, rejected output, missing metadata, stale cache, malformed review and evidence minimum.");
}
void main();
