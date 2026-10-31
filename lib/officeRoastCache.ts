import { isClientReadyReport } from "./reportQuality";
import { getRoastAccess } from "./reportAccess";
import type { StoredRoastReport } from "./types";
import { ROAST_VOICE_VERSION } from "./roastVoice";
export const OFFICE_REPORT_CACHE_MS = 6 * 60 * 60 * 1000;
export function reusableOfficeReport(report: StoredRoastReport, url: string, now = Date.now()) {
  const age = now - Date.parse(report.createdAt);
  return report.url === url && age >= 0 && age <= OFFICE_REPORT_CACHE_MS && report.roast.outreach?.editorialVersion === ROAST_VOICE_VERSION && report.roast.contractVersion === "2026-09-v1" && getRoastAccess(report.roast).unlockSource === "office" && isClientReadyReport(report.roast);
}
