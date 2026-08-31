import { CATEGORY_WEIGHTS, categoryRatio } from "./scoringConfig";
import {
  buildSiteContextSnapshot,
  inferSiteNiche,
  type SiteNiche,
} from "./siteContext";
import type {
  ScoreAdjustment,
  ScrapedWebsiteData,
  WebsiteScoring,
} from "./types";

type GuideCategory =
  | "clarity"
  | "trust"
  | "CTA"
  | "differentiation"
  | "design_hint";

type FixBlueprintItem = {
  title: string;
  where: string;
  why: string;
  how: string[];
  example: string;
  impact?: "High" | "Medium" | "Low";
  effort?: "Low" | "Medium" | "High";
  before?: string;
  after?: string;
};

type NicheDefaults = {
  audience: string;
  outcome: string;
  fallbackCta: string;
};

type GuideContext = {
  scraped: ScrapedWebsiteData;
  scoring: WebsiteScoring;
  niche: SiteNiche;
  nicheLabel: string;
  offerLabel: string;
  audience: string;
  outcome: string;
  companyName?: string;
  services: string[];
  locations: string[];
  pagesReviewed: string[];
  copyIssues: string[];
  serviceLabel: string;
  locationLabel: string;
  detectedPrimaryCta?: string;
  primaryCta: string;
  primaryCtaWasDetected: boolean;
  primaryCtaReason: string;
  trustSnapshot: string;
  contactSnapshot: string;
  genericSnapshot: string;
};

export type ImplementationBlueprint = {
  primaryCta: string;
  primaryCtaSource: "detected" | "recommended";
  heroHeadlineExample: string;
  heroSubheadlineExample: string;
  trustBlockExample: string;
  structureOrder: string[];
  priorities: string[];
  siteSpecificObservations: string[];
  brutalTruths: string[];
  fixes: FixBlueprintItem[];
  rewriteExamples: Array<{
    location: string;
    whyItMatters: string;
    before: string;
    after: string;
  }>;
  sevenDayPlan: string[];
};

const CATEGORY_ORDER: GuideCategory[] = [
  "clarity",
  "trust",
  "CTA",
  "differentiation",
  "design_hint",
];

const NICHE_DEFAULTS: Record<SiteNiche, NicheDefaults> = {
  saas: {
    audience: "teams under delivery pressure",
    outcome: "reduce manual work and ship faster",
    fallbackCta: "Start Free Trial",
  },
  ecommerce: {
    audience: "high-intent shoppers",
    outcome: "buy with confidence in one visit",
    fallbackCta: "Shop Now",
  },
  local_service: {
    audience: "homeowners and local buyers",
    outcome: "get help fast with clear pricing",
    fallbackCta: "Request a Quote",
  },
  professional_service: {
    audience: "buyers comparing expertise",
    outcome: "book a trusted first consultation",
    fallbackCta: "Book a Consultation",
  },
  healthcare: {
    audience: "patients seeking reliable care",
    outcome: "book the right appointment quickly",
    fallbackCta: "Book an Appointment",
  },
  creative_agency: {
    audience: "brands looking for growth assets",
    outcome: "launch stronger campaigns faster",
    fallbackCta: "Book a Discovery Call",
  },
  mobile_game: {
    audience: "mobile players",
    outcome: "start playing in one tap",
    fallbackCta: "Download The App",
  },
  public_enterprise: {
    audience: "citizens and service users",
    outcome: "find the right action without confusion",
    fallbackCta: "Find The Right Service",
  },
  generic: {
    audience: "qualified buyers",
    outcome: "take a clear next step with confidence",
    fallbackCta: "Book A Consultation",
  },
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shortOffer(value: string, limit = 56): string {
  const cleaned = cleanText(value);
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, limit - 3)}...`;
}

function missingSignal(value: string): boolean {
  return /\bno (meaningful |obvious |strong |visible )?(trust proof|contact path|cta|cta text|generic phrase flags) detected\b/i.test(value);
}

function proofPhrase(context: GuideContext): string {
  if (context.niche === "mobile_game" && missingSignal(context.trustSnapshot)) {
    return "no gameplay trailer, app-store proof, player/community numbers, reviews, or launch credibility near the pitch";
  }

  return missingSignal(context.trustSnapshot)
    ? "no visible testimonials, client results, reviews, credentials, or proof near the pitch"
    : context.trustSnapshot;
}

function contactPhrase(context: GuideContext): string {
  return missingSignal(context.contactSnapshot)
    ? "no obvious email, phone, booking route, or direct contact path"
    : context.contactSnapshot;
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function humanJoin(items: string[], limit = 2): string {
  const cleaned = items
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, limit);

  if (cleaned.length === 0) {
    return "";
  }
  if (cleaned.length === 1) {
    return cleaned[0];
  }
  return `${cleaned.slice(0, -1).join(", ")} and ${cleaned[cleaned.length - 1]}`;
}

function serviceLabelFromFacts(services: string[], fallback: string): string {
  const normalized = services.map((service) => service.toLowerCase());
  if (normalized.includes("construction") && normalized.includes("landscaping")) {
    return "construction and landscaping";
  }
  if (normalized.includes("construction") && normalized.includes("renovations")) {
    return "construction and renovation";
  }
  if (normalized.includes("building services")) {
    return "building services";
  }

  const joined = humanJoin(
    services.filter((service) => !/^generic/i.test(service)),
    2,
  );
  if (joined) {
    return joined.toLowerCase();
  }

  const cleanedFallback = shortOffer(fallback.replace(/[:|].*$/, ""), 38)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim();
  return cleanedFallback ? cleanedFallback.toLowerCase() : "local service";
}

function locationLabelFromFacts(locations: string[]): string {
  const preferred = locations.find(
    (location) => !/^south africa$/i.test(location) && !/^gauteng$/i.test(location),
  );
  return preferred || locations[0] || "";
}

function weakOrMismatchedCtaForNiche(
  detectedCta: string | undefined,
  niche: SiteNiche,
): boolean {
  if (!detectedCta) {
    return true;
  }

  const normalized = detectedCta.toLowerCase();
  const weakGeneric = /^(learn more|read more|more|contact|contact us|send message|message us|get in touch|submit)$/i.test(detectedCta);

  switch (niche) {
    case "ecommerce":
      return !/\b(add to cart|checkout|buy now|shop now|shop|order now)\b/.test(normalized);
    case "local_service":
      return !/\b(get|request)\s+(a\s+)?quote\b|\bestimate\b|\bcall now\b|\bwhatsapp\b/.test(normalized);
    case "professional_service":
      return !/\b(book|schedule)\b.*\b(consultation|call|conversation)\b|\bfree consultation\b/.test(normalized);
    case "healthcare":
      return !/\b(book|schedule)\b.*\b(appointment|visit|consultation|call)\b|\bbook now\b|\bcall now\b/.test(normalized);
    case "creative_agency":
      return !/\b(book|schedule)\b.*\b(discovery|call|consultation|brief)\b|\bfree consultation\b|\brequest\s+(a\s+)?quote\b/.test(normalized);
    case "mobile_game":
      return !/\b(download|install|play now|get the app|app store|google play)\b/.test(normalized);
    case "saas":
      return !/\b(book|request)\b.*\bdemo\b|\bstart free trial\b|\bstart trial\b|\bsign up\b/.test(normalized);
    default:
      return weakGeneric;
  }
}

function ctaRecommendation(
  detectedCta: string | undefined,
  niche: SiteNiche,
  defaults: NicheDefaults,
): { label: string; source: "detected" | "recommended"; reason: string } {
  if (!detectedCta) {
    return {
      label: defaults.fallbackCta,
      source: "recommended",
      reason: "the page does not expose a clear next step",
    };
  }

  if (weakOrMismatchedCtaForNiche(detectedCta, niche)) {
    return {
      label: defaults.fallbackCta,
      source: "recommended",
      reason:
        niche === "mobile_game"
          ? `"${detectedCta}" points at a conversation, but a mobile game page should push players to install or start playing`
          : niche === "ecommerce"
            ? `"${detectedCta}" is not a buying action for shoppers`
          : `"${detectedCta}" is too soft or generic for the page goal`,
    };
  }

  return {
    label: detectedCta,
    source: "detected",
    reason: "the detected CTA matches the page goal",
  };
}

function makeContext(
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
): GuideContext {
  const snapshot = buildSiteContextSnapshot(scraped);
  const niche = inferSiteNiche(scraped);
  const defaults = NICHE_DEFAULTS[niche];
  const primaryCtaWasDetected =
    Boolean(snapshot.primaryCta) && snapshot.primaryCta !== "No strong CTA detected";
  const detectedPrimaryCta = primaryCtaWasDetected
    ? toTitleCase(snapshot.primaryCta)
    : undefined;
  const recommended = ctaRecommendation(detectedPrimaryCta, niche, defaults);

  return {
    scraped,
    scoring,
    niche,
    nicheLabel: snapshot.nicheLabel,
    companyName: snapshot.companyName,
    services: snapshot.services,
    locations: snapshot.locations,
    pagesReviewed: snapshot.pagesReviewed,
    copyIssues: snapshot.copyIssues,
    serviceLabel: serviceLabelFromFacts(snapshot.services, snapshot.offerHeadline),
    locationLabel: locationLabelFromFacts(snapshot.locations),
    offerLabel: snapshot.offerHeadline,
    audience: defaults.audience,
    outcome: defaults.outcome,
    detectedPrimaryCta,
    primaryCta: recommended.label,
    primaryCtaWasDetected: recommended.source === "detected",
    primaryCtaReason: recommended.reason,
    trustSnapshot: snapshot.topTrustSignal,
    contactSnapshot: snapshot.contactPathSummary,
    genericSnapshot: snapshot.genericCopySummary,
  };
}

function heroBeforeLine(context: GuideContext): string {
  const h1 = context.scraped.headings.h1[0];
  if (h1 && cleanText(h1).length >= 5) {
    return cleanText(h1).slice(0, 120);
  }
  return context.offerLabel;
}

function ctaBeforeLine(context: GuideContext): string {
  if (context.scraped.ctas.length > 0) {
    return toTitleCase(cleanText(context.scraped.ctas[0]));
  }
  return "Learn More";
}

function trustBeforeLine(context: GuideContext): string {
  if (context.scraped.trustSignals.length > 0) {
    return `Trust cues found: ${context.scraped.trustSignals.slice(0, 2).join(" | ")}`;
  }
  return "No trust proof visible near the first CTA.";
}

function genericBeforeLine(context: GuideContext): string {
  if (context.scraped.genericPhrasesFound.length > 0) {
    return context.scraped.genericPhrasesFound.slice(0, 2).join(" | ");
  }
  return "Generic copy blurs differentiation.";
}

function headlineExampleForContext(context: GuideContext): string {
  const offerName = shortOffer(context.offerLabel.replace(/[:|].*$/, ""), 38).replace(/[^a-zA-Z0-9\s-]/g, "");

  switch (context.niche) {
    case "local_service":
      return `Reliable ${context.serviceLabel || offerName || "local service"}${context.locationLabel ? ` in ${context.locationLabel}` : ""} with clear quotes and fast response`;
    case "professional_service":
      return `Trusted ${offerName || "professional guidance"} for buyers who need a clear first consultation`;
    case "healthcare":
      return `Book reliable care with a team that makes the next step simple`;
    case "creative_agency":
      return `Launch a sharper website with a clear plan, proof, and next step`;
    case "ecommerce":
      return `Shop the right product faster, with proof and fewer doubts`;
    case "saas":
      return `Book a demo and see the workflow improvement in one session`;
    default:
      return `${context.offerLabel} for ${context.audience} who want to ${context.outcome}`;
  }
}

function inferImpactEffort(fix: FixBlueprintItem): {
  impact: "High" | "Medium" | "Low";
  effort: "Low" | "Medium" | "High";
} {
  const key = `${fix.title} ${fix.where}`.toLowerCase();

  const impact: "High" | "Medium" | "Low" =
    /\b(cta|offer|headline|trust|proof)\b/.test(key) ? "High" : "Medium";

  const effort: "Low" | "Medium" | "High" =
    /\b(rewrite|replace|add|expose|standardize|copy)\b/.test(key)
      ? "Low"
      : /\b(reorder|structure|flow|hierarchy)\b/.test(key)
        ? "Medium"
        : "High";

  return { impact, effort };
}

function inferRewritePair(
  context: GuideContext,
  fix: FixBlueprintItem,
): { before: string; after: string } {
  const key = `${fix.title} ${fix.where}`.toLowerCase();

  if (/\b(cta|action|button)\b/.test(key)) {
    return {
      before: ctaBeforeLine(context),
      after: context.primaryCta,
    };
  }

  if (/\b(trust|proof|testimonial|review)\b/.test(key)) {
    return {
      before: trustBeforeLine(context),
      after:
        "[X+ clients served] | [measurable result] | [credential/compliance marker]",
    };
  }

  if (/\b(generic|position|different)\b/.test(key)) {
    return {
      before: genericBeforeLine(context),
      after: `For ${context.audience}, we deliver ${context.outcome} using [specific method].`,
    };
  }

  return {
    before: heroBeforeLine(context),
    after: `${context.offerLabel} for ${context.audience} who want to ${context.outcome}.`,
  };
}

function enrichFix(context: GuideContext, fix: FixBlueprintItem): FixBlueprintItem {
  const impactEffort = inferImpactEffort(fix);
  const rewrite = inferRewritePair(context, fix);

  return {
    ...fix,
    impact: fix.impact ?? impactEffort.impact,
    effort: fix.effort ?? impactEffort.effort,
    before: fix.before ?? rewrite.before,
    after: fix.after ?? rewrite.after,
  };
}

function buildRewriteExamples(
  context: GuideContext,
  fixes: FixBlueprintItem[],
): ImplementationBlueprint["rewriteExamples"] {
  const examples = fixes.slice(0, 3).map((fix) => ({
    location: fix.where,
    whyItMatters: fix.why,
    before: fix.before ?? heroBeforeLine(context),
    after:
      fix.after ??
      `${context.offerLabel} for ${context.audience} who want to ${context.outcome}.`,
  }));

  if (examples.length === 0) {
    return [
      {
        location: "Hero headline",
        whyItMatters: "First-screen clarity sets conversion intent.",
        before: heroBeforeLine(context),
        after: `${context.offerLabel} for ${context.audience} who want to ${context.outcome}.`,
      },
    ];
  }

  return examples;
}

function categoryPriority(scoring: WebsiteScoring): GuideCategory[] {
  return [...CATEGORY_ORDER].sort((a, b) => {
    const left = categoryRatio(a, scoring.breakdown[a]);
    const right = categoryRatio(b, scoring.breakdown[b]);
    return left - right;
  });
}

function penaltyPriority(scoring: WebsiteScoring): ScoreAdjustment[] {
  return [...scoring.penalties].sort((a, b) => b.points - a.points);
}

function baseObservationLines(context: GuideContext): string[] {
  const h1 = context.scraped.headings.h1[0]
    ? cleanText(context.scraped.headings.h1[0])
    : "No H1 detected";
  const ctas = context.scraped.ctas.slice(0, 3);
  const trust = context.scraped.trustSignals.slice(0, 3);
  const contacts = context.scraped.contactSignals.slice(0, 2);
  const visuals = context.scraped.visualAudit?.summary;
  const pagesReviewed = context.pagesReviewed.slice(0, 5);
  const services = context.services.slice(0, 5);
  const locations = context.locations.slice(0, 4);
  const copyIssues = context.copyIssues.slice(0, 3);

  const lines = [
    `Detected niche: ${context.nicheLabel}.`,
    context.companyName ? `Company name signal: ${context.companyName}.` : "",
    pagesReviewed.length > 1 ? `Pages reviewed: ${pagesReviewed.join(" | ")}.` : "",
    services.length > 0 ? `Service signals: ${services.join(" | ")}.` : "",
    locations.length > 0 ? `Location signals: ${locations.join(" | ")}.` : "",
    `Current headline snapshot: "${h1}".`,
    context.primaryCtaWasDetected
      ? `Detected primary CTA: "${context.primaryCta}".`
      : context.detectedPrimaryCta
        ? `Detected CTA "${context.detectedPrimaryCta}" is not the recommended action. Use "${context.primaryCta}" because ${context.primaryCtaReason}.`
        : `Recommended primary CTA: "${context.primaryCta}" because ${context.primaryCtaReason}.`,
    ctas.length > 0
      ? `CTA signals found: ${ctas.join(" | ")}`
      : "No clear primary CTA appears in the visible copy.",
    trust.length > 0
      ? `Trust signals found: ${trust.join(" | ")}`
      : context.niche === "mobile_game"
        ? "The visible copy does not show app-store badges, player/community proof, reviews, gameplay trailer proof, or launch credibility near the main action."
        : "The visible copy does not show testimonials, reviews, credentials, client results, or other proof.",
    contacts.length > 0
      ? `Contact path signals: ${contacts.join(" | ")}`
      : "No obvious email, phone, booking route, or direct contact path appears in the core copy.",
  ];

  if (context.genericSnapshot !== "No obvious generic phrase flags") {
    lines.push(`Generic copy warning: ${context.genericSnapshot}.`);
  }

  if (copyIssues.length > 0) {
    lines.push(`Copy issue signals: ${copyIssues.join(" | ")}.`);
  }

  if (visuals) {
    lines.push(
      `Visual signals: CTA ${visuals.ctaProminence}/100, readability ${visuals.readability}/100, hierarchy ${visuals.hierarchy}/100, consistency ${visuals.consistency}/100, motion risk ${visuals.motionDistraction}/100.`,
    );
  }

  return lines.filter(Boolean).slice(0, 10);
}

function brutalTruthsFromPenalties(context: GuideContext): string[] {
  const truths: string[] = [];
  const penalties = penaltyPriority(context.scoring);

  for (const penalty of penalties) {
    switch (penalty.label) {
      case "Keyword-Stuffed Headline":
      case "Overloaded Hero Headline":
        truths.push(
          `"${shortOffer(context.offerLabel, 72)}" reads like a search-engine grocery list before it reads like a buyer promise.`,
        );
        break;
      case "Mismatched CTA Goal":
        truths.push(
          context.detectedPrimaryCta
            ? `"${context.detectedPrimaryCta}" is the wrong action to amplify. The page should push "${context.primaryCta}" because ${context.primaryCtaReason}.`
            : `The page does not make "${context.primaryCta}" obvious enough for ${context.nicheLabel.toLowerCase()} buyers.`,
        );
        break;
      case "No CTA Path":
      case "Weak CTA Path":
      case "Soft Visual CTA":
      case "Weak Visual CTA":
        truths.push(
          context.primaryCtaWasDetected
            ? `Your page behaves like a brochure, not a sales flow. "${context.primaryCta}" is present, but it is not driving action.`
            : context.detectedPrimaryCta
              ? `"${context.detectedPrimaryCta}" is the wrong action to amplify. The page should push "${context.primaryCta}" because ${context.primaryCtaReason}.`
              : `Your page behaves like a brochure, not a sales flow. No meaningful CTA was found, so "${context.primaryCta}" is the action path the page needs to grow teeth.`,
        );
        break;
      case "No Trust Proof":
      case "Trust-Led Visual Polish Gap":
        truths.push(
          `You are asking buyers to trust "${shortOffer(context.offerLabel)}" while showing ${proofPhrase(context)}.`,
        );
        break;
      case "No Contact Path":
        truths.push(
          `High-intent visitors should not play hide-and-seek for contact. The page shows ${contactPhrase(context)}.`,
        );
        break;
      case "Heavy Generic Copy":
        truths.push(
          `Your copy sounds like everyone else in ${context.nicheLabel.toLowerCase()}, which makes "${context.offerLabel}" forgettable.`,
        );
        break;
      case "Weak Visual Hierarchy":
      case "Low Visual Readability":
      case "Medium Readability Risk":
      case "Distracting Motion":
        truths.push(
          `The first screen leaks attention before the offer lands. Visual clarity is fighting your conversion path.`,
        );
        break;
      default:
        break;
    }
  }

  const weakest = categoryPriority(context.scoring)[0];
  if (weakest === "clarity") {
    truths.push(
      `"${context.offerLabel}" describes what you are, but not why a buyer should care now.`,
    );
  }
  if (weakest === "trust") {
    truths.push(
      `For ${context.nicheLabel} buyers, weak proof is fatal. They compare fast and leave faster.`,
    );
  }
  if (weakest === "CTA") {
    truths.push(
      `You are one clear next-step away from better conversions, and right now that step is blurry.`,
    );
  }
  if (weakest === "differentiation") {
    truths.push(
      `Your positioning reads generic, so the market has no reason to choose your version of the offer.`,
    );
  }

  if (truths.length < 3) {
    truths.push(
      `This page explains your business, but it is not closing confidence gaps for ${context.audience}.`,
    );
    truths.push(
      context.detectedPrimaryCta && !context.primaryCtaWasDetected
        ? `The current conversion story points at "${context.detectedPrimaryCta}" when the business goal needs "${context.primaryCta}".`
        : `The current conversion story around "${context.primaryCta}" is too soft for high-intent traffic.`,
    );
  }

  return [...new Set(truths)].slice(0, 4);
}

function fixFromPenalty(
  context: GuideContext,
  penalty: ScoreAdjustment,
): FixBlueprintItem | null {
  switch (penalty.label) {
    case "Keyword-Stuffed Headline":
    case "Overloaded Hero Headline":
      return {
        title: "Replace the keyword pile with a buyer promise",
        where: "Hero H1, page title, and first supporting paragraph",
        why:
          `"${shortOffer(context.offerLabel, 72)}" reads like SEO stuffing before it reads like a reason to choose the business.`,
        how: [
          "Cut the headline to one buyer, one service category, and one outcome.",
          "Move location/service variants into supporting copy or service-area blocks.",
          `Place "${context.primaryCta}" directly under the rewritten promise.`,
        ],
        example: `Headline: "${headlineExampleForContext(context)}"`,
      };
    case "Mismatched CTA Goal":
      return {
        title: `Replace the soft action with "${context.primaryCta}"`,
        where: "Primary nav, hero button, sticky mobile action, and final CTA",
        why:
          context.detectedPrimaryCta
            ? `"${context.detectedPrimaryCta}" does not match what ${context.nicheLabel.toLowerCase()} buyers are ready to do.`
            : `The page does not make the right ${context.nicheLabel.toLowerCase()} next step obvious.`,
        how: [
          `Use "${context.primaryCta}" as the main CTA label across the page.`,
          "Keep softer actions like contact/about as secondary text links.",
          "Add one reassurance line under the CTA so the action feels low-friction.",
        ],
        example: `Button: "${context.primaryCta}" | Microcopy: "Fast response within 1 business day."`,
      };
    case "No CTA Path":
    case "Weak CTA Path":
    case "Soft Visual CTA":
    case "Weak Visual CTA":
      return {
        title: `Make "${context.primaryCta}" impossible to miss`,
        where: "Hero section, mid-page checkpoint, and final CTA block",
        why:
          context.detectedPrimaryCta && !context.primaryCtaWasDetected
            ? `"${context.detectedPrimaryCta}" does not match the page goal. One dominant action should lead visitors toward "${context.primaryCta}".`
            : "Visitors should not need to guess the next step. One dominant action should lead the page.",
        how: [
          context.detectedPrimaryCta && !context.primaryCtaWasDetected
            ? `Replace "${context.detectedPrimaryCta}" with "${context.primaryCta}" in the hero, nav, and final CTA.`
            : `Use the exact same CTA label everywhere: "${context.primaryCta}".`,
          "Promote one primary button style and demote other actions to links.",
          "Add one friction-reducing line under the button.",
        ],
        example:
          context.niche === "mobile_game"
            ? `Button: "${context.primaryCta}" | Microcopy: "Free to start. Join a live Ludo match in seconds."`
            : `Button: "${context.primaryCta}" | Microcopy: "No pressure. Fast response within 1 business day."`,
      };
    case "No Trust Proof":
      return {
        title:
          context.niche === "mobile_game"
            ? `Show player proof under "${shortOffer(context.offerLabel, 48)}"`
            : `Put real proof under "${shortOffer(context.offerLabel, 48)}"`,
        where: "Directly below hero and near first CTA",
        why:
          context.niche === "mobile_game"
            ? "Players need to see why this game is worth installing before they give it phone space."
            : "Without visible proof, skeptical buyers bounce before they read deeper sections.",
        how:
          context.niche === "mobile_game"
            ? [
                "Add App Store / Google Play badges or a launch waitlist cue near the hero.",
                "Show a gameplay trailer, live match screenshots, or ranked-mode preview.",
                "Add community proof: player count, tournament partners, Discord/community size, or review snippets.",
              ]
            : [
                "Add one testimonial with buyer type and measurable result.",
                "Add one credibility strip: years, client count, credential, or compliance marker.",
                "Keep proof near CTA instead of burying it lower on the page.",
              ],
        example:
          context.niche === "mobile_game"
            ? 'Proof strip: "Gameplay trailer | Live match screenshots | Join the launch list | Google Play / App Store badges"'
            : 'Proof strip: "[X+ clients served] | [Years experience] | [Measured result from real client case]"',
      };
    case "No Contact Path":
      return {
        title: `Expose direct contact around "${context.primaryCta}"`,
        where: "Hero support line and footer",
        why:
          "Buyers who are ready to talk should not click through extra pages to find your details.",
        how: [
          "Show email and phone near the primary CTA.",
          "Repeat same contact details in footer.",
          "Add response-time expectation to reduce hesitation.",
        ],
        example:
          'Support line: "Questions? Call [phone] or email [address]. We reply within 24 hours."',
      };
    case "Heavy Generic Copy":
      return {
        title: `Replace generic claims in "${shortOffer(context.offerLabel, 48)}"`,
        where: "Hero subheadline and service/value bullets",
        why:
          "Generic language removes differentiation and makes your offer blend into competitors.",
        how: [
          `Remove flagged generic claims: ${context.genericSnapshot}.`,
          "Replace each with specific method, constraint, or measurable outcome.",
          "Add one line that explains why your approach is different.",
        ],
        example:
          `"Unlike typical providers, we use [specific process] to deliver [specific measurable outcome] in [timeframe]."`,
      };
    case "Low Visual Readability":
    case "Medium Readability Risk":
      return {
        title: `Increase readability around "${context.primaryCta}"`,
        where: "Hero copy, CTA text, and primary content blocks",
        why:
          "If people strain to read, they stop evaluating your offer and leave.",
        how: [
          "Raise text/background contrast in key sections.",
          "Keep body copy around 16px+ and avoid low-contrast muted text for core value statements.",
          "Ensure CTA label contrast stays strong on both mobile and desktop.",
        ],
        example:
          'Typography rule: "Primary body text >=16px and CTA contrast >=4.5:1 in all viewport sizes."',
      };
    case "Weak Visual Hierarchy":
      return {
        title: "Simplify above-the-fold hierarchy",
        where: "Top 900px of the homepage",
        why:
          "Too much competing content above the fold weakens attention and action flow.",
        how: [
          "Lead with one headline, one short subheadline, one primary CTA.",
          "Move secondary links and decorative blocks lower.",
          "Keep trust strip directly below CTA, not separated by visual clutter.",
        ],
        example:
          "Hero order: Headline -> Subheadline -> Primary CTA -> Proof strip",
      };
    case "Distracting Motion":
      return {
        title: "Reduce motion that steals CTA attention",
        where: "Above-the-fold animated components",
        why:
          "High animation density competes with decision-making and suppresses conversion focus.",
        how: [
          "Remove autoplay motion near hero content.",
          "Keep transition durations short and consistent.",
          "Reserve strong animation only for one key interaction.",
        ],
        example:
          "Motion policy: no autoplay in hero, standard transitions around 150-250ms.",
      };
    default:
      return null;
  }
}

function fallbackFixForCategory(
  context: GuideContext,
  category: GuideCategory,
): FixBlueprintItem {
  switch (category) {
    case "clarity":
      return {
        title: `Rewrite "${context.offerLabel}" into a clear buyer promise`,
        where: "Hero headline and first supporting paragraph",
        why:
          "Buyers decide quickly. If the offer is unclear, they assume the value is unclear too.",
        how: [
          "Use audience + outcome + mechanism in one sentence.",
          "Lead with buyer result, not company description.",
          "Keep headline specific enough to exclude non-ideal traffic.",
        ],
        example: `Headline: "${context.offerLabel} for ${context.audience} who want to ${context.outcome}."`,
      };
    case "trust":
      return {
        title:
          context.niche === "mobile_game"
            ? "Build an install-confidence stack near the first CTA"
            : "Build a trust stack near the first CTA",
        where: "Hero-to-offer transition block",
        why:
          context.niche === "mobile_game"
            ? "Download intent needs confidence before the app-store click, not vague hype after it."
            : "Trust must appear before commitment asks, not after long scrolling.",
        how:
          context.niche === "mobile_game"
            ? [
                "Show gameplay footage or screenshots before the first download CTA.",
                "Add community, tournament, rating, or launch-list proof.",
                "Make platform availability obvious: iOS, Android, or coming-soon status.",
              ]
            : [
                "Add one client story with measurable outcome.",
                "Add credential/compliance/experience proof.",
                "Keep trust visuals minimal but specific.",
              ],
        example:
          context.niche === "mobile_game"
            ? 'Install proof: "Available for Android/iOS | Gameplay trailer | Ranked league preview | Community updates"'
            : 'Trust stack: "[X+ clients] | [Years experience] | [Credential] | [Result snippet]"',
      };
    case "CTA":
      return {
        title: `Standardize action path around "${context.primaryCta}"`,
        where: "Primary nav, hero, and bottom CTA section",
        why:
          context.detectedPrimaryCta && !context.primaryCtaWasDetected
            ? `"${context.detectedPrimaryCta}" is not aligned with what this page should make visitors do. The action path needs one goal-led CTA.`
            : "Split CTA labels fragment buyer intent and reduce completion.",
        how: [
          context.detectedPrimaryCta && !context.primaryCtaWasDetected
            ? `Replace weak action labels like "${context.detectedPrimaryCta}" with "${context.primaryCta}".`
            : `Use "${context.primaryCta}" as the main CTA phrase across the page.`,
          "Keep one visual button style for primary action.",
          "Place CTA after trust and process blocks.",
        ],
        example: `Primary button everywhere: "${context.primaryCta}"`,
      };
    case "differentiation":
      return {
        title: "Add explicit positioning against alternatives",
        where: "Value proposition and service comparison block",
        why:
          "Buyers compare options. If your differences are implicit, they are ignored.",
        how: [
          "Add a short 'why us vs typical option' section.",
          "Use concrete contrast language with outcomes.",
          "Remove vague adjectives and replace with specifics.",
        ],
        example:
          '"Why us: [specific method], [specific speed], [specific risk reduction] vs generic alternatives."',
      };
    case "design_hint":
      return {
        title: "Reorder content to a conversion sequence",
        where: "Homepage section flow",
        why:
          "Good sections in the wrong order still leak conversions.",
        how: [
          "Sequence content as problem -> offer -> proof -> process -> CTA.",
          "Cut sections that do not push the next decision.",
          `Repeat "${context.primaryCta}" after each major section.`,
        ],
        example:
          "Order: Hero -> Proof -> Offer outcomes -> Process -> Objection handling -> Final CTA",
      };
    default:
      return {
        title: "Tighten conversion flow",
        where: "Homepage core sections",
        why: "Loose structure and mixed signals suppress conversion intent.",
        how: [
          "Clarify offer, reinforce trust, and simplify CTA path.",
          "Remove sections that do not support conversion.",
          "Keep one dominant action path.",
        ],
        example: `Primary conversion action: "${context.primaryCta}"`,
      };
  }
}

function hasService(context: GuideContext, pattern: RegExp): boolean {
  return context.services.some((service) => pattern.test(service));
}

function siteSpecificFixes(context: GuideContext): FixBlueprintItem[] {
  const fixes: FixBlueprintItem[] = [];
  const serviceLocation = `${context.serviceLabel}${context.locationLabel ? ` in ${context.locationLabel}` : ""}`;

  if (context.copyIssues.length > 0) {
    fixes.push({
      title: "Fix credibility-killing copy mistakes",
      where: "Service-page copy, hero support text, and final CTA copy",
      why:
        `Visible wording issues (${context.copyIssues.slice(0, 2).join(" | ")}) make the business look less careful before buyers even make contact.`,
      how: [
        "Run a proofread pass on every service block and CTA support line.",
        "Replace broken phrases with plain service outcomes and clean grammar.",
        "Keep one reviewed sentence per service card instead of long stitched copy.",
      ],
      example:
        `Before: "${context.copyIssues[0]}" | After: "Clear ${serviceLocation} with a simple quote request and fast response."`,
      impact: "High",
      effort: "Low",
    });
  }

  if (
    context.niche === "local_service" &&
    (hasService(context, /\bconstruction\b/i) || hasService(context, /\blandscaping\b/i))
  ) {
    fixes.push({
      title: "Show completed-work proof before the first quote ask",
      where: "Hero-to-services transition and project/gallery block",
      why:
        `${context.serviceLabel} buyers need to see real work, locations, and proof before trusting a quote request.`,
      how: [
        "Add 3 to 6 real project photos with location, service type, and short outcome notes.",
        "Place the best proof strip directly below the hero CTA.",
        "Link service cards to matching project examples instead of sending buyers into generic copy.",
      ],
      example:
        'Proof card: "Houghton landscaping project | Scope: paving + irrigation | Completed in 2 weeks"',
      impact: "High",
      effort: "Medium",
    });
  }

  if (context.scraped.headings.h1.length === 0) {
    fixes.push({
      title: "Add one real H1 that says what the page sells",
      where: "Top of the homepage or service page",
      why:
        "A missing primary heading weakens both scanning and SEO clarity. The visible page title should be machine-readable and buyer-readable.",
      how: [
        "Use one H1 per page.",
        "Make it describe the service, buyer area, and outcome.",
        `Place "${context.primaryCta}" directly below it.`,
      ],
      example: `H1: "${headlineExampleForContext(context)}"`,
      impact: "High",
      effort: "Low",
    });
  }

  return fixes;
}

function dedupeFixes(fixes: FixBlueprintItem[]): FixBlueprintItem[] {
  const seen = new Set<string>();
  const out: FixBlueprintItem[] = [];
  for (const fix of fixes) {
    const key = `${fix.title}::${fix.where}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(fix);
  }
  return out;
}

function structureOrder(context: GuideContext): string[] {
  if (context.niche === "mobile_game") {
    return [
      `Hero: game promise + CTA "${context.primaryCta}"`,
      "Gameplay proof: trailer, screenshots, or match-flow preview",
      "Player value: competitive modes, social play, and replay reasons",
      "Install confidence: platform badges, launch timing, reviews, or community proof",
      "Objection handling: device availability, cost, launch status, and game modes",
      `Final CTA: repeat "${context.primaryCta}" with platform/download cue`,
    ];
  }

  return [
    `Hero: clear buyer promise + CTA "${context.primaryCta}"`,
    "Proof block: credibility and measurable outcomes",
    "Offer section: outcomes first, features second",
    "Process section: 3-step path to results",
    "Objection handling: FAQ and reassurance",
    `Final CTA: repeat "${context.primaryCta}" with direct contact cue`,
  ];
}

function priorities(context: GuideContext): string[] {
  return categoryPriority(context.scoring)
    .slice(0, 3)
    .map((category, index) => {
      const score = context.scoring.breakdown[category];
      const max = CATEGORY_WEIGHTS[category];
      const label = category === "design_hint" ? "Structure" : category;
      return `${index + 1}. ${label} (${score.toFixed(1)}/${max})`;
    });
}

function sevenDayPlan(context: GuideContext, fixes: FixBlueprintItem[]): string[] {
  const actionForFix = (fix: FixBlueprintItem | undefined, fallback: string): string => {
    if (!fix) {
      return fallback;
    }

    const title = cleanText(fix.title);
    const lower = title.toLowerCase();

    if (lower.startsWith("put real proof under")) {
      return "Place a proof strip directly under the hero claim";
    }
    if (lower.startsWith("expose direct contact")) {
      return "Add email, phone, or booking support beside the primary CTA";
    }
    if (lower.includes("impossible to miss")) {
      return `Make "${context.primaryCta}" the dominant action across the page`;
    }
    if (lower.startsWith("build a trust stack")) {
      return "Build a compact trust stack near the first CTA";
    }
    if (lower.startsWith("standardize action path")) {
      return "Standardize the main action path from hero to footer";
    }
    if (lower.startsWith("rewrite")) {
      return "Rewrite the hero into a clear buyer promise";
    }

    return title.replace(/"/g, "'");
  };

  const firstFix = actionForFix(fixes[0], "Clarify the core offer and CTA");
  const secondFix = actionForFix(fixes[1], "Strengthen trust and proof");
  const thirdFix = actionForFix(fixes[2], "Tighten structure and action flow");

  return [
    `Day 1: ${firstFix}.`,
    `Day 2: ${secondFix}.`,
    `Day 3: ${thirdFix}, then remove sections that do not support the sale.`,
    `Day 4: Standardize CTA wording to "${context.primaryCta}" across the page.`,
    "Day 5: Add objection-handling FAQ and reassurance copy near CTA.",
    "Day 6: Improve mobile readability, spacing, and visual action hierarchy.",
    "Day 7: QA desktop/mobile and run one conversion-focused copy pass.",
  ];
}

export function buildImplementationBlueprint(
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
): ImplementationBlueprint {
  const context = makeContext(scraped, scoring);
  const topPenaltyFixes = penaltyPriority(scoring)
    .slice(0, 4)
    .map((penalty) => fixFromPenalty(context, penalty))
    .filter((fix): fix is FixBlueprintItem => Boolean(fix));
  const evidenceFixes = siteSpecificFixes(context);
  const fallbackCategoryFixes = categoryPriority(scoring)
    .slice(0, 3)
    .map((category) => fallbackFixForCategory(context, category));

  const fixes = dedupeFixes([
    ...topPenaltyFixes.slice(0, 2),
    ...evidenceFixes,
    ...topPenaltyFixes.slice(2),
    ...fallbackCategoryFixes,
  ])
    .map((fix) => enrichFix(context, fix))
    .slice(0, 4);

  return {
    primaryCta: context.primaryCta,
    primaryCtaSource: context.primaryCtaWasDetected ? "detected" : "recommended",
    heroHeadlineExample: `${context.offerLabel} for ${context.audience} who want to ${context.outcome}.`,
    heroSubheadlineExample: `We help ${context.audience} achieve this through a clear process with visible proof and a direct next step.`,
    trustBlockExample:
      "[X+ customers or clients] | [Years of experience] | [Credential/compliance marker] | [Measured result case]",
    structureOrder: structureOrder(context),
    priorities: priorities(context),
    siteSpecificObservations: baseObservationLines(context),
    brutalTruths: brutalTruthsFromPenalties(context),
    fixes,
    rewriteExamples: buildRewriteExamples(context, fixes),
    sevenDayPlan: sevenDayPlan(context, fixes),
  };
}

export function toQuickFixLines(
  blueprint: ImplementationBlueprint,
  limit = 3,
): string[] {
  return blueprint.fixes.slice(0, limit).map((fix) => {
    const firstStep = fix.how[0] ?? "Apply this update in that section.";
    return `Where: ${fix.where} | Fix: ${fix.title}. ${firstStep} | Impact: ${fix.impact ?? "Medium"} | Effort: ${fix.effort ?? "Medium"} | Example: ${fix.example}`;
  });
}
