import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { compactEvidence } from "../lib/compactEvidence";
import { resolveClaimReferences } from "../lib/citationReferences";
import { deduplicatePages, pageUrlKey } from "../lib/pageAliases";
import { parseReportReview } from "../lib/reportReview";
import { scoreVisualAudit } from "../lib/visualScoring";
import { selectVisualEvidence } from "../lib/visualEvidence";
import type { ScrapedWebsiteData } from "../lib/types";

async function main() {
  const catalog = compactEvidence([{ source: "cta", sourceUrl: "https://example.com/", text: "Discuss Your Project" }, { source: "content", sourceUrl: "https://example.com/other", text: "Different branch policy" }]);
  const reference = { claim: "A project enquiry action is present.", evidenceId: "e0", pageId: "p0", target: "mistake", severity: "low", certainty: "observed" };
  const resolved = resolveClaimReferences([reference, reference, reference], catalog);
  assert.equal(resolved[0].evidence, "Discuss Your Project");
  assert.equal(resolved[0].sourceUrl, "https://example.com/");
  assert.throws(() => resolveClaimReferences([{ ...reference, pageId: "p1" }, reference, reference], catalog), /belong/);
  assert.throws(() => resolveClaimReferences([{ ...reference, evidenceId: "e999" }, reference, reference], catalog));
  const draft = { report: {}, scoring: { penalties: [{ reason: "Observed detector discrepancy" }] } };
  const review = { evidenceSupported: false, businessAppropriate: true, scopeHonest: true, actionsUseful: true, issues: [{ field: "/report/scoring/penalties/0/reason", quote: "detector discrepancy", reason: "Check this measurement against the image." }] };
  const parsed = parseReportReview(review, draft);
  assert.equal(parsed.passed, false, "A valid objection still withholds the report.");
  assert.ok(parsed.issues[0].startsWith("/scoring/penalties/0/reason:"));
  assert.ok(!parsed.issues[0].includes("quote does not occur"));
  assert.ok(parseReportReview({ ...review, issues: [{ ...review.issues[0], quote: "invented quote" }] }, draft).issues[0].includes("quote does not occur"));
  const content = "Specific page content. ".repeat(20);
  const pages = [{ url: "https://example.com/", title: "Home", content }, { url: "https://example.com/index.html", title: "Home", content }, { url: "https://example.com/about", title: "About", content }, { url: "https://example.com/about.html", title: "About", content }, { url: "https://example.com/another", title: "About", content }, { url: "https://example.com/about?branch=2", title: "About", content }];
  const unique = deduplicatePages(pages, page => page);
  assert.equal(unique.pages.length, 4);
  assert.equal(unique.aliases.length, 2);
  assert.equal(pageUrlKey("https://example.com/index.html"), pageUrlKey("https://example.com/"));
  assert.notEqual(pageUrlKey("https://example.com/Room"), pageUrlKey("https://example.com/room"));
  assert.notEqual(pageUrlKey("https://example.com/?branch=1"), pageUrlKey("https://example.com/?branch=2"));
  const replay: unknown[] = [];
  for (const name of ["play-with-bits", "lockdown-studios", "propshaft-engineering"]) {
    const saved = await readFile(`tmp/${name}-acceptance-20261028-evidence.json`, "utf8").then(text => JSON.parse(text), () => null);
    if (!saved) continue;
    const scraped = saved.scraped as ScrapedWebsiteData;
    const impact = scoreVisualAudit(scraped);
    if (name === "play-with-bits") assert.ok(!impact.penalties.some(p => p.label === "CTA Heuristic Flag"), "No detected CTA is not proof of weak visible buttons.");
    const before = scraped.crawl?.pages || [];
    const deduped = deduplicatePages(before, page => ({ url: page.url, title: page.title, content: page.contentSnippet || "" }));
    const withAliases = { ...scraped, crawl: scraped.crawl ? { ...scraped.crawl, aliases: deduped.aliases } : undefined };
    const images = selectVisualEvidence(withAliases, true);
    assert.ok(images.length >= 2 && images.length <= 4);
    assert.ok(!images.slice(2).some(image => pageUrlKey(image.sourceUrl) === pageUrlKey(scraped.url)), "An index alias must not waste a decision-page image slot.");
    replay.push({ name, pageRecordsBefore: before.length, uniqueAfter: deduped.pages.length, aliases: deduped.aliases, imageSources: images.map(image => image.sourceUrl), visualPenalties: impact.penalties.map(p => p.label), note: "Offline measurements only. Saved narrative not regenerated or re-approved." });
  }
  if (replay.length) await writeFile("tmp/evidence-hardening-replay.json", JSON.stringify(replay, null, 2));
  console.log(`Evidence hardening checks passed: server-resolved citations, exact cross-page ownership, reviewer pointer normalisation, verified aliases and ${replay.length} optional saved-site replays. Zero paid calls.`);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
