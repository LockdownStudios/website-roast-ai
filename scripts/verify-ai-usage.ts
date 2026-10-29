import assert from "node:assert/strict";
import { aiPolicy, assertAiEnabled, reserveAiRun, verifyAiLedger } from "../lib/aiUsage";
import { estimateOpenAiRunUsd, maxAiRunUsd } from "../lib/aiCost";

async function main() {
  const previous = { ...process.env };
  const fetch = globalThis.fetch;
  let requests = 0;
  let allow = true;
  const reservations: Record<string, unknown>[] = [];
  const officeEntries: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => {
    requests++;
    if (String(_url).includes("rpc/")) {
      reservations.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ allowed: allow }));
    }
    if (init?.method === "POST" && String(_url).endsWith("/roast_ai_runs")) officeEntries.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 204 });
  };
  try {
    process.env.ROAST_AI_PROVIDER = "openai";
    delete process.env.ROAST_AI_MAX_RUN_USD;
    assert.equal(maxAiRunUsd(), 0.10);
    assert.equal(estimateOpenAiRunUsd("gpt-5.6-terra", 80000, 4000, 800), 0.46272);
    assert.equal(estimateOpenAiRunUsd("gpt-5.6-terra", 65000, 4000, 800), 0.38772);
    assert.equal(estimateOpenAiRunUsd("gpt-4o-mini", 80000, 4000, 800), 0.0271872);
    assert.throws(() => estimateOpenAiRunUsd("gpt-5.5", 80000, 4000, 800), /approved cost estimate/);
    assert.throws(() => estimateOpenAiRunUsd("gpt-4o-mini", -1, 4000, 800), /Invalid/);
    delete process.env.ROAST_AI_ENABLED;
    assert.throws(() => assertAiEnabled({ channel: "development" }), /paused/);
    assert.equal(requests, 0);
    Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_MODEL: "gpt-4o-mini", ROAST_AI_ALLOWED_MODELS: "gpt-4o-mini", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "fake-key" });
    assert.throws(() => assertAiEnabled({ channel: "public" }), /sign in/);
    process.env.ROAST_AI_MODEL = "gpt-5.5";
    assert.throws(() => assertAiEnabled({ channel: "office" }), /not approved/);
    process.env.ROAST_AI_MODEL = "gpt-4o-mini";
    process.env.ROAST_USER_DAILY_LIMIT = "invalid";
    assert.throws(() => aiPolicy(), /Invalid/);
    delete process.env.ROAST_USER_DAILY_LIMIT;
    const run = await reserveAiRun({ channel: "public", userId: "user-test" }, "https://example.com");
    assert.equal(reservations[0].p_actor_limit, 3);
    assert.ok(!JSON.stringify(reservations[0]).includes("user-test"), "Hash user identity in usage ledger");
    const writer = run.prepare({ messages: [{ role: "user", content: "Evidence" }] }, "writer");
    assert.equal(writer.max_completion_tokens, 4000);
    assert.equal(writer.n, 1);
    assert.equal(writer.stream, false);
    assert.equal(writer.store, false);
    assert.throws(() => run.prepare({}, "writer"), /Only one writer/);
    assert.equal(run.prepare({ messages: [] }, "review").max_completion_tokens, 800);
    assert.throws(() => run.prepare({}, "writer"), /request limit/);
    await run.finish("failed");
    const office = await reserveAiRun({ channel: "office" }, "https://example.com");
    assert.equal(reservations.length, 1, "Staff must not use the quota/cooldown RPC");
    assert.equal(officeEntries[0].channel, "office");
    assert.ok(Number(officeEntries[0].reserved_units) > 0, "Staff usage must still be recorded");
    assert.throws(() => office.prepare({ input: "x".repeat(80001) }, "writer"), /input allowance/);
    assert.throws(() => office.prepare({ content: [{ type: "image_url" }] }, "writer"), /Image API/);
    assert.throws(() => office.prepare({ tools: [{ type: "web_search" }] }, "writer"), /Only text/);
    await office.finish("failed");
    const beforeCostDenial = requests;
    process.env.ROAST_AI_MAX_RUN_USD = "0.01";
    await assert.rejects(reserveAiRun({ channel: "office" }, "https://example.com"), /cost ceiling/);
    assert.equal(requests, beforeCostDenial, "Cost denial must happen before any request or reservation");
    process.env.ROAST_AI_MAX_RUN_USD = "NaN";
    await assert.rejects(reserveAiRun({ channel: "office" }, "https://example.com"), /MAX_RUN_USD/);
    delete process.env.ROAST_AI_MAX_RUN_USD;
    allow = false;
    await assert.rejects(reserveAiRun({ channel: "public", userId: "user-test" }, "https://example.com"), /allowance/);
    const staff = await reserveAiRun({ channel: "office" }, "https://example.com");
    await staff.finish("completed");
    assert.equal(officeEntries.length, 2, "Office scans proceed even when public quotas reject requests");
    Object.assign(process.env, { ROAST_AI_MODEL: "gpt-5.6-terra", ROAST_AI_ALLOWED_MODELS: "gpt-5.6-terra" });
    const counted = await reserveAiRun({ channel: "office", reportKind: "outreach" }, "https://example.com");
    const images = [0, 1].map(() => ({ type: "image_url", image_url: { url: "data:image/jpeg;base64,YQ==", detail: "low" } }));
    const evidence = "Evidence ".repeat(12000);
    const countedWriter = counted.prepare({ messages: [{ role: "user", content: [{ type: "text", text: evidence }, ...images] }] }, "writer");
    assert.ok(JSON.stringify(countedWriter).includes(evidence), "Full affordable evidence must survive legacy 36KB gate");
    counted.record({ usage: { prompt_tokens: 9000, completion_tokens: 500 } });
    const countedReview = counted.prepare({ messages: [{ role: "user", content: [{ type: "text", text: evidence + 'Saved report findings' }, ...images] }] }, "review");
    assert.ok(JSON.stringify(countedReview).includes('Saved report findings'), "Reviewer must keep findings and source evidence");
    await counted.finish("completed");
    const oversized = await reserveAiRun({ channel: "office" }, "https://example.com");
    assert.throws(() => oversized.prepare({ messages: [{role: "user", content: "x".repeat(2_000_001)}] }, "writer"), /safety bound/);
    await oversized.finish("failed");
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(reserveAiRun({ channel: "office" }, "https://example.com"), /No new AI request/);
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(verifyAiLedger(), /Supabase project status/);
    await assert.rejects(reserveAiRun({ channel: "office" }, "https://example.com"), /No new AI request/);
    console.log("AI usage checks passed: off by default, sign-in, model allowlist, input/output caps, two-call maximum, ledger denial and fail-closed storage. No paid calls.");
  } finally {
    globalThis.fetch = fetch;
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
