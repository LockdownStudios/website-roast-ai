import type { CompactReport } from "./compactReportPdf";
import type { OutreachAudit, StoredRoastReport, TechnicalCheck, WebsiteScoring } from "./types";
import { CATEGORY_WEIGHTS } from "./scoringConfig";

export function savedStudioScorecards(scoring?: WebsiteScoring): NonNullable<CompactReport["scorecards"]> {
  if (!scoring) return [];
  const labels = { clarity: "Clarity", trust: "Trust", CTA: "Calls to action", differentiation: "Differentiation", design_hint: "Structure" };
  const cards: NonNullable<CompactReport["scorecards"]> = Object.entries(labels).map(([key,label])=>{
    const value=scoring.breakdown?.[key as keyof typeof CATEGORY_WEIGHTS];
    const max=CATEGORY_WEIGHTS[key as keyof typeof CATEGORY_WEIGHTS];
    return {group:"Saved studio assessment",label,maximum:10,value:typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?Math.round(value/max*100)/10:null};
  });
  if(scoring.visualDesign?.score!==undefined)cards.unshift({group:"Saved studio assessment",label:"Visual design",maximum:10,value:Number.isFinite(scoring.visualDesign.score)&&scoring.visualDesign.score>=0&&scoring.visualDesign.score<=10?scoring.visualDesign.score:null});
  return cards;
}

export function outreachReportPresentation(audit: OutreachAudit, name?: string, savedScore?: number, scoring?: WebsiteScoring): CompactReport {
  const url = audit.images[0].sourceUrl;
  return {
    name: name || new URL(url).hostname.replace(/^www\./, ""), url,
    score: typeof savedScore === "number" && Number.isFinite(savedScore) && savedScore >= 0 && savedScore <= 10 ? savedScore : undefined,
    scorecards: savedStudioScorecards(scoring),
    meta: "Website roast | visual, UX and technical evidence",
    summary: audit.summary,
    leak: `${audit.findings[0].observed} ${audit.findings[0].consequence}`,
    strengths: audit.strengths, verdict: audit.recommendationReason,
    coverage: audit.scope, technical: compactTechnicalSummary(audit.technicalChecks),
    findings: audit.findings.map((f, index) => ({ headline: f.headline || `Finding ${index + 1}`, observation: f.observed, consequence: f.consequence, fix: f.fix, source: f.pageUrl })),
  };
}

export function compactTechnicalSummary(checks?: TechnicalCheck[]) {
  if (!checks?.length) return "Technical measurements were not recorded for this saved report.";
  const reviewed = checks.filter(check => check.status === "review").map(check => check.name);
  const observed = checks.filter(check => check.status === "observed").length;
  return `${observed} HTML spot-checks recorded${reviewed.length ? `; review flags: ${reviewed.join(", ")}` : "; no HTML review flags recorded"}. Review flags require confirmation, not automatic repairs. Speed/Core Web Vitals, security and completed transactions were not tested.`;
}

export function fullReportPresentation(report: Pick<StoredRoastReport, "roast" | "url" | "scraped" | "createdAt"> & {scoring?:WebsiteScoring}, name?: string): CompactReport {
  const roast = report.roast;
  return {
    name: name || report.scraped.title.replace(/\s+[|–-]\s+.*$/, "").slice(0, 64), url: report.url, score: roast.score,
    scorecards: savedStudioScorecards(report.scoring),
    meta: `${new Date(report.createdAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "short", day: "numeric" })} | ${report.scraped.crawl?.pageCount || 1} pages reviewed${report.scraped.crawl?.coverage?.truncated ? " (sampled)" : ""}`,
    summary: roast.first_impression, leak: roast.single_biggest_leak, strengths: [], verdict: roast.high_impact,
    customerFriction: roast.lost_customers,
    priorityFixes: roast.findings ? undefined : roast.quick_fixes,
    coverage: "Visual observations cover captured viewports only. Booking/form/payment submissions were not completed.",
    technical: compactTechnicalSummary(roast.technicalChecks),
    findings: roast.findings ? roast.findings.map(f => ({ headline: f.headline, observation: f.observation, fix: f.fix })) : roast.mistakes.map((observation, index) => {
      const opening = observation.match(/^(.{1,100}?[.!?])(?:\s+|$)([\s\S]*)$/);
      return { headline: opening?.[1] || `What needs work / ${index + 1}`, observation: opening ? opening[2] : observation, fix: "", source: roast.claim_contract?.find(claim => claim.target === "mistake" && claim.claim === observation)?.sourceUrl };
    }),
  };
}
