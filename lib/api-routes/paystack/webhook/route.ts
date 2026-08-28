import { NextRequest, NextResponse } from "next/server";
import { getRoastAccess } from "@/lib/reportAccess";
import {
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/paystack";
import { getRoastResult, unlockRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";

type PaystackWebhookPayload = {
  event?: unknown;
  data?: {
    reference?: unknown;
    status?: unknown;
    metadata?: unknown;
  };
};

function extractReference(payload: PaystackWebhookPayload): string | null {
  const reference = payload.data?.reference;
  if (typeof reference !== "string") {
    return null;
  }

  const trimmed = reference.trim();
  return trimmed ? trimmed : null;
}

function extractReportIdFromMetadata(payload: PaystackWebhookPayload): string | null {
  const metadata = payload.data?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const reportId = (metadata as Record<string, unknown>).reportId;
  if (typeof reportId !== "string") {
    return null;
  }

  const trimmed = reportId.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const reference = extractReference(payload);
  const reportIdFromMetadata = extractReportIdFromMetadata(payload);
  if (!reference || !reportIdFromMetadata) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const verification = await verifyPaystackTransaction(reference);
    const reportId =
      typeof verification.metadata.reportId === "string"
        ? verification.metadata.reportId
        : reportIdFromMetadata;

    const report = await getRoastResult(reportId);
    if (!report) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const expectedAmountKobo = getRoastAccess(report.roast).priceZar * 100;
    const wasSuccessful =
      verification.status.toLowerCase() === "success" &&
      verification.amountKobo >= expectedAmountKobo &&
      (verification.currency ?? "").toUpperCase() === "ZAR";

    if (!wasSuccessful) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    await unlockRoastResult(reportId, "paystack");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[paystack/webhook] verification failed", {
      reference,
      reportId: reportIdFromMetadata,
      message: error instanceof Error ? error.message : "Unknown webhook verification error",
    });
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
