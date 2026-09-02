import type {
  CrawlPageRole,
  CrawlPageSummary,
  ScrapedWebsiteData,
  SiteFactEvidence,
  SiteFacts,
} from "./types";

type PatternFact = {
  value: string;
  pattern: RegExp;
};

type ExclusionRule = {
  value: string;
  patterns: RegExp[];
};

type SourceHint = {
  sourceUrl?: string;
  sourceRole?: CrawlPageRole;
};

const SERVICE_PATTERNS: PatternFact[] = [
  { value: "Construction", pattern: /\b(?:construction services?|construction company|building construction|residential construction|commercial construction|industrial construction)\b/i },
  { value: "Building services", pattern: /\bbuilding (?:services|contractors?|projects?)\b/i },
  { value: "Residential construction", pattern: /\bresidential construction\b/i },
  { value: "Commercial construction", pattern: /\bcommercial construction\b/i },
  { value: "Industrial construction", pattern: /\bindustrial construction\b/i },
  { value: "Renovations", pattern: /\brenovations?\b/i },
  { value: "Paving", pattern: /\bpaving\b/i },
  { value: "Driveway paving", pattern: /\bdriveway paving\b/i },
  { value: "Patio and pool paving", pattern: /\b(?:patio|pool)(?:s| area| deck)?(?:\s+and\s+|\s*&\s*|\s+\/\s+)?(?:patio|pool)?\s*paving\b|\bpatios?\s*&\s*pool decks?\b/i },
  { value: "Commercial and industrial paving", pattern: /\bcommercial (?:&|and) industrial paving\b/i },
  { value: "Cladding", pattern: /\bcladding\b/i },
  { value: "Paving cleaning", pattern: /\bpav(?:e|ing)[-\s]?kleen\b|\bpaving cleaning\b/i },
  { value: "Landscaping", pattern: /\blandscap(?:e|ing)\b/i },
  { value: "Residential landscaping", pattern: /\bresidential landscaping\b/i },
  { value: "Commercial landscaping", pattern: /\bcommercial landscaping\b/i },
  { value: "Garden maintenance", pattern: /\bgarden maintenance\b/i },
  { value: "Water features", pattern: /\bwater features?\b/i },
  { value: "Bomas and entertainment areas", pattern: /\bbomas?(?:\s+(?:&|and)\s+entertainment areas?)?\b/i },
  { value: "Herb and vegetable gardens", pattern: /\bherb\s*(?:&|and)\s*veg(?:etable)? gardens?\b/i },
  { value: "Garden decor", pattern: /\bgarden decor\b/i },
  { value: "Instant lawns", pattern: /\binstant lawns?\b/i },
  { value: "Tree felling", pattern: /\btree felling\b/i },
  { value: "Irrigation", pattern: /\birrigation\b/i },
  { value: "Demolition", pattern: /\bdemolition\b/i },
  { value: "Rubble removal", pattern: /\brubble removal\b/i },
  { value: "Site clearing", pattern: /\bsite clearing\b/i },
  { value: "Rock breaking", pattern: /\brock breaking\b/i },
  { value: "Blasting", pattern: /\bblasting\b/i },
  { value: "Plant hire", pattern: /\bplant hire\b/i },
  { value: "Tipper truck hire", pattern: /\btipper truck (?:hire|rental)\b/i },
  { value: "Roofing", pattern: /\broofing\b/i },
  { value: "Painting", pattern: /\bpainting\b/i },
  { value: "Waterproofing", pattern: /\bwaterproofing\b/i },
  { value: "Solar", pattern: /\bsolar\b/i },
  { value: "Security", pattern: /\b(?:cctv|alarm|security|access control|electric fence)\b/i },
  { value: "Legal services", pattern: /\b(?:law firm|attorneys?|legal services?)\b/i },
  { value: "Accounting", pattern: /\b(?:accounting|bookkeeping|tax services?)\b/i },
  { value: "Dental care", pattern: /\b(?:dentist|dental)\b/i },
  { value: "Medical practice", pattern: /\b(?:clinic|medical practice|healthcare)\b/i },
  { value: "Web design", pattern: /\bweb design\b/i },
  { value: "Marketing", pattern: /\b(?:marketing|paid media|advertising)\b/i },
];

const PRODUCT_CATEGORY_PATTERNS: PatternFact[] = [
  { value: "Solar inverters", pattern: /\bsolar inverters?\b|\ball inverters?\b|\bhybrid inverters?\b|\bgrid tie\b|\boff[-\s]?grid\b/i },
  { value: "Solar panels", pattern: /\bsolar panels?\b|\bjinko\b|\blongi\b|\bseraphim\b/i },
  { value: "Batteries", pattern: /\bbatteries\b|\blithium\b|\bagm\b|\bgel\b|\bbattery storage\b|\bbattery cable\b|\bbattery fusing\b/i },
  { value: "Solar system kits", pattern: /\bsolar system kits?\b|\bsolar kits?\b|\bvictron solar kits?\b|\bluxpower solar kits?\b|\bsolis kits?\b/i },
  { value: "Solar accessories", pattern: /\bsolar accessories\b|\bcables? and connectors?\b|\bfuses?\b|\bdc isolators?\b|\bsolar tools?\b|\bmc4\b/i },
  { value: "Solar mounting systems", pattern: /\bsolar (?:panel )?mounting systems?\b|\brenusol\b|\bplas-sol\b|\beco mounting\b/i },
  { value: "Victron Energy products", pattern: /\bvictron(?: energy)?\b|\bvictron all products\b|\bvictron charge controllers?\b/i },
  { value: "Camping power supplies", pattern: /\bcamping\b|\bpower supplies\b/i },
  { value: "Specials and clearance", pattern: /\bspecials\b|\bclearance\b|\blimited stock\b|\bsale\b/i },
];

const LOCATION_PATTERNS: PatternFact[] = [
  { value: "Gauteng", pattern: /\bgauteng\b/i },
  { value: "Johannesburg", pattern: /\bjohannesburg\b/i },
  { value: "Houghton", pattern: /\bhoughton\b/i },
  { value: "Pretoria", pattern: /\bpretoria\b/i },
  { value: "Tshwane", pattern: /\btshwane\b/i },
  { value: "Centurion", pattern: /\bcenturion\b/i },
  { value: "Sandton", pattern: /\bsandton\b/i },
  { value: "Randburg", pattern: /\brandburg\b/i },
  { value: "Midrand", pattern: /\bmidrand\b/i },
  { value: "Roodepoort", pattern: /\broodepoort\b/i },
  { value: "East Rand", pattern: /\beast rand\b/i },
  { value: "West Rand", pattern: /\bwest rand\b/i },
  { value: "Cape Town", pattern: /\bcape town\b/i },
  { value: "Durban", pattern: /\bdurban\b/i },
  { value: "KwaZulu-Natal", pattern: /\bkwazulu[-\s]?natal\b/i },
  { value: "Western Cape", pattern: /\bwestern cape\b/i },
  { value: "South Africa", pattern: /\bsouth africa\b/i },
];

const COPY_ISSUE_PATTERNS: PatternFact[] = [
  { value: 'Grammar issue: "achieve the your"', pattern: /\bachieve the your\b/i },
  { value: 'Copy issue: "tipper trucker"', pattern: /\btipper trucker\b/i },
  { value: "Placeholder copy appears in visible content", pattern: /\blorem ipsum\b/i },
  { value: "Generic claim: quality service", pattern: /\bquality service\b/i },
  { value: "Generic claim: affordable prices", pattern: /\baffordable prices\b/i },
  { value: "Generic claim: customer satisfaction", pattern: /\bcustomer satisfaction\b/i },
];

const EXCLUSION_RULES: ExclusionRule[] = [
  {
    value: "Garden maintenance",
    patterns: [
      /\b(?:do\s+not|don't|does\s+not|doesn't|no\s+longer)\s+(?:offer|provide|do)\s+(?:ongoing\s+)?garden maintenance\b/i,
      /\b(?:we\s+)?(?:do\s+not|don't)\s+offer\s+garden maintenance\b/i,
      /\bno\s+ongoing\s+garden maintenance\b/i,
    ],
  },
  {
    value: "Maintenance",
    patterns: [
      /\b(?:do\s+not|don't|does\s+not|doesn't)\s+(?:offer|provide|do)\s+(?:ongoing\s+)?maintenance\b/i,
      /\bno\s+ongoing\s+maintenance\b/i,
    ],
  },
  {
    value: "Construction",
    patterns: [
      /\b(?:do\s+not|don't|does\s+not|doesn't)\s+(?:offer|provide|do)\s+construction\b/i,
    ],
  },
  {
    value: "Landscaping",
    patterns: [
      /\b(?:do\s+not|don't|does\s+not|doesn't)\s+(?:offer|provide|do)\s+landscap(?:e|ing)\b/i,
    ],
  },
];

function cleanText(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string): string {
  return cleanText(value).toLowerCase();
}

function visibleUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return value;
  }
}

function roleLabel(role: CrawlPageRole): string {
  switch (role) {
    case "home":
      return "Home";
    case "contact":
      return "Contact";
    case "about":
      return "About";
    case "services":
      return "Services";
    case "pricing":
      return "Pricing";
    case "projects":
      return "Projects";
    case "testimonials":
      return "Testimonials";
    case "faq":
      return "FAQ";
    default:
      return "Page";
  }
}

function sourceForPattern(
  scraped: ScrapedWebsiteData,
  pattern: RegExp,
): SourceHint {
  const pages = scraped.crawl?.pages ?? [];

  for (const page of pages) {
    const pageText = [
      page.title,
      page.primaryHeading,
      page.contentSnippet,
      page.url,
    ]
      .filter(Boolean)
      .join(" ");
    if (pattern.test(pageText)) {
      return { sourceUrl: page.url, sourceRole: page.role };
    }
  }

  return { sourceUrl: scraped.url, sourceRole: "home" };
}

function pushFact(
  facts: SiteFactEvidence[],
  seen: Set<string>,
  value: string,
  source: SourceHint,
): void {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return;
  }

  const key = normalizeKey(cleaned);
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  facts.push({
    value: cleaned,
    sourceUrl: source.sourceUrl,
    sourceRole: source.sourceRole,
  });
}

function factsFromPatterns(
  scraped: ScrapedWebsiteData,
  patterns: PatternFact[],
  limit: number,
  excludedValues: Set<string> = new Set(),
): SiteFactEvidence[] {
  const corpus = [
    scraped.title,
    scraped.description,
    scraped.headings.h1.join(" "),
    scraped.headings.h2.join(" "),
    scraped.content,
  ].join(" ");
  const facts: SiteFactEvidence[] = [];
  const seen = new Set<string>();

  for (const item of patterns) {
    if (excludedValues.has(normalizeKey(item.value))) {
      continue;
    }
    if (!item.pattern.test(corpus)) {
      continue;
    }
    pushFact(facts, seen, item.value, sourceForPattern(scraped, item.pattern));
    if (facts.length >= limit) {
      break;
    }
  }

  return facts;
}

function exclusionFacts(scraped: ScrapedWebsiteData): SiteFactEvidence[] {
  const facts: SiteFactEvidence[] = [];
  const seen = new Set<string>();
  const pages = scraped.crawl?.pages ?? [];
  const fallbackPages =
    pages.length > 0
      ? pages
      : [
          {
            url: scraped.url,
            role: "home" as const,
            title: scraped.title,
            primaryHeading: scraped.headings.h1[0],
            contentSnippet: scraped.contentSnippet,
            contentLength: scraped.contentLength,
            headingCount: scraped.headings.h1.length + scraped.headings.h2.length,
          },
        ];

  for (const rule of EXCLUSION_RULES) {
    for (const pattern of rule.patterns) {
      const page = fallbackPages.find((item) =>
        pattern.test(
          [item.title, item.primaryHeading, item.contentSnippet].filter(Boolean).join(" "),
        ),
      );

      if (page) {
        pushFact(
          facts,
          seen,
          rule.value,
          { sourceUrl: page.url, sourceRole: page.role },
        );
        break;
      }
    }
  }

  return facts.slice(0, 8);
}

function signalFacts(
  signals: string[],
  fallbackSource: SourceHint,
  limit: number,
): SiteFactEvidence[] {
  const facts: SiteFactEvidence[] = [];
  const seen = new Set<string>();

  for (const signal of signals) {
    pushFact(facts, seen, signal, fallbackSource);
    if (facts.length >= limit) {
      break;
    }
  }

  return facts;
}

function pagesReviewedFacts(scraped: ScrapedWebsiteData): SiteFactEvidence[] {
  const pages: CrawlPageSummary[] =
    scraped.crawl?.pages && scraped.crawl.pages.length > 0
      ? scraped.crawl.pages
      : [
          {
            url: scraped.url,
            role: "home",
            title: scraped.title,
            primaryHeading: scraped.headings.h1[0],
            contentSnippet: scraped.contentSnippet,
            contentLength: scraped.contentLength,
            headingCount: scraped.headings.h1.length + scraped.headings.h2.length,
          },
        ];

  return pages.slice(0, 8).map((page) => {
    const primaryHeading = cleanText(page.primaryHeading ?? "");
    const title = cleanText(
      primaryHeading && !/\b(login|log in|my account|create my account|recover password|lost password|cart is empty|checkout|contact us|get in touch)\b/i.test(primaryHeading)
        ? primaryHeading
        : page.title || visibleUrl(page.url),
    );
    const label =
      page.role === "services" &&
      /\b(product|connector|battery|victron|renusol|inverter|panel|fuse|isolator|mppt|kit)\b/i.test(
        `${page.url} ${title}`,
      )
        ? "Product"
        : roleLabel(page.role);
    return {
      value: `${label}: ${title}`,
      sourceUrl: page.url,
      sourceRole: page.role,
    };
  });
}

function companyName(scraped: ScrapedWebsiteData): string | undefined {
  const titlePart = cleanText(scraped.title)
    .split(/\s+[|-]\s+/)[0]
    ?.replace(/\b(home|services|about|contact us|contact)\b$/i, "")
    .trim();

  if (titlePart && titlePart.length >= 2 && titlePart.length <= 80) {
    return titlePart;
  }

  try {
    const host = new URL(scraped.url).hostname.replace(/^www\./, "");
    return host
      .split(".")[0]
      .split(/[-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return undefined;
  }
}

function trustFacts(scraped: ScrapedWebsiteData): SiteFactEvidence[] {
  const facts = signalFacts(
    scraped.trustSignals,
    { sourceUrl: scraped.url, sourceRole: "home" },
    8,
  );
  const hasBareSince = facts.some((fact) => /^since$/i.test(fact.value));
  const hasStrongerProof = facts.some((fact) =>
    /\b(?:years?|reviews?|testimonials?|case stud|certified|licensed|insured|guarantee|rating|5-star|clients?)\b/i.test(
      fact.value,
    ),
  );

  if (hasBareSince && !hasStrongerProof) {
    facts.push({
      value: 'Bare "since" cue without concrete years, reviews, projects, or credentials',
      sourceUrl: scraped.url,
      sourceRole: "home",
    });
  }

  return facts.slice(0, 8);
}

export function siteFactValues(
  facts: SiteFactEvidence[] | undefined,
  limit = 5,
): string[] {
  return (facts ?? [])
    .map((fact) => cleanText(fact.value))
    .filter(Boolean)
    .slice(0, limit);
}

export function buildSiteFacts(scraped: ScrapedWebsiteData): SiteFacts {
  const fallbackSource: SourceHint = { sourceUrl: scraped.url, sourceRole: "home" };
  const exclusions = exclusionFacts(scraped);
  const excludedValues = new Set(exclusions.map((fact) => normalizeKey(fact.value)));

  return {
    companyName: companyName(scraped),
    services: factsFromPatterns(scraped, SERVICE_PATTERNS, 10, excludedValues),
    productCategories: factsFromPatterns(scraped, PRODUCT_CATEGORY_PATTERNS, 12),
    exclusions,
    locations: factsFromPatterns(scraped, LOCATION_PATTERNS, 8),
    contacts: signalFacts(scraped.contactSignals, fallbackSource, 6),
    ctas: signalFacts(scraped.ctas, fallbackSource, 8),
    trustSignals: trustFacts(scraped),
    pagesReviewed: pagesReviewedFacts(scraped),
    copyIssues: factsFromPatterns(scraped, COPY_ISSUE_PATTERNS, 8),
  };
}
