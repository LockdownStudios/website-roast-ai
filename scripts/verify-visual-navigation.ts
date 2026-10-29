import assert from "node:assert/strict";
import { createServer } from "node:http";
import { analyzeVisualSignals } from "../lib/visual";

async function main() {
  // Reproduce a real DOMContentLoaded delay longer than the old 12s cutoff.
  // No external websites, model calls, secrets or paid requests are involved.
  const server = createServer((request, response) => {
    if (request.url === "/deferred.js") {
      setTimeout(() => { response.setHeader("Content-Type", "application/javascript"); response.end("document.documentElement.dataset.finished='yes';"); }, 13000);
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html><head><script defer src="/deferred.js"></script></head><body><main><h1>Property services</h1><p>A settled, complete page after a slow deferred script.</p><a href="/contact">Contact our team</a></main></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const result = await analyzeVisualSignals(`http://127.0.0.1:${port}/`);
    assert.equal(result.available, true, result.reason);
    for (const view of [result.desktop, result.mobile]) {
      assert.equal(view?.captureReadiness?.settled, true);
      assert.ok(view?.screenshotDataUrl?.startsWith("data:image/jpeg;base64,"));
    }
    console.log("Slow-navigation regression passed: both complete viewport captures survive a 13-second deferred-script delay. No AI calls.");
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
