import { categoryRatio, clampToRange, roundToOne } from "./scoringConfig";
import type { ScoreAdjustment, ScoreBreakdown, ScrapedWebsiteData, VisualDesignAssessment } from "./types";

type VisualDesignInput = { scrapedData: ScrapedWebsiteData; breakdown: ScoreBreakdown; penalties: ScoreAdjustment[]; overallScore: number };

export function scoreVisualDesign(input: VisualDesignInput): VisualDesignAssessment {
  const summary = input.scrapedData.visualAudit?.available ? input.scrapedData.visualAudit.summary : undefined;
  // Business proof, CTA wording and inferred industry are not measurements of visual design.
  const raw = summary
    ? (summary.readability * 0.35 + summary.hierarchy * 0.30 + summary.consistency * 0.35) / 10
    : Math.min(6, categoryRatio("design_hint", input.breakdown.design_hint) * 10);
  const score = roundToOne(clampToRange(raw, 0, 10));
  return {
    score, label: score >= 7 ? "Strong" : score >= 4.8 ? "Mixed" : "Weak",
    basis: summary ? "visual_audit" : "structure_fallback",
    summary: summary ? "Visual structure of the captured viewports only; not a whole-site aesthetic judgement or a usability test."
      : "No rendered visual assessment is available.",
    factors: summary ? [
      `Captured readability ${summary.readability}/100, hierarchy ${summary.hierarchy}/100, consistency ${summary.consistency}/100.`,
      "Business-copy and industry penalties do not change this visual score.",
      "Intro screens, overlays and capture timing can limit representativeness.",
    ] : ["Structure fallback is not a visual design assessment."],
  };
}
