import { technicalChecksFromHtml } from "../lib/technicalAudit";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { generateOutreachAudit } from "../lib/outreach";
import { scoreWebsite } from "../lib/scoring";
import { isClientReadyReport } from "../lib/reportQuality";
import { renderOutreachPdf } from "../lib/outreachPdf";

async function main() {
  const saved = JSON.parse(await readFile("tmp/roast-batch/tashas-openai-accuracy-20261028.json", "utf8"));
  const visualAudit = JSON.parse(await readFile("tmp/outreach-visual-test.json", "utf8"));
  const scraped = { ...saved.scraped, visualAudit, technicalChecks: technicalChecksFromHtml([{ url: saved.scraped.url, html: '<title>Layout fixture only</title><meta name="viewport" content="width=device-width">' }]) };
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let approve = true;
  const finding = (observed: string, fix: string, imageIndex: number) => ({ headline: ["The menu is playing hide-and-seek.", "The film got top billing. Visitors got homework.", "Great photograph. Now give the guest a next step."][imageIndex === 1 ? 2 : observed.startsWith("The desktop") ? 1 : 0], category: "visual", observed, fix, consequence: "Visitors may need an extra step before finding practical information.", evidence: "Captured homepage view; a visual hierarchy observation only.", imageIndex, pageId: null, evidenceId: null });
  const writer = {
    summary: "INTERNAL LAYOUT TEST ONLY. Mock narrative and synthetic technical HTML illustrate the combined report structure. These are not verified findings about Tashas.",
    strengths: ["The homepage uses recognisable brand photography.", "The logo remains visible against the image."],
    recommendation: "targeted refresh",
    recommendationReason: "Layout test only. A real recommendation requires the independent evidence reviewer to approve all findings.",
    findings: [
      finding("Desktop navigation is represented by a menu icon.", "Test a visible navigation label alongside the icon.", 0),
      finding("The desktop central action emphasises playing the brand film.", "Explore a secondary practical route to location information.", 0),
      finding("Large photography dominates the opening viewport.", "Explore a short practical introduction without losing the photography.", 1),
    ],
  };
  try {
    Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_PROVIDER: "openai", ROAST_AI_MODEL: "gpt-5.6-terra", ROAST_AI_ALLOWED_MODELS: "gpt-5.6-terra", OPENAI_API_KEY: "mock-only", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "mock-only" });
    globalThis.fetch = async (url, init) => {
      if (!String(url).includes("api.openai.com")) return new Response(JSON.stringify({ allowed: true }));
      calls++;
      const request = JSON.parse(String(init?.body));
      if (calls % 2) assert.match(request.messages[0].content, /sharp, witty, evidence-led/);
      assert.equal((JSON.stringify(request).match(/"type":"image_url"/g) || []).length, 2);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(calls % 2 ? writer : { evidenceSupported: approve, businessAppropriate: true, scopeHonest: true, actionsUseful: true, issues: approve ? [] : [{ field: "/report/outreach/findings/0/observed", quote: writer.findings[0].observed, reason: "Mock reviewer rejected a finding." }] }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    };
    const result = await generateOutreachAudit(scraped, scoreWebsite(scraped), { channel: "development" });
    assert.ok(isClientReadyReport(result.roast));
    assert.equal(calls, 2);
    assert.deepEqual(result.roast.outreach?.technicalChecks, scraped.technicalChecks);
    approve = false;
    const rejected = await generateOutreachAudit(scraped, scoreWebsite(scraped), { channel: "development" });
    assert.equal(isClientReadyReport(rejected.roast), false);
    assert.equal(calls, 4, "Each independent mock run has exactly two calls; no retry.");
    await assert.rejects(generateOutreachAudit({ ...scraped, visualAudit: { ...visualAudit, desktop: undefined } }, scoreWebsite(scraped), { channel: "development" }), /screenshots/);
    assert.equal(calls, 4, "Missing capture must fail before a provider request.");
    const pdf = await renderOutreachPdf(rejected.roast.outreach!, true);
    await writeFile("../output/pdf/tashas-outreach-layout-draft.pdf", pdf);
    console.log("Mock flow passed: writer/reviewer images, approval and rejection, no retry, missing-visual fail closed. Draft layout generated. Zero paid calls.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
