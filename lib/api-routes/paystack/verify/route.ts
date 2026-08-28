import { NextRequest, NextResponse } from "next/server";
import { getRoastAccess } from "@/lib/reportAccess";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { getRoastResult, unlockRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";

function resolveSiteUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
}

function resolveReportIdFromMetadata(metadata: Record<string, unknown>): string | null {
  const fromMetadata = metadata.reportId;
  if (typeof fromMetadata !== "string") {
    return null;
  }

  const trimmed = fromMetadata.trim();
  return trimmed ? trimmed : null;
}

function resultRedirectUrl(
  request: NextRequest,
  reportId: string,
  paymentStatus: "success" | "failed",
  reason?: string,
): URL {
  const siteUrl = resolveSiteUrl(request);
  const url = new URL(`/result/${reportId}`, siteUrl);
  url.searchParams.set("payment", paymentStatus);
  if (reason) {
    url.searchParams.set("reason", reason.slice(0, 120));
  }
  return url;
}

function genericFallbackUrl(request: NextRequest, reason: string): URL {
  const siteUrl = resolveSiteUrl(request);
  const url = new URL("/", siteUrl);
  url.searchParams.set("payment", "failed");
  url.searchParams.set("reason", reason.slice(0, 120));
  return url;
}

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference")?.trim();
  if (!reference) {
    return NextResponse.redirect(genericFallbackUrl(request, "missing_reference"));
  }

  try {
    const verification = await verifyPaystackTransaction(reference);
    const reportId = resolveReportIdFromMetadata(verification.metadata);
    if (!reportId) {
      return NextResponse.redirect(genericFallbackUrl(request, "missing_report_id"));
    }

    const report = await getRoastResult(reportId);
    if (!report) {
      return NextResponse.redirect(genericFallbackUrl(request, "report_not_found"));
    }

    const expectedAmountKobo = getRoastAccess(report.roast).priceZar * 100;
    const paidEnough = verification.amountKobo >= expectedAmountKobo;
    const wasSuccessful =
      verification.status.toLowerCase() === "success" &&
      paidEnough &&
      (verification.currency ?? "").toUpperCase() === "ZAR";

    if (!wasSuccessful) {
      return NextResponse.redirect(
        resultRedirectUrl(request, reportId, "failed", "verification_failed"),
      );
    }

    await unlockRoastResult(reportId, "paystack");
    return NextResponse.redirect(resultRedirectUrl(request, reportId, "success"));
  } catch {
    return NextResponse.redirect(genericFallbackUrl(request, "verification_error"));
  }
}
