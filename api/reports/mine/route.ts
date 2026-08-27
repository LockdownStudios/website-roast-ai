import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { getRoastAccess, isRoastUnlocked } from "@/lib/reportAccess";
import { getRoastResultsByUserId } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const user = await getSupabaseUserFromAccessToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const reports = await getRoastResultsByUserId(user.id, 200);
    return NextResponse.json({
      reports: reports.map((report) => ({
        access: getRoastAccess(report.roast),
        unlocked: isRoastUnlocked(report.roast),
        id: report.id,
        url: report.url,
        score: report.roast.score,
        scoreLabel: report.roast.score_label,
        toneSummary: report.roast.tone_summary,
        createdAt: report.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}
