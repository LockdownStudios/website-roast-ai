import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { scrapeWebsite } from "../lib/scrape";

async function main() {
  await mkdir("tmp/crawl-checks", { recursive: true });
  for (const [name, url] of [["mogodi", "https://www.mogodilodge.co.za/"], ["reinke", "https://reinke.com/"]]) {
    const scraped = await scrapeWebsite(url);
    const pages = scraped.crawl?.pages ?? [];
    const urls = pages.map(page => page.url);
    await writeFile(`tmp/crawl-checks/${name}.json`, JSON.stringify(scraped, null, 2));
    console.log(JSON.stringify({ name, urls }));
    if (name === "mogodi") {
      assert.ok(urls.some(url => url.includes("/product/")), "Review actual accommodation pages");
      assert.ok(urls.some(url => url.includes("/elements/pages/contact")), "Retain genuine booking destination");
      assert.ok(!urls.some(url => /\/(cart|my-account)\//.test(url)), "Avoid utility pages displacing guest information");
    } else {
      assert.ok(urls.some(url => url.includes("/find-a-dealer")), "Review actual dealer destination");
      assert.ok(!urls.some(url => /\/(es-mx|fr|hu)\//.test(url)), "Translated duplicate pages must not consume English sample");
    }
  }
  console.log("Live crawl selection checks passed. No AI requests were made.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
