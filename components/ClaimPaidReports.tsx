"use client";

import { useState } from "react";
import { getAccessToken } from "@/lib/clientAuth";

type ClaimPaidReportsProps = {
  onClaimed?: () => void;
};

export function ClaimPaidReports({ onClaimed }: ClaimPaidReportsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function claimReports() {
    const token = getAccessToken();
    if (!token) {
      setIsError(true);
      setMessage("Sign in with the same email you used at checkout first.");
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch("/api/reports/claim-paid", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as {
        claimed?: number;
        alreadyOwned?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to recover paid reports.");
      }

      const claimed = payload.claimed ?? 0;
      const alreadyOwned = payload.alreadyOwned ?? 0;
      if (claimed > 0) {
        setMessage(`Recovered ${claimed} paid report${claimed === 1 ? "" : "s"}.`);
        onClaimed?.();
        return;
      }

      if (alreadyOwned > 0) {
        setMessage("Your paid reports are already connected to this account.");
        onClaimed?.();
        return;
      }

      setMessage("No paid guest reports were found for this email.");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Failed to recover paid reports.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-soft">
            Paid As Guest?
          </p>
          <p className="mt-1 text-sm text-white/80">
            Claim unlocked reports paid with this sign-in email.
          </p>
        </div>
        <button
          type="button"
          onClick={claimReports}
          disabled={isLoading}
          className="inline-flex h-11 shrink-0 justify-center rounded-xl border border-accent/45 bg-accent px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Checking..." : "Recover Paid Reports"}
        </button>
      </div>
      {message ? (
        <p
          className={`mt-3 text-sm font-semibold ${
            isError ? "text-red-200" : "text-emerald-200"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
