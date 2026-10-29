// Approved standard uncached rates, USD per million tokens (28 October 2026).
// Unknown models fail closed rather than inheriting a cheaper model's estimate.
export function estimateOpenAiRunUsd(model: string, inputBytes: number, writerTokens: number, reviewTokens: number, imageTokens = 0) {
  if ([inputBytes, writerTokens, reviewTokens, imageTokens].some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid AI cost allowances.");
  // Terra reports cache writes separately; reserve their 1.25x input rate too.
  const rate = model === "gpt-5.6-terra" ? { input: 2.5, output: 12 }
    : /^gpt-4o-mini(?:-2024-07-18)?$/.test(model) ? { input: 0.15, output: 0.60 } : null;
  if (!rate) throw new Error("This OpenAI model has no approved cost estimate. Use gpt-5.6-terra; no AI request was sent.");
  // UTF-8 bytes conservatively bound text tokens; reserve two full requests plus framing.
  const inputTokens = inputBytes * 2 + 2048 + imageTokens;
  const outputTokens = writerTokens + reviewTokens;
  return Math.ceil((inputTokens * rate.input + outputTokens * rate.output) * 100) / 100_000_000;
}

export function maxAiRunUsd() {
  const raw = process.env.ROAST_AI_MAX_RUN_USD?.trim() || "0.10";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error("ROAST_AI_MAX_RUN_USD must be greater than 0 and at most 1 USD.");
  return value;
}
