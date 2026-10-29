import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { renderRoastReportPdf } from "../lib/reportPdf";
import { isClientReadyReport } from "../lib/reportQuality";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  await mkdir("tmp/roast-batch/pdfs", { recursive: true });
  for (const file of await readdir("tmp/roast-batch")) {
    if (!/^[a-z0-9-]+\.json$/.test(file)) continue;
    const result = JSON.parse(await readFile(`tmp/roast-batch/${file}`, "utf8")) as StoredRoastReport;
    if (!isClientReadyReport(result.roast)) {
      console.log(`${file}: withheld, evidence review failed`);
      continue;
    }
    const access = { tier: "full_unlocked" as const, priceZar: 49, unlockSource: "office" as const };
    const pdf = await renderRoastReportPdf({ ...result, id: file, createdAt: new Date().toISOString(),
      scrapeHash: "local-test-batch", roast: { ...result.roast, access } }, { access, isUnlocked: true });
    const output = `tmp/roast-batch/pdfs/${file.replace(/\.json$/, "")}-roast.pdf`;
    await writeFile(output, pdf);
    console.log(`${output}: ${pdf.length} bytes`);
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
