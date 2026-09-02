import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";
import { claimPaidRoastResultsByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const user = await getSupabaseUserFromAccessToken(token);
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const summary = await claimPaidRoastResultsByEmail(user.id, user.email);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[reports/claim-paid] failed", {
      message: error instanceof Error ? error.message : "Unknown claim error",
    });
    return NextResponse.json(
      { error: "Failed to recover paid reports." },
      { status: 500 },
    );
  }
}
