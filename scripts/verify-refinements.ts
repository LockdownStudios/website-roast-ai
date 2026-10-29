import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePairedFindings, projectPairedFindings } from "../lib/pairedFindings";
import { parseReportReview } from "../lib/reportReview";
import { selectVisualEvidence } from "../lib/visualEvidence";
import { buildTeaserRoast } from "../lib/reportAccess";
import { estimateOpenAiRunUsd } from "../lib/aiCost";
import { reserveAiRun } from "../lib/aiUsage";
import { reportResponseFormat } from "../lib/reportSchema";
import { fullReportPresentation } from "../lib/reportPresentation";
import type { ScrapedWebsiteData, VisualViewportMetrics } from "../lib/types";

async function main() {
  const fixture = JSON.parse(await readFile("fixtures/roast-report-sample.json", "utf8"));
  const findings = parsePairedFindings([
    { headline: "The room comparison needs a referee.", observation: "Room capacity is not shown on the reviewed listing cards.", fix: "Add verified capacity alongside each listed room." },
    { headline: "The enquiry needs a clearer introduction.", observation: "The CTA leads to a general contact page.", fix: "Explain which dates and room details to provide." },
  ]);
  const reordered = [findings[1], findings[0]];
  assert.deepEqual(projectPairedFindings(reordered).quick_fixes, [findings[1].fix, findings[0].fix]);
  assert.throws(() => parsePairedFindings([{ ...findings[0], fix: "" }]));
  assert.throws(() => parsePairedFindings([findings[0], findings[0]]));
  assert.ok("findings" in reportResponseFormat.json_schema.schema.properties);
  assert.ok(!("quick_fixes" in reportResponseFormat.json_schema.schema.properties));
  const roast = { ...fixture.roast, findings: reordered, ...projectPairedFindings(reordered) };
  assert.equal(buildTeaserRoast(roast).findings, undefined, "Paid paired fixes must not leak through the teaser.");
  const presented = fullReportPresentation({ ...fixture, roast, createdAt: "2026-10-28T12:00:00Z" });
  assert.equal(presented.findings[0].headline, reordered[0].headline);
  assert.equal(presented.findings[0].fix, reordered[0].fix);
  const draft = { report: { findings } };
  const verdict = { evidenceSupported: false, businessAppropriate: true, scopeHonest: true, actionsUseful: true };
  const objection = { field: "/report/findings/0/observation", quote: "Room capacity", reason: "The supplied capture does not establish this observation." };
  const valid = parseReportReview({ ...verdict, issues: [objection] }, draft);
  assert.equal(valid.passed, false);
  assert.ok(valid.issues[0].includes(objection.reason));
  const invented = parseReportReview({ ...verdict, issues: [{ ...objection, quote: "unpaid overtime" }] }, draft);
  assert.ok(invented.issues[0].includes("quote does not occur"), "Invented reviewer quotations must be flagged.");
  const wrongField = parseReportReview({ ...verdict, issues: [{ ...objection, field: "/report/findings/1/observation" }] }, draft);
  assert.ok(wrongField.issues[0].includes("quote does not occur"));
  const viewport = (name: "desktop" | "mobile") => ({ width: 1440, height: 900, sampledElementCount: 0, aboveFoldElementCount: 0, ctaCount: 1, primaryCtaText: "Book", primaryCtaAboveFold: true, primaryCtaContrast: 4, primaryCtaAreaRatio: 0.01, averageTextContrast: 4, lowContrastTextShare: 0, averageFontSize: 16, headingCountAboveFold: 1, uniqueColorBuckets: 4, uniqueFontFamilies: 1, animatedElementShare: 0, autoplayMediaCount: 0, viewport: name, screenshotDataUrl: "data:image/jpeg;base64,YQ==", captureReadiness: { settled: true, waitedMs: 0, reasons: [] } } as VisualViewportMetrics);
  const scraped: ScrapedWebsiteData = { ...fixture.scraped, visualAudit: { available: true, sampledAt: "2026-10-28T12:00:00Z", findings: [], evidence: [], desktop: viewport("desktop"), mobile: viewport("mobile"), keyPages: [{ url: "https://example.com/rooms", desktop: viewport("desktop") }, { url: "https://example.com/contact", desktop: viewport("desktop") }, { url: "https://example.com/rooms", desktop: viewport("desktop") }] } };
  const selected = selectVisualEvidence(scraped, true);
  assert.equal(selected.length, 4);
  assert.deepEqual(selected.slice(2).map(image => image.sourceUrl), ["https://example.com/rooms", "https://example.com/contact"]);
  assert.equal(selectVisualEvidence(scraped, false).length, 2);
  assert.equal(selectVisualEvidence({ ...scraped, visualAudit: { ...scraped.visualAudit!, mobile: undefined } }, true).length, 0);
  assert.ok(estimateOpenAiRunUsd("gpt-5.6-terra", 58000, 4000, 800, 16384) <= 0.40);
  const env = { ...process.env }, fetch = globalThis.fetch;
  try {
    Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_PROVIDER: "openai", ROAST_AI_MODEL: "gpt-5.6-terra", ROAST_AI_ALLOWED_MODELS: "gpt-5.6-terra", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "mock-only" });
    delete process.env.ROAST_AI_MAX_RUN_USD;
    globalThis.fetch = async () => new Response(JSON.stringify({ allowed: true }));
    const run = await reserveAiRun({ channel: "development", reportKind: "full_visual" }, scraped.url);
    const content = selected.map(image => ({ type: "image_url", image_url: { url: image.dataUrl, detail: "low" } }));
    assert.throws(() => run.prepare({ messages: [{ content: [...content, content[0]] }] }, "writer"), /approved count/);
    assert.equal(run.prepare({ messages: [{ content }] }, "writer").max_completion_tokens, 4000);
    assert.equal(run.prepare({ messages: [{ content }] }, "review").max_completion_tokens, 800);
    assert.throws(() => run.prepare({ messages: [{ content }] }, "review"), /request limit/);
    await run.finish("completed");
  } finally {
    globalThis.fetch = fetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
  console.log("Refinement regressions pass: atomic finding/fix records, headline preservation, teaser protection, grounded reviewer objections, shared four-image selection and bounded two-call cost. Zero paid calls.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
