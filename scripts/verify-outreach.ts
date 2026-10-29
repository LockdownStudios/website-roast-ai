import assert from "node:assert/strict";
import { reserveAiRun } from "../lib/aiUsage";
import { estimateOpenAiRunUsd } from "../lib/aiCost";
import { parseOutreach, resolveOutreachCitations, outreachResponseFormat } from "../lib/outreachContract";
import { isClientReadyReport, REPORT_REVIEW_VERSION } from "../lib/reportQuality";
import { readFileSync } from "node:fs";
import type { RoastResultPayload } from "../lib/types";

async function main() {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  const image = { label: "Desktop", sourceUrl: "https://example.com/", dataUrl: "data:image/jpeg;base64,YQ==" };
  const finding = { category: "visual", observed: "Navigation needs a clearer label.", pageUrl: image.sourceUrl, consequence: "Visitors may need longer to find the menu.", fix: "Add a visible navigation label.", evidence: "Desktop screenshot", imageIndex: 0 };
  const fixture = { summary: "A focused refresh is appropriate.", strengths: ["Consistent brand colours."], recommendation: "small improvements", recommendationReason: "Keep the established identity.", scope: "Homepage screenshots only; no submissions tested.", images: [image, { ...image, label: "Mobile" }], findings: [finding, { ...finding, observed: "A second distinct observation." }, { ...finding, observed: "A third distinct observation." }] };
  try {
    parseOutreach(fixture);
    const catalog: { pages: string[]; entries: Array<[string, string, number[]]> } = { pages: [image.sourceUrl, "https://other.test/"], entries: [["heading", "Exact site evidence", [0]]] };
    const resolved = resolveOutreachCitations({ findings: [{ imageIndex: null, evidenceId: "e0", pageId: "p0" }] }, catalog, fixture.images);
    assert.equal((resolved.findings[0] as { evidence: string }).evidence, "Exact site evidence");
    assert.equal(resolved.findings[0].pageUrl, image.sourceUrl);
    assert.throws(() => resolveOutreachCitations({ findings: [{ imageIndex: null, evidenceId: "e0", pageId: "p1" }] }, catalog, fixture.images), /different page/);
    assert.equal(parseOutreach({ ...fixture, findings: [finding] }).findings.length, 1);
    assert.throws(() => parseOutreach({ ...fixture, findings: [] }));
    const schema = outreachResponseFormat.json_schema.schema;
    assert.equal(schema.properties.findings.minItems, 1);
    assert.equal(schema.properties.findings.maxItems, 5);
    const observedPattern = new RegExp(schema.properties.findings.items.properties.observed.pattern);
    assert.ok(observedPattern.test("x".repeat(180)));
    assert.ok(!observedPattern.test("x".repeat(181)));
    assert.deepEqual(schema.properties.findings.items.properties.imageIndex.enum, [null, 0, 1]);
    const base = JSON.parse(readFileSync("fixtures/roast-report-sample.json", "utf8")).roast as RoastResultPayload;
    const single: RoastResultPayload = { ...base, findings: undefined, outreach: parseOutreach({ ...fixture, findings: [finding] }), claim_contract: [{ claim: finding.observed, evidence: finding.evidence, source: "visual", severity: "medium" }], generation: { mode: "ai", review: { version: REPORT_REVIEW_VERSION, passed: true, issues: [], checkedAt: "2026-10-29T00:00:00Z" } } };
    assert.equal(isClientReadyReport(single), true, "A concise, reviewed, image-grounded report need not invent three issues");
    assert.equal(isClientReadyReport({ ...single, claim_contract: [] }), false);
    assert.equal(isClientReadyReport({ ...single, generation: { mode: "ai", review: { ...single.generation!.review!, passed: false } } }), false);
    assert.equal(isClientReadyReport({ ...single, outreach: undefined }), false, "Full-report evidence minimum is unchanged");
    assert.throws(() => parseOutreach({ ...fixture, findings: fixture.findings.map(f => ({ ...f, imageIndex: null })) }));
    assert.throws(() => parseOutreach({ ...fixture, images: [image] }));
    assert.throws(() => parseOutreach({ ...fixture, findings: fixture.findings.map(f => ({ ...f, observed: "x".repeat(181) })) }));
    Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_PROVIDER: "openai", ROAST_AI_MODEL: "gpt-5.6-terra", ROAST_AI_ALLOWED_MODELS: "gpt-5.6-terra", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "test" });
    delete process.env.ROAST_AI_MAX_RUN_USD;
    globalThis.fetch = async () => new Response(JSON.stringify({ allowed: true }));
    await assert.rejects(reserveAiRun({ channel: "public", userId: "test", reportKind: "outreach" }, image.sourceUrl), /private Office/);
    const run = await reserveAiRun({ channel: "office", reportKind: "outreach" }, image.sourceUrl);
    const messages = [{ role: "user", content: [0, 1].map(() => ({ type: "image_url", image_url: { url: image.dataUrl, detail: "low" } })) }];
    assert.throws(() => run.prepare({ messages: [] }, "writer"), /exactly two/);
    assert.throws(() => run.prepare({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://untrusted.test/image", detail: "low" } }] }] }, "writer"), /bounded/);
    assert.equal(run.prepare({ messages }, "writer").max_completion_tokens, 2400);
    assert.equal(run.prepare({ messages }, "review").max_completion_tokens, 800);
    assert.throws(() => run.prepare({ messages }, "review"), /request limit/);
    await run.finish("completed");
    assert.ok(estimateOpenAiRunUsd("gpt-5.6-terra", 36000, 2400, 800, 8192) < 0.40);
    console.log("Outreach checks passed: concise evidence contract, required visual evidence, private generation, image restrictions, two calls and cost ceiling. No paid calls.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
