import type { CompactReport } from "./compactReportPdf";
import type { OutreachAudit, StoredRoastReport, TechnicalCheck } from "./types";

export function outreachReportPresentation(audit: OutreachAudit, name?: string): CompactReport {
  const url = audit.images[0].sourceUrl;
  return {
    name: name || new URL(url).hostname.replace(/^www\./, ""), url,
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

export function fullReportPresentation(report: Pick<StoredRoastReport, "roast" | "url" | "scraped" | "createdAt">, name?: string): CompactReport {
  const roast = report.roast;
  const paired = roast.mistakes.length === roast.quick_fixes.length;
  return {
    name: name || report.scraped.title.replace(/\s+[|–-]\s+.*$/, "").slice(0, 64), url: report.url, score: roast.score,
    meta: `${new Date(report.createdAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "short", day: "numeric" })} | ${report.scraped.crawl?.pageCount || 1} pages reviewed${report.scraped.crawl?.coverage?.truncated ? " (sampled)" : ""}`,
    summary: roast.first_impression, leak: roast.single_biggest_leak, strengths: [], verdict: roast.high_impact,
    coverage: "Visual observations cover captured viewports only. Booking/form/payment submissions were not completed.",
    technical: compactTechnicalSummary(roast.technicalChecks),
    findings: roast.findings ? roast.findings.map(f => ({ headline: f.headline, observation: f.observation, fix: f.fix })) : roast.mistakes.map((observation, index) => {
      const opening = observation.match(/^(.{1,100}?[.!?])(?:\s+|$)([\s\S]*)$/);
      return { headline: opening?.[1] || `What needs work / ${index + 1}`, observation: opening ? opening[2] : observation, fix: paired ? roast.quick_fixes[index] : "", source: roast.claim_contract?.find(claim => claim.target === "mistake" && claim.claim === observation)?.sourceUrl };
    }).concat((paired ? [] : roast.quick_fixes).map((fix, index) => ({ headline: `Priority fix / ${index + 1}`, observation: "", fix, source: undefined }))),
  };
}
