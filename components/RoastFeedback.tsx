"use client";

import { FormEvent, useState } from "react";
import { getOrCreateSessionId } from "@/lib/clientAnalytics";
import { getAccessToken } from "@/lib/clientAuth";
import type { ToneAccuracy } from "@/lib/types";

type RoastFeedbackProps = {
  reportId: string;
  url: string;
  score: number;
};

const SCORE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Way Off" },
  { value: 2, label: "Mostly Off" },
  { value: 3, label: "Half Right" },
  { value: 4, label: "Mostly Right" },
  { value: 5, label: "Spot On" },
];

const TONE_OPTIONS: Array<{ value: ToneAccuracy; label: string }> = [
  { value: "too_soft", label: "Too Soft" },
  { value: "balanced", label: "Balanced" },
  { value: "too_harsh", label: "Too Harsh" },
];

export function RoastFeedback({ reportId, url, score }: RoastFeedbackProps) {
  const [scoreAccuracy, setScoreAccuracy] = useState<number | null>(null);
  const [toneAccuracy, setToneAccuracy] = useState<ToneAccuracy | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!scoreAccuracy || !toneAccuracy) {
      setError("Please rate both score accuracy and tone.");
      return;
    }

    setIsLoading(true);
    setStatus("idle");

    try {
      const sessionId = getOrCreateSessionId();
      const accessToken = getAccessToken();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          reportId,
          sessionId,
          url,
          scoreAtReview: score,
          scoreAccuracy,
          toneAccuracy,
          notes: notes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save feedback.");
      }

      setStatus("saved");
    } catch (submitError) {
      setStatus("error");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save feedback.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-surface/80 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Help Us Tune The Roast
      </p>
      <h2 className="mt-2 text-xl font-black uppercase tracking-wide text-white">
        Was this report accurate?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Your feedback improves scoring reliability and roast tone over time.
      </p>

      <form className="mt-5 space-y-5" onSubmit={onSubmit}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Score Accuracy
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCORE_OPTIONS.map((option) => {
              const selected = scoreAccuracy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScoreAccuracy(option.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    selected
                      ? "border-accent/60 bg-accent/20 text-accent-soft"
                      : "border-white/15 bg-black/25 text-white/85 hover:border-accent/35"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Roast Tone
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TONE_OPTIONS.map((option) => {
              const selected = toneAccuracy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setToneAccuracy(option.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    selected
                      ? "border-accent/60 bg-accent/20 text-accent-soft"
                      : "border-white/15 bg-black/25 text-white/85 hover:border-accent/35"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor={`feedback-note-${reportId}`}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted"
          >
            Optional Note
          </label>
          <textarea
            id={`feedback-note-${reportId}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="What felt wrong, missing, or too harsh?"
            className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl border border-accent/50 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Saving..." : "Submit Feedback"}
          </button>

          {status === "saved" ? (
            <p className="text-sm font-semibold text-emerald-200">
              Feedback saved. This helps calibrate future roasts.
            </p>
          ) : null}

          {status === "error" && error ? (
            <p className="text-sm font-semibold text-red-200">{error}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
