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
import { scoreVisualDesign } from "./designScoring";
import { scoreVisualAudit } from "./visualScoring";
import { buildAuditContext } from "./auditContext";
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

type CtaGoal = "commerce" | "quote" | "booking" | "consultation" | "download" | "demo";

function classifyCtaSignal(signal: string): "strong" | "weak" | "none" {
  const lower = signal.toLowerCase();

  const goals: CtaGoal[] = ["commerce", "quote", "booking", "consultation", "download", "demo"];
  if (
    /\b(find (?:a |your )?(?:dealer|location|cafe)|make a booking|bespreek|beskikbaarheid)\b/.test(lower) ||
    goals.some((goal) => ctaMatchesGoal(signal, goal)) ||
    /\bdiscuss\s+(?:(?:your|a|an|our|the)\s+)?(?:website|app|game|project|brief|visual production|automation)\b/.test(lower)
  ) {
    return "strong";
  }

  if (
    /\b(get (a )?quote|request (a )?quote|book|schedule|start|sign up|apply|trial|buy now|shop now|shop our products|view product range|call now|call us|request demo|book a demo|consultation)\b/.test(
      lower,
    )
  ) {
    return "strong";
  }

  if (
    /\b(contact|kontak ons|beskrywing|learn more|view|explore|send message|chat|discover|read more|about)\b/.test(
      lower,
    )
  ) {
    return "weak";
  }

  return "none";
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function headlineTooLong(headline: string): boolean {
  const cleaned = headline.replace(/\s+/g, " ").trim();
  return cleaned.length > 105 || wordCount(cleaned) > 16;
}

function keywordStuffedHeadline(headline: string): boolean {
  const cleaned = headline.replace(/\s+/g, " ").trim().toLowerCase();
  const words = cleaned
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5);
  const repeatedTerms = words.length - new Set(words).size;
  const localModifierCount = (
    cleaned.match(/\b(pretoria|centurion|tshwane|north|east|south|west|near me|residential|commercial|industrial)\b/g) ??
    []
  ).length;

  return (
    headlineTooLong(cleaned) &&
    (repeatedTerms >= 2 || localModifierCount >= 3 || /[,;:]/.test(cleaned))
  );
}

function pageHasOverloadedHeadline(scrapedData: ScrapedWebsiteData): boolean {
  const entry = scrapedData.crawl?.pages.find(page => page.url === scrapedData.url);
  return entry ? headlineTooLong(entry.primaryHeading || "") : scrapedData.headings.h1.some(headlineTooLong);
}

function pageHasKeywordStuffedHeadline(scrapedData: ScrapedWebsiteData): boolean {
  return scrapedData.headings.h1.some(keywordStuffedHeadline);
}

function ctaMatchesGoal(signal: string, goal: CtaGoal): boolean {
  const lower = signal.toLowerCase();
  switch (goal) {
    case "commerce":
      return /\b(add to cart|checkout|buy now|shop now|shop|shop our products|view product range|order now)\b/.test(lower);
    case "quote":
      return /\b(get|request)\s+(a\s+)?quote\b|\bestimate\b|\bcall now\b|\bwhatsapp\b/.test(lower);
    case "booking":
      return /\b(check availability|book direct|reserve a table|make a reservation|view menu|enquire about availability|inquire about availability)\b|\b(book|schedule)\b.*\b(appointment|visit|call|consultation|room|stay|table)\b|\bbook now\b|\bcall now\b/.test(lower);
    case "consultation":
      return /\b(book|schedule)\b.*\b(consultation|call|discovery|conversation)\b|\bfree consultation\b/.test(lower);
    case "download":
      return /\b(download|install|play now|get the app|app store|google play)\b/.test(lower);
    case "demo":
      return /\b(book|request)\b.*\bdemo\b|\bstart free trial\b|\bstart trial\b|\bsign up\b/.test(lower);
    default:
      return false;
  }
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
    if (/\b(login|log in|my account|create my account|recover password|lost password|cart is empty|checkout)\b/i.test(h1)) {
      return false;
    }
    const words = h1.trim().split(/\s+/);
    return words.length >= 4 && h1.trim().length >= 22;
  });
}

function hasNumericProof(text: string): boolean {
  if (/\b\d(?:\.\d)?\s*\/\s*5\b|\b\d[\d,]*\+?\s*(reviews|runners|teams)\b|\b\d+-day returns\b/i.test(text)) return true;
  return /\d+(?:\.\d+)?\s*%|\bsince\s+\d{4}\b|\b\d+\+?\s*(years|clients|customers|projects|locations|branches|rooms|guests)\b|\b(?:in|within)\s+\d+\s*(days|weeks|hours|minutes|months)\b|(?:R|ZAR|USD|GBP|EUR|\$)\s*\d+[\d,.]*\b/i.test(
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

  if (penaltyLabels.has("Keyword-Stuffed Headline")) {
    return "Your homepage is ranking for phrases instead of persuading people.";
  }

  if (penaltyLabels.has("Mismatched CTA Goal")) {
    return "The page asks for the wrong next step, so buyer intent cools down.";
  }

  if (penaltyLabels.has("Trust Proof Not Observed") && penaltyLabels.has("No Contact Path")) {
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
  const audit = buildAuditContext(scrapedData);
  const titleText = scrapedData.title.trim();
  const descriptionText = scrapedData.description.trim();
  const headingCount = scrapedData.headings.h1.length + scrapedData.headings.h2.length;
  const hasH1 = scrapedData.headings.h1.length > 0;
  const meaningfulH1 = hasMeaningfulH1(scrapedData.headings.h1);
  const contentLength = scrapedData.content.length;
  const homepageContentLength =
    scrapedData.crawl?.pages.find((page) => page.role === "home")?.contentLength ??
    contentLength;
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
  const overloadedHeadline = pageHasOverloadedHeadline(scrapedData);
  const stuffedHeadline = pageHasKeywordStuffedHeadline(scrapedData);
  const headlineWorksForClarity = meaningfulH1 && !overloadedHeadline && !stuffedHeadline;

  const trustSignalCount = scrapedData.trustSignals.length;
  const contactSignalCount = scrapedData.contactSignals.length;
  const strongCtaCount = audit.actionLabels.filter(
    (cta) => classifyCtaSignal(cta) === "strong",
  ).length;
  const weakCtaCount = audit.actionLabels.filter(
    (cta) => classifyCtaSignal(cta) === "weak",
  ).length;
  const ctaCount = strongCtaCount + weakCtaCount;
  const genericCount = scrapedData.genericPhrasesFound.length;
  const hasObservedContactPath = audit.journeys.some(journey =>
    ["contact", "call", "apply", "find_dealer", "reserve_table", "book_stay"].includes(journey.intent) && journey.status !== "unclear");

  const clarity = scoreClarity({
    titleExists,
    titleLengthGood,
    titleSpecific: titleLengthGood && (hasServiceKeywords || headlineOutcomeHit || /\d/.test(titleText)),
    hasH1,
    meaningfulH1: headlineWorksForClarity,
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
    meaningfulH1: headlineWorksForClarity,
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

  if (stuffedHeadline) {
    addAdjustment(
      penalties,
      "Keyword-Stuffed Headline",
      7,
      "The primary headline is overloaded with service and location terms instead of a clear buyer promise.",
    );
  } else if (overloadedHeadline) {
    addAdjustment(
      penalties,
      "Overloaded Hero Headline",
      5,
      "The primary headline is too long for quick buyer comprehension.",
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
      "No recognised CTA label was found in the captured evidence; this is a detection gap, not proof that no customer action exists.",
    );
  } else if (strongCtaCount === 0 && weakCtaCount > 0 && !hasObservedContactPath) {
    addAdjustment(
      penalties,
      "Weak CTA Path",
      3,
      "Detected CTA labels are generic; no specific action wording was recognised. This does not establish whether the destination or form works.",
    );
  }

  if (trustSignalCount === 0) {
    addAdjustment(
      penalties,
      "Trust Proof Not Observed",
      7,
      "No recognised testimonials, reviews or case-study signals were extracted. Other proof or uncaptured pages may exist.",
    );
  }

  if (contactSignalCount === 0) {
    addAdjustment(
      penalties,
      "No Contact Path",
      4,
      "No recognised contact method was extracted; this does not establish that the site has none.",
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

  if ((scrapedData.siteFacts?.copyIssues.length ?? 0) > 0) {
    addAdjustment(
      penalties,
      "Visible Copy Quality Gap",
      3,
      "Visible copy issues or generic credibility claims make the business feel less careful.",
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

  if (homepageContentLength > 9000) {
    addAdjustment(
      penalties,
      "Bloated Content",
      2,
      "Copy is bloated, which can bury key conversion messages.",
    );
  }

  if (numericProof && ctaCount >= 2 && strongCtaCount > 0) {
    addAdjustment(
      bonuses,
      "Quantified Offer + CTA",
      3,
      "Numeric messaging and specific action wording were detected. This bonus assesses visible copy, not a tested enquiry or checkout flow.",
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

  const capturedAction = [scrapedData.visualAudit?.desktop, scrapedData.visualAudit?.mobile].some(view => view?.captureReadiness?.settled && view.primaryCtaAboveFold && !!view.primaryCtaText);
  if (capturedAction || (!scrapedData.visualAudit?.available && scrapedData.visualHints.aboveFoldCtaLikely && scrapedData.visualHints.formAboveFoldLikely)) {
    addAdjustment(
      bonuses,
      "Above-Fold Action Path",
      2,
      capturedAction ? "A settled viewport contains a visible primary CTA. No above-fold form or completed enquiry was established." : "Heuristic action-layout signals were detected. This does not establish a visible form or a completed enquiry flow.",
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
  const preliminaryRaw = clampToRange(baseRaw - penaltyTotal + bonusTotal, 0, 100);
  const rawCaps: number[] = [];
  if (stuffedHeadline) rawCaps.push(68);
  const visualSummary = scrapedData.visualAudit?.summary;
  if (visualSummary) {
    if (visualSummary.readability < 35 && visualSummary.ctaProminence < 45) {
      rawCaps.push(58);
    } else if (visualSummary.readability < 35) {
      rawCaps.push(62);
    }
    if (visualSummary.motionDistraction > 60 && visualSummary.readability < 50) {
      rawCaps.push(60);
    }
  }
  const cappedRaw = rawCaps.length > 0 ? Math.min(preliminaryRaw, ...rawCaps) : preliminaryRaw;
  const rawScore = roundToOne(clampToRange(cappedRaw, 0, 100));
  const score = scoreOutOf10FromRaw(rawScore);

  const baseConfidence = computeConfidence({
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
  const confidence = Math.max(20, baseConfidence - (audit.scope.sampled ? 8 : 0) -
    (audit.scope.staticPages.length ? 8 : 0) - (!scrapedData.visualAudit?.available ? 10 : 0));

  const findings = toFindings(
    {
      titleExists,
      meaningfulH1: headlineWorksForClarity,
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
    `Observed business evidence: ${audit.profile.summary}`,
  );
  findings.push(`Observed actions: ${audit.actionLabels.slice(0, 8).join(" | ") || "not established"}. Presence is not a completed journey test.`);
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

  const visualDesign = scoreVisualDesign({
    scrapedData,
    breakdown,
    penalties,
    overallScore: score,
  });

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
    visualDesign: scrapedData.visualAudit?.available ? visualDesign : undefined,
    findings: normalizedFindings,
    evidence,
    penalties,
    bonuses,
    singleBiggestLeak,
  };
}
