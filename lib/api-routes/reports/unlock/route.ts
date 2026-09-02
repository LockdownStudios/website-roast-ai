import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await request.text().catch(() => "");
  return NextResponse.json(
    {
      error:
        "Manual report unlocks are disabled. Use Paystack checkout or the private Office roast endpoint.",
    },
    { status: 410 },
  );
}
