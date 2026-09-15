import type { RoastResultPayload } from "./types";

export const ROAST_REPORT_CONTRACT_VERSION = "2026-09-v1";
export const LEGACY_ROAST_REPORT_CONTRACT_VERSION = "legacy-v0";

export function withReportContract(
  roast: RoastResultPayload,
): RoastResultPayload {
  return {
    ...roast,
    contractVersion: ROAST_REPORT_CONTRACT_VERSION,
  };
}
