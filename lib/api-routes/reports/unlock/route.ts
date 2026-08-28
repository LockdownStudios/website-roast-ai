import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { getRoastResult, unlockRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";

function normalizeReportId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { reportId?: unknown };
    const reportId = normalizeReportId(body.reportId);

    if (!reportId) {
      return NextResponse.json({ error: "Missing report id." }, { status: 400 });
    }

    const report = await getRoastResult(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await getSupabaseUserFromAccessToken(token) : null;
    if (token && !user) {
      return NextResponse.json(
        { error: "Session expired. Sign in again and retry unlock." },
        { status: 401 },
      );
    }

    if (report.userId && user && report.userId !== user.id) {
      return NextResponse.json(
        { error: "This report belongs to another account." },
        { status: 403 },
      );
    }

    // Temporary unlock endpoint until Paystack webhook flow is wired.
    const unlocked = await unlockRoastResult(reportId, "mock");
    if (!unlocked) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      reportId: unlocked.id,
      unlocked: true,
      access: unlocked.roast.access,
    });
  } catch {
    return NextResponse.json({ error: "Failed to unlock report." }, { status: 500 });
  }
}
