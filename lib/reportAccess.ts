import type { ReportAccess, RoastResultPayload, ReportUnlockSource } from "./types";

export const DEFAULT_UNLOCK_PRICE_ZAR = 49;

function clampPrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_UNLOCK_PRICE_ZAR;
  }
  const rounded = Math.round(value);
  return Math.max(1, Math.min(50000, rounded));
}

export function normalizeRoastAccess(value: unknown): ReportAccess | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Partial<ReportAccess>;
  const tier =
    raw.tier === "free_teaser" || raw.tier === "full_unlocked" ? raw.tier : null;
  const unlockSource =
    raw.unlockSource === "none" ||
    raw.unlockSource === "mock" ||
    raw.unlockSource === "paystack" ||
    raw.unlockSource === "legacy" ||
    raw.unlockSource === "office"
      ? raw.unlockSource
      : null;

  if (!tier || !unlockSource) {
    return undefined;
  }

  return {
    tier,
    unlockSource,
    priceZar: clampPrice(raw.priceZar),
    unlockedAt:
      typeof raw.unlockedAt === "string" && raw.unlockedAt.trim()
        ? raw.unlockedAt
        : undefined,
  };
}

export function getRoastAccess(roast: RoastResultPayload): ReportAccess {
  const normalized = normalizeRoastAccess(roast.access);
  if (normalized) {
    return normalized;
  }

  // Existing legacy reports (before paywall) remain fully accessible.
  return {
    tier: "full_unlocked",
    unlockSource: "legacy",
    priceZar: DEFAULT_UNLOCK_PRICE_ZAR,
  };
}

export function isRoastUnlocked(roast: RoastResultPayload): boolean {
  return getRoastAccess(roast).tier === "full_unlocked";
}

export function createFreeTeaserAccess(priceZar = DEFAULT_UNLOCK_PRICE_ZAR): ReportAccess {
  return {
    tier: "free_teaser",
    unlockSource: "none",
    priceZar: clampPrice(priceZar),
  };
}

export function createUnlockedAccess(
  current: ReportAccess | undefined,
  source: ReportUnlockSource,
): ReportAccess {
  return {
    tier: "full_unlocked",
    unlockSource: source,
    unlockedAt: new Date().toISOString(),
    priceZar: clampPrice(current?.priceZar),
  };
}

export function withRoastAccess(
  roast: RoastResultPayload,
  access: ReportAccess,
): RoastResultPayload {
  return {
    ...roast,
    access,
  };
}

export function buildTeaserRoast(roast: RoastResultPayload): RoastResultPayload {
  const access = getRoastAccess(roast);
  const teaserMistakes = roast.mistakes.slice(0, 3);
  return {
    ...roast,
    mistakes: teaserMistakes.length > 0 ? teaserMistakes : roast.mistakes,
    lost_customers:
      "Unlock the full report to see the detailed leakage analysis and buyer drop-off reasoning.",
    quick_fixes: [
      "Unlock the full report to get section-by-section fixes, example copy, and implementation steps.",
    ],
    high_impact:
      "Unlock the full report to reveal your highest-impact improvement plan.",
    evidence: [],
    claim_contract: [],
    access,
  };
}
