import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderRoastReportPdf } from "../lib/reportPdf";
import { compactEvidence } from "../lib/compactEvidence";
import { claimEvidenceRecords } from "../lib/ai";
import { isClientReadyReport } from "../lib/reportQuality";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("Run with NODE_ENV=development; draft previews must not run in production.");
  const source = "tmp/roast-batch/tashas-openai-accuracy-20261028.json";
  const saved = JSON.parse(await readFile(source, "utf8")) as StoredRoastReport;
  const access = { tier: "full_unlocked" as const, priceZar: 49, unlockSource: "office" as const };
  const report = { ...saved, id: "tashas-format-preview", createdAt: saved.roast.generation?.review?.checkedAt || new Date().toISOString(), scrapeHash: "local-format-preview" };
  const pdf = await renderRoastReportPdf(report, { access, isUnlocked: true, internalDraftPreview: true });
  await mkdir("../output/pdf", { recursive: true });
  const output = "../output/pdf/tashas-final-format-internal-preview.pdf";
  await writeFile(output, pdf);
  const records = claimEvidenceRecords(saved.scraped, saved.scoring);
  const original = Buffer.byteLength(JSON.stringify(records));
  const packed = Buffer.byteLength(JSON.stringify(compactEvidence(records)));
  console.log(JSON.stringify({ output, clientReady: isClientReadyReport(saved.roast), paidCalls: 0, evidenceRecords: records.length, originalCatalogBytes: original, compactCatalogBytes: packed, catalogReductionPercent: Math.round((1 - packed / original) * 100) }, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
