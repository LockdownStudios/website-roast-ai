import assert from "node:assert/strict";
import { chromium } from "playwright";
import { waitForVisualReadiness } from "../lib/visualReadiness";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const check = async (html: string, timeout = 2200) => {
      await page.setContent(html);
      await page.evaluate("var __name = (fn) => fn;");
      return page.evaluate(waitForVisualReadiness, timeout);
    };
    const content = '<main><h1>Choose your next stay</h1><a href="/rooms">View rooms and availability</a></main>';
    assert.equal((await check(content)).settled, true);
    const overlay = '<div id="preloader" style="position:fixed;inset:0;background:white;z-index:99">Loading</div>';
    const blocked = await check(content + overlay);
    assert.equal(blocked.settled, false);
    assert.ok(blocked.reasons.includes("Loading overlay remains visible"));
    const delayed = await check(content + overlay + '<script>setTimeout(() => document.getElementById("preloader").remove(), 1400)</script>', 3000);
    assert.equal(delayed.settled, true);
    assert.ok(delayed.waitedMs >= 1400);
    const hidden = await check(content + '<div id="preloader" style="display:none">Loading</div>');
    assert.equal(hidden.settled, true, "Hidden loaders must not invalidate a finished page");
    const broken = await check(content + '<img src="data:image/png;base64,broken" width="200" height="200">');
    assert.equal(broken.settled, false);
    assert.ok(broken.reasons.includes("Visible image failed to load"));
    const intro = await check('<main><p>Brand intro</p><a href="#">PLAY</a><a href="#">SKIP</a></main>');
    assert.equal(intro.settled, false);
    assert.ok(intro.reasons.includes("Intro screen requires interaction"));
    console.log("Visual readiness checks passed: stable page, blocked/delayed/interactive intros, hidden loader and broken image.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
