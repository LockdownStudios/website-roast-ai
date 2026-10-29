import { parsePairedFindings } from "./pairedFindings";
import { parseOutreach } from "./outreachContract";
import type { RoastResultPayload } from "./types";

export const REPORT_REVIEW_VERSION = "evidence-review-v3";

export function isClientReadyReport(roast: RoastResultPayload): boolean {
  try { if (roast.findings) { const findings = parsePairedFindings(roast.findings); if (findings.length !== roast.mistakes.length || findings.length !== roast.quick_fixes.length) return false; } if (roast.outreach) parseOutreach(roast.outreach); } catch { return false; }
  const generation = roast.generation;
  return generation?.mode === "ai" && !generation.validationIssues?.length &&
    generation.review?.version === REPORT_REVIEW_VERSION && generation.review.passed === true &&
    generation.review.issues.length === 0 && Boolean(generation.review.checkedAt) &&
    (roast.claim_contract?.length ?? 0) >= (roast.outreach ? roast.outreach.findings.length : 3);
}

export const INCOMPLETE_REPORT_MESSAGE = "This scan did not pass the evidence review. No client-ready report was created. Please try again; do not send an earlier draft to the client.";
