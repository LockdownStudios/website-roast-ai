import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { scrapeWebsite } from "../lib/scrape";
import { analyzeVisualSignals, withoutVisualImageData } from "../lib/visual";
import { scoreWebsite } from "../lib/scoring";
import { generateRoastWithUsage } from "../lib/ai";
import { isClientReadyReport } from "../lib/reportQuality";
import { assertAiEnabled, verifyAiLedger } from "../lib/aiUsage";
import { aiProviderCredentials } from "../lib/aiProvider";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.argv[2];
  const nameIndex = process.argv.indexOf("--name");
  const name = nameIndex >= 0 ? process.argv[nameIndex + 1] : undefined;
  if (nameIndex >= 0 && (!name || !/^[a-z0-9-]+$/.test(name))) throw new Error("Use a lowercase slug for --name.");
  const outputPath = name ? `tmp/roast-batch/${name}.json` : "tmp/reviewed-smoke-result.json";
  if (!process.argv.includes("--live")) {
    const saved = JSON.parse(await readFile(outputPath, "utf8").catch(() => { throw new Error("No saved test exists. Default mode never calls AI. Choose an existing --name for replay; a live test requires --live and explicit AI policy opt-in."); }));
    if (url && saved.url !== url) throw new Error("Saved evidence belongs to a different site.");
    console.log(JSON.stringify({ mode: "offline-replay", paidCalls: 0, url: saved.url, scoring: scoreWebsite(saved.scraped), originalGeneration: saved.roast?.generation, notice: "Recomputed scoring only. The saved narrative was not regenerated or re-approved." }, null, 2));
    return;
  }
  const policy = assertAiEnabled({ channel: "development" });
  if (!url || !/^https?:\/\//.test(url)) throw new Error("Provide a public test URL. This script uses the configured model but does not save to Supabase or charge a customer.");
  console.log("Checking usage database before collecting evidence (no model generation)...");
  await verifyAiLedger();
  if (policy.provider === "openai") {
    const credentials = aiProviderCredentials("openai");
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(policy.model)}`, { headers: { Authorization: `Bearer ${credentials.apiKey}` }, redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`OpenAI model-access preflight failed (${response.status}) for ${policy.model}. Check the project key and model availability privately. No paid generation was requested.`);
  }
  console.log("Collecting public site evidence...");
  const replay = process.argv.includes("--reuse-evidence") ? JSON.parse(await readFile(outputPath, "utf8")) : null;
  if (replay && replay.url !== url) throw new Error("Saved evidence belongs to a different site.");
  const base: Awaited<ReturnType<typeof scrapeWebsite>> = replay ? replay.scraped : await scrapeWebsite(url);
  const visualAudit = replay ? { available: false, sampledAt: new Date().toISOString(), findings: [], evidence: [], reason: "Text-only replay: original screenshot pixels are not persisted" }
    : await analyzeVisualSignals(url, (base.crawl?.pages || []).filter(page => page.ctaEvidence?.length).map(page => page.url));
  const scraped = { ...base, visualAudit } as Awaited<ReturnType<typeof scrapeWebsite>>;
  const scoring = scoreWebsite(scraped);
  console.log(`Reviewed ${base.crawl?.pageCount || 1} pages; visual capture ${visualAudit.available ? "available" : "unavailable"}. Generating and reviewing...`);
  const generation = await generateRoastWithUsage(scraped, scoring);
  const ready = isClientReadyReport(generation.roast);
  await mkdir(name ? "tmp/roast-batch" : "tmp", { recursive: true });
  await writeFile(outputPath, JSON.stringify({ url, scoring, scraped: { ...scraped, visualAudit: withoutVisualImageData(visualAudit) }, ...generation }, null, 2));
  console.log(JSON.stringify({ url, ready, pages: base.crawl?.pageCount, visual: visualAudit.available,
    generation: generation.roast.generation, error: generation.error }, null, 2));
  if (!ready) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke check failed."); process.exitCode = 1; });
