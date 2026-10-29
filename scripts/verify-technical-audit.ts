import assert from "node:assert/strict";
import { technicalChecksFromHtml, normalizeTechnicalChecks } from "../lib/technicalAudit";
import { estimateOpenAiRunUsd } from "../lib/aiCost";

const html = `<title>Example</title><meta content="Description" name="description"><meta name="viewport" content="width=device-width, initial-scale=1"><link href="/" rel="canonical"><img src="decorative.jpg" alt=""><!-- <meta name="robots" content="noindex"> --><script>const fake = '<img src="not-real">';</script>`;
const checks = technicalChecksFromHtml([{ url: "https://example.com/", html }]);
assert.equal(checks.find(c => c.name === "Image alt attributes")?.status, "observed", "Empty alt is valid; no fabricated deficiency from scripts.");
assert.equal(checks.find(c => c.name === "Indexing directives")?.status, "observed", "Ignore comments.");
assert.equal(checks.find(c => c.name === "Search descriptions")?.status, "observed", "Attribute order is irrelevant.");
const issues = technicalChecksFromHtml([{ url: "https://example.com/shop", html: '<meta name="robots" content="noindex"><img src="product.jpg">' }]);
assert.equal(issues.find(c => c.name === "Indexing directives")?.status, "review");
assert.equal(issues.find(c => c.name === "Image alt attributes")?.status, "review");
assert.deepEqual(issues.find(c => c.name === "Page titles")?.pageUrls, ["https://example.com/shop"]);
assert.equal(issues.find(c => c.name === "Speed and Core Web Vitals")?.status, "not_tested");
assert.equal(normalizeTechnicalChecks(undefined), undefined, "Legacy reports must not invent historical measurements.");
assert.throws(() => normalizeTechnicalChecks([{ ...checks[0], status: "passed-security" }]));
assert.ok(estimateOpenAiRunUsd("gpt-5.6-terra", 60000, 4000, 800, 8192) <= 0.40);
console.log("Technical audit checks passed: exact HTML scope, comments/scripts excluded, attribute order, decorative alt, noindex review, untested performance and bounded visual full-report cost. No network calls.");
