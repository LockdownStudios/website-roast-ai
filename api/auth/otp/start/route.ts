import { NextRequest, NextResponse } from "next/server";
import { sendEmailOtpCode } from "@/lib/auth";

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

    const result = await sendEmailOtpCode({ email });
    if (!result.ok) {
      const rawError =
        result.error ?? "Failed to send OTP code. Check Supabase email auth settings.";
      const lowerError = rawError.toLowerCase();
      const status = result.status >= 400 && result.status < 600 ? result.status : 500;

      if (status === 429 || lowerError.includes("rate")) {
        return NextResponse.json(
          { error: "Too many code requests. Wait about 60 seconds and try again." },
          { status: 429 },
        );
      }

      if (lowerError.includes("captcha")) {
        return NextResponse.json(
          {
            error:
              "Supabase CAPTCHA is blocking OTP. Disable CAPTCHA for email auth or add CAPTCHA token handling.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: rawError },
        { status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send OTP code." }, { status: 500 });
  }
}
