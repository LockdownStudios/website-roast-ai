export type RoastAiProvider = "openai" | "deepseek";

export function roastAiProvider(): RoastAiProvider {
  const provider = process.env.ROAST_AI_PROVIDER?.trim() || "openai";
  if (provider !== "openai" && provider !== "deepseek") throw new Error("Invalid ROAST_AI_PROVIDER. Use openai or deepseek; no AI request was sent.");
  return provider;
}

export function defaultAiModel(provider: RoastAiProvider) {
  return provider === "deepseek" ? "deepseek-flash" : "gpt-5.6-terra";
}

export function aiProviderCredentials(provider: RoastAiProvider) {
  const keyName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY";
  const apiKey = process.env[keyName]?.trim();
  if (!apiKey || /placeholder|your_.*key/i.test(apiKey)) throw new Error(`Add ${keyName} privately on the server. No AI request was sent.`);
  return {
    apiKey,
    endpoint: provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions"
  };
}

export function providerRequestBody(provider: RoastAiProvider, body: Record<string, unknown>, model: string, maxTokens: number): Record<string, unknown> {
  const { max_tokens: _maxTokens, max_completion_tokens: _completionTokens, ...input } = body;
  void _maxTokens; void _completionTokens;
  if (provider === "openai") {
    if (model === "gpt-5.6-terra") {
      const { temperature: _temperature, top_p: _topP, ...terraInput } = input;
      void _temperature; void _topP;
      return { ...terraInput, model, max_completion_tokens: maxTokens, reasoning_effort: "none", service_tier: "default" };
    }
    return { ...input, model, max_completion_tokens: maxTokens, service_tier: "default" };
  }
  const format = input.response_format as { type?: string; json_schema?: { schema?: unknown } } | undefined;
  const messages = Array.isArray(input.messages) ? [...input.messages] : [];
  if (format?.type === "json_schema") {
    if (!format.json_schema?.schema) throw new Error("Missing JSON schema for DeepSeek report generation.");
    messages.push({ role: "system", content: `Return one JSON object matching this JSON schema exactly. Do not wrap it in markdown or omit required fields.\n${JSON.stringify(format.json_schema.schema)}` });
  }
  return {
    ...input, model, messages, max_tokens: maxTokens, reasoning_effort: "none",
    ...(format?.type === "json_schema" ? { response_format: { type: "json_object" } } : {})
  };
}
