import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderRoastReportPdf } from "../lib/reportPdf";
import type { StoredRoastReport } from "../lib/types";

async function main() {
  const fixturePath = path.join(process.cwd(), "fixtures", "roast-report-sample.json");
  const outputDir = path.join(process.cwd(), "tmp", "pdfs");
  const outputPath = path.join(outputDir, "roast-report-fixture.pdf");
  const report = JSON.parse(await readFile(fixturePath, "utf8")) as StoredRoastReport;
  const access = report.roast.access ?? {
    tier: "full_unlocked" as const,
    priceZar: 50,
    unlockSource: "office" as const
  };
  const pdf = await renderRoastReportPdf(report, { access, isUnlocked: true });

  if (pdf.length < 5000 || pdf.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("Roast AI fixture PDF did not generate a valid PDF.");
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${pdf.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
