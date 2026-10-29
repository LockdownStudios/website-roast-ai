// Count the complete prompt, including images and JSON schema, before generation.
// Chat/Responses framing can differ: reserve an additional 10% plus 1,024 tokens.
export async function authorizeTerraBudget(body: Record<string, unknown>, apiKey: string, ceiling: number, spent: number, stage: "writer" | "review") {
  const messages = body.messages as Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> }>;
  if (!Array.isArray(messages)) throw new Error("AI budget requires messages; no generation was sent.");
  const input = messages.map(message => ({ role: message.role, content: typeof message.content === "string" ? message.content : message.content.map(part => {
    if (part.type === "text") return { type: "input_text", text: part.text };
    if (part.type === "image_url" && part.image_url) return { type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail };
    throw new Error("Unsupported budget input; no generation was sent.");
  }) }));
  const format = body.response_format as { type?: string; json_schema?: Record<string, unknown> } | undefined;
  const response = await fetch("https://api.openai.com/v1/responses/input_tokens", {
    method: "POST", signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: body.model, input, ...(format?.type === "json_schema" ? { text: { format: { type: "json_schema", ...format.json_schema } } } : {}) }),
  });
  if (!response.ok) throw new Error(`AI input budget check unavailable (${response.status}); no generation was sent.`);
  const count = (await response.json()).input_tokens;
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Invalid AI input count; no generation was sent.");
  const inputReserve = (Math.ceil(count * 1.1) + 1024) * 2.5 / 1_000_000;
  // Leave room for review; do not remove evidence or omit the reviewer to fit.
  const reviewReserve = stage === "writer" ? 0.02 : 0;
  const affordable = Math.floor((ceiling - spent - inputReserve - reviewReserve) * 1_000_000 / 12);
  const limit = Math.min(Number(body.max_completion_tokens), ceiling <= 0.10 && stage === "writer" ? 2400 : Number(body.max_completion_tokens), affordable);
  const minimum = stage === "writer" ? 1800 : 400;
  if (!Number.isSafeInteger(limit) || limit < minimum) throw new Error("This report exceeds the per-roast AI budget; no additional generation was sent. Evidence and review were not silently removed.");
  body.max_completion_tokens = limit;
}
