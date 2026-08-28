import { NextRequest, NextResponse } from "next/server";
import { buildTeaserRoast, getRoastAccess, isRoastUnlocked } from "@/lib/reportAccess";
import { renderRoastReportPdf, roastReportFilename } from "@/lib/reportPdf";
import { sanitizeStoredRoastReport } from "@/lib/reportSanitizer";
import { getRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "Missing report id." }, { status: 400 });
  }

  const report = await getRoastResult(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const safeReport = sanitizeStoredRoastReport(report);
  const access = getRoastAccess(safeReport.roast);
  const isUnlocked = isRoastUnlocked(safeReport.roast);
  const visibleReport = isUnlocked
    ? safeReport
    : {
        ...safeReport,
        roast: buildTeaserRoast(safeReport.roast),
      };
  const pdf = await renderRoastReportPdf(visibleReport, { access, isUnlocked });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${roastReportFilename(visibleReport)}"`,
      "Content-Type": "application/pdf",
    },
  });
}
