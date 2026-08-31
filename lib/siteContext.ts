import type { ScrapedWebsiteData } from "./types";

export type SiteNiche =
  | "saas"
  | "ecommerce"
  | "local_service"
  | "professional_service"
  | "healthcare"
  | "creative_agency"
  | "mobile_game"
  | "public_enterprise"
  | "generic";

export type SiteContextSnapshot = {
  niche: SiteNiche;
  nicheLabel: string;
  offerHeadline: string;
  primaryCta: string;
  topTrustSignal: string;
  contactPathSummary: string;
  genericCopySummary: string;
};

export type VisualThresholdProfile = {
  label: string;
  ctaWeak: number;
  ctaStrong: number;
  readabilityWeak: number;
  readabilityStrong: number;
  hierarchyWeak: number;
  hierarchyStrong: number;
  consistencyWeak: number;
  consistencyStrong: number;
  motionHigh: number;
  motionLow: number;
};

type NicheRule = {
  niche: SiteNiche;
  label: string;
  keywords: string[];
};

const NICHE_RULES: NicheRule[] = [
  {
    niche: "mobile_game",
    label: "Mobile Game",
    keywords: [
      "ludo",
      "game",
      "mobile game",
      "app",
      "download",
      "install",
      "android",
      "ios",
      "app store",
      "google play",
      "play now",
      "tournament",
      "league",
    ],
  },
  {
    niche: "ecommerce",
    label: "Ecommerce",
    keywords: [
      "checkout",
      "cart",
      "add to cart",
      "buy now",
      "shop now",
      "shipping",
      "order",
      "free shipping",
      "returns",
      "wishlist",
      "new arrivals",
      "best sellers",
    ],
  },
  {
    niche: "saas",
    label: "SaaS",
    keywords: [
      "software",
      "platform",
      "saas",
      "dashboard",
      "api",
      "integration",
      "trial",
      "sign up",
      "workspace",
      "automation",
    ],
  },
  {
    niche: "healthcare",
    label: "Healthcare",
    keywords: [
      "clinic",
      "doctor",
      "medical",
      "patient",
      "treatment",
      "hearing",
      "dental",
      "eye",
      "hospital",
      "health",
      "dentist",
      "aesthetic",
      "aesthetics",
      "physiotherapy",
      "physio",
      "practice",
    ],
  },
  {
    niche: "local_service",
    label: "Local Service",
    keywords: [
      "plumbing",
      "electric",
      "drain",
      "repair",
      "maintenance",
      "emergency",
      "installation",
      "contractor",
      "contractors",
      "construction",
      "building",
      "builder",
      "builders",
      "renovation",
      "renovations",
      "paving",
      "landscaping",
      "roofing",
      "waterproofing",
      "painting",
      "carpentry",
      "tiling",
      "solar",
      "inverter",
      "backup power",
      "cctv",
      "security",
      "alarm",
      "gate automation",
      "electric fence",
      "access control",
      "call out",
      "quote",
    ],
  },
  {
    niche: "professional_service",
    label: "Professional Service",
    keywords: [
      "advisor",
      "consultant",
      "financial",
      "legal",
      "accounting",
      "planning",
      "portfolio",
      "wealth",
      "audit",
      "compliance",
      "attorney",
      "attorneys",
      "law firm",
      "accountant",
      "bookkeeping",
      "bookkeeper",
      "tax",
      "broker",
      "insurance",
      "estate agent",
    ],
  },
  {
    niche: "creative_agency",
    label: "Creative Agency",
    keywords: [
      "studio",
      "branding",
      "design",
      "creative",
      "marketing",
      "campaign",
      "video",
      "production",
      "web design",
      "content",
    ],
  },
  {
    niche: "public_enterprise",
    label: "Public / Enterprise",
    keywords: [
      "government",
      "municipality",
      "public",
      "utility",
      "eskom",
      "notice",
      "policy",
      "service interruption",
      "infrastructure",
      "authority",
    ],
  },
];

const VISUAL_THRESHOLDS_BY_NICHE: Record<SiteNiche, VisualThresholdProfile> = {
  ecommerce: {
    label: "Ecommerce",
    ctaWeak: 50,
    ctaStrong: 80,
    readabilityWeak: 52,
    readabilityStrong: 82,
    hierarchyWeak: 50,
    hierarchyStrong: 78,
    consistencyWeak: 42,
    consistencyStrong: 78,
    motionHigh: 55,
    motionLow: 18,
  },
  saas: {
    label: "SaaS",
    ctaWeak: 48,
    ctaStrong: 78,
    readabilityWeak: 55,
    readabilityStrong: 84,
    hierarchyWeak: 52,
    hierarchyStrong: 80,
    consistencyWeak: 45,
    consistencyStrong: 80,
    motionHigh: 50,
    motionLow: 16,
  },
  local_service: {
    label: "Local Service",
    ctaWeak: 45,
    ctaStrong: 75,
    readabilityWeak: 50,
    readabilityStrong: 80,
    hierarchyWeak: 48,
    hierarchyStrong: 76,
    consistencyWeak: 38,
    consistencyStrong: 74,
    motionHigh: 45,
    motionLow: 12,
  },
  professional_service: {
    label: "Professional Service",
    ctaWeak: 42,
    ctaStrong: 74,
    readabilityWeak: 54,
    readabilityStrong: 82,
    hierarchyWeak: 46,
    hierarchyStrong: 76,
    consistencyWeak: 44,
    consistencyStrong: 80,
    motionHigh: 38,
    motionLow: 10,
  },
  healthcare: {
    label: "Healthcare",
    ctaWeak: 40,
    ctaStrong: 72,
    readabilityWeak: 56,
    readabilityStrong: 84,
    hierarchyWeak: 45,
    hierarchyStrong: 75,
    consistencyWeak: 44,
    consistencyStrong: 80,
    motionHigh: 35,
    motionLow: 8,
  },
  creative_agency: {
    label: "Creative Agency",
    ctaWeak: 42,
    ctaStrong: 72,
    readabilityWeak: 50,
    readabilityStrong: 78,
    hierarchyWeak: 45,
    hierarchyStrong: 74,
    consistencyWeak: 36,
    consistencyStrong: 72,
    motionHigh: 62,
    motionLow: 15,
  },
  mobile_game: {
    label: "Mobile Game",
    ctaWeak: 52,
    ctaStrong: 82,
    readabilityWeak: 50,
    readabilityStrong: 80,
    hierarchyWeak: 52,
    hierarchyStrong: 82,
    consistencyWeak: 40,
    consistencyStrong: 76,
    motionHigh: 70,
    motionLow: 18,
  },
  public_enterprise: {
    label: "Public / Enterprise",
    ctaWeak: 36,
    ctaStrong: 68,
    readabilityWeak: 54,
    readabilityStrong: 82,
    hierarchyWeak: 42,
    hierarchyStrong: 72,
    consistencyWeak: 40,
    consistencyStrong: 78,
    motionHigh: 35,
    motionLow: 8,
  },
  generic: {
    label: "Generic",
    ctaWeak: 45,
    ctaStrong: 75,
    readabilityWeak: 52,
    readabilityStrong: 82,
    hierarchyWeak: 48,
    hierarchyStrong: 76,
    consistencyWeak: 40,
    consistencyStrong: 76,
    motionHigh: 50,
    motionLow: 12,
  },
};

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      entityFromCodePoint(match, Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (match, decimal: string) =>
      entityFromCodePoint(match, Number.parseInt(decimal, 10)),
    );
}

function entityFromCodePoint(fallback: string, codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function truncateAtWord(value: string, limit: number): string {
  const cleaned = normalizeWhitespace(value);
  if (cleaned.length <= limit) {
    return cleaned;
  }

  const clipped = cleaned.slice(0, Math.max(0, limit - 3));
  const wordSafe = clipped.replace(/\s+\S*$/, "").trim();
  return `${(wordSafe.length >= limit * 0.65 ? wordSafe : clipped).trim()}...`;
}

function corpusFromScraped(scraped: ScrapedWebsiteData): string {
  return [
    scraped.url,
    scraped.title,
    scraped.description,
    scraped.headings.h1.join(" "),
    scraped.headings.h2.join(" "),
    scraped.contentSnippet,
  ]
    .join(" ")
    .toLowerCase();
}

function pickPrimaryCta(scraped: ScrapedWebsiteData): string {
  const ranked = [...scraped.ctas]
    .map((cta) => normalizeWhitespace(cta))
    .filter(Boolean)
    .sort((left, right) => ctaStrength(right) - ctaStrength(left));

  if (ranked.length > 0) {
    return truncateAtWord(ranked[0], 80);
  }
  return "No strong CTA detected";
}

function pickOfferHeadline(scraped: ScrapedWebsiteData): string {
  const fromH1 = scraped.headings.h1.find((item) => normalizeWhitespace(item).length >= 6);
  if (fromH1) {
    return truncateAtWord(fromH1, 120);
  }
  const fromTitle = normalizeWhitespace(scraped.title);
  if (fromTitle && fromTitle !== "No title found.") {
    return truncateAtWord(fromTitle, 120);
  }
  return "No clear offer headline detected";
}

export function inferSiteNiche(scraped: ScrapedWebsiteData): SiteNiche {
  const corpus = corpusFromScraped(scraped);
  const ctaCorpus = scraped.ctas.join(" ").toLowerCase();
  const scores = Object.fromEntries(
    NICHE_RULES.map((rule) => [rule.niche, 0]),
  ) as Record<SiteNiche, number>;
  scores.generic = 0;

  for (const rule of NICHE_RULES) {
    scores[rule.niche] = keywordHitCount(corpus, rule.keywords);
  }

  const ecommerceIntent = ecommerceIntentScore(corpus, ctaCorpus);
  const serviceIntent = serviceIntentScore(scraped, corpus, ctaCorpus);
  const serviceNiche = strongestServiceNiche(scores);

  if (scores.mobile_game >= 2 && scores.mobile_game >= scores.saas) {
    return "mobile_game";
  }

  if (
    scores.saas >= 3 &&
    scores.saas >= scores.ecommerce &&
    scores.saas >= scores[serviceNiche]
  ) {
    return "saas";
  }

  if (
    scores.ecommerce >= 2 &&
    ecommerceIntent >= 3 &&
    ecommerceIntent >= serviceIntent + 1
  ) {
    return "ecommerce";
  }

  if (scores[serviceNiche] > 0 && serviceIntent >= 2) {
    return serviceNiche;
  }

  let bestNiche: SiteNiche = "generic";
  let bestScore = 0;
  for (const [niche, score] of Object.entries(scores) as Array<[SiteNiche, number]>) {
    if (score > bestScore) {
      bestNiche = niche;
      bestScore = score;
    }
  }

  if (bestNiche === "ecommerce" && ecommerceIntent < 3 && scores[serviceNiche] > 0) {
    return serviceNiche;
  }

  return bestNiche;
}

const SERVICE_NICHES: SiteNiche[] = [
  "local_service",
  "professional_service",
  "healthcare",
  "creative_agency",
];

const ECOMMERCE_INTENT_SIGNALS = [
  "add to cart",
  "checkout",
  "cart",
  "buy now",
  "shop now",
  "shop online",
  "free shipping",
  "shipping",
  "returns",
  "wishlist",
  "new arrivals",
  "best sellers",
  "limited stock",
  "quantity",
];

const SERVICE_INTENT_SIGNALS = [
  "get a quote",
  "request a quote",
  "quote",
  "estimate",
  "call now",
  "call us",
  "contact us",
  "whatsapp",
  "book consultation",
  "book a consultation",
  "book appointment",
  "schedule a call",
  "free consultation",
  "service area",
  "site visit",
  "contractor",
  "construction",
  "building",
  "solar",
  "cctv",
  "security",
  "dentist",
  "attorney",
  "accountant",
];

function keywordHitCount(corpus: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => {
    return sum + (corpus.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
}

function ctaStrength(cta: string): number {
  const lower = cta.toLowerCase();
  if (/\b(add to cart|checkout|buy now|shop now)\b/.test(lower)) return 100;
  if (/\b(get|request)\s+(a\s+)?quote\b|\bbook\b|\bschedule\b|\bconsultation\b/.test(lower)) return 96;
  if (/\b(call now|call us|whatsapp|talk to us|speak to)\b/.test(lower)) return 82;
  if (/\b(contact us|contact|get in touch|send message)\b/.test(lower)) return 42;
  if (/\b(learn more|read more|view|explore)\b/.test(lower)) return 20;
  return 0;
}

function ecommerceIntentScore(corpus: string, ctaCorpus: string): number {
  return (
    keywordHitCount(corpus, ECOMMERCE_INTENT_SIGNALS) +
    keywordHitCount(ctaCorpus, ["add to cart", "checkout", "buy now", "shop now"]) * 2
  );
}

function serviceIntentScore(
  scraped: ScrapedWebsiteData,
  corpus: string,
  ctaCorpus: string,
): number {
  return (
    keywordHitCount(corpus, SERVICE_INTENT_SIGNALS) +
    keywordHitCount(ctaCorpus, ["quote", "book", "consultation", "appointment", "call", "contact"]) +
    Math.min(scraped.contactSignals.length, 2)
  );
}

function strongestServiceNiche(scores: Record<SiteNiche, number>): SiteNiche {
  return SERVICE_NICHES.reduce((best, niche) =>
    scores[niche] > scores[best] ? niche : best,
  );
}

function nicheLabelFromType(niche: SiteNiche): string {
  const fromRule = NICHE_RULES.find((rule) => rule.niche === niche);
  return fromRule?.label ?? "Generic";
}

export function getVisualThresholdProfile(niche: SiteNiche): VisualThresholdProfile {
  return VISUAL_THRESHOLDS_BY_NICHE[niche] ?? VISUAL_THRESHOLDS_BY_NICHE.generic;
}

export function buildSiteContextSnapshot(
  scraped: ScrapedWebsiteData,
): SiteContextSnapshot {
  const niche = inferSiteNiche(scraped);
  const topTrustSignal =
    scraped.trustSignals.length > 0
      ? scraped.trustSignals.slice(0, 2).join(" | ")
      : "No trust proof detected";
  const contactPathSummary =
    scraped.contactSignals.length > 0
      ? scraped.contactSignals.slice(0, 2).join(" | ")
      : "No contact path detected";
  const genericCopySummary =
    scraped.genericPhrasesFound.length > 0
      ? scraped.genericPhrasesFound.slice(0, 3).join(", ")
      : "No obvious generic phrase flags";

  return {
    niche,
    nicheLabel: nicheLabelFromType(niche),
    offerHeadline: pickOfferHeadline(scraped),
    primaryCta: pickPrimaryCta(scraped),
    topTrustSignal,
    contactPathSummary,
    genericCopySummary,
  };
}

export function extractSourceAnchors(scraped: ScrapedWebsiteData): string[] {
  const anchors = new Set<string>();
  const parts = [
    scraped.title,
    scraped.headings.h1[0] ?? "",
    scraped.headings.h2[0] ?? "",
    scraped.ctas[0] ?? "",
    scraped.trustSignals[0] ?? "",
    scraped.contactSignals[0] ?? "",
  ];

  for (const part of parts) {
    const normalized = normalizeWhitespace(part).toLowerCase();
    if (!normalized || normalized.includes("no ") || normalized.length < 4) {
      continue;
    }
    anchors.add(truncateAtWord(normalized, 80));
  }

  return [...anchors].slice(0, 8);
}
