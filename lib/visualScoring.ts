import {
  buildSiteContextSnapshot,
  getVisualThresholdProfile,
} from "./siteContext";
import type { ScoreAdjustment, ScrapedWebsiteData } from "./types";

export type VisualScoreImpact = {
  penalties: ScoreAdjustment[];
  bonuses: ScoreAdjustment[];
  findings: string[];
  evidence: string[];
};

function addAdjustment(
  list: ScoreAdjustment[],
  label: string,
  points: number,
  reason: string,
): void {
  list.push({ label, points, reason });
}

export function scoreVisualAudit(scrapedData: ScrapedWebsiteData): VisualScoreImpact {
  const penalties: ScoreAdjustment[] = [];
  const bonuses: ScoreAdjustment[] = [];
  const findings: string[] = [];
  const evidence: string[] = [];
  const visualAudit = scrapedData.visualAudit;
  const siteContext = buildSiteContextSnapshot(scrapedData);
  const profile = getVisualThresholdProfile(siteContext.niche);

  if (!visualAudit) {
    return { penalties, bonuses, findings, evidence };
  }

  if (!visualAudit.available || !visualAudit.summary) {
    return { penalties, bonuses, findings, evidence };
  }

  const summary = visualAudit.summary;
  const views = [visualAudit.desktop, visualAudit.mobile].filter(view => view?.captureReadiness?.settled !== false);
  const measuredCta = views.some(view => view && view.ctaCount > 0 && !!view.primaryCtaText);
  const clearInBoth = views.length === 2 && views.every(view => view && view.primaryCtaAboveFold && view.primaryCtaContrast >= 3 && view.primaryCtaAreaRatio >= 0.001);
  if (!measuredCta) evidence.push("CTA prominence is unverified: no candidate was established. Detector silence is not a missing or weak CTA.");
  evidence.push(
    `Visual threshold profile: ${profile.label} (ctaWeak<${profile.ctaWeak}, readabilityWeak<${profile.readabilityWeak}, hierarchyWeak<${profile.hierarchyWeak}, consistencyWeak<${profile.consistencyWeak}, motionHigh>${profile.motionHigh}).`,
  );

  if (measuredCta && !clearInBoth && summary.ctaProminence < profile.ctaWeak - 12) {
    addAdjustment(
      penalties,
      "CTA Heuristic Flag",
      4,
      "Detected CTA contrast/scale triggered a heuristic review flag. Confirm in the captured viewport; no missed actions or customer behaviour was measured.",
    );
  } else if (measuredCta && !clearInBoth && summary.ctaProminence < profile.ctaWeak) {
    addAdjustment(
      penalties,
      "Soft Visual CTA",
      2,
      "Detected CTA contrast/scale warrants a visual check; hierarchy and customer behaviour remain unverified.",
    );
  } else if (measuredCta && summary.ctaProminence >= profile.ctaStrong) {
    addAdjustment(
      bonuses,
      "Clear Visual CTA",
      2,
      "Detected CTA contrast, size and placement meet the heuristic thresholds; action speed was not tested.",
    );
  }

  if (summary.readability < profile.readabilityWeak - 12) {
    addAdjustment(
      penalties,
      "Readability Heuristic Flag",
      4,
      "An automated contrast/typography heuristic flagged this captured sample. Confirm against the pixels; no human reading difficulty was measured.",
    );
  } else if (summary.readability < profile.readabilityWeak) {
    addAdjustment(
      penalties,
      "Medium Readability Risk",
      2,
      "Contrast/typography sampling warrants a viewport check; reading difficulty was not measured.",
    );
  } else if (summary.readability >= profile.readabilityStrong) {
    addAdjustment(
      bonuses,
      "Strong Readability",
      1,
      "Contrast/typography sampling met the heuristic threshold in the captured viewports, not across all sections.",
    );
  }

  if (summary.hierarchy < profile.hierarchyWeak) {
    addAdjustment(
      penalties,
      "Weak Visual Hierarchy",
      3,
      "Layout-density sampling triggered a hierarchy check; clutter and decision-flow effects were not measured.",
    );
  } else if (summary.hierarchy >= profile.hierarchyStrong) {
    addAdjustment(
      bonuses,
      "Clean Visual Hierarchy",
      1,
      "Captured layout measurements met the hierarchy threshold; no conversion behaviour was tested.",
    );
  }

  if (summary.consistency < profile.consistencyWeak) {
    addAdjustment(
      penalties,
      "Visual Inconsistency",
      3,
      "Colour/font counts triggered a consistency check; perceived trust or polish was not measured.",
    );
  } else if (summary.consistency >= profile.consistencyStrong) {
    addAdjustment(
      bonuses,
      "Consistent Visual Style",
      1,
      "Captured colour/font counts met the consistency threshold; buyer confidence was not measured.",
    );
  }

  if (summary.motionDistraction > profile.motionHigh) {
    addAdjustment(
      penalties,
      "Motion Heuristic Flag",
      2,
      "Animation-related style counts triggered a motion check; actual distraction, jitter or task interference was not tested.",
    );
  } else if (summary.motionDistraction <= profile.motionLow) {
    addAdjustment(
      bonuses,
      "Controlled Motion",
      1,
      "Animation-related style counts were low; user attention and scrolling smoothness were not tested.",
    );
  }

  findings.push(...visualAudit.findings);
  evidence.push(...visualAudit.evidence);

  if (visualAudit.desktop && visualAudit.mobile) {
    if (
      visualAudit.desktop.primaryCtaAboveFold &&
      !visualAudit.mobile.primaryCtaAboveFold
    ) {
      addAdjustment(
        penalties,
        "Mobile CTA Placement Gap",
        2,
        "A CTA candidate was detected above the fold on desktop but not mobile. This is a cross-viewport detector discrepancy, not proof of a missing mobile action.",
      );
    }
  }

  if (measuredCta && !clearInBoth && siteContext.niche === "ecommerce" && summary.ctaProminence < profile.ctaWeak) {
    addAdjustment(
      penalties,
      "Ecommerce CTA Urgency Gap",
      2,
      "Detected purchase-action prominence triggered a heuristic check; no abandonment was measured.",
    );
  }

  if (
    (siteContext.niche === "professional_service" ||
      siteContext.niche === "healthcare") &&
    summary.consistency < profile.consistencyWeak + 6
  ) {
    addAdjustment(
      penalties,
      "Trust-Led Visual Polish Gap",
      2,
      "Professional trust-driven sites need tighter visual polish to reduce credibility friction.",
    );
  }

  return {
    penalties,
    bonuses,
    findings: [...new Set(findings)].slice(0, 8),
    evidence: [...new Set(evidence)].slice(0, 8),
  };
}
