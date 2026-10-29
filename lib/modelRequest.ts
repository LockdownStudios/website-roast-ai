export async function modelRequestError(response: Response, stage: string): Promise<Error> {
  const payload = await response.json().catch(() => null);
  const rawCode = payload?.error?.code;
  const code = typeof rawCode === "string" && /^[a-z0-9_-]{1,80}$/i.test(rawCode) ? rawCode : "unknown";
  const hint = code === "model_not_found" ? " Check ROAST_AI_PROVIDER, ROAST_AI_MODEL and this provider's model access." : "";
  return new Error(`${stage} failed (${response.status}, ${code}).${hint}`);
}
