"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getStoredAuthUser } from "@/lib/clientAuth";

type UnlockFullReportProps = {
  reportId: string;
  priceZar: number;
};

export function UnlockFullReport({ reportId, priceZar }: UnlockFullReportProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredAuthUser();
    if (stored?.email) {
      setEmail(stored.email);
    }
  }, []);

  async function onUnlockWithPaystack() {
    setIsLoading(true);
    setError("");

    try {
      const token = getAccessToken();
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reportId, email }),
      });

      const payload = (await response.json()) as {
        error?: string;
        alreadyUnlocked?: boolean;
        authorizationUrl?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to initialize checkout.");
      }

      if (payload.alreadyUnlocked) {
        router.refresh();
        return;
      }

      if (!payload.authorizationUrl) {
        throw new Error("Checkout URL missing from payment provider response.");
      }

      window.location.assign(payload.authorizationUrl);
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Failed to initialize checkout.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft">
        Full Report Locked
      </p>
      <h2 className="mt-2 text-xl font-black uppercase tracking-wide text-white">
        Unlock Full Conversion Breakdown
      </h2>
      <p className="mt-2 text-sm text-white/85">
        You are seeing the free roast preview. Unlock to get section-by-section fixes,
        example copy you can use, and a 7-day implementation plan.
      </p>
      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
        Checkout Email
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent/55"
      />
      <button
        type="button"
        onClick={onUnlockWithPaystack}
        disabled={isLoading}
        className="mt-4 inline-flex rounded-xl border border-accent/45 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Redirecting to Checkout..." : `Unlock Full Report - R${priceZar}`}
      </button>
      <p className="mt-2 text-[11px] text-muted">
        Secure checkout powered by Paystack. Test mode works with `sk_test` keys.
      </p>
      {error ? (
        <p className="mt-3 rounded-xl border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
