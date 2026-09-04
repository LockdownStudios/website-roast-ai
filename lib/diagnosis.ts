import { buildImplementationBlueprint } from "./implementationGuide";
import { buildSiteContextSnapshot, type SiteNiche } from "./siteContext";
import { categoryRatio } from "./scoringConfig";
import type {
  RoastBusinessModel,
  RoastBuyerAnxiety,
  RoastDiagnosis,
  RoastPainPoint,
  RoastSiteGoal,
  ScrapedWebsiteData,
  WebsiteScoring,
} from "./types";

const BUSINESS_MODEL_LABELS: Record<RoastBusinessModel, string> = {
  local_service: "Local service",
  professional_service: "Professional service",
  ecommerce: "Ecommerce",
  healthcare: "Healthcare",
  b2b_consulting: "B2B consulting",
  construction_trade: "Construction trade",
  creative_agency: "Creative agency",
  franchise_location: "Franchise / location business",
  saas_platform: "SaaS platform",
  public_enterprise: "Public / enterprise",
  other: "Other",
};

const SITE_GOAL_LABELS: Record<RoastSiteGoal, string> = {
  sell_online: "Sell online",
  generate_calls: "Generate calls",
  book_consultations: "Book consultations",
  capture_quote_requests: "Capture quote requests",
  build_credibility: "Build credibility",
  explain_complex_services: "Explain complex services",
  support_existing_customers: "Support existing customers",
  recruit_partners: "Recruit partners",
  drive_trials_or_demos: "Drive trials or demos",
};

const BUYER_ANXIETY_LABELS: Record<RoastBuyerAnxiety, string> = {
  credibility: "Credibility",
  qualification: "Qualification",
  price_uncertainty: "Price uncertainty",
  location_fit: "Location fit",
  product_fit: "Product fit",
  response_time: "Response time",
  risk: "Risk",
  next_step: "Next step",
  delivery_or_warranty: "Delivery / warranty",
  privacy_or_compliance: "Privacy / compliance",
};

const PAIN_POINT_LABELS: Record<RoastPainPoint, string> = {
  weak_offer_clarity: "Weak offer clarity",
  wrong_cta_for_intent: "Wrong CTA for buyer intent",
  thin_authority_proof: "Thin authority proof",
  missing_price_expectation: "Missing price expectation",
  poor_product_discovery: "Poor product discovery",
  weak_checkout_reassurance: "Weak checkout reassurance",
  no_service_area_confidence: "No service-area confidence",
  flat_visual_hierarchy: "Flat visual hierarchy",
  navigation_hides_money_pages: "Navigation hides money pages",
  interchangeable_copy: "Interchangeable copy",
  missing_process_explanation: "Missing process explanation",
  weak_urgency: "Weak urgency",
  no_comparison_argument: "No comparison argument",
  poor_mobile_scanning: "Poor mobile scanning",
  missing_high_friction_faqs: "Missing high-friction FAQs",
  underused_trust_assets: "Underused trust assets",
  strong_site_minor_leaks: "Strong site, minor leaks",
  thin_customer_support_path: "Thin customer support path",
  unclear_buyer_fit: "Unclear buyer fit",
};

export function diagnoseWebsite(
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
): RoastDiagnosis {
  const context = buildSiteContextSnapshot(scraped);
  const blueprint = buildImplementationBlueprint(scraped, scoring);
  const businessModel = inferBusinessModel(context.niche, scraped);
  const siteGoal = inferSiteGoal(context.niche, scraped, blueprint.primaryCta);
  const buyerAnxieties = inferBuyerAnxieties(businessModel, scraped, scoring);
  const primaryPainpoints = inferPainPoints(businessModel, siteGoal, scraped, scoring);
  const evidence = [
    context.companyName ? `Company detected: ${context.companyName}` : "",
    `Offer/headline: ${context.offerHeadline}`,
    `Primary CTA signal: ${context.primaryCta}`,
    context.services.length ? `Services: ${context.services.slice(0, 5).join(" | ")}` : "",
    context.productCategories.length ? `Products/categories: ${context.productCategories.slice(0, 5).join(" | ")}` : "",
    context.locations.length ? `Locations: ${context.locations.slice(0, 4).join(" | ")}` : "",
    context.topTrustSignal ? `Trust signal: ${context.topTrustSignal}` : "",
    scoring.singleBiggestLeak ? `Scoring leak: ${scoring.singleBiggestLeak}` : "",
  ].filter(Boolean);

  return {
    businessModel,
    siteGoal,
    buyerAnxieties,
    primaryPainpoints,
    summary: `${businessModelLabel(businessModel)} site whose main job is to ${siteGoalLabel(siteGoal).toLowerCase()}. The roast should focus on ${primaryPainpoints
      .slice(0, 3)
      .map(painPointLabel)
      .join(", ")
      .toLowerCase()}, using only the extracted site evidence.`,
    evidence: evidence.slice(0, 6),
    confidence: scoring.confidence >= 70 ? "high" : scoring.confidence >= 45 ? "medium" : "low",
  };
}

export function diagnosisPromptBlock(diagnosis: RoastDiagnosis): string {
  return `DIAGNOSIS STRATEGY:
- Business model: ${businessModelLabel(diagnosis.businessModel)} (${diagnosis.businessModel})
- Site goal: ${siteGoalLabel(diagnosis.siteGoal)} (${diagnosis.siteGoal})
- Buyer anxieties: ${diagnosis.buyerAnxieties.map(buyerAnxietyLabel).join(" | ")}
- Primary painpoints: ${diagnosis.primaryPainpoints.map(painPointLabel).join(" | ")}
- Diagnosis summary: ${diagnosis.summary}
- Diagnosis evidence: ${diagnosis.evidence.join(" | ") || "No strong diagnosis evidence extracted"}
- Diagnosis confidence: ${diagnosis.confidence}`;
}

export function diagnosisQuickFixes(
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
  diagnosis: RoastDiagnosis = diagnoseWebsite(scraped, scoring),
): string[] {
  const context = buildSiteContextSnapshot(scraped);
  const blueprint = buildImplementationBlueprint(scraped, scoring);
  const offer = context.offerHeadline || context.companyName || "the main offer";
  const cta = blueprint.primaryCta;
  const product = context.productCategories[0] || "top product category";
  const service = context.services[0] || "core service";
  const location = context.locations[0] ? ` in ${context.locations[0]}` : "";

  const fixes = diagnosis.primaryPainpoints.map((painPoint) => {
    switch (painPoint) {
      case "poor_product_discovery":
        return `Where: Product/category path | Fix: Group the main range around buyer intent, compatibility, stock, and price cues. | Example: Start with "${product}", then show best sellers, use cases, warranty, delivery, and support before the cart path.`;
      case "weak_checkout_reassurance":
        return `Where: First buying path | Fix: Put payment, delivery, warranty, return, and support reassurance beside the first product action. | Example: Add a compact trust row under the first "Buy" or "Add to Cart" action.`;
      case "missing_price_expectation":
        return `Where: Offer and service/product blocks | Fix: Give buyers a price expectation, quote boundary, or decision range before asking for contact. | Example: Add "Request a quote with site details" or "From/typical range" copy where exact pricing is not possible.`;
      case "missing_process_explanation":
        return `Where: Main service section | Fix: Explain the working process in 3 to 4 steps so the buyer knows what happens after the enquiry. | Example: Enquire, assess, quote, complete the work.`;
      case "no_service_area_confidence":
        return `Where: Hero, contact block, and footer | Fix: State the served areas clearly so local buyers know they qualify. | Example: "${service}${location}" plus nearby areas and response expectations.`;
      case "thin_authority_proof":
        return `Where: First screen and first CTA | Fix: Move proof closer to the decision point. | Example: Show reviews, credentials, completed work, client outcomes, or guarantees directly under "${offer}".`;
      case "wrong_cta_for_intent":
        return `Where: Hero, nav, mobile sticky action, and final section | Fix: Use one goal-led primary action everywhere. | Example: Button text = "${cta}" with microcopy that explains what happens next.`;
      case "flat_visual_hierarchy":
        return `Where: Above the fold | Fix: Make the offer, proof, and primary action visually dominant before secondary content competes. | Example: One headline, one proof strip, one high-contrast "${cta}" button.`;
      case "poor_mobile_scanning":
        return `Where: Mobile first screen and long sections | Fix: Shorten blocks, increase contrast, and make the primary action reachable without hunting. | Example: Keep paragraphs to 2 lines and repeat "${cta}" after key sections.`;
      case "navigation_hides_money_pages":
        return `Where: Main navigation | Fix: Promote the money pages buyers need before they enquire. | Example: Put services/products, proof, FAQs, and contact/quote ahead of low-intent company links.`;
      case "interchangeable_copy":
        return `Where: Hero and service copy | Fix: Replace category-safe claims with specific outcomes, constraints, proof, and buyer-fit language. | Example: Rewrite "${offer}" around who it helps, what problem it solves, and why this company is safer.`;
      case "missing_high_friction_faqs":
        return `Where: Before final CTA | Fix: Answer the questions that stop buyers from acting. | Example: Include pricing, timeline, areas, guarantees, requirements, and what happens after contact.`;
      case "no_comparison_argument":
        return `Where: Mid-page proof section | Fix: Explain why choosing this company is safer than comparing more options. | Example: Add method, response speed, credentials, and one concrete proof point.`;
      case "thin_customer_support_path":
        return `Where: Product/support area | Fix: Make after-sale help obvious before checkout or enquiry. | Example: Add warranty, returns, installation/support, and phone/email routes near product decisions.`;
      case "unclear_buyer_fit":
        return `Where: Offer intro | Fix: State who the site is best for and who should take the next step. | Example: "Best for homeowners/businesses needing ${service || product} with clear support."`;
      case "strong_site_minor_leaks":
      case "underused_trust_assets":
      case "weak_urgency":
      case "weak_offer_clarity":
      default:
        return `Where: Hero and first content section | Fix: Tighten the main promise into a sharper buyer outcome and support it with one proof point. | Example: Replace "${offer}" with a specific result, served audience, and "${cta}".`;
    }
  });

  return [...new Set(fixes)].slice(0, 5);
}

export function businessModelLabel(value: RoastBusinessModel): string {
  return BUSINESS_MODEL_LABELS[value] ?? value;
}

export function siteGoalLabel(value: RoastSiteGoal): string {
  return SITE_GOAL_LABELS[value] ?? value;
}

export function buyerAnxietyLabel(value: RoastBuyerAnxiety): string {
  return BUYER_ANXIETY_LABELS[value] ?? value;
}

export function painPointLabel(value: RoastPainPoint): string {
  return PAIN_POINT_LABELS[value] ?? value;
}

function inferBusinessModel(niche: SiteNiche, scraped: ScrapedWebsiteData): RoastBusinessModel {
  const text = siteText(scraped);

  if (niche === "ecommerce") return "ecommerce";
  if (niche === "healthcare") return "healthcare";
  if (niche === "creative_agency") return "creative_agency";
  if (niche === "saas") return "saas_platform";
  if (niche === "public_enterprise") return "public_enterprise";

  if (/\b(tax|account|bookkeep|legal|attorney|law firm|consult|advisor|compliance|audit|financial)\b/i.test(text)) {
    return "professional_service";
  }
  if (/\b(construction|builder|contractor|renovation|paving|landscaping|demolition|roofing|tiling|plumbing|electrical)\b/i.test(text)) {
    return "construction_trade";
  }
  if (niche === "local_service") return "local_service";

  return "other";
}

function inferSiteGoal(
  niche: SiteNiche,
  scraped: ScrapedWebsiteData,
  primaryCta: string,
): RoastSiteGoal {
  const text = [siteText(scraped), primaryCta].join(" ");
  if (niche === "ecommerce") return "sell_online";
  if (niche === "saas") return /\btrial|demo\b/i.test(text) ? "drive_trials_or_demos" : "build_credibility";
  if (/\b(book|appointment|consultation|schedule)\b/i.test(text)) return "book_consultations";
  if (/\b(quote|estimate|proposal)\b/i.test(text)) return "capture_quote_requests";
  if (/\b(call|phone|whatsapp)\b/i.test(text)) return "generate_calls";
  if (niche === "professional_service" || niche === "healthcare") return "explain_complex_services";
  return "build_credibility";
}

function inferBuyerAnxieties(
  model: RoastBusinessModel,
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
): RoastBuyerAnxiety[] {
  const anxieties = new Set<RoastBuyerAnxiety>();
  const facts = scraped.siteFacts;

  if (categoryRatio("trust", scoring.breakdown.trust) < 0.72 || (facts?.trustSignals.length ?? 0) < 2) {
    anxieties.add("credibility");
    anxieties.add("risk");
  }
  if (categoryRatio("CTA", scoring.breakdown.CTA) < 0.72) anxieties.add("next_step");
  if (categoryRatio("clarity", scoring.breakdown.clarity) < 0.72) anxieties.add("qualification");

  if (model === "ecommerce") {
    anxieties.add("product_fit");
    anxieties.add("delivery_or_warranty");
    anxieties.add("price_uncertainty");
  } else if (model === "professional_service" || model === "healthcare" || model === "b2b_consulting") {
    anxieties.add("qualification");
    anxieties.add("risk");
    anxieties.add("next_step");
    if (model === "professional_service") anxieties.add("privacy_or_compliance");
  } else if (model === "local_service" || model === "construction_trade") {
    anxieties.add("location_fit");
    anxieties.add("response_time");
    anxieties.add("risk");
  }

  return Array.from(anxieties).slice(0, 5);
}

function inferPainPoints(
  model: RoastBusinessModel,
  goal: RoastSiteGoal,
  scraped: ScrapedWebsiteData,
  scoring: WebsiteScoring,
): RoastPainPoint[] {
  const painPoints = new Set<RoastPainPoint>();
  const visual = scraped.visualAudit?.summary;
  const facts = scraped.siteFacts;
  const text = siteText(scraped);
  const strongSite = scoring.score >= 7;

  if (categoryRatio("clarity", scoring.breakdown.clarity) < 0.72) painPoints.add("weak_offer_clarity");
  if (categoryRatio("CTA", scoring.breakdown.CTA) < 0.75) painPoints.add("wrong_cta_for_intent");
  if (categoryRatio("trust", scoring.breakdown.trust) < 0.72 || (facts?.trustSignals.length ?? 0) < 2) {
    painPoints.add("thin_authority_proof");
  }
  if (categoryRatio("differentiation", scoring.breakdown.differentiation) < 0.72 || scraped.genericPhrasesFound.length >= 2) {
    painPoints.add("interchangeable_copy");
  }
  if (visual && (visual.hierarchy < 55 || visual.ctaProminence < 55)) painPoints.add("flat_visual_hierarchy");
  if (visual && visual.readability < 58) painPoints.add("poor_mobile_scanning");

  if (model === "ecommerce") {
    painPoints.add("poor_product_discovery");
    if (!/\b(delivery|shipping|returns?|warranty|guarantee|secure|payment)\b/i.test(text)) {
      painPoints.add("weak_checkout_reassurance");
    }
    if (!/\b(price|r\s?\d|zar|vat|quote|from)\b/i.test(text)) painPoints.add("missing_price_expectation");
    if (!/\b(support|warranty|returns?|installation|help)\b/i.test(text)) painPoints.add("thin_customer_support_path");
  }

  if (model === "professional_service" || model === "healthcare" || model === "b2b_consulting") {
    painPoints.add("missing_process_explanation");
    painPoints.add("missing_high_friction_faqs");
    if (!/\b(fee|pricing|cost|quote|consultation|assessment)\b/i.test(text)) painPoints.add("missing_price_expectation");
  }

  if (model === "local_service" || model === "construction_trade") {
    if ((facts?.locations.length ?? 0) === 0) painPoints.add("no_service_area_confidence");
    painPoints.add("missing_process_explanation");
  }

  if (goal === "build_credibility" && painPoints.size < 3) painPoints.add("no_comparison_argument");
  if (strongSite) {
    painPoints.add("strong_site_minor_leaks");
    painPoints.add("underused_trust_assets");
  }

  if (painPoints.size < 3) {
    painPoints.add("weak_offer_clarity");
    painPoints.add("thin_authority_proof");
    painPoints.add("wrong_cta_for_intent");
  }

  return Array.from(painPoints).slice(0, 5);
}

function siteText(scraped: ScrapedWebsiteData): string {
  return [
    scraped.title,
    scraped.description,
    scraped.headings.h1.join(" "),
    scraped.headings.h2.join(" "),
    scraped.contentSnippet,
    scraped.siteFacts?.services.map((item) => item.value).join(" "),
    scraped.siteFacts?.productCategories?.map((item) => item.value).join(" "),
    scraped.ctas.join(" "),
  ].filter(Boolean).join(" ");
}
