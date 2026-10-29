import assert from "node:assert/strict";
import { authorizeTerraBudget } from "../lib/requestBudget";

async function main() {
  const original = globalThis.fetch;
  let count = 12000, status = 200;
  let sent: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses/input_tokens");
    sent = JSON.parse(String(init?.body));
    return Response.json({ input_tokens: count }, { status });
  };
  const request = () => ({ model: "gpt-5.6-terra", max_completion_tokens: 4000, messages: [{ role: "user", content: [{ type: "text", text: "Evidence" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,YQ==", detail: "low" } }] }], response_format: { type: "json_schema", json_schema: { name: "report", strict: true, schema: { type: "object" } } } });
  try {
    const writer = request();
    await authorizeTerraBudget(writer, "fake", 0.1, 0, "writer");
    assert.equal(writer.max_completion_tokens, 2400);
    assert.ok(JSON.stringify(sent).includes('"type":"input_image"'));
    assert.ok(JSON.stringify(sent).includes('"name":"report"'));
    const review = { ...request(), max_completion_tokens: 800 };
    await authorizeTerraBudget(review, "fake", 0.1, 0.045, "review");
    assert.equal(review.max_completion_tokens, 800);
    await assert.rejects(authorizeTerraBudget(request(), "fake", 0.1, 0.09, "review"), /exceeds/);
    count = 100000;
    await assert.rejects(authorizeTerraBudget(request(), "fake", 0.1, 0, "writer"), /exceeds/);
    count = -1;
    await assert.rejects(authorizeTerraBudget(request(), "fake", 0.1, 0, "writer"), /Invalid/);
    status = 503;
    await assert.rejects(authorizeTerraBudget(request(), "fake", 0.1, 0, "writer"), /unavailable/);
    console.log("Request budget checks passed: complete schema/image counting, bounded output, shared spend and fail-closed preflight. No generation calls.");
  } finally { globalThis.fetch = original; }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
