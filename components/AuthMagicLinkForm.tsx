"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearAuthSession,
  fetchCurrentAuthUser,
  setAuthTokens,
  setStoredAuthUser,
} from "@/lib/clientAuth";

type AuthMagicLinkFormProps = {
  className?: string;
  redirectTo?: string;
};

function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeCode(value: string): string | null {
  const normalized = value.replace(/\s/g, "").slice(0, 24);
  if (!/^[A-Za-z0-9]{6,24}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function AuthMagicLinkForm({
  className = "",
  redirectTo = "/my-reports",
}: AuthMagicLinkFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendCode() {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send magic link.");
      }

      setStep("code");
      setStatus("sent");
      setMessage("Code sent. Check your inbox and enter the latest code.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to send OTP code.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyCode() {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      setStatus("error");
      setMessage("Enter the code from your email (6 to 24 characters).");
      return;
    }

    setIsLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          code: normalizedCode,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        accessToken?: string;
        refreshToken?: string | null;
        user?: { id?: string; email?: string | null };
      };

      if (!response.ok || typeof payload.accessToken !== "string") {
        throw new Error(payload.error ?? "Invalid or expired OTP code.");
      }

      setAuthTokens(payload.accessToken, payload.refreshToken ?? undefined);
      const resolvedUser = await fetchCurrentAuthUser(payload.accessToken);
      if (!resolvedUser) {
        clearAuthSession();
        throw new Error("Could not verify your session. Please request a new code.");
      }

      setStoredAuthUser(resolvedUser);

      setStatus("sent");
      setMessage("Signed in. Redirecting...");
      router.replace(redirectTo);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to verify OTP code.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (step === "email") {
      await sendCode();
      return;
    }

    await verifyCode();
  }

  return (
    <form className={`space-y-3 ${className}`.trim()} onSubmit={onSubmit}>
      <label
        htmlFor="magic-link-email"
        className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
      >
        Sign in with Email Code
      </label>
      <div className="flex flex-col gap-2">
        <input
          id="magic-link-email"
          type="email"
          required
          autoComplete="email"
          disabled={step === "code"}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="h-11 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent/55"
        />

        {step === "code" ? (
          <input
            id="email-otp-code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\s/g, "").slice(0, 24))}
            placeholder="Enter code from email"
            className="h-11 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm tracking-[0.2em] text-white placeholder:tracking-normal placeholder:text-muted outline-none transition focus:border-accent/55"
          />
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 shrink-0 rounded-xl border border-accent/45 bg-accent px-4 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading
              ? step === "email"
                ? "Sending..."
                : "Verifying..."
              : step === "email"
                ? "Send Code"
                : "Verify & Sign In"}
          </button>

          {step === "code" ? (
            <button
              type="button"
              onClick={() => {
                setCode("");
                void sendCode();
              }}
              disabled={isLoading}
              className="h-11 shrink-0 rounded-xl border border-white/20 bg-black/20 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              Resend Code
            </button>
          ) : null}

          {step === "code" ? (
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setStatus("idle");
                setMessage("");
              }}
              disabled={isLoading}
              className="h-11 shrink-0 rounded-xl border border-white/20 bg-black/20 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              Change Email
            </button>
          ) : null}
        </div>
      </div>

      {status === "sent" ? (
        <p className="text-sm font-semibold text-emerald-200">{message}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm font-semibold text-red-200">{message}</p>
      ) : null}
      <p className="text-xs text-muted">
        {step === "email"
          ? "We will email a one-time sign-in code."
          : "Enter the newest code from your email."}
      </p>
    </form>
  );
}
