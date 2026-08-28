"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClientEvent } from "@/lib/clientAnalytics";
import { clearAuthSession, getAccessToken } from "@/lib/clientAuth";
import type { LandingVariant, ScrapeQuality } from "@/lib/types";

type UrlInputProps = {
  showLabel?: boolean;
  center?: boolean;
  placeholder?: string;
  buttonText?: string;
  microcopy?: string;
  className?: string;
  variant?: LandingVariant;
  context?: "hero" | "bottom";
};

function normalizeInputUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function toConfidenceBucket(
  confidence: number | undefined,
): "high" | "medium" | "low" | "unknown" {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "unknown";
  }
  if (confidence >= 80) {
    return "high";
  }
  if (confidence >= 55) {
    return "medium";
  }
  return "low";
}

export function UrlInput({
  showLabel = true,
  center = false,
  placeholder = "Enter your website URL...",
  buttonText = "Roast My Website",
  microcopy = "No signup required. Instant results.",
  className = "",
  variant,
  context = "hero",
}: UrlInputProps) {
  const router = useRouter();
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedUrl = normalizeInputUrl(url);
    if (!normalizedUrl) {
      setError("That URL is broken. Paste a valid website URL.");
      return;
    }

    setIsLoading(true);

    let hostname = "";
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      hostname = "";
    }

    void trackClientEvent({
      name: "roast_submit",
      variant,
      metadata: {
        context,
        hostname,
      },
    });

    try {
      const accessToken = getAccessToken();
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const payload = (await response.json()) as {
        id?: string;
        cached?: boolean;
        authExpired?: boolean;
        error?: string;
        scoring?: {
          confidence?: number;
          analysisMeta?: {
            freshness?: "fresh" | "cached";
          };
        };
        scrapeMeta?: {
          quality?: ScrapeQuality;
          retryUsed?: boolean;
          usedRelaxedFallback?: boolean;
          contentLength?: number;
          confidence?: number;
        };
      };

      if (!response.ok || !payload.id) {
        throw new Error(
          payload.error ?? "Roast failed. The site might be blocking crawlers.",
        );
      }

      if (payload.authExpired) {
        clearAuthSession();
      }

      const confidence = payload.scrapeMeta?.confidence ?? payload.scoring?.confidence;

      void trackClientEvent({
        name: "roast_success",
        variant,
        metadata: {
          context,
          cached: Boolean(payload.cached),
          confidence: confidence ?? 0,
          confidence_bucket: toConfidenceBucket(confidence),
          scrape_quality: payload.scrapeMeta?.quality ?? "unknown",
          scrape_retry_used: Boolean(payload.scrapeMeta?.retryUsed),
          scrape_relaxed_fallback: Boolean(payload.scrapeMeta?.usedRelaxedFallback),
          content_length: payload.scrapeMeta?.contentLength ?? 0,
        },
      });

      const freshness = payload.scoring?.analysisMeta?.freshness
        ?? (payload.cached ? "cached" : "fresh");
      router.push(`/result/${payload.id}?freshness=${freshness}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something exploded. Please try again.";
      setError(message);

      void trackClientEvent({
        name: "roast_error",
        variant,
        metadata: {
          context,
          reason: message.slice(0, 120),
        },
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className={`space-y-3 ${className}`.trim()} onSubmit={onSubmit}>
      {showLabel ? (
        <label
          className={`block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted ${center ? "text-center" : ""}`.trim()}
          htmlFor={inputId}
        >
          Website URL
        </label>
      ) : null}

      <div className="rounded-2xl border border-white/12 bg-black/35 p-2 sm:p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            type="url"
            required
            autoComplete="url"
            placeholder={placeholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-13 w-full rounded-xl border border-white/10 bg-background/65 px-4 text-[15px] text-white placeholder:text-muted/90 outline-none transition focus:border-accent/55"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="h-13 shrink-0 rounded-xl border border-accent/50 bg-accent px-5 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {buttonText}
          </button>
        </div>
      </div>

      {microcopy ? (
        <p
          className={`text-xs font-medium text-muted ${center ? "text-center" : ""}`.trim()}
        >
          {microcopy}
        </p>
      ) : null}

      {isLoading ? (
        <p
          className={`text-sm font-semibold text-accent-soft ${center ? "text-center" : ""}`.trim()}
        >
          {"Roasting your website... \u{1F525}"}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </form>
  );
}
