import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function statLabel(value: number, suffix = ""): string {
  return `${value}${suffix}`;
}

export default async function AnalyticsPage() {
  const summary = await getAnalyticsSummary();
  const generatedAt = new Date(summary.generatedAt).toLocaleString();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Internal Analytics
            </p>
            <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-white">
              Roast Funnel Dashboard
            </h1>
            <p className="mt-2 text-sm text-muted">Updated: {generatedAt}</p>
          </div>
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
          >
            {"<- Back to app"}
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Total Events
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.totalEvents)}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Unique Sessions
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.uniqueSessions)}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Roast Successes
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.quality.roastSuccesses)}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Avg Confidence
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.quality.avgConfidence, "%")}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Feedback Count
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.feedback.total)}
            </p>
          </article>
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Avg Score Accuracy
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {statLabel(summary.feedback.avgScoreAccuracy, "/5")}
            </p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Funnel
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-white/90">
              <li>
                Landing views: <span className="font-semibold">{summary.funnel.landingViews}</span>
              </li>
              <li>
                Roasts submitted: <span className="font-semibold">{summary.funnel.submits}</span>
              </li>
              <li>
                Roasts succeeded: <span className="font-semibold">{summary.funnel.successes}</span>
              </li>
              <li>
                Result pages viewed: <span className="font-semibold">{summary.funnel.resultViews}</span>
              </li>
              <li>
                Landing -&gt; Submit: <span className="font-semibold">{summary.funnel.landingToSubmitRate}%</span>
              </li>
              <li>
                Submit -&gt; Success: <span className="font-semibold">{summary.funnel.submitToSuccessRate}%</span>
              </li>
              <li>
                Success -&gt; Result view: <span className="font-semibold">{summary.funnel.successToResultViewRate}%</span>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Roast Quality
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-white/90">
              <li>
                Confidence high/med/low:{" "}
                <span className="font-semibold">
                  {summary.quality.confidenceBuckets.high}/
                  {summary.quality.confidenceBuckets.medium}/
                  {summary.quality.confidenceBuckets.low}
                </span>
              </li>
              <li>
                Scrape quality high/med/low:{" "}
                <span className="font-semibold">
                  {summary.quality.scrapeQuality.high}/
                  {summary.quality.scrapeQuality.medium}/
                  {summary.quality.scrapeQuality.low}
                </span>
              </li>
              <li>
                Cache hit rate: <span className="font-semibold">{summary.quality.cacheHitRate}%</span>
              </li>
              <li>
                Relaxed fallback rate:{" "}
                <span className="font-semibold">{summary.quality.relaxedFallbackRate}%</span>
              </li>
              <li>
                Retry rate: <span className="font-semibold">{summary.quality.retryRate}%</span>
              </li>
            </ul>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Feedback By Score Bucket
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-white/90">
              <li>
                &lt; 4.0 score accuracy:{" "}
                <span className="font-semibold">
                  {summary.feedback.scoreAccuracyByBucket.under4.avgAccuracy}/5
                </span>{" "}
                ({summary.feedback.scoreAccuracyByBucket.under4.count} reviews)
              </li>
              <li>
                4.0 - 5.9 score accuracy:{" "}
                <span className="font-semibold">
                  {summary.feedback.scoreAccuracyByBucket.from4to6.avgAccuracy}/5
                </span>{" "}
                ({summary.feedback.scoreAccuracyByBucket.from4to6.count} reviews)
              </li>
              <li>
                6.0 - 7.9 score accuracy:{" "}
                <span className="font-semibold">
                  {summary.feedback.scoreAccuracyByBucket.from6to8.avgAccuracy}/5
                </span>{" "}
                ({summary.feedback.scoreAccuracyByBucket.from6to8.count} reviews)
              </li>
              <li>
                8.0+ score accuracy:{" "}
                <span className="font-semibold">
                  {summary.feedback.scoreAccuracyByBucket.above8.avgAccuracy}/5
                </span>{" "}
                ({summary.feedback.scoreAccuracyByBucket.above8.count} reviews)
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Tone Accuracy
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-white/90">
              <li>
                Too soft:{" "}
                <span className="font-semibold">{summary.feedback.toneBreakdown.tooSoft}</span>
              </li>
              <li>
                Balanced:{" "}
                <span className="font-semibold">{summary.feedback.toneBreakdown.balanced}</span>
              </li>
              <li>
                Too harsh:{" "}
                <span className="font-semibold">{summary.feedback.toneBreakdown.tooHarsh}</span>
              </li>
            </ul>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Harshness Trend
            </h3>
            {summary.feedback.harshnessTrend.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs text-white/80">
                {summary.feedback.harshnessTrend.map((day) => (
                  <li key={day.date}>
                    {day.date}: soft {day.tooSoft} | balanced {day.balanced} | harsh {day.tooHarsh}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No tone feedback trend yet.</p>
            )}
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Most Mis-Scored Domains
            </h2>
            {summary.feedback.mostMiscalibratedDomains.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/90">
                {summary.feedback.mostMiscalibratedDomains.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No feedback domain diagnostics yet.</p>
            )}
          </article>

          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Top Submitted Hostnames
            </h2>
            {summary.topHostnames.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/90">
                {summary.topHostnames.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No submit hostnames captured yet.</p>
            )}
          </article>

          <article className="rounded-2xl border border-white/12 bg-surface/80 p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.12em] text-accent-soft">
              Top Errors
            </h2>
            {summary.topErrors.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/90">
                {summary.topErrors.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No tracked roast errors.</p>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
