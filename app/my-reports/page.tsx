"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthMagicLinkForm } from "@/components/AuthMagicLinkForm";
import { AuthStatus } from "@/components/AuthStatus";
import { clearAuthSession, getAccessToken } from "@/lib/clientAuth";
import type { ReportAccess } from "@/lib/types";

type MyReportItem = {
  id: string;
  url: string;
  score: number;
  scoreLabel: string;
  toneSummary: string;
  createdAt: string;
  unlocked: boolean;
  access: ReportAccess;
};

export default function MyReportsPage() {
  const [reports, setReports] = useState<MyReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        setIsAuthed(false);
        setIsLoading(false);
        return;
      }

      setIsAuthed(true);
      setError("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/reports/mine", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as {
          reports?: MyReportItem[];
          error?: string;
        };

        if (!response.ok || !Array.isArray(payload.reports)) {
          if (response.status === 401) {
            clearAuthSession();
            setIsAuthed(false);
          }
          throw new Error(payload.error ?? "Failed to load reports.");
        }

        setReports(payload.reports);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load reports.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
          >
            {"<- Back"}
          </Link>
          <AuthStatus />
        </div>

        <section className="rounded-3xl border border-white/12 bg-surface/85 p-6 shadow-xl shadow-black/40 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Account
          </p>
          <h1 className="mt-3 font-display text-5xl uppercase tracking-wide text-white">
            My Reports
          </h1>
          <p className="mt-2 text-sm text-muted">
            Signed-in roasts are saved here so you can revisit them later.
          </p>
        </section>

        {!isAuthed ? (
          <section className="rounded-3xl border border-white/12 bg-surface/80 p-6 sm:p-8">
            <p className="text-sm text-muted">
              Sign in to view your saved roasts.
            </p>
            <AuthMagicLinkForm className="mt-4" />
          </section>
        ) : null}

        {isAuthed ? (
          <section className="rounded-3xl border border-white/12 bg-surface/80 p-6 sm:p-8">
            {isLoading ? (
              <p className="text-sm font-semibold text-accent-soft">
                Loading your saved reports...
              </p>
            ) : null}

            {!isLoading && error ? (
              <p className="rounded-xl border border-danger/45 bg-danger/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            {!isLoading && !error && reports.length === 0 ? (
              <p className="text-sm text-muted">
                No saved reports yet. Roast a site while signed in and it will appear here.
              </p>
            ) : null}

            {!isLoading && !error && reports.length > 0 ? (
              <ul className="space-y-3">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="rounded-2xl border border-white/12 bg-black/25 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="break-all text-sm font-semibold text-white">
                          {report.url}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {new Date(report.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-accent-soft">
                          {report.score.toFixed(1)} / 10
                        </p>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted">
                          {report.scoreLabel}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-white/85">{report.toneSummary}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      {report.unlocked
                        ? "Full report unlocked"
                        : `Preview only - unlock for R${report.access.priceZar}`}
                    </p>
                    <Link
                      href={`/result/${report.id}`}
                      className="mt-3 inline-flex rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-accent-soft transition hover:border-accent/60"
                    >
                      Open Report
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
