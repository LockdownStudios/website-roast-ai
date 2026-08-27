import { NextRequest, NextResponse } from "next/server";
import { verifyEmailOtpCode } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s/g, "").trim();
  if (!/^[A-Za-z0-9]{6,24}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      code?: unknown;
    };

    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and OTP code are required." },
        { status: 400 },
      );
    }

    const session = await verifyEmailOtpCode({ email, code });
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code. Use the latest code sent to your email." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  } catch {
    return NextResponse.json({ error: "Failed to verify OTP code." }, { status: 500 });
  }
}
