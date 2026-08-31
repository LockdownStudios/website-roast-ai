import {
  categoryRatio,
  CATEGORY_WEIGHTS,
  getWeakestCategory,
  roundToOne,
} from "./scoringConfig";
import { buildImplementationBlueprint, toQuickFixLines } from "./implementationGuide";
import { buildSiteContextSnapshot, extractSourceAnchors, type SiteNiche } from "./siteContext";
import type {
  RoastClaim,
  RoastClaimSeverity,
  RoastClaimSource,
  RoastResultPayload,
  ScoreLabel,
  ScrapedWebsiteData,
  WebsiteScoring,
} from "./types";

const SYSTEM_PROMPT = `You are a brutally honest direct-response conversion expert.
Your tone is sharp, witty, harsh, and memorable.
You roast weak marketing decisions, not the human.

Rules:
- Be specific to provided evidence only
- Do not invent facts
- No polite filler and no corporate fluff
- Do not hedge with weak language ("could", "consider", "might")
- Do not write category-only criticism; every criticism needs a concrete site detail
- Quote exact site text, CTA text, trust gaps, visual metrics, or missing signals
- If trust, CTA, clarity, or differentiation is weak, call it out directly
- Be harder on vague offers, soft CTAs, thin proof, and copy that sounds interchangeable
- Keep feedback concise, punchy, and conversion-focused
- Give implementation-grade fixes users can execute immediately
- Every major criticism should map to real scraped signals
- First impression must include one memorable roast line grounded in quoted evidence
- The opening sentence should sting. Start with the sharpest site-specific line, then explain it.
- Put the roast before the audit. The user should feel the punch before the explanation.
- Avoid neutral consultant language that sounds generic across sites
- Vary rhythm, metaphors, and sentence structure between reports
- Do not reuse the same opening frame across first_impression, single_biggest_leak, and mistakes
- Do not refer to localhost, 127.0.0.1, or development hostnames as the business name. Say "this page" instead.
- Never quote internal labels like "No trust proof detected", "No contact path detected", or "No strong CTA detected". Translate them into human business language.
- Output a claim contract that maps key claims to concrete evidence snippets
- Never recommend "Shop Now" unless the detected niche is Ecommerce and the evidence includes real shopping/cart/checkout intent
- For local service, professional service, healthcare, and agency sites, recommend quote, booking, consultation, call, or appointment actions

Return valid JSON only.`;

const SOFT_PHRASES = [
  "could improve",
  "consider",
  "might",
  "may want to",
  "could benefit",
  "optimize your",
  "enhance",
  "user experience",
  "improve your",
  "it may help",
  "it might help",
];

const VAGUE_MISTAKE_PHRASES = [
  "improve user experience",
  "improve your website",
  "better content",
  "more engaging",
  "stronger messaging",
  "improve seo",
  "improve design",
];

const GENERIC_REJECTION_PHRASES = [
  "focus on user experience",
  "enhance your website",
  "improve engagement",
  "consider adding",
  "you should consider",
  "it would be beneficial",
  "optimize your website",
  "strengthen your online presence",
  "increase your digital presence",
  "solid foundation",
  "workable base",
  "good start",
  "strong start",
  "nice website",
  "looks good",
  "overall decent",
  "not bad",
];

const ROAST_EDGE_TERMS = [
  "lazy",
  "limp",
  "soft",
  "toothless",
  "forgettable",
  "anonymous",
  "committee",
  "wallpaper",
  "receipt",
  "receipts",
  "guess",
  "guessing",
  "leak",
  "bleed",
  "buried",
  "blurry",
  "generic",
  "invisible",
  "weak",
  "wrong",
  "stuffed",
  "overloaded",
  "bloated",
  "flat",
  "confusing",
  "brochure",
  "snoozing",
  "dragging",
  "hesitate",
  "bland",
  "invisible",
  "template",
  "shrug",
  "drift",
  "ghost",
  "yawn",
];

const SPECIFICITY_TERMS = [
  "\"",
  "h1",
  "headline",
  "title",
  "meta",
  "cta",
  "call to action",
  "testimonial",
  "review",
  "case study",
  "contact",
  "email",
  "phone",
  "offer",
  "trust",
  "generic",
  "proof",
  "above the fold",
  "hero",
  "footer",
  "faq",
  "section",
  "contrast",
  "mobile",
  "visual",
  "font",
];

const CLAIM_SOURCES: RoastClaimSource[] = [
  "title",
  "meta",
  "h1",
  "h2",
  "content",
  "cta",
  "trust",
  "contact",
  "visual",
  "crawl",
  "scoring",
];

const IMPLEMENTATION_LOCATION_TERMS = [
  "hero",
  "above the fold",
  "header",
  "navigation",
  "nav",
  "mid-page",
  "services section",
  "trust block",
  "proof strip",
  "faq",
  "footer",
  "cta",
  "contact",
];

const IMPLEMENTATION_ACTION_TERMS = [
  "rewrite",
  "replace",
  "add",
  "remove",
  "repeat",
  "place",
  "use",
  "create",
  "move",
  "reorder",
];

function toScoreLabel(score: number): ScoreLabel {
  if (score <= 2.5) return "Brutal";
  if (score <= 4.5) return "Needs Work";
  if (score <= 6.5) return "Decent but Leaking";
  if (score <= 8.5) return "Strong Foundation";
  return "Conversion Ready";
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(" | ") : "None detected";
}

function categoryLine(scoringData: WebsiteScoring): string {
  return `Clarity: ${scoringData.breakdown.clarity}/${CATEGORY_WEIGHTS.clarity}
Trust: ${scoringData.breakdown.trust}/${CATEGORY_WEIGHTS.trust}
CTA: ${scoringData.breakdown.CTA}/${CATEGORY_WEIGHTS.CTA}
Differentiation: ${scoringData.breakdown.differentiation}/${CATEGORY_WEIGHTS.differentiation}
Design Hint: ${scoringData.breakdown.design_hint}/${CATEGORY_WEIGHTS.design_hint}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function variantIndex(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
  salt: string,
  count: number,
): number {
  if (count <= 1) {
    return 0;
  }

  return stableHash(
    [
      scrapedData.url,
      scrapedData.title,
      scrapedData.headings.h1[0] ?? "",
      scrapedData.ctas[0] ?? "",
      weakestCategory(scoringData),
      salt,
    ].join("|"),
  ) % count;
}

function pickVariant<T>(
  items: T[],
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
  salt: string,
): T {
  return items[variantIndex(scrapedData, scoringData, salt, items.length)];
}

function visualPromptLines(scrapedData: ScrapedWebsiteData): string {
  const visual = scrapedData.visualAudit;

  if (!visual) {
    return "Visual audit: not captured.";
  }

  if (!visual.available || !visual.summary) {
    return `Visual audit: unavailable (${visual.reason ?? "rendering not available"}).`;
  }

  const desktop = visual.desktop;
  const mobile = visual.mobile;

  return `Visual audit summary:
- CTA prominence: ${visual.summary.ctaProminence}/100
- Readability: ${visual.summary.readability}/100
- Hierarchy: ${visual.summary.hierarchy}/100
- Consistency: ${visual.summary.consistency}/100
- Motion distraction: ${visual.summary.motionDistraction}/100
- Desktop primary CTA: ${desktop?.primaryCtaText ? `"${desktop.primaryCtaText}"` : "none"} (above fold=${String(desktop?.primaryCtaAboveFold ?? false)}, contrast=${desktop?.primaryCtaContrast ?? 0})
- Mobile primary CTA: ${mobile?.primaryCtaText ? `"${mobile.primaryCtaText}"` : "none"} (above fold=${String(mobile?.primaryCtaAboveFold ?? false)}, contrast=${mobile?.primaryCtaContrast ?? 0})
- Visual findings: ${visual.findings.length > 0 ? visual.findings.join(" | ") : "none"}`;
}

function humanSignal(value: string): string {
  return value
    .replace(
      /\bNo trust proof detected\b/gi,
      "no visible testimonials, client results, reviews, credentials, or proof near the pitch",
    )
    .replace(
      /\bNo contact path detected\b/gi,
      "no obvious email, phone, booking route, or direct contact path",
    )
    .replace(/\bNo strong CTA detected\b/gi, "no clear primary CTA")
    .replace(/\bNo CTA text detected\b/gi, "no clear CTA text")
    .replace(/\bNo H1 detected\b/gi, "no visible primary headline")
    .replace(/\bNo H2s detected\b/gi, "no visible section headlines")
    .replace(/\bNo generic phrase flags detected\b/gi, "no obvious generic phrase flags")
    .replace(/\bNo obvious generic phrase flags\b/gi, "no obvious generic phrase flags");
}

function quoted(value: string | undefined, fallback: string): string {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }

  const human = humanSignal(cleaned);
  return human !== cleaned ? human : `"${human.slice(0, 180)}"`;
}

function alignGoalLanguage(
  value: string,
  niche: SiteNiche,
  nicheLabel: string,
  primaryCta: string,
): string {
  if (niche === "ecommerce") {
    return value;
  }

  return value
    .replace(/\b"Shop Now"\b/gi, `"${primaryCta}"`)
    .replace(/\bShop Now\b/gi, primaryCta)
    .replace(/\becommerce traffic\b/gi, `${nicheLabel.toLowerCase()} traffic`)
    .replace(/\bhigh-intent shoppers\b/gi, "high-intent buyers")
    .replace(/\bshoppers\b/gi, "buyers")
    .replace(/\bshopping\b/gi, "buying");
}

function genericEvidenceLine(context: ReturnType<typeof buildSiteContextSnapshot>): string {
  if (/^no obvious generic phrase flags$/i.test(context.genericCopySummary)) {
    return `thin ${context.nicheLabel.toLowerCase()} differentiation`;
  }

  return quoted(context.genericCopySummary, "generic copy");
}

function formatEvidenceList(items: string[], emptyLabel: string, limit = 5): string {
  if (items.length === 0) {
    return emptyLabel;
  }

  return items.slice(0, limit).map((item) => quoted(item, "missing")).join(" | ");
}

function buildVoiceDirective(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const directives = [
    "Voice pattern: surgical, dry, and blunt. Short punch first, evidence second.",
    "Voice pattern: impatient conversion auditor. Call out the wasted money directly.",
    "Voice pattern: sharp creative director. Roast the messaging like a weak campaign concept.",
    "Voice pattern: sales-floor brutalist. Treat vague copy like a lost deal.",
    "Voice pattern: skeptical buyer. Attack the exact thing that makes this page hard to trust.",
  ];
  const forbidden = [
    "Do not use the phrases 'headline wallpaper', 'trust is starving', 'conversion tax', or 'polite afterthought'.",
    "Do not start multiple sections with the same subject or sentence rhythm.",
    "Do not use a generic template like 'The biggest leak is...' unless the rest of the sentence is highly specific.",
  ];

  return `${pickVariant(directives, scrapedData, scoringData, "voice")}\n${forbidden.join("\n")}`;
}

function buildSiteEvidenceDossier(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const visual = scrapedData.visualAudit?.summary;
  const crawlPages = scrapedData.crawl?.pages ?? [];
  const weakest = weakestCategory(scoringData);
  const weakestLabel = weakest === "design_hint" ? "structure" : weakest;
  const pageSummary = crawlPages.length > 0
    ? crawlPages
        .slice(0, 5)
        .map((page) => `${page.role}: ${page.title || page.url} (${page.contentLength} chars)`)
        .join(" | ")
    : "homepage only";

  return `SITE EVIDENCE DOSSIER (use these exact details in the roast):
- Detected niche: ${context.nicheLabel}
- Weakest conversion area: ${weakestLabel}
- URL: ${scrapedData.url}
- Title: ${quoted(scrapedData.title, "No title detected")}
- Meta description: ${quoted(scrapedData.description, "No meta description detected")}
- Primary H1: ${quoted(scrapedData.headings.h1[0], "No H1 detected")}
- Top H2s: ${formatEvidenceList(scrapedData.headings.h2, "No H2s detected", 4)}
- CTA text found: ${formatEvidenceList(scrapedData.ctas, "no clear CTA text found", 6)}
- Trust proof found: ${formatEvidenceList(scrapedData.trustSignals, "no visible testimonials, reviews, credentials, client results, or proof found", 6)}
- Contact path found: ${formatEvidenceList(scrapedData.contactSignals, "no obvious email, phone, booking route, or direct contact path found", 4)}
- Generic phrases found: ${formatEvidenceList(scrapedData.genericPhrasesFound, "No generic phrase flags detected", 6)}
- Visual metrics: ${visual ? `CTA ${visual.ctaProminence}/100, readability ${visual.readability}/100, hierarchy ${visual.hierarchy}/100, consistency ${visual.consistency}/100, motion risk ${visual.motionDistraction}/100` : "not available"}
- Pages sampled: ${pageSummary}
- Biggest deterministic leak: ${scoringData.singleBiggestLeak}`;
}

function siteContextPromptLines(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  return `Site context snapshot:
- Niche: ${context.nicheLabel}
- Offer headline: ${context.offerHeadline}
- Detected CTA snapshot: ${humanSignal(context.primaryCta)}
- Recommended CTA: ${blueprint.primaryCta} (${blueprint.primaryCtaSource})
- Proof snapshot: ${humanSignal(context.topTrustSignal)}
- Contact snapshot: ${humanSignal(context.contactPathSummary)}
- Generic copy snapshot: ${context.genericCopySummary}`;
}

function buildUserPrompt(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const crawl = scrapedData.crawl;
  const crawlLines = crawl
    ? `CRAWL SUMMARY:
- Strategy: ${crawl.strategy}
- Pages visited: ${crawl.pageCount}
- Visited URLs: ${crawl.visitedUrls.join(" | ")}
- Failed URLs: ${crawl.failedUrls.length > 0 ? crawl.failedUrls.join(" | ") : "None"}`
    : "CRAWL SUMMARY:\n- Strategy: single_page\n- Pages visited: 1";

  return `Analyze this website using scraped data and precomputed scoring.

Website URL: ${scrapedData.url}

PRECOMPUTED SCORE:
Total Score: ${scoringData.score}/10
Raw Score: ${scoringData.rawScore}/100
Confidence: ${scoringData.confidence}%

BREAKDOWN (weighted):
${categoryLine(scoringData)}

DETECTED SIGNALS:
- CTAs found: ${formatList(scrapedData.ctas)}
- Trust signals found: ${formatList(scrapedData.trustSignals)}
- Contact signals found: ${formatList(scrapedData.contactSignals)}
- Generic phrases found: ${formatList(scrapedData.genericPhrasesFound)}
- Visual hints: aboveFoldCtaLikely=${String(scrapedData.visualHints.aboveFoldCtaLikely)}, heroHeadingEarly=${String(scrapedData.visualHints.heroHeadingEarly)}, formAboveFoldLikely=${String(scrapedData.visualHints.formAboveFoldLikely)}
- Scrape quality: ${scrapedData.scrapeQuality} (retryUsed=${String(scrapedData.retryUsed)}, relaxedFallback=${String(scrapedData.usedRelaxedFallback)}, contentLength=${scrapedData.contentLength})
${visualPromptLines(scrapedData)}
${crawlLines}
${siteContextPromptLines(scrapedData, scoringData)}
${buildVoiceDirective(scrapedData, scoringData)}
${buildSiteEvidenceDossier(scrapedData, scoringData)}

PENALTIES:
${scoringData.penalties.length > 0 ? scoringData.penalties.map((item) => `- ${item.label}: -${item.points} (${item.reason})`).join("\n") : "- None"}

BONUSES:
${scoringData.bonuses.length > 0 ? scoringData.bonuses.map((item) => `- ${item.label}: +${item.points} (${item.reason})`).join("\n") : "- None"}

TITLE:
${scrapedData.title}

META DESCRIPTION:
${scrapedData.description}

H1:
${formatList(scrapedData.headings.h1)}

H2:
${formatList(scrapedData.headings.h2)}

CONTENT SNIPPET:
${scrapedData.contentSnippet}

SCORING EVIDENCE:
${scoringData.evidence.map((line) => `- ${line}`).join("\n")}

Return JSON in this exact format:
{
  "score": number,
  "score_label": "string",
  "first_impression": "string",
  "single_biggest_leak": "string",
  "mistakes": ["string", "string", "string"],
  "lost_customers": "string",
  "quick_fixes": ["string", "string", "string"],
  "high_impact": "string",
  "tone_summary": "string",
  "evidence": ["string", "string", "string"],
  "claim_contract": [
    {
      "claim": "string",
      "source": "title|meta|h1|h2|content|cta|trust|contact|visual|crawl|scoring",
      "evidence": "string",
      "severity": "high|medium|low"
    }
  ]
}

Output constraints:
- Keep score within +/-0.4 of precomputed score
- score_label must map honestly to score
- first_impression must sound like a real harsh roast, not generic UX advice or a neutral audit note
- first_impression must open with the hardest line, not a setup sentence
- first_impression must quote or name at least one exact site detail from the dossier
- single_biggest_leak must name the specific leak, quote the exact headline/CTA/proof/contact signal behind it, and explain why money is leaking
- mistakes must be concrete and each must reference actual signals; at least 3 mistakes must quote or name exact site details
- mistakes must be harsher than the first_impression, not a polite checklist
- mistakes must not repeat the same trust/CTA/contact point with different wording
- lost_customers must explain the business consequence in plain money/lead/customer terms, not analytics jargon
- Do not say only "trust is weak", "CTA is weak", "messaging is generic", or similar. Explain exactly what text/signal makes it weak.
- Do not include internal analysis labels such as engine version, scrape quality, cached report, claim contract, raw score, or confidence in the roast fields
- Do not include scanner fallback phrases such as "No trust proof detected", "No contact path detected", "No strong CTA detected", or "No CTA text detected"; describe the missing proof, contact route, or CTA in plain language
- Do not use the URL hostname as the subject if it is localhost, 127.0.0.1, or another development host. Say "this page".
- Do not use repeated phrasing from the Voice Directive forbidden list
- The three visible sections must not read like the same sentence with different labels
- quick_fixes must be immediately actionable and implementation-ready
- each quick_fix should follow this structure: "Where: ... | Fix: ... | Example: ..."
- If the detected CTA is weak or mismatched for the site goal, do not recommend standardizing it. Recommend the goal-led CTA from the site context instead.
- Do not recommend "Shop Now" unless the niche is Ecommerce and the evidence shows cart, checkout, buying, or shopping signals. Service businesses need quote/book/call/consultation actions.
- For mobile games or app pages, the primary CTA should usually drive install/download/play intent, not contact intent.
- Use exact site details (headline/CTA/trust/contact/visual findings). If details are missing, say they are missing and roast that absence.
- Include at least 5 sharp roast lines across first_impression, single_biggest_leak, lost_customers, and mistakes
- Harshness target: 9/10. Punch hard, stay useful, and make it feel unmistakably about this website.
- tone_summary must be a punchy one-liner
- tone_summary should feel like the report's headline, not a category label
- tone_summary must sound like a roast headline, not a consultant summary
- Avoid these words/phrases: could, consider, might, optimize your, improve user experience
- claim_contract must include 3 to 6 claims tied to explicit evidence
- If confidence is low, say data is thin and avoid fake certainty`;
}

function parseJsonFromModel(rawContent: string): unknown {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Model did not return JSON.");
  }

  return JSON.parse(jsonMatch[0]);
}

function normalizeStringList(value: unknown, minimum: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return normalized.length >= minimum ? normalized : [];
}

function containsAnyPhrase(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

function isSoft(text: string): boolean {
  return containsAnyPhrase(text, SOFT_PHRASES);
}

function hasSpecificity(text: string): boolean {
  return containsAnyPhrase(text, SPECIFICITY_TERMS);
}

function hasImplementationShape(text: string): boolean {
  const lower = text.toLowerCase();
  const hasSeparator = lower.includes("|") || lower.includes(":");
  const hasLocation = IMPLEMENTATION_LOCATION_TERMS.some((term) =>
    lower.includes(term),
  );
  const hasAction = IMPLEMENTATION_ACTION_TERMS.some((term) =>
    lower.includes(term),
  );
  const hasExample = lower.includes("example");

  return hasSeparator && hasLocation && hasAction && hasExample;
}

function hasSourceAnchor(text: string, anchors: string[]): boolean {
  const lower = text.toLowerCase();
  return anchors.some((anchor) => anchor.length >= 4 && lower.includes(anchor));
}

function hasSiteSpecificDetail(text: string, scrapedData: ScrapedWebsiteData): boolean {
  if (hasSourceAnchor(text, extractSourceAnchors(scrapedData))) {
    return true;
  }

  const lower = text.toLowerCase();
  const missingSignals = [
    "no trust proof detected",
    "no contact path detected",
    "no cta",
    "no strong cta detected",
    "no h1 detected",
    "no meta description",
  ];

  return missingSignals.some((signal) => lower.includes(signal));
}

function hasRoastEdge(text: string): boolean {
  const lower = text.toLowerCase();
  return ROAST_EDGE_TERMS.some((term) => lower.includes(term));
}

function normalizeClaimSource(value: unknown): RoastClaimSource {
  if (typeof value === "string" && CLAIM_SOURCES.includes(value as RoastClaimSource)) {
    return value as RoastClaimSource;
  }
  return "content";
}

function normalizeClaimSeverity(value: unknown): RoastClaimSeverity {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

function sourceEvidence(
  source: RoastClaimSource,
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  switch (source) {
    case "title":
      return scrapedData.title;
    case "meta":
      return scrapedData.description;
    case "h1":
      return scrapedData.headings.h1[0] ?? "No H1 detected";
    case "h2":
      return scrapedData.headings.h2[0] ?? "No H2 detected";
    case "cta":
      return scrapedData.ctas.length > 0
        ? `CTA signals: ${scrapedData.ctas.slice(0, 3).join(" | ")}`
        : "No CTA signals detected";
    case "trust":
      return scrapedData.trustSignals.length > 0
        ? `Trust signals: ${scrapedData.trustSignals.slice(0, 3).join(" | ")}`
        : "No trust signals detected";
    case "contact":
      return scrapedData.contactSignals.length > 0
        ? `Contact signals: ${scrapedData.contactSignals.slice(0, 2).join(" | ")}`
        : "No contact signals detected";
    case "visual":
      return scrapedData.visualAudit?.summary
        ? `Visual summary CTA ${scrapedData.visualAudit.summary.ctaProminence}/100, readability ${scrapedData.visualAudit.summary.readability}/100`
        : "Visual summary unavailable";
    case "crawl":
      return scrapedData.crawl
        ? `Crawl strategy=${scrapedData.crawl.strategy}, pages=${scrapedData.crawl.pageCount}`
        : "Single page scrape";
    case "scoring":
      return `Breakdown Clarity ${scoringData.breakdown.clarity}/${CATEGORY_WEIGHTS.clarity}, Trust ${scoringData.breakdown.trust}/${CATEGORY_WEIGHTS.trust}, CTA ${scoringData.breakdown.CTA}/${CATEGORY_WEIGHTS.CTA}`;
    case "content":
    default:
      return scrapedData.contentSnippet.slice(0, 160);
  }
}

function buildClaimContractFromSignals(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): RoastClaim[] {
  const claims: RoastClaim[] = [];

  const pushClaim = (
    claim: string,
    source: RoastClaimSource,
    severity: RoastClaimSeverity,
  ) => {
    claims.push({
      claim,
      source,
      severity,
      evidence: sourceEvidence(source, scrapedData, scoringData).slice(0, 220),
    });
  };

  if (isWeakCategory(scoringData, "clarity", 0.45)) {
    pushClaim("Offer clarity is weak above the fold.", "h1", "high");
  }
  if (isWeakCategory(scoringData, "trust", 0.5)) {
    pushClaim("Trust proof is not strong enough to convert skeptical buyers.", "trust", "high");
  }
  if (isWeakCategory(scoringData, "CTA", 0.5)) {
    pushClaim("Primary action path is weak or missing.", "cta", "high");
  }
  if (isWeakCategory(scoringData, "differentiation", 0.5)) {
    pushClaim("Copy sounds generic and lacks positioning edge.", "content", "medium");
  }
  if (scrapedData.contactSignals.length === 0) {
    pushClaim("Contact path is hidden or absent in core copy.", "contact", "medium");
  }
  if (scrapedData.visualAudit?.summary && scrapedData.visualAudit.summary.ctaProminence < 45) {
    pushClaim("Visual hierarchy underweights the main CTA.", "visual", "medium");
  }
  if (claims.length === 0) {
    pushClaim("Score outcome is grounded in weighted conversion signals.", "scoring", "low");
  } else {
    pushClaim("Weighted score aligns with the strongest leak category.", "scoring", "low");
  }

  return claims.slice(0, 6);
}

function normalizeClaimContract(
  value: unknown,
  fallback: RoastClaim[],
  scrapedData: ScrapedWebsiteData,
): RoastClaim[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const anchors = extractSourceAnchors(scrapedData);
  const normalized = value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const raw = item as Partial<RoastClaim>;
      const claim =
        typeof raw.claim === "string" && raw.claim.trim()
          ? raw.claim.trim().slice(0, 240)
          : null;
      const evidence =
        typeof raw.evidence === "string" && raw.evidence.trim()
          ? raw.evidence.trim().slice(0, 220)
          : null;
      if (!claim || !evidence) {
        return [];
      }

      return [
        {
          claim,
          evidence,
          source: normalizeClaimSource(raw.source),
          severity: normalizeClaimSeverity(raw.severity),
        },
      ];
    })
    .slice(0, 8);

  if (normalized.length < 3) {
    return fallback;
  }

  const anchoredCount = normalized.filter(
    (item) =>
      hasSourceAnchor(item.claim, anchors) || hasSourceAnchor(item.evidence, anchors),
  ).length;

  if (anchors.length >= 2 && anchoredCount < 2) {
    return fallback;
  }

  return normalized.slice(0, 6);
}

function normalizeScore(rawScore: unknown, baseScore: number): number {
  const numeric = Number(rawScore);
  if (!Number.isFinite(numeric)) {
    return baseScore;
  }

  const bounded = Math.max(baseScore - 0.4, Math.min(baseScore + 0.4, numeric));
  return roundToOne(Math.max(0, Math.min(10, bounded)));
}

function isWeakCategory(
  scoringData: WebsiteScoring,
  key: keyof WebsiteScoring["breakdown"],
  threshold = 0.45,
): boolean {
  return categoryRatio(key, scoringData.breakdown[key]) <= threshold;
}

function weakestCategory(
  scoringData: WebsiteScoring,
): keyof WebsiteScoring["breakdown"] {
  return getWeakestCategory(scoringData.breakdown);
}

function siteAnchorLine(scrapedData: ScrapedWebsiteData): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const h1 = scrapedData.headings.h1[0] ?? context.offerHeadline;
  const cta = context.primaryCta;
  const trust = context.topTrustSignal;
  const contact = context.contactPathSummary;

  return `H1 ${quoted(h1, "missing")}; CTA ${quoted(cta, "missing")}; trust ${quoted(trust, "missing")}; contact ${quoted(contact, "missing")}`;
}

function hostLabel(scrapedData: ScrapedWebsiteData): string {
  try {
    const host = new URL(scrapedData.url).hostname.replace(/^www\./, "");
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/i.test(host)) {
      return "This page";
    }
    return host;
  } catch {
    return "This page";
  }
}

function uniqueNarrativeLines(items: string[], limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const cleaned = item
      .replace(/\blocalhost(?::\d+)?\b/gi, "this page")
      .replace(/\b127\.0\.0\.1(?::\d+)?\b/g, "this page")
      .replace(/\b0\.0\.0\.0(?::\d+)?\b/g, "this page")
      .replace(/\s+/g, " ")
      .trim();
    const human = humanSignal(cleaned);
    const key = human.toLowerCase();
    if (!human || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(human);
  }

  return out.slice(0, limit);
}

function visualEvidenceLine(scrapedData: ScrapedWebsiteData): string {
  const summary = scrapedData.visualAudit?.summary;
  if (!summary) {
    return "visual audit unavailable";
  }

  return `visuals CTA ${summary.ctaProminence}/100, readability ${summary.readability}/100, hierarchy ${summary.hierarchy}/100`;
}

function sellsWebsiteJudgment(scrapedData: ScrapedWebsiteData): boolean {
  const text = [
    scrapedData.title,
    scrapedData.description,
    scrapedData.headings.h1[0],
    scrapedData.contentSnippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(roast|audit|website audit|conversion audit|landing page|website)\b/.test(text);
}

function anchoredRoastHook(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const offer = quoted(context.offerHeadline, "your missing headline");
  const cta = quoted(context.primaryCta, "your missing CTA");
  const trust = quoted(context.topTrustSignal, "no trust proof");
  const contact = quoted(context.contactPathSummary, "no contact path");
  const generic = genericEvidenceLine(context);
  const host = hostLabel(scrapedData);

  if (sellsWebsiteJudgment(scrapedData) && isWeakCategory(scoringData, "trust", 0.45)) {
    return `${host} is selling website judgment while its own page forgets to bring proof. That is like a fire alarm with dead batteries.`;
  }

  switch (weakestCategory(scoringData)) {
    case "clarity":
      return pickVariant(
        [
          `${host} opens with ${offer}, then leaves the buyer assembling the value proposition by hand.`,
          `${offer} sounds busy, but the buyer outcome is still hiding behind the curtain.`,
          `The first screen spends ${offer} like a label, not a reason to care.`,
          `${host} has a clarity problem: ${offer} names the thing, but it does not make the payoff obvious.`,
        ],
        scrapedData,
        scoringData,
        "hook-clarity",
      );
    case "trust":
      return pickVariant(
        [
          `${trust} is doing far too much pretending for far too little proof.`,
          `${host} asks for belief, then hands over ${trust}. That is not credibility; that is a shrug.`,
          `The proof layer is thin enough to see through: ${trust}.`,
          `${offer} needs evidence, but the page serves ${trust} and hopes nobody asks follow-up questions.`,
        ],
        scrapedData,
        scoringData,
        "hook-trust",
      );
    case "CTA":
      return pickVariant(
        [
          `${cta} does not steer the visit; it politely exists while intent leaks away.`,
          `After ${offer}, ${cta} should feel unavoidable. Right now it feels optional in the worst way.`,
          `${host} makes the buyer hunt for momentum, and ${cta} is not strong enough to rescue it.`,
          `${cta} has the command presence of placeholder text.`,
        ],
        scrapedData,
        scoringData,
        "hook-cta",
      );
    case "differentiation":
      return pickVariant(
        [
          `${offer} sounds replaceable, and ${generic} is not helping it earn a memory slot.`,
          `${host} is blending into the category instead of making competitors uncomfortable.`,
          `${generic} makes the positioning feel borrowed, not built.`,
          `${offer} needs a point of view; right now it sounds category-safe and buyer-forgettable.`,
        ],
        scrapedData,
        scoringData,
        "hook-diff",
      );
    case "design_hint":
      return pickVariant(
        [
          `${host} has sections, but the page flow is not creating pressure around ${offer}.`,
          `The layout presents ${offer}; it does not drive anyone toward ${cta}.`,
          `The page structure is organized enough to look finished and loose enough to leak action.`,
          `${offer}, ${cta}, and ${contact} are not working as one conversion path.`,
        ],
        scrapedData,
        scoringData,
        "hook-structure",
      );
    default:
      return `${host} is not dead, but ${offer} is leaking conversion intent before ${cta} can cash it in.`;
  }
}

function buildBiggestLeak(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const offer = quoted(context.offerHeadline, "missing headline");
  const cta = quoted(context.primaryCta, "missing CTA");
  const trust = quoted(context.topTrustSignal, "no trust proof");
  const contact = quoted(context.contactPathSummary, "no contact path");
  const generic = genericEvidenceLine(context);
  const visual = visualEvidenceLine(scrapedData);
  const host = hostLabel(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const penaltyLabels = new Set(scoringData.penalties.map((penalty) => penalty.label));

  if (penaltyLabels.has("Keyword-Stuffed Headline") && penaltyLabels.has("Mismatched CTA Goal")) {
    return pickVariant(
      [
        `${offer} is built like an SEO net, not a buyer promise. Then ${cta} asks for a vague next step when the page should drive "${blueprint.primaryCta}", so high-intent visitors get keywords before confidence.`,
        `${host} leaks intent in two places: the headline is overloaded, and ${cta} does not match the buyer's real job. The page should make "${blueprint.primaryCta}" feel obvious.`,
        `The biggest leak is the headline-to-action handoff. ${offer} makes buyers wade through search terms, then ${cta} fails to turn that interest into "${blueprint.primaryCta}".`,
      ],
      scrapedData,
      scoringData,
      "leak-headline-cta",
    );
  }

  if (penaltyLabels.has("Keyword-Stuffed Headline")) {
    return pickVariant(
      [
        `${offer} is the leak. It reads like a ranking attempt before it reads like a clear buyer promise, so the page spends its first screen making people decode the offer.`,
        `${host} is losing people at the headline. ${offer} has too many keywords and not enough buyer payoff.`,
        `The homepage is trying to satisfy a search engine before it persuades a human. ${offer} needs a shorter promise with a clearer outcome.`,
      ],
      scrapedData,
      scoringData,
      "leak-headline",
    );
  }

  if (penaltyLabels.has("Mismatched CTA Goal")) {
    return pickVariant(
      [
        `${cta} is the leak. For ${context.nicheLabel.toLowerCase()} buyers, the page should drive "${blueprint.primaryCta}" instead of letting intent cool into a vague contact path.`,
        `${host} gets the action wrong. ${cta} is too generic for the decision this page needs, so visitors are not pushed toward "${blueprint.primaryCta}".`,
        `The page loses money at the next step: ${cta} does not match the buyer's goal, while "${blueprint.primaryCta}" would make the action concrete.`,
      ],
      scrapedData,
      scoringData,
      "leak-cta-mismatch",
    );
  }

  switch (weakestCategory(scoringData)) {
    case "clarity":
      return pickVariant(
        [
          `${host} is losing people at the meaning stage: ${offer} does not make the buyer instantly understand the win, so the visit turns into translation work instead of desire.`,
          `${offer} is the leak. It gives the page a label, but not a sharp buyer promise, so qualified visitors have to guess what makes this worth their time.`,
          `Money leaks because ${offer} does not convert attention into a clear want. The buyer arrives with intent and gets a sentence that still needs a sales person standing next to it.`,
          `${host} spends the most valuable screen on ${offer}, but the payoff is not obvious enough. Confused buyers do not lean in; they leave.`,
        ],
        scrapedData,
        scoringData,
        "leak-clarity",
      );
    case "trust":
      return pickVariant(
        [
          `${trust} is the leak. ${offer} asks buyers to believe before the page earns belief, so every claim starts carrying suspicion instead of momentum.`,
          `${host} is bleeding trust because ${trust} does not match the ask. If the page wants a serious action, it needs serious proof near the pitch.`,
          `The sale breaks at credibility: ${offer} makes a claim, but ${trust} gives skeptical buyers too little to verify before they bounce.`,
          `Proof is the missing bridge. ${trust} leaves ${offer} exposed, so the buyer has to choose between trusting blindly or leaving intelligently.`,
        ],
        scrapedData,
        scoringData,
        "leak-trust",
      );
    case "CTA":
      return pickVariant(
        [
          `${cta} is where intent gets weak. After ${offer}, the page should make the next step feel obvious and valuable; instead the action path loses force.`,
          `${host} is letting warm visitors cool down because ${cta} does not take command after ${offer}. That is where clicks turn into exits.`,
          `The leak is not traffic; it is direction. ${offer} creates attention, then ${cta} fails to turn that attention into a decisive next step.`,
          `${cta} is too passive for the job. The page needs a clear conversion shove after ${offer}, not a button that feels easy to ignore.`,
        ],
        scrapedData,
        scoringData,
        "leak-cta",
      );
    case "differentiation":
      return pickVariant(
        [
          `${generic} is the leak. ${offer} needs a reason to choose this site specifically, but the copy keeps sounding like it could survive a logo swap.`,
          `${host} is losing the comparison game because ${offer} does not draw a hard line against alternatives. ${generic} makes the offer fade into the category.`,
          `The page is not giving buyers a memorable reason to pick it. ${offer} plus ${generic} feels like positioning with the serial number scratched off.`,
          `Differentiation is where the money leaks. ${generic} makes ${offer} feel safe, familiar, and dangerously forgettable.`,
        ],
        scrapedData,
        scoringData,
        "leak-diff",
      );
    case "design_hint":
      return pickVariant(
        [
          `${visual} is the leak. ${offer} may be present, but the page does not build enough visual pressure around ${cta} to pull action forward.`,
          `${host} has a structure problem: ${offer}, ${cta}, and ${contact} are not arranged like a sales path. They feel like page parts, not persuasion.`,
          `The page flow leaks because ${offer} is not followed by a strong enough proof-and-action sequence. ${visual} confirms the hierarchy is not doing enough work.`,
          `Visual hierarchy is leaving money on the table. ${cta} should dominate the decision path, but ${visual} says the action is not loud enough.`,
        ],
        scrapedData,
        scoringData,
        "leak-structure",
      );
    default:
      return `The leak sits between ${offer}, ${cta}, ${trust}, and ${contact}: ${host} has funnel pieces, but not enough pressure for a buyer to move.`;
  }
}

function wittyToneByWeakest(scoringData: WebsiteScoring): string {
  switch (weakestCategory(scoringData)) {
    case "clarity":
      return "The hero makes buyers do homework before they care.";
    case "trust":
      return "This page asks for trust with empty hands.";
    case "CTA":
      return "The page wants applause when it needs action.";
    case "differentiation":
      return "The copy could wear a competitor's logo and nobody would notice.";
    case "design_hint":
      return "The page has parts, but no sales spine.";
    default:
      return "The page looks alive, but the sales argument is wheezing.";
  }
}

function fallbackRoastMistakes(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string[] {
  const context = buildSiteContextSnapshot(scrapedData);
  const host = hostLabel(scrapedData);
  const offer = quoted(context.offerHeadline, "missing headline");
  const cta = quoted(context.primaryCta, "missing CTA");
  const trust = quoted(context.topTrustSignal, "no trust proof");
  const contact = quoted(context.contactPathSummary, "no contact path");
  const generic = genericEvidenceLine(context);
  const mistakes: string[] = [];

  if (isWeakCategory(scoringData, "clarity", 0.45)) {
    mistakes.push(
      pickVariant(
        [
          `${offer} talks around the value instead of landing it. ${host} is making the buyer decode the offer before they can want it.`,
          `${host} is wasting the hero on a line that names the business better than it sells the outcome: ${offer}.`,
          `${offer} has no sharp buyer payoff. It is readable, but readable is not the same as persuasive.`,
          `The headline is doing admin work, not sales work. ${offer} tells visitors where they are, not why they should care now.`,
        ],
        scrapedData,
        scoringData,
        "mistake-clarity",
      ),
    );
  }

  if (isWeakCategory(scoringData, "trust", 0.5)) {
    mistakes.push(
      pickVariant(
        [
          `${trust} is not enough proof to carry ${offer}. Buyers are being asked to trust before the page has earned the right.`,
          `${host} gives the buyer too little evidence. ${trust} leaves the page sounding confident without showing why anyone should believe it.`,
          `The proof stack is thin around ${offer}. ${trust} makes the site feel like it wants credibility on credit.`,
          `Credibility is underfed. If ${trust} is the best reassurance, skeptical buyers have every reason to keep comparing.`,
        ],
        scrapedData,
        scoringData,
        "mistake-trust",
      ),
    );
  }

  if (isWeakCategory(scoringData, "CTA", 0.5)) {
    mistakes.push(
      pickVariant(
        [
          `${cta} does not behave like the obvious next step after ${offer}. It sits in the flow instead of driving it.`,
          `${host} lets intent go soft at the exact moment it should ask for action. ${cta} needs command, not manners.`,
          `${cta} is too easy to ignore. A buyer should not have to search for momentum after reading ${offer}.`,
          `The CTA path is weak because ${cta} does not make the next move feel valuable, urgent, or clear enough.`,
        ],
        scrapedData,
        scoringData,
        "mistake-cta",
      ),
    );
  }

  if (isWeakCategory(scoringData, "differentiation", 0.5)) {
    mistakes.push(
      pickVariant(
        [
          `For ${context.nicheLabel.toLowerCase()} traffic, ${generic} makes the positioning feel interchangeable. ${host} needs a sharper reason to be chosen.`,
          `${generic} is flattening the message. ${offer} should sound like a specific bet, not a category default.`,
          `${host} is too easy to compare away. ${generic} gives buyers no memorable contrast against alternatives.`,
          `The copy is playing it safe, and safe copy gets forgotten. ${generic} makes ${offer} sound like it came from the same shelf as everyone else.`,
        ],
        scrapedData,
        scoringData,
        "mistake-diff",
      ),
    );
  }

  if (isWeakCategory(scoringData, "design_hint", 0.55)) {
    mistakes.push(
      pickVariant(
        [
          `${offer}, ${cta}, and ${contact} are not arranged with enough conversion pressure. The page has information, but not a strong path.`,
          `${host} has the ingredients of a page, but the order is not forcing a decision around ${cta}.`,
          `The structure explains, then drifts. ${offer} needs proof and action immediately around it, not scattered persuasion.`,
          `The page flow is too passive. ${visualEvidenceLine(scrapedData)} shows the design is not making ${cta} work hard enough.`,
        ],
        scrapedData,
        scoringData,
        "mistake-structure",
      ),
    );
  }

  if (scrapedData.contactSignals.length === 0) {
    mistakes.push(
      pickVariant(
        [
          `${contact} after ${offer} is a serious leak. High-intent buyers should not have to dig for a way to talk.`,
          `${host} hides the hand-raise path. When ${contact}, the page makes ready buyers work too hard.`,
          `No obvious contact route near the core pitch. After ${offer}, that absence makes the site feel less serious than the ask.`,
        ],
        scrapedData,
        scoringData,
        "mistake-contact",
      ),
    );
  }

  if (scrapedData.genericPhrasesFound.length >= 2) {
    mistakes.push(
      pickVariant(
        [
          `${generic} weakens the edge. Those phrases make ${offer} sound like marketing copy that has been rinsed too many times.`,
          `${scrapedData.genericPhrasesFound.slice(0, 2).join(", ")} are not persuasion; they are filler wearing a business shirt.`,
          `${host} is using generic language where proof or specificity should be. ${generic} drains the page of contrast.`,
        ],
        scrapedData,
        scoringData,
        "mistake-generic",
      ),
    );
  }

  return uniqueNarrativeLines(mistakes, 5);
}

function enforceRoastIntensity(
  candidate: Omit<RoastResultPayload, "score" | "score_label">,
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): Omit<RoastResultPayload, "score" | "score_label"> {
  const context = buildSiteContextSnapshot(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const align = (value: string) =>
    alignGoalLanguage(value, context.niche, context.nicheLabel, blueprint.primaryCta);
  const roastHook = anchoredRoastHook(scrapedData, scoringData);
  const harshLeak = buildBiggestLeak(scrapedData, scoringData);

  const firstImpressionBase =
    hasRoastEdge(candidate.first_impression) &&
    hasSiteSpecificDetail(candidate.first_impression, scrapedData)
    ? candidate.first_impression
    : `${roastHook} ${candidate.first_impression}`.trim();
  const firstImpression =
    sellsWebsiteJudgment(scrapedData) &&
    isWeakCategory(scoringData, "trust", 0.45) &&
    !/fire alarm with dead batteries/i.test(firstImpressionBase)
      ? `${roastHook} ${firstImpressionBase}`.trim()
      : firstImpressionBase;
  const singleBiggestLeak =
    hasRoastEdge(candidate.single_biggest_leak) &&
    hasSiteSpecificDetail(candidate.single_biggest_leak, scrapedData) &&
    !containsAnyPhrase(candidate.single_biggest_leak, GENERIC_REJECTION_PHRASES)
      ? candidate.single_biggest_leak
      : harshLeak;

  const incomingMistakes = candidate.mistakes.length > 0
    ? candidate.mistakes
    : fallbackRoastMistakes(scrapedData, scoringData);
  const fallbackMistakePool = fallbackRoastMistakes(scrapedData, scoringData);
  const sharpenedMistakes = incomingMistakes
    .map((item, index) =>
      isSoft(item) || !hasSiteSpecificDetail(item, scrapedData)
        ? fallbackMistakePool[index % Math.max(1, fallbackMistakePool.length)] ??
          `${roastHook} ${item}`
        : item,
    )
    .slice(0, 5);

  const roastedMistakes =
    sharpenedMistakes.filter((item) => hasRoastEdge(item) && hasSiteSpecificDetail(item, scrapedData)).length >= 3
      ? sharpenedMistakes
      : [...fallbackMistakePool, ...sharpenedMistakes].slice(
          0,
          5,
        );

  const lostCustomers = hasRoastEdge(candidate.lost_customers) && !isSoft(candidate.lost_customers)
    ? candidate.lost_customers
      : `You are paying for traffic just to send people back to Google. For ${context.nicheLabel.toLowerCase()} buyers, ${siteAnchorLine(scrapedData)} is a conversion tax.`;

  const toneSummary = hasRoastEdge(candidate.tone_summary)
    ? candidate.tone_summary
    : wittyToneByWeakest(scoringData);

  const highImpact = isSoft(candidate.high_impact)
    ? `Stop describing. Start selling. Rebuild "${context.offerHeadline}" around one buyer outcome, one proof strip, and one dominant CTA: "${blueprint.primaryCta}".`
    : candidate.high_impact;

  return {
    ...candidate,
    first_impression: align(firstImpression),
    single_biggest_leak: align(singleBiggestLeak),
    mistakes: uniqueNarrativeLines(roastedMistakes.map(align), 5),
    lost_customers: align(lostCustomers),
    quick_fixes: uniqueNarrativeLines(candidate.quick_fixes.map(align), 5),
    high_impact: align(highImpact),
    tone_summary: align(toneSummary),
  };
}

function buildFirstImpression(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const offer = context.offerHeadline;
  const cta = context.primaryCta;
  const noContactPath = scrapedData.contactSignals.length === 0;
  const weakVisualCta =
    Boolean(scrapedData.visualAudit?.summary) &&
    (scrapedData.visualAudit?.summary?.ctaProminence ?? 100) < 45;
  const host = hostLabel(scrapedData);
  const quotedOffer = quoted(offer, "missing headline");
  const quotedCta = quoted(cta, "missing CTA");
  const trust = quoted(context.topTrustSignal, "no trust proof");
  const contact = quoted(context.contactPathSummary, "no contact path");
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const penaltyLabels = new Set(scoringData.penalties.map((penalty) => penalty.label));

  if (scoringData.confidence <= 45 || scrapedData.contentSnippet.length < 180) {
    return pickVariant(
      [
        `Data is thin, but ${host} still exposes the problem: ${quotedOffer} gives buyers almost nothing specific to act on.`,
        `${host} is barely giving the roast enough material, which is already part of the roast. ${quotedOffer} needs more substance than this.`,
        `The scrape is thin, but the pitch is thinner: ${quotedOffer} does not give a buyer enough reason to stay.`,
      ],
      scrapedData,
      scoringData,
      "first-thin",
    );
  }

  if (penaltyLabels.has("Keyword-Stuffed Headline") && penaltyLabels.has("Mismatched CTA Goal")) {
    return pickVariant(
      [
        `${quotedOffer} is trying to win Google and making the buyer pay the reading bill. Then ${quotedCta} asks for the wrong next step; this page should drive "${blueprint.primaryCta}".`,
        `${host} opens with a keyword pile, not a sales promise. ${quotedOffer} needs a cleaner buyer outcome, and ${quotedCta} needs to become "${blueprint.primaryCta}".`,
        `The first impression is SEO anxiety wearing a sales badge: ${quotedOffer}. The page needs a shorter promise and one hard action: "${blueprint.primaryCta}".`,
      ],
      scrapedData,
      scoringData,
      "first-headline-cta",
    );
  }

  if (penaltyLabels.has("Keyword-Stuffed Headline")) {
    return pickVariant(
      [
        `${quotedOffer} is too bloated to sell quickly. The buyer lands on a phrase pile when they need a clean reason to choose the business.`,
        `${host} makes the headline carry every keyword at once. ${quotedOffer} reads busy before it reads persuasive.`,
        `The first impression is a headline trying to be a service-area map. ${quotedOffer} needs one buyer promise, not every location and service stuffed into one breath.`,
      ],
      scrapedData,
      scoringData,
      "first-headline",
    );
  }

  if (penaltyLabels.has("Mismatched CTA Goal")) {
    return pickVariant(
      [
        `${quotedCta} is too soft for the job. After ${quotedOffer}, the page should push "${blueprint.primaryCta}" before buyer intent cools off.`,
        `${host} gets close, then fumbles the ask. ${quotedCta} is not as clear or valuable as "${blueprint.primaryCta}" for this buyer.`,
        `${quotedCta} makes the first screen feel passive. A serious ${context.nicheLabel.toLowerCase()} page needs one concrete action: "${blueprint.primaryCta}".`,
      ],
      scrapedData,
      scoringData,
      "first-cta-mismatch",
    );
  }

  if (isWeakCategory(scoringData, "clarity", 0.4)) {
    return pickVariant(
      [
        `${host} opens with ${quotedOffer} and then makes the buyer do the work. The first impression is effort, not desire.`,
        `${quotedOffer} is too vague for the job. A buyer should land and immediately know the win; this makes them squint at the pitch.`,
        `${host} is spending the hero on explanation when it needs a sharp promise. ${quotedOffer} does not hit hard enough.`,
        `First impression: ${quotedOffer} sounds like a label on a folder, not a reason to choose the business.`,
      ],
      scrapedData,
      scoringData,
      "first-clarity",
    );
  }

  if (isWeakCategory(scoringData, "trust", 0.4)) {
    if (noContactPath) {
      return pickVariant(
        [
          `${host} asks for trust with empty hands: ${trust} and ${contact}. ${quotedOffer} feels exposed, like a claim waiting for evidence that never arrives.`,
          `${quotedOffer} is the pitch, but ${trust} plus ${contact} makes the page feel under-verified and harder to take seriously.`,
          `${host} wants buyer confidence without giving buyer reassurance. ${trust}; ${contact}. That is a rough first impression.`,
        ],
        scrapedData,
        scoringData,
        "first-trust-no-contact",
      );
    }
    if (weakVisualCta) {
      return pickVariant(
        [
          `${host} has thin proof and weak action weight (${visualEvidenceLine(scrapedData)}). ${quotedOffer} is not getting enough visual support to feel convincing.`,
          `${quotedOffer} needs trust and a dominant next step, but ${visualEvidenceLine(scrapedData)} makes the first screen feel underpowered.`,
          `The page asks buyers to believe ${quotedOffer}, then gives the CTA too little visual authority. ${visualEvidenceLine(scrapedData)} tells on it.`,
        ],
        scrapedData,
        scoringData,
        "first-trust-visual",
      );
    }
      return pickVariant(
        [
          `${host} is asking for belief before it brings receipts. Buyers see ${quotedOffer} and get too little proof to relax.`,
          `${quotedOffer} is carrying more claim than evidence. ${trust} is not enough weight for the trust this page wants.`,
          `${host} gives the first impression of a site that wants trust faster than it earns it. ${trust} is the weak link.`,
        ],
      scrapedData,
      scoringData,
      "first-trust",
    );
  }

  if (isWeakCategory(scoringData, "CTA", 0.4)) {
    return pickVariant(
      [
        `Visitors can read ${quotedOffer} and still not feel pulled anywhere. ${quotedCta} is too soft to carry conversion intent.`,
        `${host} creates attention, then lets it idle. ${quotedCta} does not feel like the obvious next move after ${quotedOffer}.`,
        `${quotedCta} is the first impression problem: the page shows an offer, then fails to make action feel worth taking.`,
        `The page does not lack a button as much as it lacks command. ${quotedCta} is not doing enough after ${quotedOffer}.`,
      ],
      scrapedData,
      scoringData,
      "first-cta",
    );
  }

  if (isWeakCategory(scoringData, "differentiation", 0.45)) {
    return pickVariant(
      [
        `${quotedOffer} sounds interchangeable on ${host}. Swap logos with a competitor and the message still fits.`,
        `${host} is not giving buyers a sharp reason to remember it. ${quotedOffer} feels too category-safe.`,
        `${quotedOffer} needs a sharper angle. Right now, the first impression is competent enough to skim and bland enough to forget.`,
        `The first impression is not offensive; it is worse, it is forgettable. ${quotedOffer} does not create separation.`,
      ],
      scrapedData,
      scoringData,
      "first-diff",
    );
  }

  return pickVariant(
    [
      `${host} has the pieces, but the sales argument is wheezing. ${quotedOffer} informs more than it sells, and ${quotedCta} is not doing enough heavy lifting.`,
      `${quotedOffer} gives the page a shell, not enough pressure. ${quotedCta} needs more force if the page wants action.`,
      `${host} looks assembled, not persuasive. ${quotedOffer} and ${quotedCta} need a tighter sales rhythm.`,
    ],
    scrapedData,
    scoringData,
    "first-default",
  );
}

function fallbackMistakes(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string[] {
  const context = buildSiteContextSnapshot(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const hero = scrapedData.headings.h1[0] ?? scrapedData.title ?? "your headline";
  const mistakes: string[] = fallbackRoastMistakes(scrapedData, scoringData);

  mistakes.push(
    ...blueprint.brutalTruths
      .slice(0, 2)
      .map((truth) => truth),
  );

  if (isWeakCategory(scoringData, "clarity")) {
    mistakes.push(
      pickVariant(
        [
          `"${hero}" tells buyers what the page is about, not what they get. That is a weak trade for first-screen attention.`,
          `"${hero}" needs to sell the outcome faster. Right now the buyer has to bring too much imagination to the page.`,
          `"${hero}" is not doing enough conversion work. It names the offer more than it makes the offer desirable.`,
        ],
        scrapedData,
        scoringData,
        "extra-clarity",
      ),
    );
  }

  if (isWeakCategory(scoringData, "trust")) {
    mistakes.push(
      pickVariant(
        [
          `Trust is underpowered around "${context.offerHeadline}". Snapshot: ${context.topTrustSignal}. That is not enough proof to make a skeptical buyer relax.`,
          `"${context.offerHeadline}" is carrying more claim than proof. ${context.topTrustSignal} needs to be stronger, closer, and more concrete.`,
          `The page asks for confidence before it has built confidence. ${context.topTrustSignal} is too light for the decision it wants.`,
        ],
        scrapedData,
        scoringData,
        "extra-trust",
      ),
    );
  }

  if (isWeakCategory(scoringData, "CTA")) {
    mistakes.push(
      pickVariant(
        [
          `CTA path is too quiet. "${context.primaryCta}" exists, but it does not dominate the decision flow.`,
          `"${context.primaryCta}" needs more authority. A conversion path should guide the buyer, not wait to be noticed.`,
          `The page lets action feel optional. "${context.primaryCta}" should be the spine of the page, not one more element in the layout.`,
        ],
        scrapedData,
        scoringData,
        "extra-cta",
      ),
    );
  }

  if (isWeakCategory(scoringData, "differentiation")) {
    const generic = genericEvidenceLine(context);
    mistakes.push(
      pickVariant(
        [
          `Positioning is generic for ${context.nicheLabel.toLowerCase()} traffic. Snapshot: ${generic}. The copy needs a sharper point of view.`,
          `${generic} makes the page sound too easy to replace. Buyers need a reason to choose this offer specifically.`,
          `The differentiation is too soft. ${generic} makes the message feel category-standard instead of choice-worthy.`,
        ],
        scrapedData,
        scoringData,
        "extra-diff",
      ),
    );
  }

  if (isWeakCategory(scoringData, "design_hint")) {
    mistakes.push(
      pickVariant(
        [
          `Structure around "${context.offerHeadline}" explains, but does not push a clear conversion sequence.`,
          `The section order is not creating enough pressure after "${context.offerHeadline}". It informs, then lets the buyer drift.`,
          `The page has content, but the persuasion path is loose. "${context.primaryCta}" needs to show up as the obvious destination.`,
        ],
        scrapedData,
        scoringData,
        "extra-structure",
      ),
    );
  }

  if (scrapedData.genericPhrasesFound.length >= 2) {
    mistakes.push(
      `Generic claims (${scrapedData.genericPhrasesFound.slice(0, 2).join(", ")}) are sanding down your edge until the offer sounds mass-produced.`,
    );
  }

  if (scrapedData.visualAudit?.available && scrapedData.visualAudit.summary) {
    const visual = scrapedData.visualAudit.summary;
    if (visual.ctaProminence < 45) {
      mistakes.push(
        pickVariant(
          [
            `CTA prominence is ${visual.ctaProminence}/100, so the primary action is visually under-selling itself above the fold.`,
            `The CTA is not visually dominant enough (${visual.ctaProminence}/100). Buyers should not have to notice the next step by accident.`,
            `Above the fold, action does not look important enough. CTA prominence at ${visual.ctaProminence}/100 is leaving intent under-directed.`,
          ],
          scrapedData,
          scoringData,
          "visual-cta",
        ),
      );
    }
    if (visual.readability < 50) {
      mistakes.push(
        `Readability is ${visual.readability}/100, which means the design is making fast comprehension harder than it needs to be.`,
      );
    }
    if (visual.consistency < 45) {
      mistakes.push(
        `Visual consistency is ${visual.consistency}/100, so the page quietly chips away at trust before the copy can recover it.`,
      );
    }
  }

  if (mistakes.length < 3) {
    mistakes.push(...scoringData.findings.slice(0, 3));
  }

  return uniqueNarrativeLines(mistakes, 5);
}

function fallbackQuickFixes(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string[] {
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const fixes = toQuickFixLines(blueprint, 4);
  const primaryCta = blueprint.primaryCta;

  fixes.push(
    `Footer and final CTA section: Reuse one exact action label so intent does not drop. Example: Button text = "${primaryCta}" and microcopy = "No pressure. 20-minute intro call."`,
  );

  if (scrapedData.visualAudit?.available && scrapedData.visualAudit.summary) {
    const visual = scrapedData.visualAudit.summary;

    if (visual.readability < 55) {
      fixes.push(
        "Body copy and CTA buttons: Increase text/background contrast and body font size for scan speed. Example: Keep body text >=16px and CTA contrast >=4.5:1.",
      );
    }

    if (visual.ctaProminence < 50) {
      fixes.push(
        `Hero CTA block: Make one dominant button with clear visual weight. Example: "${primaryCta}" as the largest button, and downgrade secondary actions to text links.`,
      );
    }

    if (visual.motionDistraction > 60) {
      fixes.push(
        "Above-the-fold interactions: Reduce non-essential animations that compete with CTA focus. Example: Keep transitions under 250ms and remove autoplay motion near hero copy.",
      );
    }
  }

  return uniqueNarrativeLines(fixes, 5);
}

function highImpactByWeakest(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): string {
  const context = buildSiteContextSnapshot(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  switch (weakestCategory(scoringData)) {
    case "clarity":
      return `Turn "${context.offerHeadline}" into a direct ${context.nicheLabel.toLowerCase()} offer with one buyer outcome and one specific promise.`;
    case "trust":
      return `Add immediate proof above the fold around "${context.offerHeadline}" so visitors do not have to guess if you are credible.`;
    case "CTA":
      return `Create one dominant next step around "${blueprint.primaryCta}" and remove competing actions that dilute intent.`;
    case "differentiation":
      return `Position "${context.offerHeadline}" against alternatives explicitly so buyers know why choosing you is safer.`;
    case "design_hint":
      return `Reorder sections around conversion flow for ${context.nicheLabel.toLowerCase()} buyers, not company narrative.`;
    default:
      return "Tighten message-to-CTA flow so attention turns into action.";
  }
}

export function generateFallbackRoast(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): RoastResultPayload {
  const context = buildSiteContextSnapshot(scrapedData);
  const blueprint = buildImplementationBlueprint(scrapedData, scoringData);
  const score = roundToOne(scoringData.score);
  const toneSummary = wittyToneByWeakest(scoringData);
  const evidence = scoringData.evidence.slice(0, 5);
  const claimContract = buildClaimContractFromSignals(scrapedData, scoringData);

  const base: RoastResultPayload = {
    score,
    score_label: toScoreLabel(score),
    first_impression: buildFirstImpression(scrapedData, scoringData),
    single_biggest_leak: buildBiggestLeak(scrapedData, scoringData),
    mistakes: fallbackMistakes(scrapedData, scoringData),
    lost_customers:
      blueprint.primaryCtaSource === "recommended"
        ? `For ${context.nicheLabel.toLowerCase()} traffic, weak trust and a soft action path around "${context.primaryCta}" mean visitors miss the real goal: "${blueprint.primaryCta}".`
        : `For ${context.nicheLabel.toLowerCase()} traffic, weak trust and a soft action path around "${context.primaryCta}" mean qualified visitors leave before converting.`,
    quick_fixes: fallbackQuickFixes(scrapedData, scoringData),
    high_impact: highImpactByWeakest(scrapedData, scoringData),
    tone_summary: toneSummary,
    evidence,
    claim_contract: claimContract,
  };

  const roasted = enforceRoastIntensity(
    {
      first_impression: base.first_impression,
      single_biggest_leak: base.single_biggest_leak,
      mistakes: base.mistakes,
      lost_customers: base.lost_customers,
      quick_fixes: base.quick_fixes,
      high_impact: base.high_impact,
      tone_summary: base.tone_summary,
      evidence: base.evidence,
      claim_contract: base.claim_contract,
      access: base.access,
    },
    scrapedData,
    scoringData,
  );

  return {
    ...base,
    ...roasted,
  };
}

function isLowQualityRoast(
  normalized: Omit<RoastResultPayload, "score" | "score_label">,
  scrapedData: ScrapedWebsiteData,
): boolean {
  if (isSoft(normalized.first_impression)) return true;
  if (isSoft(normalized.lost_customers)) return true;
  if (isSoft(normalized.high_impact)) return true;
  if (containsAnyPhrase(normalized.tone_summary, SOFT_PHRASES)) return true;
  if (normalized.tone_summary.length < 14) return true;
  if (containsAnyPhrase(normalized.tone_summary, GENERIC_REJECTION_PHRASES)) return true;

  const combinedNarrative = [
    normalized.first_impression,
    normalized.single_biggest_leak,
    normalized.lost_customers,
    normalized.high_impact,
    normalized.tone_summary,
    ...normalized.mistakes,
    ...normalized.quick_fixes,
  ].join(" ");
  if (containsAnyPhrase(combinedNarrative, GENERIC_REJECTION_PHRASES)) return true;

  const specificMistakeCount = normalized.mistakes.filter((item) =>
    hasSpecificity(item),
  ).length;
  if (specificMistakeCount < 2) return true;

  const vagueMistakeCount = normalized.mistakes.filter((item) =>
    containsAnyPhrase(item, VAGUE_MISTAKE_PHRASES),
  ).length;
  if (vagueMistakeCount >= 1) return true;

  if (normalized.quick_fixes.length < 3 || normalized.mistakes.length < 3) {
    return true;
  }
  if (new Set(normalized.mistakes.map((item) => item.toLowerCase())).size < 3) {
    return true;
  }

  const implementationFixes = normalized.quick_fixes.filter((item) =>
    hasImplementationShape(item),
  ).length;
  if (implementationFixes < 2) return true;

  const roastEdgeCount = [
    normalized.first_impression,
    normalized.single_biggest_leak,
    ...normalized.mistakes.slice(0, 4),
  ].filter((item) => hasRoastEdge(item)).length;
  if (roastEdgeCount < 3) return true;

  const anchors = extractSourceAnchors(scrapedData);
  if (anchors.length >= 2) {
    const requiredHits = (scrapedData.crawl?.pageCount ?? 1) > 1 ? 3 : 2;
    const anchorHitCount = [
      normalized.first_impression,
      normalized.single_biggest_leak,
      ...normalized.mistakes.slice(0, 3),
    ].filter((item) => hasSourceAnchor(item, anchors)).length;

    if (anchorHitCount < requiredHits) {
      return true;
    }
  }

  return false;
}

function normalizeRoast(
  candidate: unknown,
  fallback: RoastResultPayload,
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
  baseScore: number,
): RoastResultPayload {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const raw = candidate as Partial<RoastResultPayload>;
  const normalizedScore = normalizeScore(raw.score, baseScore);
  const selectedMistakes = normalizeStringList(raw.mistakes, 3);
  const selectedQuickFixes = normalizeStringList(raw.quick_fixes, 3);
  const selectedEvidence = normalizeStringList(raw.evidence, 2);
  const selectedClaimContract = normalizeClaimContract(
    raw.claim_contract,
    fallback.claim_contract ?? [],
    scrapedData,
  );

  const firstImpression =
    typeof raw.first_impression === "string" && raw.first_impression.trim()
      ? raw.first_impression.trim()
      : fallback.first_impression;
  const leak =
    typeof raw.single_biggest_leak === "string" && raw.single_biggest_leak.trim()
      ? raw.single_biggest_leak.trim()
      : fallback.single_biggest_leak;
  const lostCustomers =
    typeof raw.lost_customers === "string" && raw.lost_customers.trim()
      ? raw.lost_customers.trim()
      : fallback.lost_customers;
  const highImpact =
    typeof raw.high_impact === "string" && raw.high_impact.trim()
      ? raw.high_impact.trim()
      : fallback.high_impact;
  const toneSummary =
    typeof raw.tone_summary === "string" && raw.tone_summary.trim()
      ? raw.tone_summary.trim()
      : fallback.tone_summary;

  const merged: Omit<RoastResultPayload, "score" | "score_label"> = {
    first_impression: firstImpression,
    single_biggest_leak: leak,
    mistakes:
      selectedMistakes.length > 0 ? selectedMistakes.slice(0, 5) : fallback.mistakes,
    lost_customers: lostCustomers,
    quick_fixes:
      selectedQuickFixes.length > 0
        ? selectedQuickFixes.slice(0, 5)
        : fallback.quick_fixes,
    high_impact: highImpact,
    tone_summary: toneSummary,
    evidence:
      selectedEvidence.length > 0 ? selectedEvidence.slice(0, 5) : fallback.evidence,
    claim_contract: selectedClaimContract.length > 0 ? selectedClaimContract : undefined,
  };
  const roastedMerged = enforceRoastIntensity(merged, scrapedData, scoringData);

  if (isLowQualityRoast(roastedMerged, scrapedData)) {
    return {
      ...fallback,
      score: normalizedScore,
      score_label: toScoreLabel(normalizedScore),
    };
  }

  return {
    score: normalizedScore,
    score_label: toScoreLabel(normalizedScore),
    ...roastedMerged,
  };
}

export type RoastGenerationResult = {
  roast: RoastResultPayload;
  aiUsed: boolean;
  fallbackUsed: boolean;
  error?: string;
};

export async function generateRoastWithUsage(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): Promise<RoastGenerationResult> {
  const fallback = generateFallbackRoast(scrapedData, scoringData);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.includes("placeholder")) {
    return {
      roast: fallback,
      aiUsed: false,
      fallbackUsed: true,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(scrapedData, scoringData) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = payload.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("OpenAI returned empty content.");
    }

    const parsed = parseJsonFromModel(rawContent);
    return {
      roast: normalizeRoast(
        parsed,
        fallback,
        scrapedData,
        scoringData,
        scoringData.score,
      ),
      aiUsed: true,
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      roast: fallback,
      aiUsed: false,
      fallbackUsed: true,
      error: error instanceof Error ? error.message : "OpenAI roast generation failed.",
    };
  }
}

export async function generateRoast(
  scrapedData: ScrapedWebsiteData,
  scoringData: WebsiteScoring,
): Promise<RoastResultPayload> {
  const { roast } = await generateRoastWithUsage(scrapedData, scoringData);
  return roast;
}
