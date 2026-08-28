import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getAnalyticsSummary();
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json(
      { error: "Failed to load analytics summary." },
      { status: 500 },
    );
  }
}
