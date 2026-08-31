import { categoryRatio, clampToRange, roundToOne } from "./scoringConfig";
import { buildSiteContextSnapshot } from "./siteContext";
import type {
  ScoreAdjustment,
  ScoreBreakdown,
  ScrapedWebsiteData,
  VisualDesignAssessment,
  VisualSummaryScores,
} from "./types";

type VisualDesignInput = {
  scrapedData: ScrapedWebsiteData;
  breakdown: ScoreBreakdown;
  penalties: ScoreAdjustment[];
  overallScore: number;
};

function metric(value: unknown, fallback = 50): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return clampToRange(number, 0, 100);
}

function hasPenalty(penalties: ScoreAdjustment[], pattern: RegExp): boolean {
  return penalties.some((penalty) =>
    pattern.test(`${penalty.label} ${penalty.reason}`),
  );
}

function visualMetricScore(summary: VisualSummaryScores): number {
  const weighted =
    metric(summary.ctaProminence) * 0.18 +
    metric(summary.readability) * 0.22 +
    metric(summary.hierarchy) * 0.2 +
    metric(summary.consistency) * 0.28 +
    (100 - metric(summary.motionDistraction)) * 0.12;

  return weighted / 10;
}

function visualLabel(score: number): VisualDesignAssessment["label"] {
  if (score >= 7) return "Strong";
  if (score >= 4.8) return "Mixed";
  return "Weak";
}

function ctaText(scrapedData: ScrapedWebsiteData): string {
  return [
    scrapedData.visualAudit?.desktop?.primaryCtaText,
    scrapedData.visualAudit?.mobile?.primaryCtaText,
    scrapedData.ctas.join(" "),
    buildSiteContextSnapshot(scrapedData).primaryCta,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function scoreVisualDesign(input: VisualDesignInput): VisualDesignAssessment {
  const visualSummary =
    input.scrapedData.visualAudit?.available && input.scrapedData.visualAudit.summary
      ? input.scrapedData.visualAudit.summary
      : undefined;
  const structureScore = categoryRatio("design_hint", input.breakdown.design_hint) * 10;
  const differentiationRatio = categoryRatio(
    "differentiation",
    input.breakdown.differentiation,
  );
  const trustRatio = categoryRatio("trust", input.breakdown.trust);
  const ctaRatio = categoryRatio("CTA", input.breakdown.CTA);
  const factors: string[] = [];
  let score = visualSummary
    ? visualMetricScore(visualSummary)
    : Math.min(6, (structureScore + input.overallScore) / 2);

  if (visualSummary) {
    factors.push(
      `Visual audit base: CTA ${visualSummary.ctaProminence}/100, readability ${visualSummary.readability}/100, hierarchy ${visualSummary.hierarchy}/100, consistency ${visualSummary.consistency}/100.`,
    );
  } else {
    factors.push("Visual audit unavailable; score uses structure and conversion-quality fallback.");
  }

  const keywordStuffed = hasPenalty(input.penalties, /keyword-stuffed|overloaded hero/i);
  const mismatchedCta = hasPenalty(input.penalties, /mismatched cta|wrong action/i);
  const weakCta = hasPenalty(input.penalties, /weak(?: visual)? cta|soft visual cta|no cta/i);
  const genericContactCta = /\bcontact\b/.test(ctaText(input.scrapedData));

  if (keywordStuffed) {
    score -= 1.2;
    factors.push("Hero copy is overloaded, so the first impression feels less polished.");
  }

  if (mismatchedCta) {
    score -= 0.9;
    factors.push("The main action does not match the buyer goal.");
  }

  if (weakCta) {
    score -= 0.5;
    factors.push("The CTA path exists, but it lacks enough visual/business force.");
  }

  if (differentiationRatio <= 0.4) {
    score -= 1;
    factors.push("Weak differentiation makes the design feel more generic than premium.");
  } else if (differentiationRatio <= 0.55) {
    score -= 0.5;
    factors.push("Differentiation is only moderate, which limits perceived polish.");
  }

  if (trustRatio <= 0.5) {
    score -= 0.7;
    factors.push("Trust proof is too light to support a strong visual impression.");
  }

  if (ctaRatio <= 0.55) {
    score -= 0.3;
    factors.push("Action hierarchy is not strong enough for fast lead capture.");
  }

  if (genericContactCta) {
    score -= 0.4;
    factors.push('A generic "Contact" CTA weakens the perceived conversion design.');
  }

  if (keywordStuffed && differentiationRatio <= 0.45) {
    score = Math.min(score, 4.2);
  }

  if ((mismatchedCta || weakCta) && ctaRatio <= 0.6) {
    score = Math.min(score, 5);
  }

  const severeVisualFailure = visualSummary
    ? metric(visualSummary.readability) < 35 ||
      metric(visualSummary.hierarchy) < 35 ||
      metric(visualSummary.consistency) < 35
    : false;

  if (structureScore >= 7 && input.overallScore >= 4 && !severeVisualFailure) {
    score = Math.max(score, 3.1);
  }

  if (!visualSummary) {
    score = Math.min(score, 6);
  }

  const finalScore = roundToOne(clampToRange(score, 0, 10));

  return {
    score: finalScore,
    label: visualLabel(finalScore),
    basis: visualSummary ? "visual_audit" : "structure_fallback",
    summary:
      finalScore < 4.8
        ? "The page may have usable structure, but the visible impression is weak."
        : finalScore < 7
          ? "The page has some usable visual structure, but polish and buyer focus are mixed."
          : "The visible structure, readability, and polish are directionally strong.",
    factors: [...new Set(factors)].slice(0, 6),
  };
}
