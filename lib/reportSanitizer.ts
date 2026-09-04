import type {
  RoastClaim,
  RoastResultPayload,
  ScrapedWebsiteData,
  SiteFactEvidence,
  SiteFacts,
  StoredRoastReport,
  VisualAudit,
  WebsiteScoring,
} from "./types";
import { diagnoseWebsite } from "./diagnosis";
import { buildImplementationBlueprint } from "./implementationGuide";
import { inferSiteNiche } from "./siteContext";

const INTERNAL_DIAGNOSTIC_PATTERN =
  /visual analysis unavailable|browsertype\.launch|playwright install|chrome-headless-shell|looks like playwright was just installed/i;

const CROSS_SITE_CONTAMINATION_PATTERN =
  /\b(?:mobile game|mobile players?|players?\s+(?:to|who|will|can)|download the app|install (?:the )?app|start playing|app-store|app store|google play)\b/i;

const DOMAIN_FAMILY_PATTERNS: Array<{ family: string; pattern: RegExp }> = [
  { family: "professional", pattern: /\b(?:tax consulting|tax compliance|sars|tax dispute|expat(?:riate)? tax|international tax|payroll tax|accounting|accountant|bookkeeping|legal services?|attorneys?|law firm|consulting)\b/i },
  { family: "construction", pattern: /\b(?:construction|building services?|renovations?|paving|demolition|rubble removal|site clearing|rock breaking|blasting|plant hire|roofing|waterproofing|cladding)\b/i },
  { family: "landscaping", pattern: /\b(?:landscap(?:e|ing)|garden maintenance|instant lawn|tree felling|irrigation|water features?|bomas?)\b/i },
  { family: "solar_security", pattern: /\b(?:solar|inverter|battery|batteries|backup power|cctv|security|alarm|access control|electric fence)\b/i },
  { family: "healthcare", pattern: /\b(?:clinic|doctor|medical|healthcare|dentist|dental|patient|treatment|practice)\b/i },
  { family: "creative", pattern: /\b(?:web design|branding|marketing|creative agency|studio|advertising|campaign)\b/i },
];

function isInternalDiagnosticLine(value: string) {
  return INTERNAL_DIAGNOSTIC_PATTERN.test(value);
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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
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

function cleanReportText(value: string): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLines(lines: string[]) {
  return lines
    .map(cleanReportText)
    .filter((line) => line && !isInternalDiagnosticLine(line));
}

function preferredCtaForSite(
  scraped: ScrapedWebsiteData | undefined,
  scoring: WebsiteScoring | undefined,
): string {
  if (scraped && scoring) {
    return buildImplementationBlueprint(scraped, scoring).primaryCta;
  }

  const detected = scraped?.ctas.find((cta) =>
    /\b(?:shop|cart|checkout|buy|order|quote|consultation|appointment|call|contact|estimate|book|request)\b/i.test(cta),
  );

  return detected ? cleanReportText(detected) : "Request a Quote";
}

function isMobileGameContext(scraped: ScrapedWebsiteData | undefined): boolean {
  return scraped ? inferSiteNiche(scraped) === "mobile_game" : false;
}

function isEcommerceContext(scraped: ScrapedWebsiteData | undefined): boolean {
  return scraped ? inferSiteNiche(scraped) === "ecommerce" : false;
}

function supportedDomainFamilies(scraped: ScrapedWebsiteData | undefined): Set<string> | null {
  if (!scraped) {
    return null;
  }

  const evidence = [
    scraped.url,
    scraped.title,
    scraped.description,
    scraped.headings.h1.join(" "),
    scraped.headings.h2.slice(0, 8).join(" "),
    scraped.contentSnippet,
    ...(scraped.siteFacts?.services ?? []).map((fact) => fact.value),
    ...(scraped.siteFacts?.productCategories ?? []).map((fact) => fact.value),
  ].join(" ");
  const supported = new Set<string>();

  for (const item of DOMAIN_FAMILY_PATTERNS) {
    if (item.pattern.test(evidence)) {
      supported.add(item.family);
    }
  }

  const niche = inferSiteNiche(scraped);
  if (niche === "professional_service") supported.add("professional");
  if (niche === "healthcare") supported.add("healthcare");
  if (niche === "creative_agency") supported.add("creative");
  if (niche === "ecommerce") supported.add("solar_security");

  return supported.size ? supported : null;
}

function hasUnsupportedDomainLanguage(value: string, scraped: ScrapedWebsiteData | undefined): boolean {
  const supported = supportedDomainFamilies(scraped);
  if (!supported) {
    return false;
  }

  return DOMAIN_FAMILY_PATTERNS.some(
    (item) => item.pattern.test(value) && !supported.has(item.family),
  );
}

function scrubCrossSiteContamination(
  value: string,
  options: {
    scraped?: ScrapedWebsiteData;
    scoring?: WebsiteScoring;
  } = {},
): string {
  let cleaned = cleanReportText(value);
  if (!cleaned) {
    return cleaned;
  }

  if (!isMobileGameContext(options.scraped)) {
    const cta = preferredCtaForSite(options.scraped, options.scoring);
    cleaned = cleaned
      .replace(/\bDownload The App\b/gi, cta)
      .replace(/\bdownload (?:the )?app\b/gi, cta.toLowerCase())
      .replace(/\binstall (?:the )?app\b/gi, "take the next step")
      .replace(/\bstart playing\b/gi, "take action")
      .replace(/\bmobile game buyers?\b/gi, "buyers")
      .replace(/\bmobile players?\b/gi, "buyers")
      .replace(/\bplayers\b/gi, "buyers")
      .replace(/\bapp-store\b/gi, "trust")
      .replace(/\bapp store\b/gi, "trust")
      .replace(/\bgoogle play\b/gi, "trust");
  }

  if (isEcommerceContext(options.scraped)) {
    const cta = preferredCtaForSite(options.scraped, options.scoring);
    cleaned = cleaned
      .replace(/\bRequest a Quote\b/gi, cta)
      .replace(/\brequest a quote\b/gi, cta.toLowerCase())
      .replace(/\bquote ask\b/gi, "buying path")
      .replace(/\bquote path\b/gi, "buying path")
      .replace(/\benquir(?:y|ies)\b/gi, "purchase intent")
      .replace(/\bqualified leads\b/gi, "qualified buyers")
      .replace(/\blead quality\b/gi, "buyer confidence")
      .replace(/\bleads\b/gi, "buyers")
      .replace(/\bcompleted-work proof cards?\b/gi, "product proof cards")
      .replace(/\bcompleted-work proof\b/gi, "product proof")
      .replace(/\bproject photos?\b/gi, "product photos")
      .replace(/\bservice buyers?\b/gi, "product buyers")
      .replace(/\bservice list\b/gi, "product catalogue")
      .replace(/\bservice in\b/gi, "product range in")
      .replace(/\bsite visit\b/gi, "product selection help");
  }

  for (const exclusion of options.scraped?.siteFacts?.exclusions ?? []) {
    const valuePattern = new RegExp(
      `\\b${cleanReportText(exclusion.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    cleaned = cleaned.replace(valuePattern, "the services this site actually offers");
  }

  return cleanReportText(cleaned);
}

function hasCrossSiteContamination(
  value: string,
  scraped: ScrapedWebsiteData | undefined,
): boolean {
  return !isMobileGameContext(scraped) && CROSS_SITE_CONTAMINATION_PATTERN.test(value);
}

function cleanGroundedLines(
  lines: string[],
  options: {
    scraped?: ScrapedWebsiteData;
    scoring?: WebsiteScoring;
  } = {},
) {
  return lines
    .map((line) => scrubCrossSiteContamination(line, options))
    .filter(
      (line) =>
        line &&
        !isInternalDiagnosticLine(line) &&
        !hasCrossSiteContamination(line, options.scraped) &&
        !hasUnsupportedDomainLanguage(line, options.scraped),
    );
}

function cleanClaimContract(
  claims: RoastClaim[] | undefined,
  options: {
    scraped?: ScrapedWebsiteData;
    scoring?: WebsiteScoring;
  } = {},
) {
  if (!claims) {
    return undefined;
  }

  return claims
    .map((claim) => ({
      ...claim,
      claim: scrubCrossSiteContamination(claim.claim, options),
      evidence: scrubCrossSiteContamination(claim.evidence, options),
    }))
    .filter(
      (claim) =>
        claim.claim &&
        claim.evidence &&
        !isInternalDiagnosticLine(claim.claim) &&
        !isInternalDiagnosticLine(claim.evidence),
    );
}

function cleanFactList(facts: SiteFactEvidence[]): SiteFactEvidence[] {
  return facts
    .map((fact) => ({
      ...fact,
      value: cleanReportText(fact.value),
      sourceUrl: fact.sourceUrl ? cleanReportText(fact.sourceUrl) : undefined,
    }))
    .filter(
      (fact) =>
        fact.value &&
        !isInternalDiagnosticLine(fact.value) &&
        (!fact.sourceUrl || !isInternalDiagnosticLine(fact.sourceUrl)),
    );
}

function sanitizeSiteFacts(siteFacts: SiteFacts | undefined): SiteFacts | undefined {
  if (!siteFacts) {
    return undefined;
  }

  return {
    ...siteFacts,
    companyName: siteFacts.companyName
      ? cleanReportText(siteFacts.companyName)
      : undefined,
    services: cleanFactList(siteFacts.services),
    productCategories: cleanFactList(siteFacts.productCategories ?? []),
    exclusions: cleanFactList(siteFacts.exclusions ?? []),
    locations: cleanFactList(siteFacts.locations),
    contacts: cleanFactList(siteFacts.contacts),
    ctas: cleanFactList(siteFacts.ctas),
    trustSignals: cleanFactList(siteFacts.trustSignals),
    pagesReviewed: cleanFactList(siteFacts.pagesReviewed),
    copyIssues: cleanFactList(siteFacts.copyIssues),
  };
}

export function sanitizeVisualAudit(visualAudit: VisualAudit | undefined) {
  if (!visualAudit) {
    return undefined;
  }

  return {
    ...visualAudit,
    reason: visualAudit.reason && isInternalDiagnosticLine(visualAudit.reason)
      ? "visual rendering is unavailable in this environment"
      : visualAudit.reason,
    findings: cleanLines(visualAudit.findings),
    evidence: cleanLines(visualAudit.evidence),
  };
}

export function sanitizeScrapedWebsiteData(
  scraped: ScrapedWebsiteData,
): ScrapedWebsiteData {
  return {
    ...scraped,
    title: cleanReportText(scraped.title),
    description: cleanReportText(scraped.description),
    headings: {
      h1: cleanLines(scraped.headings.h1),
      h2: cleanLines(scraped.headings.h2),
    },
    content: cleanReportText(scraped.content),
    contentSnippet: cleanReportText(scraped.contentSnippet),
    ctas: cleanLines(scraped.ctas),
    trustSignals: cleanLines(scraped.trustSignals),
    contactSignals: cleanLines(scraped.contactSignals),
    genericPhrasesFound: cleanLines(scraped.genericPhrasesFound),
    visualAudit: sanitizeVisualAudit(scraped.visualAudit),
    siteFacts: sanitizeSiteFacts(scraped.siteFacts),
  };
}

export function sanitizeWebsiteScoring(scoring: WebsiteScoring): WebsiteScoring {
  return {
    ...scoring,
    visualDesign: scoring.visualDesign
      ? {
          ...scoring.visualDesign,
          summary: cleanReportText(scoring.visualDesign.summary),
          factors: cleanLines(scoring.visualDesign.factors),
        }
      : undefined,
    findings: cleanLines(scoring.findings),
    evidence: cleanLines(scoring.evidence),
    penalties: scoring.penalties.filter(
      (penalty) => !isInternalDiagnosticLine(penalty.reason),
    ),
    bonuses: scoring.bonuses.filter(
      (bonus) => !isInternalDiagnosticLine(bonus.reason),
    ),
  };
}

export function sanitizeRoastPayload(
  roast: RoastResultPayload,
  scraped?: ScrapedWebsiteData,
  scoring?: WebsiteScoring,
): RoastResultPayload {
  const options = { scraped, scoring };
  const diagnosis = scraped && scoring ? diagnoseWebsite(scraped, scoring) : roast.diagnosis;
  return {
    ...roast,
    diagnosis,
    first_impression: scrubCrossSiteContamination(roast.first_impression, options),
    single_biggest_leak: scrubCrossSiteContamination(roast.single_biggest_leak, options),
    mistakes: cleanGroundedLines(roast.mistakes, options),
    lost_customers: scrubCrossSiteContamination(roast.lost_customers, options),
    quick_fixes: cleanGroundedLines(roast.quick_fixes, options),
    high_impact: scrubCrossSiteContamination(roast.high_impact, options),
    tone_summary: scrubCrossSiteContamination(roast.tone_summary, options),
    evidence: cleanGroundedLines(roast.evidence, options),
    claim_contract: cleanClaimContract(roast.claim_contract, options),
  };
}

export function sanitizeStoredRoastReport(
  report: StoredRoastReport,
): StoredRoastReport {
  return {
    ...report,
    scraped: sanitizeScrapedWebsiteData(report.scraped),
    scoring: sanitizeWebsiteScoring(report.scoring),
    roast: sanitizeRoastPayload(report.roast, report.scraped, report.scoring),
  };
}
