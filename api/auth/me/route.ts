import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, getSupabaseUserFromAccessToken } from "@/lib/auth";

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

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Failed to resolve user." }, { status: 500 });
  }
}
