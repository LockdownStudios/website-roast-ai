import assert from "node:assert/strict";
import { reserveAiRun } from "../lib/aiUsage";
import { requestAiCompletion } from "../lib/aiCompletion";

async function main() {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  const evidence = "Verified company-specific source evidence. ".repeat(3000);
  let inputTokens = 2000, generations = 0, counts = 0;
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    if (address.includes("ledger.test")) return init?.method === "POST" && address.includes("rpc/") ? Response.json({ allowed: true }) : new Response(null, { status: 204 });
    const body = JSON.parse(String(init?.body));
    assert.ok(JSON.stringify(body).includes(evidence), "Writer and reviewer must retain the entire evidence payload");
    if (address.endsWith("/responses/input_tokens")) { counts++; return Response.json({ input_tokens: inputTokens }); }
    assert.equal(address, "https://api.openai.com/v1/chat/completions");
    generations++;
    return Response.json({ usage: { prompt_tokens: 9000, completion_tokens: 500 }, choices: [{ finish_reason: "stop", message: { content: '{"verified":true}' } }] });
  };
  try {
    Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_PROVIDER: "openai", ROAST_AI_MODEL: "gpt-5.6-terra", ROAST_AI_ALLOWED_MODELS: "gpt-5.6-terra", ROAST_AI_MAX_RUN_USD: "0.10", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "fake", OPENAI_API_KEY: "fake" });
    const request = () => ({ messages: [{ role: "user", content: [{ type: "text", text: evidence }, ...[0, 1].map(() => ({ type: "image_url", image_url: { url: "data:image/jpeg;base64,YQ==", detail: "low" } }))] }] });
    for (const reportKind of ["outreach", "full_visual"] as const) {
      const run = await reserveAiRun({ channel: reportKind === "outreach" ? "office" : "public", userId: "test", reportKind }, "https://example.com/");
      await requestAiCompletion(run, request(), "writer");
      await requestAiCompletion(run, request(), "review");
      await run.finish("completed");
    }
    assert.equal(generations, 4);
    assert.equal(counts, 4, "Every generation requires its own complete token-cost check");
    inputTokens = 100000;
    const denied = await reserveAiRun({ channel: "office", reportKind: "outreach" }, "https://example.com/");
    await assert.rejects(requestAiCompletion(denied, request(), "writer"), /per-roast AI budget/);
    assert.equal(generations, 4, "Over-budget evidence must never reach generation");
    await denied.finish("failed");
    console.log("Large-input integration passed: complete outreach/full evidence through writer and review, token preflight per call, over-budget generation blocked. Mock requests only; no AI credits.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
