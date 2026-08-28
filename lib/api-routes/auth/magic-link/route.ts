import { NextRequest, NextResponse } from "next/server";
import { sendMagicLinkEmail } from "@/lib/auth";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const redirectTo = new URL("/auth/callback", appUrl).toString();
    const result = await sendMagicLinkEmail({ email, redirectTo });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.error ?? "Failed to send magic link. Check Supabase auth settings.",
        },
        { status: result.status >= 400 && result.status < 600 ? result.status : 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send magic link." }, { status: 500 });
  }
}
