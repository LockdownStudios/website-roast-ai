import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { RoastResult } from "@/components/RoastResult";
import { ResultViewTracker } from "@/components/ResultViewTracker";
import { ShareReport } from "@/components/ShareReport";
import { RoastFeedback } from "@/components/RoastFeedback";
import { UnlockFullReport } from "@/components/UnlockFullReport";
import { buildTeaserRoast, getRoastAccess, isRoastUnlocked } from "@/lib/reportAccess";
import { getRoastResult } from "@/lib/store";

export const dynamic = "force-dynamic";

type ResultPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    payment?: string;
    reason?: string;
    freshness?: "fresh" | "cached";
  }>;
};

function normalizePaymentReason(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export default async function ResultPage({ params, searchParams }: ResultPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const report = await getRoastResult(id);

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-surface/80 p-8 text-center shadow-xl shadow-black/40">
          <h1 className="font-display text-4xl uppercase tracking-wide text-white">
            Roast Not Found
          </h1>
          <p className="mt-3 text-muted">
            This report is gone from memory. Generate a fresh roast and we are
            back in business.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl border border-accent/40 bg-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:brightness-110"
          >
            Roast Another Site
          </Link>
        </section>
      </main>
    );
  }

  const access = getRoastAccess(report.roast);
  const unlocked = isRoastUnlocked(report.roast);
  const roastForView = unlocked ? report.roast : buildTeaserRoast(report.roast);
  const paymentStatus = query.payment === "success" || query.payment === "failed"
    ? query.payment
    : null;
  const freshnessHint =
    query.freshness === "cached" || query.freshness === "fresh"
      ? query.freshness
      : "cached";
  const scoringForView = {
    ...report.scoring,
    analysisMeta: {
      engineVersion: report.scoring.analysisMeta?.engineVersion ?? "unknown",
      generatedAt: report.scoring.analysisMeta?.generatedAt ?? report.createdAt,
      freshness: freshnessHint,
      sourcePageCount:
        report.scoring.analysisMeta?.sourcePageCount ?? report.scraped.crawl?.pageCount ?? 1,
      crawlStrategy:
        report.scoring.analysisMeta?.crawlStrategy ?? report.scraped.crawl?.strategy ?? "single_page",
    },
  };
  const paymentReason = normalizePaymentReason(query.reason);

  return (
    <main className="min-h-screen px-6 py-12">
      <ResultViewTracker reportId={report.id} score={report.roast.score} />
      <div className="mx-auto mb-6 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
        >
          {"<- Roast another website"}
        </Link>
        <AuthStatus />
      </div>
      {paymentStatus === "success" ? (
        <div className="mx-auto mb-6 w-full max-w-5xl rounded-2xl border border-emerald-300/35 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Payment successful. Your full report is now unlocked.
        </div>
      ) : null}
      {paymentStatus === "failed" ? (
        <div className="mx-auto mb-6 w-full max-w-5xl rounded-2xl border border-red-300/35 bg-red-300/10 px-4 py-3 text-sm font-semibold text-red-100">
          Payment was not completed. {paymentReason ? `Reason: ${paymentReason}.` : ""} You can try again below.
        </div>
      ) : null}
      <RoastResult
        roast={roastForView}
        scoring={scoringForView}
        url={report.url}
        scraped={report.scraped}
        access={access}
        isUnlocked={unlocked}
      />

      {!unlocked ? (
        <div className="mx-auto mt-6 w-full max-w-5xl">
          <UnlockFullReport reportId={report.id} priceZar={access.priceZar} />
        </div>
      ) : null}

      {unlocked ? (
        <div className="mx-auto mt-6 w-full max-w-5xl">
          <RoastFeedback
            reportId={report.id}
            url={report.url}
            score={report.roast.score}
          />
        </div>
      ) : null}
      {unlocked ? (
        <div className="mx-auto mt-6 w-full max-w-5xl">
          <ShareReport
            reportId={report.id}
            score={report.roast.score}
            toneSummary={report.roast.tone_summary}
          />
        </div>
      ) : null}
    </main>
  );
}
