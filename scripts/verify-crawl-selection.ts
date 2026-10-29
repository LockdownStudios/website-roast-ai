import assert from "node:assert/strict";
import { selectRepresentativeCandidates } from "../lib/scrape";

const candidates: Parameters<typeof selectRepresentativeCandidates>[0] = [
  { url: "https://example.com/elements/products/", role: "services", score: 15, discoveredFrom: "sitemap" },
  { url: "https://example.com/elements/pages/about/", role: "about", score: 14, discoveredFrom: "sitemap" },
  { url: "https://example.com/elements/pages/contact/", role: "contact", score: 12, discoveredFrom: "navigation" },
  { url: "https://example.com/product/chalet/", role: "services", score: 10, discoveredFrom: "navigation" },
  { url: "https://example.com/product/hotel-room/", role: "services", score: 10, discoveredFrom: "navigation" },
  { url: "https://example.com/fr/contact/", role: "contact", score: 20, discoveredFrom: "navigation" },
  { url: "https://example.com/cart/", role: "other", score: 20, discoveredFrom: "navigation" },
];
const selected = selectRepresentativeCandidates(candidates, 3, new Set(), "https://example.com/");
assert.ok(selected.some(page => page.url.endsWith("/chalet/")));
assert.ok(selected.some(page => page.url.endsWith("/hotel-room/")));
assert.ok(selected.some(page => page.url.endsWith("/elements/pages/contact/")), "A real linked contact page remains eligible even under /elements/");
assert.ok(!selected.some(page => page.discoveredFrom === "sitemap"));
const french = selectRepresentativeCandidates(candidates, 3, new Set(), "https://example.com/fr/");
assert.equal(french.length, 1);
assert.ok(french[0].url.includes("/fr/"));
console.log("Crawl selection checks passed: offerings before orphan demos, real contact retained, locale and utility filtering.");
