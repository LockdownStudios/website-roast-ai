import assert from "node:assert/strict";
import { aiProviderCredentials, defaultAiModel, providerRequestBody, roastAiProvider } from "../lib/aiProvider";
import { aiPolicy, reserveAiRun } from "../lib/aiUsage";
import { requestAiCompletion } from "../lib/aiCompletion";
import { reportResponseFormat } from "../lib/reportSchema";

async function main() {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  const sent: Array<{ url: string; body: Record<string, unknown>; authorization: string | null }> = [];
  let denial = false;
  let failure: "none" | "quota" | "empty" | "truncated" = "none";
  let finalUsage: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    if (address.endsWith("/responses/input_tokens")) return Response.json({ input_tokens: 2000 });
    if (address === "https://ledger.test/rest/v1/rpc/reserve_roast_ai_run") {
      const reservation = JSON.parse(String(init?.body));
      assert.match(reservation.p_model, /^(openai|deepseek):/);
      return Response.json({ allowed: !denial });
    }
    if(address==='https://ledger.test/rest/v1/roast_ai_runs'&&init?.method==='POST'){
      const reservation=JSON.parse(String(init.body));
      assert.equal(reservation.channel,'office');
      assert.match(reservation.model,/^(openai|deepseek):/);
      return new Response(null,{status:201});
    }
    if (address.startsWith("https://ledger.test/rest/v1/roast_ai_runs?")) {
      finalUsage = JSON.parse(String(init?.body));
      return new Response(null, { status: 204 });
    }
    assert.ok(["https://api.deepseek.com/chat/completions", "https://api.openai.com/v1/chat/completions"].includes(address));
    assert.equal(init?.redirect, "error", "Credentials must not follow redirects");
    sent.push({ url: address, body: JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get("authorization") });
    if (failure === "quota") return Response.json({ error: { code: "insufficient_balance", message: "Private provider detail" } }, { status: 402 });
    return Response.json({ choices: [{ finish_reason: failure === "truncated" ? "length" : "stop", message: { content: failure === "empty" ? "" : '{"ok":true}' } }], usage: { prompt_tokens: 12, completion_tokens: 4 } });
  };
  try {
    Object.assign(process.env, { ROAST_AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "fake-deepseek-key", OPENAI_API_KEY: "fake-openai-key",
      ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "fake-service-key" });
    delete process.env.ROAST_AI_MODEL; delete process.env.ROAST_AI_ALLOWED_MODELS;
    assert.equal(defaultAiModel(roastAiProvider()), "deepseek-flash");
    assert.equal(aiPolicy().model, "deepseek-flash");
    const run = await reserveAiRun({ channel: "office" }, "https://example.com");
    const body = { response_format: reportResponseFormat, messages: [{ role: "system", content: "Return JSON only." }], max_tokens: 999999, max_completion_tokens: 999999 };
    await requestAiCompletion(run, body, "writer");
    assert.equal(sent[0].url, "https://api.deepseek.com/chat/completions");
    assert.equal(sent[0].authorization, "Bearer fake-deepseek-key");
    assert.equal(sent[0].body.max_tokens, 4000);
    assert.equal(sent[0].body.max_completion_tokens, undefined);
    assert.equal(sent[0].body.reasoning_effort, "none");
    assert.deepEqual(sent[0].body.response_format, { type: "json_object" });
    assert.ok(JSON.stringify(sent[0].body.messages).includes("claim_contract"), "Keep schema instructions in JSON-mode prompts");
    await requestAiCompletion(run, body, "review");
    assert.equal(sent[1].body.max_tokens, 800);
    await assert.rejects(requestAiCompletion(run, body, "review"), /request limit/);
    assert.equal(sent.length, 2);
    await run.finish("completed");
    assert.equal(finalUsage.input_tokens, 24); assert.equal(finalUsage.output_tokens, 8); assert.equal(finalUsage.model_calls, 2);
    const capped = await reserveAiRun({ channel: "office" }, "https://example.com");
    assert.throws(() => capped.prepare({ ...body, response_format: { type: "json_schema", json_schema: { schema: { description: "x".repeat(80001) } } } }, "writer"), /input allowance/);
    assert.throws(() => capped.prepare({ messages: [{ content: [{ type: "image_url" }] }] }, "writer"), /Image API/);
    await capped.finish("failed");
    const before = sent.length;
    denial = true;
    await assert.rejects(reserveAiRun({ channel: "development" }, "https://example.com"), /allowance/);
    denial = false;
    delete process.env.DEEPSEEK_API_KEY;
    assert.throws(() => aiProviderCredentials("deepseek"), /DEEPSEEK_API_KEY/);
    assert.equal(sent.length, before, "Missing DeepSeek credentials must not fall back to OpenAI");
    process.env.DEEPSEEK_API_KEY = "fake-deepseek-key";
    for (const mode of ["quota", "empty", "truncated"] as const) {
      failure = mode;
      const failed = await reserveAiRun({ channel: "office" }, "https://example.com");
      const previousCalls: number = sent.length;
      await assert.rejects(requestAiCompletion(failed, body, "writer"), /402|empty|did not complete/);
      assert.equal(sent.length, previousCalls + 1, "Errors must not retry or call another provider");
      await failed.finish("failed");
    }
    process.env.ROAST_AI_PROVIDER = "other";
    assert.throws(() => roastAiProvider(), /Invalid ROAST_AI_PROVIDER/);
    process.env.ROAST_AI_PROVIDER = "openai";
    assert.equal(aiPolicy().model, "gpt-5.6-terra");
    const openai = providerRequestBody("openai", body, "gpt-4o-mini", 4000);
    assert.equal(openai.max_completion_tokens, 4000); assert.equal(openai.max_tokens, undefined);
    assert.deepEqual(openai.response_format, reportResponseFormat);
    failure = "none";
    const openaiRun = await reserveAiRun({ channel: "office" }, "https://example.com");
    const sentBeforeOpenai = sent.length;
    await requestAiCompletion(openaiRun, { ...body, n: 99, stream: true, store: true }, "writer");
    assert.equal(sent[sentBeforeOpenai].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(sent[sentBeforeOpenai].authorization, "Bearer fake-openai-key");
    assert.equal(sent[sentBeforeOpenai].body.n, 1);
    assert.equal(sent[sentBeforeOpenai].body.stream, false);
    assert.equal(sent[sentBeforeOpenai].body.store, false);
    assert.equal(sent[sentBeforeOpenai].body.model, "gpt-5.6-terra");
    assert.equal(sent[sentBeforeOpenai].body.reasoning_effort, "none");
    assert.equal(sent[sentBeforeOpenai].body.service_tier, "default");
    const terra = providerRequestBody("openai", { ...body, temperature: 1, top_p: 0.8, reasoning_effort: "high", service_tier: "priority" }, "gpt-5.6-terra", 800);
    assert.equal(terra.temperature, undefined);
    assert.equal(terra.top_p, undefined);
    assert.equal(terra.reasoning_effort, "none");
    assert.equal(terra.max_completion_tokens, 800);
    assert.equal(terra.service_tier, "default");
    await openaiRun.finish("completed");
    console.log("Provider checks passed: direct endpoint/key isolation, JSON adaptation, budgets, token caps, text-only policy, usage recording, missing keys, quota/empty/truncated errors and no retries/fallback. No live API calls.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of Object.keys(process.env)) if (!(name in original)) delete process.env[name];
    Object.assign(process.env, original);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
