import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { AnalyticsEventName, LandingVariant } from "@/lib/types";

const EVENT_NAMES: AnalyticsEventName[] = [
  "landing_view",
  "roast_submit",
  "roast_success",
  "roast_error",
  "result_view",
];

function isEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && EVENT_NAMES.includes(value as AnalyticsEventName);
}

function isVariant(value: unknown): value is LandingVariant | undefined {
  return value === undefined || value === "A" || value === "B";
}

function normalizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, 128);
  return trimmed.length > 0 ? trimmed : null;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      sessionId?: unknown;
      variant?: unknown;
      metadata?: unknown;
    };

    if (!isEventName(body.name)) {
      return NextResponse.json({ error: "Invalid event name." }, { status: 400 });
    }

    const sessionId = normalizeSessionId(body.sessionId);
    if (!sessionId) {
      return NextResponse.json({ error: "Missing or invalid sessionId." }, { status: 400 });
    }

    if (!isVariant(body.variant)) {
      return NextResponse.json({ error: "Invalid variant." }, { status: 400 });
    }

    await trackAnalyticsEvent({
      name: body.name,
      sessionId,
      variant: body.variant,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, string | number | boolean>)
          : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to track event." }, { status: 500 });
  }
}
