import { readFile, writeFile } from "node:fs/promises";
import { parsePairedFindings, projectPairedFindings } from "../lib/pairedFindings";
import { renderRoastReportPdf } from "../lib/reportPdf";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  const name = process.argv[2], day = process.argv[3];
  if (!name || !/^[a-z0-9-]+$/.test(name) || !/^\d{8}$/.test(day || "")) throw new Error("Supply a local saved test slug and YYYYMMDD.");
  const responses = JSON.parse(await readFile(`tmp/${name}-acceptance-${day}-responses.json`, "utf8"));
  const saved = JSON.parse(await readFile(`tmp/roast-batch/${name}-live-${day}.json`, "utf8")) as StoredRoastReport;
  const raw = JSON.parse(responses[0]?.payload?.choices?.[0]?.message?.content || "null");
  const findings = parsePairedFindings(raw?.findings);
  const roast = { ...saved.roast, technicalChecks: saved.scraped.technicalChecks, findings, ...projectPairedFindings(findings), claim_contract: [], evidence: [], generation: { ...saved.roast.generation, mode: "hybrid" as const, reason: "validation_failed" as const, review: undefined, validationIssues: ["Unreviewed original writer output; citation validation failed before review. Not approved for client use."] } };
  for (const key of ["first_impression", "single_biggest_leak", "lost_customers", "high_impact", "tone_summary"] as const) {
    if (typeof raw[key] !== "string") throw new Error(`Missing draft field ${key}`);
    roast[key] = raw[key];
  }
  const pdf = await renderRoastReportPdf({ ...saved, roast }, { access: { tier: "full_unlocked", priceZar: 49, unlockSource: "office" }, isUnlocked: true, internalDraftPreview: true });
  await writeFile(`../output/pdf/${name}-fresh-live-roast.pdf`, pdf);
  await writeFile(`tmp/${name}-unreviewed-writer-preview.json`, JSON.stringify({ ...saved, roast }, null, 2));
  console.log("Original writer preview rendered with draft labels; saved failed report untouched. No network or AI calls.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
