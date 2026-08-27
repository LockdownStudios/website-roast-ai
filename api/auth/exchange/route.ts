import { NextRequest, NextResponse } from "next/server";
import { exchangeMagicLinkToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function normalizeTokenHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeType(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      tokenHash?: unknown;
      type?: unknown;
    };

    const tokenHash = normalizeTokenHash(body.tokenHash);
    const type = normalizeType(body.type);

    if (!tokenHash) {
      return NextResponse.json({ error: "Missing token hash." }, { status: 400 });
    }

    const session = await exchangeMagicLinkToken({ tokenHash, type });
    if (!session) {
      return NextResponse.json(
        { error: "Login link is invalid or expired." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to exchange login token." },
      { status: 500 },
    );
  }
}
