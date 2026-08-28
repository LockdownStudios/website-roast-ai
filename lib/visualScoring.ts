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
  evidence.push(
    `Visual threshold profile: ${profile.label} (ctaWeak<${profile.ctaWeak}, readabilityWeak<${profile.readabilityWeak}, hierarchyWeak<${profile.hierarchyWeak}, consistencyWeak<${profile.consistencyWeak}, motionHigh>${profile.motionHigh}).`,
  );

  if (summary.ctaProminence < profile.ctaWeak - 12) {
    addAdjustment(
      penalties,
      "Weak Visual CTA",
      4,
      "Primary CTA lacks visual dominance, so high-intent users may miss the next step.",
    );
  } else if (summary.ctaProminence < profile.ctaWeak) {
    addAdjustment(
      penalties,
      "Soft Visual CTA",
      2,
      "CTA exists but does not stand out strongly in the visual hierarchy.",
    );
  } else if (summary.ctaProminence >= profile.ctaStrong) {
    addAdjustment(
      bonuses,
      "Clear Visual CTA",
      2,
      "Primary CTA is visually prominent and supports faster action.",
    );
  }

  if (summary.readability < profile.readabilityWeak - 12) {
    addAdjustment(
      penalties,
      "Low Visual Readability",
      4,
      "Weak contrast or typography readability likely slows comprehension.",
    );
  } else if (summary.readability < profile.readabilityWeak) {
    addAdjustment(
      penalties,
      "Medium Readability Risk",
      2,
      "Readability is mixed and can hurt message clarity under quick scanning.",
    );
  } else if (summary.readability >= profile.readabilityStrong) {
    addAdjustment(
      bonuses,
      "Strong Readability",
      1,
      "Contrast and typography are visually readable across key sections.",
    );
  }

  if (summary.hierarchy < profile.hierarchyWeak) {
    addAdjustment(
      penalties,
      "Weak Visual Hierarchy",
      3,
      "Above-the-fold structure looks cluttered and weakens decision flow.",
    );
  } else if (summary.hierarchy >= profile.hierarchyStrong) {
    addAdjustment(
      bonuses,
      "Clean Visual Hierarchy",
      1,
      "Above-the-fold layout has a clearer conversion order.",
    );
  }

  if (summary.consistency < profile.consistencyWeak) {
    addAdjustment(
      penalties,
      "Visual Inconsistency",
      3,
      "Color/font consistency is weak, reducing trust and polish perception.",
    );
  } else if (summary.consistency >= profile.consistencyStrong) {
    addAdjustment(
      bonuses,
      "Consistent Visual Style",
      1,
      "Color and typography consistency support buyer confidence.",
    );
  }

  if (summary.motionDistraction > profile.motionHigh) {
    addAdjustment(
      penalties,
      "Distracting Motion",
      2,
      "Animation density is high enough to compete with CTA focus.",
    );
  } else if (summary.motionDistraction <= profile.motionLow) {
    addAdjustment(
      bonuses,
      "Controlled Motion",
      1,
      "Motion is restrained, which helps keep attention on key conversion actions.",
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
        "Desktop CTA is visible, but mobile placement is weaker and can leak conversions.",
      );
    }
  }

  if (siteContext.niche === "ecommerce" && summary.ctaProminence < profile.ctaWeak) {
    addAdjustment(
      penalties,
      "Ecommerce CTA Urgency Gap",
      2,
      "Ecommerce pages need stronger visual buy/checkout cues to reduce abandonment.",
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
