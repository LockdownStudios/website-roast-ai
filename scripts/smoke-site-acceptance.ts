import { createScrapeHash } from "../lib/fingerprint";
import { loadEnvConfig } from "@next/env";
import { access, mkdir, writeFile } from "node:fs/promises";
import { scrapeWebsite } from "../lib/scrape";
import { analyzeVisualSignals, withoutVisualImageData } from "../lib/visual";
import { scoreWebsite } from "../lib/scoring";
import { generateRoastWithUsage } from "../lib/ai";
import { assertAiEnabled, verifyAiLedger } from "../lib/aiUsage";
import { aiProviderCredentials } from "../lib/aiProvider";
import { isClientReadyReport } from "../lib/reportQuality";
import { renderRoastReportPdf } from "../lib/reportPdf";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Explicit --live and approved local opt-in are required.");
  loadEnvConfig(process.cwd());
  const policy = assertAiEnabled({ channel: "development" });
  if (policy.provider !== "openai" || policy.model !== "gpt-5.6-terra") throw new Error("This acceptance test requires the configured Terra model.");
  const url = process.argv[2];
  const nameIndex = process.argv.indexOf("--name");
  const name = nameIndex >= 0 ? process.argv[nameIndex + 1] : undefined;
  if (!url || !/^https?:\/\//i.test(url) || !name || !/^[a-z0-9-]+$/.test(name)) throw new Error("Supply the requested public URL and --name lowercase-slug.");
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }).replace(/-/g, "");
  const prefix = `tmp/${name}-acceptance-${day}`;
  const exists = await access(`${prefix}-attempt.json`).then(() => true, () => false);
  if (exists) throw new Error("This approved live attempt already started. No automatic retry is permitted.");
  await verifyAiLedger();
  const credentials = aiProviderCredentials("openai");
  const preflight = await fetch(`https://api.openai.com/v1/models/${policy.model}`, { headers: { Authorization: `Bearer ${credentials.apiKey}` }, signal: AbortSignal.timeout(12000), redirect: "error" });
  if (!preflight.ok) throw new Error(`Model access preflight HTTP ${preflight.status}. No paid generation requested.`);
  console.log("Ledger and model access verified. Collecting fresh evidence for " + url);
  const base = await scrapeWebsite(url);
  const visualAudit = await analyzeVisualSignals(url, (base.crawl?.pages || []).filter(page => page.ctaEvidence?.length).map(page => page.url));
  const scraped = { ...base, visualAudit };
  const scoring = scoreWebsite(scraped);
  await writeFile(`${prefix}-evidence.json`, JSON.stringify({ url, scraped, scoring }, null, 2));
  for (const [name, view] of [["desktop", visualAudit.desktop], ["mobile", visualAudit.mobile]] as const) {
    if (view?.screenshotDataUrl) await writeFile(`${prefix}-${name}.jpg`, Buffer.from(view.screenshotDataUrl.split(",")[1], "base64"));
  }
  console.log(JSON.stringify({ pages: scraped.crawl?.pageCount, technicalChecks: scraped.technicalChecks?.length, visualAvailable: visualAudit.available, desktop: visualAudit.desktop?.captureReadiness, mobile: visualAudit.mobile?.captureReadiness, score: scoring.score }));
  const originalFetch = globalThis.fetch;
  const responses: unknown[] = [];
  let posts = 0;
  globalThis.fetch = async (...args) => {
    if (String(args[0]) === credentials.endpoint && args[1]?.method === "POST") {
      if (++posts > 2) throw new Error("Only one writer and one reviewer request are authorised.");
      await writeFile(`${prefix}-attempt.json`, JSON.stringify({ startedAt: new Date().toISOString(), posts }));
    }
    const response = await originalFetch(...args);
    if (String(args[0]) === credentials.endpoint) {
      responses.push({ status: response.status, payload: await response.clone().json().catch(() => null) });
      await writeFile(`${prefix}-responses.json`, JSON.stringify(responses, null, 2));
    }
    return response;
  };
  let generation;
  try { generation = await generateRoastWithUsage(scraped, scoring, { channel: "development" }); }
  finally { globalThis.fetch = originalFetch; }
  const report: StoredRoastReport = { id: `${name}-live-${day}`, url, roast: generation.roast, scraped: { ...scraped, visualAudit: withoutVisualImageData(visualAudit) }, scoring, createdAt: new Date().toISOString(), scrapeHash: createScrapeHash(scraped) };
  await writeFile(`tmp/roast-batch/${name}-live-${day}.json`, JSON.stringify(report, null, 2));
  const ready = isClientReadyReport(report.roast);
  if (report.roast.generation?.mode === "fallback") {
    console.log(JSON.stringify({ ready: false, posts, generation: report.roast.generation, error: generation.error, pdf: null, notice: "No fallback PDF was presented as a generated roast. Inspect the saved raw writer output separately." }, null, 2));
    process.exitCode = 1;
    return;
  }
  await mkdir("../output/pdf", { recursive: true });
  const pdf = await renderRoastReportPdf(report, { access: { tier: "full_unlocked", priceZar: 49, unlockSource: "office" }, isUnlocked: true, internalDraftPreview: !ready });
  await writeFile(`../output/pdf/${name}-fresh-live-roast.pdf`, pdf);
  console.log(JSON.stringify({ ready, posts, score: scoring.score, generation: report.roast.generation, error: generation.error, pdf: `../output/pdf/${name}-fresh-live-roast.pdf` }, null, 2));
  if (!ready) process.exitCode = 1;
}
void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
