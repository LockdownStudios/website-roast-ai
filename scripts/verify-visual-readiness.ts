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
    const inlineSpinner = await check('<main style="min-height:150vh"><h1>Finished website</h1><span class="preloader" style="display:inline-block;width:20px;height:20px">...</span></main>');
    assert.equal(inlineSpinner.settled, true, "A small inline spinner must not inherit its full-page parent's area");
    const busyMain = await check('<main aria-busy="true" style="min-height:150vh"><h1>Finished content</h1><a href="/contact">Contact</a></main>');
    assert.equal(busyMain.settled, true, "A busy content region is not automatically an overlay");
    const wrappedLoader = await check(content + '<div style="position:fixed;inset:0;background:white;z-index:99"><span class="preloader" style="display:inline-block;width:20px;height:20px">...</span></div>');
    assert.equal(wrappedLoader.settled, false, "A real blocking wrapper containing a tiny spinner must still block");
    const behindContent = await check('<div id="preloader" style="position:fixed;inset:0;background:white;z-index:0">Loading</div><main style="position:relative;z-index:1;background:white;min-height:150vh"><h1>Finished content</h1></main>');
    assert.equal(behindContent.settled, true, "A loader retained behind finished content is not blocking");
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
