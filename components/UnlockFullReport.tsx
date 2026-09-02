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
    <section className="overflow-hidden rounded-2xl border border-accent/40 bg-accent/10">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft">
            Full Report Locked
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white">
            Unlock The Full Conversion Breakdown
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/85">
            The preview shows the headline problem. The paid report gives you the
            actual repair plan: what to change, where to change it, and why it
            matters.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Score detail", "Category scoring and confidence signals."],
              ["Fix plan", "Prioritized changes with examples."],
              ["7-day plan", "A practical implementation sequence."],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-xl border border-white/12 bg-black/25 p-3"
              >
                <p className="text-xs font-black uppercase tracking-[0.13em] text-accent-soft">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/75">{copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="rounded-2xl border border-white/12 bg-background/70 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
                  One-Time Unlock
                </p>
                <p className="mt-1 text-4xl font-black text-white">
                  R{priceZar}
                </p>
              </div>
              <p className="pb-1 text-right text-xs font-semibold uppercase tracking-[0.12em] text-accent-soft">
                No subscription
              </p>
            </div>

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
              className="mt-4 inline-flex w-full justify-center rounded-xl border border-accent/45 bg-accent px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Redirecting to Checkout..." : `Unlock Full Report - R${priceZar}`}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              Secure checkout powered by Paystack. The full report unlocks after
              payment is verified.
              {" "}
              <a href="/recover" className="font-semibold text-accent-soft underline">
                Already paid? Recover it here.
              </a>
            </p>
            {error ? (
              <p className="mt-3 rounded-xl border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
