import { NextRequest, NextResponse } from "next/server";
import { getRoastAccess } from "@/lib/reportAccess";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { recordPaymentTransaction } from "@/lib/payments";
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

function resolvePayerEmail(
  verificationEmail: string | null,
  metadata: Record<string, unknown>,
): string | null {
  if (verificationEmail) {
    return verificationEmail.trim().toLowerCase();
  }

  return typeof metadata.payerEmail === "string"
    ? metadata.payerEmail.trim().toLowerCase()
    : null;
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
      await recordPaymentTransaction({
        reference: verification.reference,
        reportId,
        userId:
          typeof verification.metadata.userId === "string"
            ? verification.metadata.userId
            : report.userId ?? null,
        email: resolvePayerEmail(verification.customerEmail, verification.metadata),
        amountKobo: verification.amountKobo || expectedAmountKobo,
        currency: verification.currency ?? "ZAR",
        status: "failed",
        providerStatus: verification.status,
        providerMessage: "Paystack callback verification failed.",
        metadata: verification.metadata,
      });
      return NextResponse.redirect(
        resultRedirectUrl(request, reportId, "failed", "verification_failed"),
      );
    }

    await unlockRoastResult(reportId, "paystack");
    await recordPaymentTransaction({
      reference: verification.reference,
      reportId,
      userId:
        typeof verification.metadata.userId === "string"
          ? verification.metadata.userId
          : report.userId ?? null,
      email: resolvePayerEmail(verification.customerEmail, verification.metadata),
      amountKobo: verification.amountKobo || expectedAmountKobo,
      currency: verification.currency ?? "ZAR",
      status: "success",
      providerStatus: verification.status,
      providerMessage: "Paystack callback verified and report unlocked.",
      metadata: verification.metadata,
    });
    return NextResponse.redirect(resultRedirectUrl(request, reportId, "success"));
  } catch (error) {
    console.error("[paystack/verify] failed", {
      reference,
      message: error instanceof Error ? error.message : "Unknown verification error",
    });
    return NextResponse.redirect(genericFallbackUrl(request, "verification_error"));
  }
}
