import type { AiRun } from "./aiUsage";
import { aiProviderCredentials } from "./aiProvider";
import { modelRequestError } from "./modelRequest";
import { authorizeTerraBudget } from "./requestBudget";

export async function requestAiCompletion(run: AiRun, body: Record<string, unknown>, stage: "writer" | "review") {
  const startedAt = Date.now();
  const { apiKey, endpoint } = aiProviderCredentials(run.provider);
  const prepared = run.prepare(body, stage);
  if (run.provider === "openai" && run.model === "gpt-5.6-terra") {
    await authorizeTerraBudget(prepared, apiKey, run.costCeiling, run.spentUpperUsd(), stage);
  }
  const response = await fetch(endpoint, {
    method: "POST", signal: AbortSignal.timeout(45_000), redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(prepared)
  });
  if (!response.ok) throw await modelRequestError(response, `${run.provider} ${stage}`);
  const payload = await response.json();
  run.record(payload);
  if (process.env.VERCEL === "1") console.info("[ai] stage completed", { runId: run.id, stage, elapsedMs: Date.now() - startedAt, inputTokens: payload.usage?.prompt_tokens, outputTokens: payload.usage?.completion_tokens });
  const choice = payload.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== "stop") throw new Error(`${run.provider} ${stage} did not complete (${String(choice.finish_reason).replace(/[^a-z_]/gi, "").slice(0, 50)}).`);
  if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) throw new Error(`${run.provider} ${stage} returned empty content.`);
  return choice.message.content as string;
}
