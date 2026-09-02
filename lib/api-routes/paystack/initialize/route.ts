import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { getRoastAccess, isRoastUnlocked } from "@/lib/reportAccess";
import { createPaystackReference, initializePaystackTransaction } from "@/lib/paystack";
import { recordPaymentTransaction } from "@/lib/payments";
import { getRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";

function normalizeReportId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, 320);
}

function resolveSiteUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      reportId?: unknown;
      email?: unknown;
    };
    const reportId = normalizeReportId(body.reportId);

    if (!reportId) {
      return NextResponse.json({ error: "Missing report id." }, { status: 400 });
    }

    const report = await getRoastResult(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const access = getRoastAccess(report.roast);
    if (isRoastUnlocked(report.roast)) {
      return NextResponse.json({
        ok: true,
        alreadyUnlocked: true,
        reportId: report.id,
      });
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await getSupabaseUserFromAccessToken(token) : null;
    if (token && !user) {
      return NextResponse.json(
        { error: "Session expired. Sign in again and retry checkout." },
        { status: 401 },
      );
    }

    if (report.userId && (!user || report.userId !== user.id)) {
      return NextResponse.json(
        { error: "This report belongs to another account." },
        { status: 403 },
      );
    }

    const payerEmail = normalizeEmail(user?.email ?? body.email);
    if (!payerEmail) {
      return NextResponse.json(
        { error: "Valid email is required to start checkout." },
        { status: 400 },
      );
    }

    const siteUrl = resolveSiteUrl(request);
    const callbackUrl = new URL("/api/paystack/verify", siteUrl).toString();
    const reference = createPaystackReference(report.id);
    const checkout = await initializePaystackTransaction({
      email: payerEmail,
      amountZar: access.priceZar,
      callbackUrl,
      reference,
      metadata: {
        reportId: report.id,
        userId: user?.id ?? report.userId ?? null,
        product: "website_roast_full_report_unlock",
        priceZar: access.priceZar,
      },
    });
    await recordPaymentTransaction({
      reference: checkout.reference,
      reportId: report.id,
      userId: user?.id ?? report.userId ?? null,
      email: payerEmail,
      amountKobo: access.priceZar * 100,
      currency: "ZAR",
      status: "initialized",
      providerStatus: "initialized",
      authorizationUrl: checkout.authorizationUrl,
      metadata: {
        product: "website_roast_full_report_unlock",
        priceZar: access.priceZar,
      },
    });

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      reference: checkout.reference,
      authorizationUrl: checkout.authorizationUrl,
      accessCode: checkout.accessCode,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize Paystack checkout.";
    const status = message.includes("PAYSTACK_SECRET_KEY") ? 503 : 500;

    console.error("[paystack/initialize] failed", {
      message,
    });

    return NextResponse.json({ error: message }, { status });
  }
}
