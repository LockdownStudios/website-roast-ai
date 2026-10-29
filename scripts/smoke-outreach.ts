import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateOutreachAudit } from "../lib/outreach";
import { scoreWebsite } from "../lib/scoring";
import { isClientReadyReport } from "../lib/reportQuality";
import { renderRoastReportPdf } from "../lib/reportPdf";
import { verifyAiLedger } from "../lib/aiUsage";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("This is a paid smoke test. Explicit --live and local spending opt-in are required.");
  loadEnvConfig(process.cwd());
  await verifyAiLedger();
  const saved = JSON.parse(await readFile("tmp/roast-batch/tashas-openai-accuracy-20261028.json", "utf8"));
  const visualAudit = JSON.parse(await readFile("tmp/outreach-visual-test.json", "utf8"));
  if (Date.now() - Date.parse(visualAudit.sampledAt) > 3600000) throw new Error("Capture fresh visual evidence before testing.");
  const scraped = { ...saved.scraped, visualAudit };
  const scoring = scoreWebsite(scraped);
  const originalFetch = globalThis.fetch;
  const usage: unknown[] = [];
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (String(args[0]).includes("api.openai.com") && response.ok) {
      const payload = await response.clone().json();
      if (payload.usage) usage.push(payload.usage);
    }
    return response;
  };
  let generation;
  try { generation = await generateOutreachAudit(scraped, scoring, { channel: "development" }); }
  finally {
    globalThis.fetch = originalFetch;
    await writeFile("tmp/outreach-live-usage.json", JSON.stringify({ usage }, null, 2));
  }
  const report: StoredRoastReport = { id: "tashas-outreach-test", url: scraped.url, scraped, scoring, roast: generation.roast, scrapeHash: "local-outreach-v1", createdAt: new Date().toISOString() };
  await writeFile("tmp/roast-batch/tashas-outreach-test.json", JSON.stringify(report, null, 2));
  const ready = isClientReadyReport(report.roast);
  const pdf = await renderRoastReportPdf(report, { access: { tier: "full_unlocked", priceZar: 49, unlockSource: "office" }, isUnlocked: true, internalDraftPreview: !ready });
  await mkdir("../output/pdf", { recursive: true });
  await writeFile("../output/pdf/tashas-outreach-test.pdf", pdf);
  console.log(JSON.stringify({ ready, review: generation.roast.generation?.review, findings: generation.roast.outreach?.findings.length, usage, pdf: "../output/pdf/tashas-outreach-test.pdf" }, null, 2));
  if (!ready) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
