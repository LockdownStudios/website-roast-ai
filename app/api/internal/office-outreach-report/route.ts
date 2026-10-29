import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRoastResult } from "@/lib/store";
import { isClientReadyReport } from "@/lib/reportQuality";
import { renderOutreachPdf } from "@/lib/outreachPdf";
import { outreachReportPresentation } from "@/lib/reportPresentation";
import { renderCompactReportHtml } from "@/lib/compactReportHtml";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const expected = process.env.OFFICE_ROAST_API_SECRET?.trim();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !token || Buffer.byteLength(expected) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return new NextResponse("Unauthorized", { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Invalid report", { status: 400 });
  const report = await getRoastResult(id);
  if (!report?.roast.outreach || !isClientReadyReport(report.roast)) return new NextResponse("No reviewed mini-audit available", { status: 409 });
  const requestedSubject = request.nextUrl.searchParams.get("subject")?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  const subject = requestedSubject || report.scraped.siteFacts?.companyName || report.scraped.title.replace(/\s+[|–-]\s+.*$/, "").slice(0, 80);
  if (request.nextUrl.searchParams.get("format") === "html") {
    const leadId = request.nextUrl.searchParams.get("leadId");
    const download = leadId && /^[0-9a-f-]{36}$/i.test(leadId) ? `/api/reports/${leadId}/download` : undefined;
    return new NextResponse(renderCompactReportHtml(outreachReportPresentation(report.roast.outreach, subject), download), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const pdf = await renderOutreachPdf(report.roast.outreach, false, subject || undefined);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
