import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outreachReportPresentation } from "../lib/reportPresentation";
import { renderCompactReportHtml } from "../lib/compactReportHtml";
import type { OutreachAudit } from "../lib/types";

const audit: OutreachAudit = { summary: "The next decision needs a chair at this hero's table.", strengths: ["A clear consultation route."], recommendation: "small improvements", recommendationReason: "Keep the identity; tighten the mobile opening.", scope: "Homepage desktop/mobile sampled; no form submission.", images: [0, 1].map(i => ({ label: i ? "Mobile" : "Desktop", sourceUrl: "https://example.test/", dataUrl: "data:image/jpeg;base64,YQ==" })), findings: [{ headline: "The hero has room for a barrister, not the next decision", category: "visual", observed: "The opening occupies the captured mobile viewport.", consequence: "The next section requires scrolling.", fix: "Test tighter spacing around the existing actions.", evidence: "Mobile screenshot", imageIndex: 1, pageUrl: "https://example.test/" }] };
const presentation = outreachReportPresentation(audit, "Example Attorneys");
const html = renderCompactReportHtml(presentation, "/api/reports/12345678-1234-4234-8234-123456789012/download");
for (const text of ["The Roast", "Single Biggest Leak", "Keep The Good Stuff", "The Problems. The Fixes.", "The Verdict", "Checks &amp; coverage", "Download PDF", audit.findings[0].headline!]) assert.ok(html.includes(text), text);
assert.ok(!html.includes("Website mini-audit"));
assert.ok(!html.includes("<img"));
assert.equal(presentation.findings[0].observation, audit.findings[0].observed);
assert.equal(presentation.verdict, audit.recommendationReason);
assert.equal(outreachReportPresentation(audit, "Example Attorneys", 7.4).score, 7.4);
assert.ok(renderCompactReportHtml(outreachReportPresentation(audit, "Example Attorneys", 7.4)).includes("7.4/10"));
assert.ok(renderCompactReportHtml(outreachReportPresentation(audit, "Example Attorneys", 0)).includes("0.0/10"));
for (const value of [undefined, NaN, Infinity, -1, 11]) assert.equal(outreachReportPresentation(audit, undefined, value).score, undefined);
const malicious = renderCompactReportHtml({ ...presentation, name: '<script>alert("x")</script>', url: "javascript:alert(1)" });
assert.ok(!malicious.includes("<script>"));
assert.ok(!malicious.includes('href="javascript:'));
assert.ok(!renderCompactReportHtml(presentation, "https://evil.test/").includes('href="https://evil.test/"'));
const savedPath = "tmp/saved-client-layout-report.json";
try {
  const saved = JSON.parse(readFileSync(savedPath, "utf8"));
  const restored = outreachReportPresentation(saved.roast.outreach, saved.scraped.title);
  assert.equal(restored.summary, saved.roast.outreach.summary, "Existing verified copy must not be rewritten for styling");
  assert.equal(restored.findings[0].headline, saved.roast.outreach.findings[0].headline);
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
console.log("Report presentation passes: shared HTML/PDF model, preserved saved copy/headlines, compact sections and safe links/escaping. No AI calls.");
