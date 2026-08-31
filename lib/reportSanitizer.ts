import type {
  RoastClaim,
  RoastResultPayload,
  ScrapedWebsiteData,
  StoredRoastReport,
  VisualAudit,
  WebsiteScoring,
} from "./types";

const INTERNAL_DIAGNOSTIC_PATTERN =
  /visual analysis unavailable|browsertype\.launch|playwright install|chrome-headless-shell|looks like playwright was just installed/i;

function isInternalDiagnosticLine(value: string) {
  return INTERNAL_DIAGNOSTIC_PATTERN.test(value);
}

function entityFromCodePoint(fallback: string, codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      entityFromCodePoint(match, Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (match, decimal: string) =>
      entityFromCodePoint(match, Number.parseInt(decimal, 10)),
    );
}

function cleanReportText(value: string): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLines(lines: string[]) {
  return lines
    .map(cleanReportText)
    .filter((line) => line && !isInternalDiagnosticLine(line));
}

function cleanClaimContract(claims: RoastClaim[] | undefined) {
  if (!claims) {
    return undefined;
  }

  return claims
    .map((claim) => ({
      ...claim,
      claim: cleanReportText(claim.claim),
      evidence: cleanReportText(claim.evidence),
    }))
    .filter(
      (claim) =>
        claim.claim &&
        claim.evidence &&
        !isInternalDiagnosticLine(claim.claim) &&
        !isInternalDiagnosticLine(claim.evidence),
    );
}

export function sanitizeVisualAudit(visualAudit: VisualAudit | undefined) {
  if (!visualAudit) {
    return undefined;
  }

  return {
    ...visualAudit,
    reason: visualAudit.reason && isInternalDiagnosticLine(visualAudit.reason)
      ? "visual rendering is unavailable in this environment"
      : visualAudit.reason,
    findings: cleanLines(visualAudit.findings),
    evidence: cleanLines(visualAudit.evidence),
  };
}

export function sanitizeScrapedWebsiteData(
  scraped: ScrapedWebsiteData,
): ScrapedWebsiteData {
  return {
    ...scraped,
    title: cleanReportText(scraped.title),
    description: cleanReportText(scraped.description),
    headings: {
      h1: cleanLines(scraped.headings.h1),
      h2: cleanLines(scraped.headings.h2),
    },
    content: cleanReportText(scraped.content),
    contentSnippet: cleanReportText(scraped.contentSnippet),
    ctas: cleanLines(scraped.ctas),
    trustSignals: cleanLines(scraped.trustSignals),
    contactSignals: cleanLines(scraped.contactSignals),
    genericPhrasesFound: cleanLines(scraped.genericPhrasesFound),
    visualAudit: sanitizeVisualAudit(scraped.visualAudit),
  };
}

export function sanitizeWebsiteScoring(scoring: WebsiteScoring): WebsiteScoring {
  return {
    ...scoring,
    visualDesign: scoring.visualDesign
      ? {
          ...scoring.visualDesign,
          summary: cleanReportText(scoring.visualDesign.summary),
          factors: cleanLines(scoring.visualDesign.factors),
        }
      : undefined,
    findings: cleanLines(scoring.findings),
    evidence: cleanLines(scoring.evidence),
    penalties: scoring.penalties.filter(
      (penalty) => !isInternalDiagnosticLine(penalty.reason),
    ),
    bonuses: scoring.bonuses.filter(
      (bonus) => !isInternalDiagnosticLine(bonus.reason),
    ),
  };
}

export function sanitizeRoastPayload(
  roast: RoastResultPayload,
): RoastResultPayload {
  return {
    ...roast,
    first_impression: cleanReportText(roast.first_impression),
    single_biggest_leak: cleanReportText(roast.single_biggest_leak),
    mistakes: cleanLines(roast.mistakes),
    lost_customers: cleanReportText(roast.lost_customers),
    quick_fixes: cleanLines(roast.quick_fixes),
    high_impact: cleanReportText(roast.high_impact),
    tone_summary: cleanReportText(roast.tone_summary),
    evidence: cleanLines(roast.evidence),
    claim_contract: cleanClaimContract(roast.claim_contract),
  };
}

export function sanitizeStoredRoastReport(
  report: StoredRoastReport,
): StoredRoastReport {
  return {
    ...report,
    scraped: sanitizeScrapedWebsiteData(report.scraped),
    scoring: sanitizeWebsiteScoring(report.scoring),
    roast: sanitizeRoastPayload(report.roast),
  };
}
