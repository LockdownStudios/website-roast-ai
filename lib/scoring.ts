import {
  BREAKDOWN_KEYS,
  CATEGORY_WEIGHTS,
  clampToRange,
  getWeakestCategory,
  roundToOne,
  scoreOutOf10FromRaw,
  sumBreakdown,
} from "./scoringConfig";
import { ROAST_ENGINE_VERSION } from "./fingerprint";
import { buildSiteContextSnapshot } from "./siteContext";
import { scoreVisualAudit } from "./visualScoring";
import type {
  ScoreAdjustment,
  ScoreBreakdown,
  ScrapedWebsiteData,
  WebsiteScoring,
} from "./types";

const SERVICE_PRODUCT_KEYWORDS = [
  "service",
  "services",
  "product",
  "products",
  "solution",
  "solutions",
  "agency",
  "platform",
  "software",
  "consulting",
  "pricing",
  "quote",
  "book",
  "demo",
  "trial",
  "appointment",
];

const OUTCOME_WORDS = [
  "increase",
  "reduce",
  "save",
  "grow",
  "book",
  "close",
  "faster",
  "instant",
  "results",
  "revenue",
  "leads",
  "sales",
  "convert",
];

const LEGAL_TRUST_WORDS = ["privacy", "terms", "policy", "refund", "secure"];
function classifyCtaSignal(signal: string): "strong" | "weak" | "none" {
  const lower = signal.toLowerCase();

  if (
    /\b(get (a )?quote|request (a )?quote|book|schedule|start|sign up|apply|trial|buy now|shop now|call now|call us|request demo|book a demo|consultation)\b/.test(
      lower,
    )
  ) {
    return "strong";
  }

  if (
    /\b(contact|learn more|view|explore|send message|chat|discover|read more|about)\b/.test(
      lower,
    )
  ) {
    return "weak";
  }

  return "none";
}

function hasAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function countUniqueLongTerms(content: string): number {
  return new Set(
    content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 8),
  ).size;
}

function hasMeaningfulH1(h1List: string[]): boolean {
  return h1List.some((h1) => {
    const words = h1.trim().split(/\s+/);
    return words.length >= 4 && h1.trim().length >= 22;
  });
}

function hasNumericProof(text: string): boolean {
  return /\b\d{2,}\+?\b|%|since\s+\d{4}|in\s+\d+\s*(days|weeks|hours|minutes|months)\b/i.test(
    text,
  );
}

function scoreClarity(signals: {
  titleExists: boolean;
  titleLengthGood: boolean;
  titleSpecific: boolean;
  hasH1: boolean;
  meaningfulH1: boolean;
  contentLength: number;
  hasServiceKeywords: boolean;
  headlineOutcomeHit: boolean;
}): number {
  let points = 0;
  if (signals.titleExists) points += 3;
  if (signals.titleLengthGood) points += 2;
  if (signals.titleSpecific) points += 2;
  if (signals.hasH1) points += 3;
  if (signals.meaningfulH1) points += 4;
  if (signals.contentLength >= 350) points += 3;
  if (signals.contentLength >= 900) points += 3;
  if (signals.hasServiceKeywords) points += 3;
  if (signals.headlineOutcomeHit) points += 2;
  return clampToRange(points, 0, CATEGORY_WEIGHTS.clarity);
}

function scoreTrust(signals: {
  trustSignalCount: number;
  contactSignalCount: number;
  numericProof: boolean;
  trustTokenAboveFold: boolean;
  legalCue: boolean;
}): number {
  const trustSignalDepth =
    signals.trustSignalCount >= 3
      ? 10
      : signals.trustSignalCount === 2
        ? 7
        : signals.trustSignalCount === 1
          ? 4
          : 0;
  const contactPath =
    signals.contactSignalCount >= 2
      ? 7
      : signals.contactSignalCount === 1
        ? 5
        : 0;
  const credibilitySpecifics =
    (signals.numericProof ? 3 : 0) + (signals.trustTokenAboveFold ? 3 : 0);
  const complianceCue = signals.legalCue ? 2 : 0;

  return clampToRange(
    trustSignalDepth + contactPath + credibilitySpecifics + complianceCue,
    0,
    CATEGORY_WEIGHTS.trust,
  );
}

function scoreCta(signals: {
  strongCtaCount: number;
  weakCtaCount: number;
  aboveFoldCtaLikely: boolean;
  formAboveFoldLikely: boolean;
  buttonCount: number;
  linkCount: number;
}): number {
  const ctaDepth =
    signals.strongCtaCount >= 3
      ? 12
      : signals.strongCtaCount === 2
        ? 10
        : signals.strongCtaCount === 1
          ? 7
          : signals.weakCtaCount >= 2
            ? 4
            : signals.weakCtaCount === 1
              ? 2
              : 0;
  const aboveFoldPoints = signals.aboveFoldCtaLikely ? 3 : 0;
  const formPoints = signals.formAboveFoldLikely ? 2 : 0;
  const interactionPoints = signals.buttonCount >= 2 || signals.linkCount >= 10 ? 2 : 0;

  return clampToRange(
    ctaDepth + aboveFoldPoints + formPoints + interactionPoints,
    0,
    CATEGORY_WEIGHTS.CTA,
  );
}

function scoreDifferentiation(signals: {
  numericProof: boolean;
  headlineOutcomeHit: boolean;
  hasServiceKeywords: boolean;
  meaningfulH1: boolean;
  uniqueLongTerms: number;
  genericCount: number;
}): number {
  const specificityPoints =
    (signals.numericProof ? 6 : 0) +
    (signals.headlineOutcomeHit ? 4 : 0) +
    (signals.hasServiceKeywords ? 3 : 0) +
    (signals.meaningfulH1 ? 3 : 0);
  const uniqueLanguagePoints =
    signals.uniqueLongTerms >= 25 ? 4 : signals.uniqueLongTerms >= 14 ? 2 : 0;
  const genericPenalty = Math.min(12, signals.genericCount * 4);

  return clampToRange(
    specificityPoints + uniqueLanguagePoints - genericPenalty,
    0,
    CATEGORY_WEIGHTS.differentiation,
  );
}

function scoreDesignHint(signals: {
  titleExists: boolean;
  descriptionExists: boolean;
  headingCount: number;
  contentLength: number;
  heroHeadingEarly: boolean;
  formAboveFoldLikely: boolean;
  buttonCount: number;
}): number {
  let points = 0;
  if (signals.titleExists) points += 2;
  if (signals.descriptionExists) points += 2;

  if (signals.headingCount >= 2 && signals.headingCount <= 16) {
    points += 2;
  } else if (signals.headingCount === 1) {
    points += 1;
  }

  if (signals.contentLength >= 450 && signals.contentLength <= 5000) {
    points += 2;
  } else if (signals.contentLength >= 250) {
    points += 1;
  }

  if (signals.heroHeadingEarly) points += 1;
  if (signals.formAboveFoldLikely || signals.buttonCount >= 2) points += 1;

  return clampToRange(points, 0, CATEGORY_WEIGHTS.design_hint);
}

function computeConfidence(signals: {
  titleExists: boolean;
  descriptionExists: boolean;
  headingCount: number;
  contentLength: number;
  contentSnippetLength: number;
  signalRichness: number;
  buttonCount: number;
  linkCount: number;
}): number {
  const checks = [
    signals.titleExists,
    signals.descriptionExists,
    signals.headingCount >= 1,
    signals.contentLength >= 250,
    signals.contentLength <= 12000,
    signals.contentSnippetLength >= 120,
    signals.signalRichness >= 1,
    signals.buttonCount + signals.linkCount >= 2,
  ];

  let confidence = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  if (signals.contentLength < 120) {
    confidence = Math.min(confidence, 40);
  }

  if (signals.headingCount === 0 && !signals.descriptionExists) {
    confidence = Math.min(confidence, 55);
  }

  return Math.round(clampToRange(confidence, 20, 100));
}

function addAdjustment(
  list: ScoreAdjustment[],
  label: string,
  points: number,
  reason: string,
): void {
  list.push({ label, points, reason });
}

function toFindings(
  signals: {
    titleExists: boolean;
    meaningfulH1: boolean;
    contentLength: number;
    trustSignalCount: number;
    contactSignalCount: number;
    ctaCount: number;
    aboveFoldCtaLikely: boolean;
    genericCount: number;
    descriptionExists: boolean;
    headingCount: number;
  },
  penalties: ScoreAdjustment[],
): string[] {
  const findings: string[] = [];

  if (!signals.titleExists) findings.push("Title is weak or missing.");
  if (!signals.meaningfulH1) findings.push("Hero headline does not communicate a clear outcome.");
  if (signals.contentLength < 350) findings.push("Page copy is thin for high-intent buyers.");
  if (signals.trustSignalCount === 0) findings.push("No clear trust proof detected.");
  if (signals.contactSignalCount === 0) findings.push("No visible contact path in core copy.");
  if (signals.ctaCount === 0 && !signals.aboveFoldCtaLikely) {
    findings.push("No strong CTA path detected.");
  } else if (signals.ctaCount <= 1) {
    findings.push("CTA presence is weak or inconsistent.");
  }
  if (signals.genericCount >= 2) findings.push("Copy leans generic and loses differentiation.");
  if (!signals.descriptionExists) findings.push("Meta description is missing.");
  if (signals.headingCount === 0) findings.push("No heading structure detected.");

  for (const penalty of penalties) {
    findings.push(penalty.reason);
  }

  return [...new Set(findings)].slice(0, 12);
}

function leakFromWeakestCategory(
  breakdown: ScoreBreakdown,
  penalties: ScoreAdjustment[],
): string {
  const penaltyLabels = new Set(penalties.map((item) => item.label));

  if (penaltyLabels.has("No CTA Path")) {
    return "Visitors can read your page and still not know what to do next.";
  }

  if (penaltyLabels.has("No Trust Proof") && penaltyLabels.has("No Contact Path")) {
    return "You ask people to trust you, but you give them nothing to believe.";
  }

  if (penaltyLabels.has("No Clear Offer")) {
    return "Your homepage talks around the offer instead of making one.";
  }

  if (penaltyLabels.has("Heavy Generic Copy")) {
    return "Your copy sounds interchangeable, so buyers have no reason to choose you.";
  }

  switch (getWeakestCategory(breakdown)) {
    case "clarity":
      return "Your homepage explains things, but it does not land a clear offer.";
    case "trust":
      return "You need visible proof before asking visitors to believe you.";
    case "CTA":
      return "There is no dominant next step, so conversion intent leaks out.";
    case "differentiation":
      return "Your message blends in with competitors instead of standing out.";
    case "design_hint":
      return "Your structure is present, but the conversion flow is weak.";
    default:
      return "The page does not convert attention into action.";
  }
}

function buildEvidence(
  scrapedData: ScrapedWebsiteData,
  breakdown: ScoreBreakdown,
  penalties: ScoreAdjustment[],
  bonuses: ScoreAdjustment[],
  rawScore: number,
  confidence: number,
): string[] {
  const evidence: string[] = [
    `Weighted breakdown -> Clarity ${roundToOne(breakdown.clarity)}/${CATEGORY_WEIGHTS.clarity}, Trust ${roundToOne(breakdown.trust)}/${CATEGORY_WEIGHTS.trust}, CTA ${roundToOne(breakdown.CTA)}/${CATEGORY_WEIGHTS.CTA}, Differentiation ${roundToOne(breakdown.differentiation)}/${CATEGORY_WEIGHTS.differentiation}, Structure ${roundToOne(breakdown.design_hint)}/${CATEGORY_WEIGHTS.design_hint}.`,
    `Detected ${scrapedData.headings.h1.length} H1 and ${scrapedData.headings.h2.length} H2 headings.`,
    scrapedData.ctas.length
      ? `CTA signals found: ${scrapedData.ctas.join(", ")}.`
      : "No CTA signals detected in visible copy or anchor actions.",
    scrapedData.trustSignals.length
      ? `Trust signals found: ${scrapedData.trustSignals.join(", ")}.`
      : "No clear trust signals detected in copy.",
    scrapedData.contactSignals.length
      ? `Contact signals found: ${scrapedData.contactSignals.slice(0, 2).join(" | ")}.`
      : "No visible phone/email contact signal detected.",
    scrapedData.genericPhrasesFound.length
      ? `Generic phrases found: ${scrapedData.genericPhrasesFound.join(", ")}.`
      : "No major generic-marketing cliches detected.",
    `Visual hints -> above-fold CTA=${scrapedData.visualHints.aboveFoldCtaLikely}, hero heading early=${scrapedData.visualHints.heroHeadingEarly}, form above fold=${scrapedData.visualHints.formAboveFoldLikely}.`,
    `Score adjustments -> penalties ${penalties.reduce((sum, item) => sum + item.points, 0)} points, bonuses ${bonuses.reduce((sum, item) => sum + item.points, 0)} points.`,
    `Final raw score ${rawScore}/100, confidence ${confidence}%.`,
  ];

  return evidence.slice(0, 12);
}

export function scoreWebsite(scrapedData: ScrapedWebsiteData): WebsiteScoring {
  const titleText = scrapedData.title.trim();
  const descriptionText = scrapedData.description.trim();
  const headingCount = scrapedData.headings.h1.length + scrapedData.headings.h2.length;
  const hasH1 = scrapedData.headings.h1.length > 0;
  const meaningfulH1 = hasMeaningfulH1(scrapedData.headings.h1);
  const contentLength = scrapedData.content.length;
  const titleExists = titleText !== "No title found." && titleText.length >= 8;
  const titleLengthGood = titleText.length >= 18 && titleText.length <= 75;
  const descriptionExists =
    descriptionText !== "No meta description found." && descriptionText.length >= 30;
  const combinedText = [
    scrapedData.title,
    scrapedData.description,
    scrapedData.headings.h1.join(" "),
    scrapedData.headings.h2.join(" "),
    scrapedData.contentSnippet,
  ].join(" ");
  const combinedLower = combinedText.toLowerCase();
  const hasServiceKeywords = hasAny(combinedLower, SERVICE_PRODUCT_KEYWORDS);
  const headlineOutcomeHit = hasAny(
    [scrapedData.title, scrapedData.headings.h1.join(" ")].join(" ").toLowerCase(),
    OUTCOME_WORDS,
  );
  const numericProof = hasNumericProof(combinedText);
  const legalCue = hasAny(combinedLower, LEGAL_TRUST_WORDS);
  const uniqueLongTerms = countUniqueLongTerms(scrapedData.content);
  const siteContext = buildSiteContextSnapshot(scrapedData);

  const trustSignalCount = scrapedData.trustSignals.length;
  const contactSignalCount = scrapedData.contactSignals.length;
  const strongCtaCount = scrapedData.ctas.filter(
    (cta) => classifyCtaSignal(cta) === "strong",
  ).length;
  const weakCtaCount = scrapedData.ctas.filter(
    (cta) => classifyCtaSignal(cta) === "weak",
  ).length;
  const ctaCount = strongCtaCount + weakCtaCount;
  const genericCount = scrapedData.genericPhrasesFound.length;

  const clarity = scoreClarity({
    titleExists,
    titleLengthGood,
    titleSpecific: titleLengthGood && (hasServiceKeywords || headlineOutcomeHit || /\d/.test(titleText)),
    hasH1,
    meaningfulH1,
    contentLength,
    hasServiceKeywords,
    headlineOutcomeHit,
  });

  const trust = scoreTrust({
    trustSignalCount,
    contactSignalCount,
    numericProof,
    trustTokenAboveFold: scrapedData.visualHints.trustTokenAboveFold,
    legalCue,
  });

  const CTA = scoreCta({
    strongCtaCount,
    weakCtaCount,
    aboveFoldCtaLikely: scrapedData.visualHints.aboveFoldCtaLikely,
    formAboveFoldLikely: scrapedData.visualHints.formAboveFoldLikely,
    buttonCount: scrapedData.visualHints.buttonCount,
    linkCount: scrapedData.visualHints.linkCount,
  });

  const differentiation = scoreDifferentiation({
    numericProof,
    headlineOutcomeHit,
    hasServiceKeywords,
    meaningfulH1,
    uniqueLongTerms,
    genericCount,
  });

  const design_hint = scoreDesignHint({
    titleExists,
    descriptionExists,
    headingCount,
    contentLength,
    heroHeadingEarly: scrapedData.visualHints.heroHeadingEarly,
    formAboveFoldLikely: scrapedData.visualHints.formAboveFoldLikely,
    buttonCount: scrapedData.visualHints.buttonCount,
  });

  const breakdown: ScoreBreakdown = {
    clarity: roundToOne(clarity),
    trust: roundToOne(trust),
    CTA: roundToOne(CTA),
    differentiation: roundToOne(differentiation),
    design_hint: roundToOne(design_hint),
  };

  const penalties: ScoreAdjustment[] = [];
  const bonuses: ScoreAdjustment[] = [];

  if (!meaningfulH1 && !hasServiceKeywords) {
    addAdjustment(
      penalties,
      "No Clear Offer",
      5,
      "The page never states a clear offer for a specific buyer.",
    );
  }

  if (
    ctaCount === 0 &&
    !scrapedData.visualHints.aboveFoldCtaLikely &&
    scrapedData.visualHints.buttonCount < 1
  ) {
    addAdjustment(
      penalties,
      "No CTA Path",
      8,
      "No strong CTA means visitors can read and leave without acting.",
    );
  } else if (strongCtaCount === 0 && weakCtaCount > 0) {
    addAdjustment(
      penalties,
      "Weak CTA Path",
      3,
      "CTA exists but is soft; next action is not compelling enough.",
    );
  }

  if (trustSignalCount === 0) {
    addAdjustment(
      penalties,
      "No Trust Proof",
      7,
      "No testimonials/reviews/case studies detected in visible copy.",
    );
  }

  if (contactSignalCount === 0) {
    addAdjustment(
      penalties,
      "No Contact Path",
      4,
      "No obvious contact method detected in key visible text.",
    );
  }

  if (genericCount >= 3) {
    addAdjustment(
      penalties,
      "Heavy Generic Copy",
      5,
      "Generic copy pattern makes the offer sound interchangeable.",
    );
  }

  if (contentLength < 220) {
    addAdjustment(
      penalties,
      "Thin Content",
      5,
      "Thin copy leaves buyers without enough information to trust or act.",
    );
  }

  if (contentLength > 9000) {
    addAdjustment(
      penalties,
      "Bloated Content",
      2,
      "Copy is bloated, which can bury key conversion messages.",
    );
  }

  if (numericProof && ctaCount >= 2) {
    addAdjustment(
      bonuses,
      "Quantified Offer + CTA",
      3,
      "Clear quantifiable messaging plus CTA stack improves conversion confidence.",
    );
  }

  if (trustSignalCount >= 3 && contactSignalCount >= 1) {
    addAdjustment(
      bonuses,
      "Proof Stack",
      3,
      "Strong social proof and visible contact path increase trust.",
    );
  }

  if (scrapedData.visualHints.aboveFoldCtaLikely && scrapedData.visualHints.formAboveFoldLikely) {
    addAdjustment(
      bonuses,
      "Above-Fold Action Path",
      2,
      "Likely above-fold CTA and form reduce friction to action.",
    );
  }

  if (genericCount === 0 && meaningfulH1 && hasServiceKeywords) {
    addAdjustment(
      bonuses,
      "Clear Positioning",
      2,
      "Messaging shows stronger positioning and specificity.",
    );
  }

  if (descriptionExists && headingCount >= 4 && contentLength >= 450 && contentLength <= 5000) {
    addAdjustment(
      bonuses,
      "Structured Content",
      1,
      "Metadata and structure suggest cleaner content hierarchy.",
    );
  }

  const visualImpact = scoreVisualAudit(scrapedData);
  penalties.push(...visualImpact.penalties);
  bonuses.push(...visualImpact.bonuses);

  const penaltyTotal = Math.min(
    23,
    penalties.reduce((sum, item) => sum + item.points, 0),
  );
  const bonusTotal = Math.min(
    10,
    bonuses.reduce((sum, item) => sum + item.points, 0),
  );
  const baseRaw = sumBreakdown(breakdown);
  const rawScore = roundToOne(clampToRange(baseRaw - penaltyTotal + bonusTotal, 0, 100));
  const score = scoreOutOf10FromRaw(rawScore);

  const confidence = computeConfidence({
    titleExists,
    descriptionExists,
    headingCount,
    contentLength,
    contentSnippetLength: scrapedData.contentSnippet.length,
    signalRichness:
      scrapedData.ctas.length +
      scrapedData.trustSignals.length +
      scrapedData.contactSignals.length +
      scrapedData.genericPhrasesFound.length,
    buttonCount: scrapedData.visualHints.buttonCount,
    linkCount: scrapedData.visualHints.linkCount,
  });

  const findings = toFindings(
    {
      titleExists,
      meaningfulH1,
      contentLength,
      trustSignalCount,
      contactSignalCount,
      ctaCount,
      aboveFoldCtaLikely: scrapedData.visualHints.aboveFoldCtaLikely,
      genericCount,
      descriptionExists,
      headingCount,
    },
    penalties,
  );
  findings.push(
    `Site profile detected: ${siteContext.nicheLabel}. Offer snapshot: ${siteContext.offerHeadline}.`,
  );
  findings.push(`Primary CTA snapshot: ${siteContext.primaryCta}.`);
  findings.push(...visualImpact.findings);

  const singleBiggestLeak = leakFromWeakestCategory(breakdown, penalties);
  const evidence = [
    ...buildEvidence(
    scrapedData,
    breakdown,
    penalties,
    bonuses,
    rawScore,
    confidence,
    ),
    ...visualImpact.evidence,
  ].slice(0, 14);

  // Guardrail: mark data-thin pages so downstream roast can avoid fake certainty.
  if (confidence <= 45) {
    findings.unshift("Scraped data is limited; confidence is low.");
  }

  // Keep ordering stable and bounded for deterministic outputs.
  const normalizedFindings = [...new Set(findings)].slice(0, 12);

  // Ensures every category key is touched for future safety checks.
  for (const key of BREAKDOWN_KEYS) {
    if (!Number.isFinite(breakdown[key])) {
      breakdown[key] = 0;
    }
  }

  return {
    score,
    rawScore,
    confidence,
    analysisMeta: {
      engineVersion: ROAST_ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      freshness: "fresh",
      sourcePageCount: scrapedData.crawl?.pageCount ?? 1,
      crawlStrategy: scrapedData.crawl?.strategy ?? "single_page",
    },
    breakdown,
    findings: normalizedFindings,
    evidence,
    penalties,
    bonuses,
    singleBiggestLeak,
  };
}
