import { notFound } from "next/navigation";
import { RoastResult } from "@/components/RoastResult";
import { getLocalReview, LOCAL_REVIEW_SITES, LOCAL_REVIEW_NOTES } from "@/lib/localReview";
import { isClientReadyReport } from "@/lib/reportQuality";

export const dynamic = "force-dynamic";

export default async function LocalReviewPage({ searchParams }: { searchParams: Promise<{ site?: string | string[] }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const site = typeof query.site === "string" ? query.site : undefined;
  const result = await getLocalReview(site);
  const ready = Boolean(result && isClientReadyReport(result.roast));
  return <main className="mx-auto w-full max-w-6xl px-5 py-8">
    <h1 className="text-2xl font-black">Local report review</h1>
    <nav aria-label="Test reports" className="my-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-accent">
      <a href="/dev-review" aria-current={!site ? "page" : undefined}>Lockdown Studios</a>
      {LOCAL_REVIEW_SITES.map(([slug, label]) => <a key={slug} href={`/dev-review?site=${slug}`}
        aria-current={site === slug ? "page" : undefined} className={site === slug ? "font-bold underline" : ""}>{label}</a>)}
    </nav>
    {site && LOCAL_REVIEW_NOTES[site] ? <p role="status" className="my-4 border-l-2 border-amber-400 bg-amber-950/30 p-4 text-sm text-amber-100">{LOCAL_REVIEW_NOTES[site]}</p> : null}
    <p className="my-4">{ready ? "Evidence review passed" : "Not client-ready"}</p>
    {!ready && result && <a download className="inline-block mb-6 text-accent" href={`/api/internal/dev-review-pdf?draft=1${site ? `&site=${encodeURIComponent(site)}` : ""}`}>Download internal draft in final PDF layout (not approved for clients)</a>}
    {ready && result ? <>
      <a download className="inline-block mb-6 text-accent" href={`/api/internal/dev-review-pdf${site ? `?site=${encodeURIComponent(site)}` : ""}`}>{site ? "Download test PDF" : "Download reviewed PDF"}</a>
      <RoastResult roast={result.roast} scoring={result.scoring} scraped={result.scraped} url={result.url}
        isUnlocked access={{ tier: "full_unlocked", priceZar: 49, unlockSource: "office" }} />
    </> : <p>{result?.error || "No local test report yet."}</p>}
  </main>;
}
