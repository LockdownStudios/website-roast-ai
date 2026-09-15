import type {
  BusinessOffering,
  BusinessProfile,
  CtaDestinationType,
  CustomerJourney,
  CustomerJourneyIntent,
  ObservedCta,
  ScrapedWebsiteData,
  SiteFactEvidence,
} from "./types";

const UTILITY_HEADINGS = /^(home|about|services|products|contact|contact us|learn more|read more|welcome|menu|gallery|our team|faq|frequently asked questions)$/i;

function clean(value: string, limit = 160): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function uniqueBy<T>(items: T[], key: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const normalized = key(item).toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function inferOfferingKind(
  value: string,
  sourceRole: string | undefined,
): BusinessOffering["kind"] {
  if (sourceRole === "pricing" && /\b(room|stay|suite|venue|tour|experience|dining)\b/i.test(value)) {
    return "experience";
  }
  if (/\b(product|shop|range|stock|kit|equipment|device|software|subscription)\b/i.test(value)) {
    return "product";
  }
  if (sourceRole === "services" || /\b(service|consult|repair|install|design|audit|care|treatment|hire)\b/i.test(value)) {
    return "service";
  }
  return "unknown";
}

function observedOfferings(scraped: ScrapedWebsiteData): BusinessOffering[] {
  const factOfferings: BusinessOffering[] = [
    ...(scraped.siteFacts?.services ?? []).map((fact) => ({
      name: clean(fact.value),
      kind: inferOfferingKind(fact.value, fact.sourceRole),
      sourceUrl: fact.sourceUrl,
    })),
    ...(scraped.siteFacts?.productCategories ?? []).map((fact) => ({
      name: clean(fact.value),
      kind: "product" as const,
      sourceUrl: fact.sourceUrl,
    })),
  ];

  const pageOfferings: BusinessOffering[] = (scraped.crawl?.pages ?? [])
    .filter((page) => page.role === "services" || page.role === "pricing")
    .flatMap((page) => page.headings ?? [page.primaryHeading ?? ""])
    .map((heading) => clean(heading))
    .filter((heading) => heading.length >= 4 && !UTILITY_HEADINGS.test(heading))
    .map((heading) => ({
      name: heading,
      kind: inferOfferingKind(heading, "services"),
      sourceUrl: scraped.crawl?.pages.find((page) => page.headings?.includes(heading))?.url,
    }));

  return uniqueBy([...factOfferings, ...pageOfferings], (item) => item.name, 16);
}

function observedAudiences(scraped: ScrapedWebsiteData): SiteFactEvidence[] {
  const audiences: SiteFactEvidence[] = [];
  for (const page of scraped.crawl?.pages ?? []) {
    const corpus = [page.description, ...(page.headings ?? []), page.contentSnippet]
      .filter(Boolean)
      .join(" ");
    for (const match of corpus.matchAll(/\b(?:for|serving|helping|built for|designed for)\s+([^.;:]{4,90})/gi)) {
      const value = clean(match[1] ?? "", 90).replace(/\s+(?:with|that|who|and)\s+.*$/i, "");
      if (value.length < 4 || UTILITY_HEADINGS.test(value)) continue;
      audiences.push({ value, sourceUrl: page.url, sourceRole: page.role });
    }
  }
  return uniqueBy(audiences, (item) => item.value, 8);
}

export function inferJourneyIntent(
  cta: Pick<ObservedCta, "label" | "destination">,
  pageText = "",
): CustomerJourneyIntent {
  // Page headings describe other journeys too; only use them to disambiguate Book Now.
  const text = `${cta.label} ${cta.destination ?? ""}`.toLowerCase();
  if (/\b(add to cart|checkout|buy now|shop now|order now|purchase)\b/.test(text)) return "purchase";
  if (/\b(reserve (?:a )?table|table reservation|book (?:a )?table)\b/.test(text)) return "reserve_table";
  if (/\b(view|see|download) (?:the )?menu\b/.test(text)) return "view_menu";
  if (/\b(check availability|book direct|book your stay|room booking|accommodation booking)\b/.test(text)) return "book_stay";
  if (/\b(request|get) (?:a )?quote|estimate|proposal\b/.test(text)) return "request_quote";
  if (/\b(book|schedule) (?:a )?(?:consultation|consult|call)\b|\bfree consultation\b/.test(text)) return "book_consultation";
  if (/\b(book|schedule) (?:an? )?appointment\b/.test(text)) return "book_appointment";
  if (/\b(request|book) (?:a )?demo\b/.test(text)) return "request_demo";
  if (/\b(start|try|begin) (?:a )?(?:free )?trial\b/.test(text)) return "start_trial";
  if (/\bapply now|submit application\b/.test(text)) return "apply";
  if (/\bcall now|call us|phone|tel:|whatsapp\b/.test(text)) return "call";
  if (/\bcontact|send message|get in touch|talk to us|speak to\b/.test(text)) return "contact";
  if (/\bbook now\b/.test(text)) {
    const context = pageText.toLowerCase();
    if (/\b(salon|treatment|beauty|appointment)\b/.test(context)) return "book_appointment";
    if (/\b(room|stay|suite|hotel|lodge|resort|accommodation|chalet|chalets|camping)\b/.test(context)) return "book_stay";
    if (/\b(restaurant|dining|table|menu)\b/.test(context)) return "reserve_table";
    return "unknown";
  }
  if (/\blearn more|read more|explore|view\b/.test(text)) return "learn";
  return "unknown";
}

function journeyStatus(destinationType: CtaDestinationType): CustomerJourney["status"] {
  if (destinationType === "same_origin") return "onsite_step";
  if (["external", "phone", "email", "whatsapp"].includes(destinationType)) return "observed_handoff";
  if (destinationType === "page_action") return "page_action";
  return "unclear";
}

export function buildCustomerJourneys(scraped: ScrapedWebsiteData): CustomerJourney[] {
  const journeys = (scraped.crawl?.pages ?? []).flatMap((page) =>
    (page.ctaEvidence ?? []).map((cta) => ({
      intent: inferJourneyIntent(cta, [page.title, page.description, ...(page.headings ?? [])].join(" ")),
      label: cta.label,
      sourceUrl: page.url,
      destination: cta.destination,
      destinationType: cta.destinationType,
      status: journeyStatus(cta.destinationType),
    })),
  );
  return uniqueBy(
    journeys,
    (journey) => `${journey.intent}|${journey.label}|${journey.destination ?? ""}`,
    20,
  );
}

export function buildBusinessProfile(
  scraped: ScrapedWebsiteData,
  journeys: CustomerJourney[] = buildCustomerJourneys(scraped),
): BusinessProfile {
  const offerings = observedOfferings(scraped);
  const audiences = observedAudiences(scraped);
  const revenueIntents = uniqueBy(
    journeys.map((journey) => journey.intent).filter((intent) => intent !== "learn" && intent !== "unknown"),
    (intent) => intent,
    8,
  );
  const primaryRevenueIntent = revenueIntents[0] ?? "unknown";
  const companyName = scraped.siteFacts?.companyName;
  const summaryParts = [
    companyName,
    offerings.length ? `offers ${offerings.slice(0, 4).map((item) => item.name).join(", ")}` : "",
    audiences.length ? `for ${audiences.slice(0, 2).map((item) => item.value).join(" and ")}` : "",
  ].filter(Boolean);
  const evidenceCount = offerings.length + audiences.length + journeys.length;
  const unknowns = [
    offerings.length === 0 ? "Core offerings were not confidently identified in the reviewed pages." : "",
    revenueIntents.length === 0 ? "No clear revenue or enquiry journey was observed." : "",
    audiences.length === 0 ? "The intended customer was not stated clearly in the reviewed pages." : "",
  ].filter(Boolean);

  return {
    companyName,
    summary: summaryParts.length ? summaryParts.join(" ") : "The reviewed pages do not establish a confident business profile.",
    offerings,
    audiences,
    serviceAreas: scraped.siteFacts?.locations ?? [],
    revenueIntents,
    primaryRevenueIntent,
    mixedBusiness: revenueIntents.length > 1,
    confidence: evidenceCount >= 8 ? "high" : evidenceCount >= 3 ? "medium" : "low",
    unknowns,
  };
}
