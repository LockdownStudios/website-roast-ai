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

function cleanLines(lines: string[]) {
  return lines.filter((line) => !isInternalDiagnosticLine(line));
}

function cleanClaimContract(claims: RoastClaim[] | undefined) {
  if (!claims) {
    return undefined;
  }

  return claims.filter(
    (claim) =>
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
    visualAudit: sanitizeVisualAudit(scraped.visualAudit),
  };
}

export function sanitizeWebsiteScoring(scoring: WebsiteScoring): WebsiteScoring {
  return {
    ...scoring,
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
    mistakes: cleanLines(roast.mistakes),
    quick_fixes: cleanLines(roast.quick_fixes),
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
