import { createHash, randomUUID } from "node:crypto";
import { defaultAiModel, providerRequestBody, roastAiProvider } from "./aiProvider";
import { estimateOpenAiRunUsd, maxAiRunUsd } from "./aiCost";

export type AiActor = { channel: "public" | "office" | "development"; userId?: string; reportKind?: "outreach" | "full_visual" };
export class AiUsageError extends Error {
  constructor(public code: string, message: string, public status = 429) { super(message); }
}

function setting(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new AiUsageError("ai-config", `Invalid ${name}; AI calls are blocked.`, 503);
  return value;
}

export function aiPolicy() {
  let provider;
  try { provider = roastAiProvider(); } catch { throw new AiUsageError("ai-config", "Invalid ROAST_AI_PROVIDER. Use openai or deepseek.", 503); }
  const defaultModel = defaultAiModel(provider);
  const model = process.env.ROAST_AI_MODEL?.trim() || defaultModel;
  return {
    provider,
    enabled: process.env.ROAST_AI_ENABLED === "1" && (process.env.NODE_ENV === "production" || process.env.ROAST_AI_ALLOW_LOCAL === "1"),
    model,
    allowedModels: (process.env.ROAST_AI_ALLOWED_MODELS || defaultModel).split(",").map(value => value.trim()).filter(Boolean),
    userDaily: setting("ROAST_USER_DAILY_LIMIT", 3, 100),
    globalDaily: setting("ROAST_GLOBAL_DAILY_LIMIT", 20, 500),
    dailyUnits: setting("ROAST_AI_DAILY_BUDGET_UNITS", 1_000_000, 100_000_000),
    monthlyUnits: setting("ROAST_AI_MONTHLY_BUDGET_UNITS", 10_000_000, 1_000_000_000),
    inputBytes: setting("ROAST_AI_MAX_INPUT_BYTES", model === "gpt-5.6-terra" ? 65_000 : 80_000, 120_000),
    writerTokens: setting("ROAST_AI_WRITER_MAX_TOKENS", 4000, 6000),
    reviewTokens: setting("ROAST_AI_REVIEW_MAX_TOKENS", 800, 1500),
  };
}

export function assertAiEnabled(actor: AiActor) {
  const policy = aiPolicy();
  if (!policy.enabled) throw new AiUsageError("ai-paused", "New AI reports are paused. Existing reports remain available.", 503);
  if (!policy.allowedModels.includes(policy.model)) throw new AiUsageError("ai-model-blocked", "The configured model is not approved for this spending policy.", 503);
  if (actor.channel === "public" && !actor.userId) throw new AiUsageError("sign-in-required", "Please sign in before generating a new report.", 401);
  return policy;
}

async function ledger(path: string, init: RequestInit) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new AiUsageError("ai-ledger-unavailable", "AI usage controls are not configured. New scans are paused.", 503);
  let response: Response;
  try {
    response = await fetch(new URL(`/rest/v1/${path}`, url), {
      ...init, signal: AbortSignal.timeout(8000), cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    });
  } catch {
    throw new AiUsageError("ai-ledger-unavailable", "The AI usage database could not be reached. Check the Roast AI Supabase project status and SUPABASE_URL. No new AI request was authorised.", 503);
  }
  if (!response.ok) throw new AiUsageError("ai-ledger-unavailable", "AI usage controls are unavailable. No new AI request was authorised.", 503);
  return response;
}

export async function verifyAiLedger() {
  await ledger("roast_ai_runs?select=id&limit=0", { method: "GET" });
}

export async function reserveAiRun(actor: AiActor, url: string) {
  const policy = assertAiEnabled(actor);
  const outreach = actor.reportKind === "outreach";
  const visual = outreach || actor.reportKind === "full_visual";
  if (visual && (policy.provider !== "openai" || policy.model !== "gpt-5.6-terra")) throw new AiUsageError("ai-visual-model", "Combined visual reports require the approved Terra policy.", 503);
  if (outreach && (actor.channel === "public" || policy.provider !== "openai" || policy.model !== "gpt-5.6-terra")) throw new AiUsageError("ai-outreach-access", "Visual outreach generation requires the private Office integration and approved Terra policy.", 403);
  if (outreach) { policy.inputBytes = Math.min(policy.inputBytes, 36000); policy.writerTokens = Math.min(policy.writerTokens, 2400); }
  if (visual && !outreach) policy.inputBytes = Math.min(policy.inputBytes, 58000);
  const imageTokens = outreach ? 8192 : visual ? 16384 : 0;
  if (policy.provider === "openai") {
    try {
      const estimate = estimateOpenAiRunUsd(policy.model, policy.inputBytes, policy.writerTokens, policy.reviewTokens, imageTokens);
      // Terra counts actual input before generation; UTF-8 reservations alone
      // would reject useful evidence even when the real request fits the cap.
      if (estimate > maxAiRunUsd() && policy.model !== "gpt-5.6-terra") throw new Error("The configured request allowances exceed the OpenAI per-roast cost ceiling. No AI request was sent.");
    } catch (error) { throw new AiUsageError("ai-cost-config", error instanceof Error ? error.message : "Invalid AI cost policy.", 503); }
  }
  const id = randomUUID();
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const units = policy.inputBytes * 2 + policy.writerTokens + policy.reviewTokens + 2048 + imageTokens;
  if (actor.channel === "office") {
    // Only the shared-secret authenticated internal route supplies this channel.
    // Staff scans remain metered, but public quotas/cooldowns cannot deny them.
    // Provider access, per-run cost, input/output and two-call caps still apply.
    await ledger("roast_ai_runs", { method: "POST", body: JSON.stringify({
      id, actor_hash: hash(`office:${actor.userId || "shared"}`), channel: "office",
      site_hash: hash(url), model: `${policy.provider}:${policy.model}`, reserved_units: units,
    }) });
  } else {
  const response = await ledger("rpc/reserve_roast_ai_run", { method: "POST", body: JSON.stringify({
    p_id: id, p_actor: hash(`${actor.channel}:${actor.userId || "shared"}`), p_channel: actor.channel,
    p_site: hash(url), p_model: `${policy.provider}:${policy.model}`,
    p_units: units,
    p_actor_limit: actor.channel === "development" ? setting("ROAST_DEVELOPMENT_DAILY_LIMIT", 1, 2) : policy.userDaily,
    p_global_limit: policy.globalDaily, p_daily_units: policy.dailyUnits, p_monthly_units: policy.monthlyUnits,
  }) });
  const result = await response.json();
  if (result?.allowed !== true) throw new AiUsageError("ai-limit-reached", "The scan allowance, cooldown or shared AI budget has been reached. Try again later.");
  }
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  return {
    id, model: policy.model, provider: policy.provider,
    costCeiling: maxAiRunUsd(),
    spentUpperUsd() { return (inputTokens * 2.5 + outputTokens * 12) / 1_000_000; },
    prepare(body: Record<string, unknown>, stage: "writer" | "review") {
      // Images are bounded and reserved: two for outreach, at most four for full visual reports.
      if (body.tools || body.functions || body.audio || body.modalities) throw new AiUsageError("ai-request-type", "Only text report requests are authorised by this spending policy.", 503);
      const prepared = providerRequestBody(policy.provider, { ...body, n: 1, stream: false, store: false }, policy.model, stage === "writer" ? policy.writerTokens : policy.reviewTokens);
      let images = 0;
      const serialized = JSON.stringify(prepared, (key, value) => {
        if (key !== "image_url") return value;
        images++;
        if (!visual || images > (outreach ? 2 : 4) || value?.detail !== "low" || typeof value?.url !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.url) || value.url.length > 350000) throw new AiUsageError("ai-images-disabled", "Image API inputs require the approved count of bounded low-detail JPEG captures.", 503);
        return { detail: "low", url: "[budgeted screenshot]" };
      });
      if (visual && (outreach ? images !== 2 : images < 2 || images > 4)) throw new AiUsageError("ai-images-disabled", outreach ? "Outreach requires exactly two bounded screenshots." : "Visual reports require two homepage captures and at most two decision-page captures.", 503);
      if (!visual && serialized.includes('"type":"image_url"')) throw new AiUsageError("ai-images-disabled", "Image API inputs are disabled by the spending policy.", 503);
      if (Buffer.byteLength(serialized, "utf8") > policy.inputBytes) throw new AiUsageError("ai-input-limit", "This evidence exceeds the AI input allowance; no additional model request was sent.", 422);
      if (calls >= 2) throw new AiUsageError("ai-call-limit", "The report's AI request limit has been reached.");
      if ((stage === "writer" && calls !== 0) || (stage === "review" && calls !== 1)) throw new AiUsageError("ai-stage-limit", "Only one writer call followed by one review call is authorised.");
      calls++;
      return prepared;
    },
    record(payload: { usage?: { prompt_tokens?: number; completion_tokens?: number } }) {
      if (policy.model === "gpt-5.6-terra" && (!Number.isSafeInteger(payload.usage?.prompt_tokens) || !Number.isSafeInteger(payload.usage?.completion_tokens) || (payload.usage?.prompt_tokens ?? 0) < 1 || (payload.usage?.completion_tokens ?? -1) < 0)) throw new AiUsageError("ai-usage-missing", "Provider usage is missing; further generation is blocked.", 503);
      const safe = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
      inputTokens += safe(payload.usage?.prompt_tokens);
      outputTokens += safe(payload.usage?.completion_tokens);
    },
    async finish(status: "completed" | "failed", errorCode?: "provider-quota" | "outreach-contract" | "outreach-writer" | "outreach-review") {
      try {
        await ledger(`roast_ai_runs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, error_code: errorCode || null, input_tokens: inputTokens, output_tokens: outputTokens, model_calls: calls, completed_at: new Date().toISOString() }) });
      } catch { console.error("[ai-usage] usage finalisation failed", { runId: id }); }
      // Reservations are never refunded: timeouts and failed responses can still incur provider costs.
    },
  };
}

export type AiRun = Awaited<ReturnType<typeof reserveAiRun>>;
