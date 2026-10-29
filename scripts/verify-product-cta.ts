import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { analyzeVisualSignals } from "../lib/visual";

async function main() {
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px Arial;margin:24px;background:#fff;color:#111}a.product-action{display:inline-block;background:#183568;color:white;padding:20px 28px;margin:8px;text-decoration:none;border-radius:6px}</style></head><body><main><h1>Choose a useful tool</h1><p>Two product paths for different needs.</p><a class="product-action" href="#cv">CV60</a><a class="product-action" href="#leave">Leave with Eaze</a></main></body></html>';
  const server = createServer((_request, response) => { response.writeHead(200, { "Content-Type": "text/html" }); response.end(html); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No local test address");
    const audit = await analyzeVisualSignals(`http://127.0.0.1:${address.port}/`, []);
    assert.equal(audit.available, true);
    for (const view of [audit.desktop, audit.mobile]) {
      assert.ok((view?.ctaCount || 0) >= 2, "Product-name buttons must be detected without action-word matching.");
      assert.ok(view?.primaryCtaAboveFold);
      assert.ok(["CV60", "Leave with Eaze"].includes(view?.primaryCtaText || ""));
    }
    console.log("Live local DOM checks passed: product-name button actions detected on desktop and mobile. No external site or paid API call.");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
