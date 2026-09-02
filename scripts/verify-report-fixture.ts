import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderRoastReportPdf } from "../lib/reportPdf";
import { sanitizeRoastPayload } from "../lib/reportSanitizer";
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
  const sanitized = sanitizeRoastPayload(report.roast, report.scraped, report.scoring);
  const combinedReportText = [
    sanitized.first_impression,
    sanitized.single_biggest_leak,
    sanitized.lost_customers,
    sanitized.high_impact,
    sanitized.tone_summary,
    ...sanitized.mistakes,
    ...sanitized.quick_fixes,
    ...sanitized.evidence,
  ].join(" ");

  if (pdf.length < 5000 || pdf.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("Roast AI fixture PDF did not generate a valid PDF.");
  }

  if (!report.scoring.visualDesign) {
    throw new Error("Roast AI fixture is missing the visual design score.");
  }

  if ((report.scraped.siteFacts?.pagesReviewed.length ?? 0) < 2) {
    throw new Error("Roast AI fixture is missing multi-page review evidence.");
  }

  if (/mobile game|mobile players?|download the app|install the app|start playing/i.test(combinedReportText)) {
    throw new Error("Roast AI fixture contains cross-site app/game contamination.");
  }

  const contaminated = sanitizeRoastPayload(
    {
      ...report.roast,
      first_impression: "Mobile game buyers need Download The App above the fold.",
      mistakes: ["Garden maintenance should be pushed harder.", "Tell players to start playing."],
      quick_fixes: ["Where: Hero | Fix: Add Download The App | Example: Download The App"],
      evidence: ["This looks like a mobile game page."],
    },
    {
      ...report.scraped,
      siteFacts: {
        ...report.scraped.siteFacts,
        services: report.scraped.siteFacts?.services ?? [],
        exclusions: [
          {
            value: "Garden maintenance",
            sourceUrl: report.scraped.url,
            sourceRole: "home",
          },
        ],
        locations: report.scraped.siteFacts?.locations ?? [],
        contacts: report.scraped.siteFacts?.contacts ?? [],
        ctas: report.scraped.siteFacts?.ctas ?? [],
        trustSignals: report.scraped.siteFacts?.trustSignals ?? [],
        pagesReviewed: report.scraped.siteFacts?.pagesReviewed ?? [],
        copyIssues: report.scraped.siteFacts?.copyIssues ?? [],
      },
    },
    report.scoring,
  );
  const contaminatedCheck = [
    contaminated.first_impression,
    ...contaminated.mistakes,
    ...contaminated.quick_fixes,
    ...contaminated.evidence,
  ].join(" ");

  if (/mobile game|mobile players?|download the app|install the app|start playing|garden maintenance/i.test(contaminatedCheck)) {
    throw new Error("Roast AI sanitizer failed to clean deliberate contamination.");
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${pdf.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
