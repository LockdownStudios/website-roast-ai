import assert from "node:assert/strict";
import { aiPolicy, assertAiEnabled, reserveAiRun, verifyAiLedger } from "../lib/aiUsage";
import { estimateOpenAiRunUsd, maxAiRunUsd } from "../lib/aiCost";

async function main() {
  const previous = { ...process.env };
  const fetch = globalThis.fetch;
  let requests = 0;
  let allow = true;
  const reservations: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => {
    requests++;
    if (String(_url).includes("rpc/")) {
      reservations.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ allowed: allow }));
    }
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
    assert.equal(reservations[1].p_actor_limit, 10);
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
    await assert.rejects(reserveAiRun({ channel: "office" }, "https://example.com"), /allowance/);
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
