import type { ScoreBreakdown } from "./types";

export const BREAKDOWN_KEYS = [
  "clarity",
  "trust",
  "CTA",
  "differentiation",
  "design_hint",
] as const;

export type BreakdownKey = (typeof BREAKDOWN_KEYS)[number];

export const CATEGORY_WEIGHTS: Record<BreakdownKey, number> = {
  clarity: 25,
  trust: 25,
  CTA: 20,
  differentiation: 20,
  design_hint: 10,
};

export function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getCategoryMax(key: BreakdownKey): number {
  return CATEGORY_WEIGHTS[key];
}

export function categoryRatio(key: BreakdownKey, value: number): number {
  const max = getCategoryMax(key);
  if (!max) {
    return 0;
  }

  return clampToRange(value / max, 0, 1);
}

export function scoreOutOf10FromRaw(rawScore: number): number {
  return roundToOne(clampToRange(rawScore, 0, 100) / 10);
}

export function sumBreakdown(breakdown: ScoreBreakdown): number {
  return BREAKDOWN_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
}

export function getWeakestCategory(breakdown: ScoreBreakdown): BreakdownKey {
  return BREAKDOWN_KEYS.reduce((weakest, key) => {
    if (categoryRatio(key, breakdown[key]) < categoryRatio(weakest, breakdown[weakest])) {
      return key;
    }
    return weakest;
  }, BREAKDOWN_KEYS[0]);
}

export function legacyBreakdownToWeighted(breakdown: ScoreBreakdown): ScoreBreakdown {
  const scaled = {} as ScoreBreakdown;

  for (const key of BREAKDOWN_KEYS) {
    const normalized = clampToRange(breakdown[key], 0, 2) / 2;
    scaled[key] = roundToOne(normalized * CATEGORY_WEIGHTS[key]);
  }

  return scaled;
}
