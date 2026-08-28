"use client";

import { useMemo, useState } from "react";

type ShareReportProps = {
  reportId: string;
  score: number;
  toneSummary: string;
};

export function ShareReport({ reportId, score, toneSummary }: ShareReportProps) {
  const [copied, setCopied] = useState(false);
  const reportUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/result/${reportId}`;
  }, [reportId]);
  const downloadUrl = `/api/reports/download?id=${encodeURIComponent(reportId)}`;

  async function copyLink(): Promise<void> {
    if (!reportUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function shareOnX(): void {
    if (!reportUrl) {
      return;
    }

    const text = `Website Roast AI gave this page a ${score}/10: "${toneSummary}"`;
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(reportUrl)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Share & Download
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copyLink}
          className="rounded-xl border border-accent/45 bg-accent px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110"
        >
          {copied ? "Copied" : "Copy Link"}
        </button>
        <a
          href={downloadUrl}
          className="rounded-xl border border-accent/45 bg-accent/10 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-accent-soft transition hover:border-accent/70 hover:bg-accent/15"
        >
          Download PDF
        </a>
        <button
          type="button"
          onClick={shareOnX}
          className="rounded-xl border border-white/20 bg-black/25 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:border-accent/50 hover:text-accent-soft"
        >
          Share on X
        </button>
      </div>
    </section>
  );
}
