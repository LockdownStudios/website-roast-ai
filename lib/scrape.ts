import type {
  CrawlPageRole,
  CrawlPageSummary,
  CrawlStrategy,
  ScrapeQuality,
  ScrapedWebsiteData,
  VisualHints,
} from "./types";

const MAX_CONTENT_CHARS = 7000;
const MAX_SNIPPET_CHARS = 1500;
const ABOVE_FOLD_CHARS = 5000;
const MAX_LINES = 320;
const MAX_FETCH_ATTEMPTS = 2;
const MAX_TOTAL_PAGES = 4;
const MAX_ADDITIONAL_PAGES = MAX_TOTAL_PAGES - 1;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const CTA_PHRASES = [
  "contact us",
  "contact",
  "get quote",
  "get a quote",
  "get your cv now",
  "book now",
  "book a first conversation",
  "book appointment",
  "book consultation",
  "book a consultation",
  "call now",
  "call us",
  "start now",
  "get started",
  "start building",
  "start building your cv",
  "free consultation",
  "request a quote",
  "request demo",
  "book a demo",
  "buy now",
  "shop now",
  "view now",
  "learn more",
  "send message",
  "let's chat",
  "lets chat",
  "launch your project",
  "explore features",
  "sign up",
  "schedule a call",
  "start free trial",
  "apply now",
  "explore services",
  "view services",
  "speak to an advisor",
  "talk to us",
];

const TRUST_PHRASES = [
  "testimonials",
  "testimonial",
  "trusted by",
  "years experience",
  "years of experience",
  "case studies",
  "case study",
  "since",
  "certified",
  "guarantee",
  "verified",
  "licensed",
  "insured",
  "accredited",
  "award",
  "5-star",
  "five-star",
  "google reviews",
  "what clients say",
  "client testimonials",
  "customer testimonials",
];

const GENERIC_PHRASES = [
  "quality service",
  "affordable prices",
  "we care",
  "customer satisfaction",
  "professional team",
  "best solutions",
  "tailored solutions",
  "high quality",
];

const BOILERPLATE_PHRASES = [
  "privacy policy",
  "terms and conditions",
  "all rights reserved",
  "cookie settings",
  "cookie policy",
  "accept all cookies",
  "reject all cookies",
  "skip to content",
  "subscribe to newsletter",
  "sitemap",
  "copyright",
  "powered by",
];

const LOW_SIGNAL_MENU_WORDS = new Set([
  "home",
  "about",
  "services",
  "products",
  "blog",
  "contact",
  "pricing",
  "portfolio",
  "features",
  "support",
  "login",
  "register",
  "sign in",
  "sign up",
  "faq",
  "terms",
  "privacy",
  "policy",
]);

type VisibleTextResult = {
  text: string;
  usedRelaxedFallback: boolean;
};

type AnchorSignal = {
  text: string;
  href: string;
};

type FetchWithRetryResult = {
  response: Response;
  retryUsed: boolean;
};

type BrowserTypeLike = {
  launch: (options: {
    headless?: boolean;
    args?: string[];
  }) => Promise<BrowserLike>;
};

type BrowserLike = {
  close: () => Promise<void>;
  newContext: (options: {
    viewport: { width: number; height: number };
    userAgent?: string;
  }) => Promise<BrowserContextLike>;
};

type BrowserContextLike = {
  close: () => Promise<void>;
  newPage: () => Promise<PageLike>;
};

type PageLike = {
  goto: (
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ) => Promise<void>;
  waitForLoadState: (
    state: "networkidle",
    options: { timeout: number },
  ) => Promise<void>;
  waitForTimeout: (timeout: number) => Promise<void>;
  evaluate: <Result>(fn: () => Result) => Promise<Result>;
};

type PageExtractResult = {
  pageUrl: string;
  role: CrawlPageRole;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  content: string;
  anchors: AnchorSignal[];
  visible: VisibleTextResult;
  retryUsed: boolean;
  html: string;
  renderedFallbackUsed: boolean;
};

type CandidatePage = {
  url: string;
  role: CrawlPageRole;
  score: number;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(input: string): string {
  return normalizeWhitespace(
    input
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function extractTagContent(html: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const values: string[] = [];
  let match = regex.exec(html);

  while (match) {
    const cleaned = decodeEntities(match[1].replace(/<[^>]+>/g, " "));
    if (cleaned) {
      values.push(cleaned);
    }
    match = regex.exec(html);
  }

  return values;
}

function extractAnchorSignals(html: string): AnchorSignal[] {
  const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const results: AnchorSignal[] = [];
  let match = regex.exec(html);

  while (match) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch || !hrefMatch[1]) {
      match = regex.exec(html);
      continue;
    }

    const text = decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, " "));
    const href = normalizeWhitespace(hrefMatch[1]);
    if (!href) {
      match = regex.exec(html);
      continue;
    }

    results.push({ text, href });
    match = regex.exec(html);
  }

  return results.slice(0, 800);
}

function toAbsoluteUrl(baseUrl: string, href: string): string | null {
  const trimmed = normalizeWhitespace(href);
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.startsWith("#") ||
    /^mailto:/i.test(trimmed) ||
    /^tel:/i.test(trimmed) ||
    /^javascript:/i.test(trimmed) ||
    /^data:/i.test(trimmed)
  ) {
    return null;
  }

  try {
    const absolute = new URL(trimmed, baseUrl);
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
      return null;
    }
    absolute.hash = "";
    return absolute.toString();
  } catch {
    return null;
  }
}

function urlKey(value: string): string {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}${parsed.search}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function classifyPageRole(url: string): CrawlPageRole {
  const lower = url.toLowerCase();
  if (/(^|\/)(contact|contact-us|contactus)(\/|$)|#contact/.test(lower)) {
    return "contact";
  }
  if (/(^|\/)(about|about-us|team|company|who-we-are)(\/|$)/.test(lower)) {
    return "about";
  }
  if (/(^|\/)(services|solutions|what-we-do|service-areas|products)(\/|$)/.test(lower)) {
    return "services";
  }
  if (/(^|\/)(pricing|plans|packages|quote|request-quote)(\/|$)/.test(lower)) {
    return "pricing";
  }
  return "other";
}

function linkPriorityScore(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;

  if (/(^|\/)(contact|contact-us|contactus)(\/|$)/.test(lower)) score += 12;
  if (/(^|\/)(services|solutions|what-we-do|products)(\/|$)/.test(lower)) score += 10;
  if (/(^|\/)(about|about-us|team|company)(\/|$)/.test(lower)) score += 9;
  if (/(^|\/)(pricing|plans|packages|quote|request-quote)(\/|$)/.test(lower)) score += 8;
  if (/(testimonials|reviews|case-studies|case-study|clients)/.test(lower)) score += 6;
  if (/(faq|process|how-it-works)/.test(lower)) score += 4;
  if (/(blog|news|press|privacy|terms|cookie|careers|jobs|legal)/.test(lower)) score -= 8;

  const slashCount = (lower.match(/\//g) ?? []).length;
  if (slashCount <= 4) {
    score += 2;
  }

  return score;
}

function rankInternalCandidatePages(
  baseUrl: string,
  anchors: AnchorSignal[],
): CandidatePage[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const bestByUrl = new Map<string, CandidatePage>();

  for (const anchor of anchors) {
    const absolute = toAbsoluteUrl(baseUrl, anchor.href);
    if (!absolute) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      continue;
    }

    if (parsed.origin !== base.origin) {
      continue;
    }

    const key = urlKey(parsed.toString());
    const homeKey = urlKey(base.toString());
    if (key === homeKey) {
      continue;
    }

    const role = classifyPageRole(parsed.toString());
    const priority = linkPriorityScore(parsed.toString());
    if (priority <= 0) {
      continue;
    }

    const current = bestByUrl.get(key);
    if (!current || priority > current.score) {
      bestByUrl.set(key, {
        url: parsed.toString(),
        role,
        score: priority,
      });
    }
  }

  return [...bestByUrl.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_ADDITIONAL_PAGES);
}

function extractMetaDescription(html: string): string {
  const metaTags = html.match(/<meta[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const nameMatch = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);

    if (!nameMatch || !contentMatch) {
      continue;
    }

    const name = nameMatch[1].toLowerCase();
    if (name === "description" || name === "og:description") {
      const value = decodeEntities(contentMatch[1]);
      if (value) {
        return value;
      }
    }
  }

  return "No meta description found.";
}

function stripNonContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function stripLowSignalHtmlSections(html: string): string {
  return html
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(
      /<([a-z0-9]+)[^>]*(?:id|class)\s*=\s*["'][^"']*(?:nav|menu|footer|cookie|consent|breadcrumb|sidebar|share|social|pagination|comments)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    );
}

function getBodyChunk(html: string, limit: number): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  return body.slice(0, limit);
}

function detectPhraseHits(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();

  for (const phrase of phrases) {
    if (lower.includes(phrase)) {
      hits.add(phrase);
    }
  }

  return [...hits];
}

function detectTrustSignals(text: string): string[] {
  const corpus = text.toLowerCase();
  const hits = new Set<string>(detectPhraseHits(corpus, TRUST_PHRASES));

  // Contextual proof cues. Avoid generic "review"/"client" mentions unless proof context exists.
  if (/\b(client|customer)\s+reviews?\b/.test(corpus)) {
    hits.add("client reviews");
  }
  if (/\bwhat clients say\b/.test(corpus)) {
    hits.add("what clients say");
  }
  if (/\b\d(?:\.\d)?\s*\/\s*5\b/.test(corpus) || /\b[4-5](?:\.\d)?\s*stars?\b/.test(corpus)) {
    hits.add("rating proof");
  }
  if (/\b\d+\+?\s+years?\s+(?:of\s+)?experience\b/.test(corpus)) {
    hits.add("years of experience");
  }

  return [...hits].slice(0, 20);
}

function isLikelyCtaAnchorText(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower || lower.length < 3) {
    return false;
  }
  if (isBoilerplateLine(text)) {
    return false;
  }
  if (isLikelyMenuLine(text) && !/(book|quote|call|consult|demo|apply|contact)/i.test(lower)) {
    return false;
  }

  return (
    CTA_PHRASES.some((phrase) => lower.includes(phrase)) ||
    /\b(book|schedule|quote|call|consult|demo|trial|apply|get started|sign up|contact|talk|speak|explore services|view services)\b/.test(
      lower,
    )
  );
}

function ctaPriority(signal: string): number {
  const lower = signal.toLowerCase();

  if (/\b(book|schedule)\b.*\b(consultation|call|appointment|conversation|demo)\b/.test(lower)) {
    return 105;
  }
  if (/\b(book your free call|book your free consultation|free consultation)\b/.test(lower)) {
    return 104;
  }
  if (/\b(get|request)\s+(a\s+)?quote\b|\bbook\s+(a\s+)?demo\b|\brequest demo\b/.test(lower)) {
    return 98;
  }
  if (/\b(buy now|shop now|start free trial|start trial|sign up|apply now|get started|start now)\b/.test(lower)) {
    return 92;
  }
  if (/\b(call now|call us|talk to us|speak to an advisor|let'?s chat|lets chat)\b/.test(lower)) {
    return 78;
  }
  if (/\b(send message|chat|explore services|view services)\b/.test(lower)) {
    return 56;
  }
  if (/\b(learn more|view now|view|explore|discover|read more)\b/.test(lower)) {
    return 36;
  }
  if (/\b(contact us|contact)\b/.test(lower)) {
    return 18;
  }

  return 0;
}

function normalizeDetectedCtaSignal(signal: string): string | null {
  const cleaned = normalizeWhitespace(signal).toLowerCase();
  if (!cleaned) {
    return null;
  }

  const genericActionMatch = cleaned.match(
    /\b(learn more|read more|view services|explore services|contact us|send message|call us)\b/i,
  );
  if (genericActionMatch && cleaned.length > 40) {
    return genericActionMatch[0].toLowerCase();
  }

  if (cleaned.length <= 90) {
    return cleaned;
  }

  const matchedPhrase = CTA_PHRASES
    .filter((phrase) => cleaned.includes(phrase))
    .sort((left, right) => right.length - left.length)[0];

  if (matchedPhrase) {
    return matchedPhrase;
  }

  const matchedAction = cleaned.match(
    /\b(book\s+(?:your\s+)?(?:free\s+)?(?:consultation|call)|schedule\s+(?:a\s+)?call|get\s+(?:a\s+)?quote|request\s+(?:a\s+)?quote|book\s+(?:a\s+)?demo|start\s+free\s+trial|get\s+started|sign\s+up|apply\s+now|call\s+us|talk\s+to\s+us|speak\s+to\s+an\s+advisor|send\s+message|contact\s+us|learn\s+more|view\s+services|explore\s+services)\b/i,
  );

  return matchedAction ? matchedAction[0].toLowerCase() : cleaned.slice(0, 90);
}

function rankCtaSignals(signals: string[]): string[] {
  const bestBySignal = new Map<string, { signal: string; priority: number }>();

  for (const signal of signals) {
    const normalized = normalizeDetectedCtaSignal(signal);
    if (!normalized) {
      continue;
    }

    const priority = ctaPriority(normalized);
    if (priority <= 0) {
      continue;
    }

    const existing = bestBySignal.get(normalized);
    if (!existing || priority > existing.priority) {
      bestBySignal.set(normalized, { signal: normalized, priority });
    }
  }

  return [...bestBySignal.values()]
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.signal.length - right.signal.length;
    })
    .map((item) => item.signal);
}

function detectCtaSignals(corpusText: string, anchors: AnchorSignal[]): string[] {
  const hits = [...detectPhraseHits(corpusText, CTA_PHRASES)];

  for (const anchor of anchors) {
    const anchorText = normalizeWhitespace(anchor.text);
    if (!anchorText) {
      continue;
    }
    if (isLikelyCtaAnchorText(anchorText)) {
      hits.push(anchorText);
    }
  }

  return rankCtaSignals(hits).slice(0, 24);
}

function normalizePhoneCandidate(phone: string): string | null {
  const compact = phone.replace(/[^\d+]/g, "");
  const digitCount = compact.replace(/\D/g, "").length;

  if (digitCount < 8 || digitCount > 15) {
    return null;
  }

  if (/(\d)\1{6,}/.test(compact)) {
    return null;
  }

  const human = normalizeWhitespace(phone);
  if (human.length > 24) {
    return null;
  }

  return human;
}

function extractContactSignals(
  html: string,
  text: string,
  anchors: AnchorSignal[],
): string[] {
  const textEmails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const textPhonesRaw = text.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) ?? [];

  const mailtoEmails =
    [...html.matchAll(/href=["']mailto:([^"'>\s?#]+)[^"']*["']/gi)]
      .map((match) => match[1])
      .filter(Boolean) ?? [];

  const telPhones =
    [...html.matchAll(/href=["']tel:([^"'>\s?#]+)[^"']*["']/gi)]
      .map((match) => match[1])
      .filter(Boolean) ?? [];

  const emails = [...textEmails, ...mailtoEmails];
  const phonesRaw = [...textPhonesRaw, ...telPhones];

  const normalizedEmails = [...new Set(emails.map((email) => email.toLowerCase().trim()))]
    .slice(0, 5)
    .map((email) => `Email: ${email}`);

  const normalizedPhoneCandidates = phonesRaw
    .map((phone) => normalizePhoneCandidate(phone))
    .filter((phone): phone is string => Boolean(phone));
  const normalizedPhones = [...new Set(normalizedPhoneCandidates)]
    .slice(0, 5)
    .map((phone) => `Phone: ${phone}`);

  const contactPageLinks = anchors
    .map((anchor) => anchor.href)
    .filter((href) =>
      /(^|\/)(contact|contact-us|contactus)(\/|$)|#contact\b|\/contact\/?/i.test(
        href,
      ),
    )
    .slice(0, 4)
    .map((href) => `Contact page: ${href}`);

  return [...normalizedEmails, ...normalizedPhones, ...new Set(contactPageLinks)];
}

function lineContainsSignals(lineLower: string): boolean {
  const hasCta = CTA_PHRASES.some((phrase) => lineLower.includes(phrase));
  const hasTrust = TRUST_PHRASES.some((phrase) => lineLower.includes(phrase));
  const hasContact =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(lineLower) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(lineLower);
  return hasCta || hasTrust || hasContact;
}

function isLikelyMenuLine(line: string): boolean {
  const normalized = line.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return true;
  }

  if (words.length > 3) {
    return false;
  }

  if (lineContainsSignals(normalized)) {
    return false;
  }

  const allMenuWords = words.every((word) => LOW_SIGNAL_MENU_WORDS.has(word));
  if (allMenuWords) {
    return true;
  }

  return false;
}

function isBoilerplateLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (BOILERPLATE_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }

  if (/^copyright\s*\d{4}/i.test(lower)) {
    return true;
  }

  return false;
}

function extractVisibleText(html: string): VisibleTextResult {
  const withoutNonContent = stripNonContent(html);
  const bodyOnly = getBodyChunk(withoutNonContent, 150000);
  const strippedSections = stripLowSignalHtmlSections(bodyOnly);

  const withLineBreaks = strippedSections
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6]|\/tr|\/td)>/gi, "\n")
    .replace(/<(p|div|section|article|li|h[1-6]|tr|td|main|header|form)[^>]*>/gi, "\n");

  const rawText = decodeEntities(withLineBreaks.replace(/<[^>]+>/g, " "));
  const lines = rawText
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const unique = new Set<string>();
  const filteredLines: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (unique.has(lower)) {
      continue;
    }
    unique.add(lower);

    if (line.length < 2) {
      continue;
    }

    if (isBoilerplateLine(line)) {
      continue;
    }

    if (isLikelyMenuLine(line)) {
      continue;
    }

    filteredLines.push(line);
    if (filteredLines.length >= MAX_LINES) {
      break;
    }
  }

  const joined = normalizeWhitespace(filteredLines.join(" "));
  if (joined.length >= 300) {
    return {
      text: joined,
      usedRelaxedFallback: false,
    };
  }

  // Fallback when aggressive filtering strips too much from JS-heavy or card-grid pages.
  const relaxedRaw = decodeEntities(bodyOnly.replace(/<[^>]+>/g, " "));
  return {
    text: normalizeWhitespace(relaxedRaw),
    usedRelaxedFallback: true,
  };
}

function detectVisualHints(
  html: string,
  firstH1: string | undefined,
  anchors: AnchorSignal[],
): VisualHints {
  const bodyChunk = getBodyChunk(stripNonContent(html), ABOVE_FOLD_CHARS);
  const aboveFoldText = decodeEntities(bodyChunk.replace(/<[^>]+>/g, " "));
  const aboveFoldLower = aboveFoldText.toLowerCase();
  const h1Early =
    typeof firstH1 === "string" &&
    firstH1.trim().length > 0 &&
    bodyChunk.toLowerCase().includes(firstH1.toLowerCase().slice(0, 24));

  const formIndex = bodyChunk.search(/<form\b/i);
  const buttonCount = (html.match(/<button\b/gi) ?? []).length;
  const linkCount = (html.match(/<a\b/gi) ?? []).length;

  const aboveFoldAnchorText = anchors
    .filter((anchor) => bodyChunk.includes(anchor.href) || bodyChunk.includes(anchor.text))
    .map((anchor) => anchor.text.toLowerCase())
    .join(" ");
  const aboveFoldCorpus = `${aboveFoldLower} ${aboveFoldAnchorText}`;

  return {
    aboveFoldCtaLikely:
      CTA_PHRASES.some((phrase) => aboveFoldCorpus.includes(phrase)) ||
      /\b(book|schedule|quote|consult|call|apply|get started|sign up|contact|demo)\b/.test(
        aboveFoldCorpus,
      ),
    heroHeadingEarly: h1Early,
    formAboveFoldLikely: formIndex >= 0,
    trustTokenAboveFold: TRUST_PHRASES.some((phrase) => aboveFoldCorpus.includes(phrase)),
    buttonCount,
    linkCount,
  };
}

function getErrorReason(error: unknown): string {
  const reasonFromMessage =
    error instanceof Error && error.message ? error.message : "";
  const reasonFromCause =
    error &&
    typeof error === "object" &&
    "cause" in error &&
    error.cause &&
    typeof error.cause === "object" &&
    "message" in error.cause &&
    typeof error.cause.message === "string"
      ? error.cause.message
      : "";

  return reasonFromCause || reasonFromMessage || "unknown reason";
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

function computeScrapeQuality(input: {
  title: string;
  description: string;
  headingCount: number;
  contentLength: number;
  signalCount: number;
  usedRelaxedFallback: boolean;
  pageCount: number;
  failedPageCount: number;
}): ScrapeQuality {
  let points = 0;

  const titleExists = input.title !== "No title found." && input.title.trim().length >= 8;
  const descriptionExists =
    input.description !== "No meta description found." &&
    input.description.trim().length >= 20;

  if (titleExists) points += 1;
  if (descriptionExists) points += 1;
  if (input.headingCount >= 1) points += 1;
  if (input.headingCount >= 3) points += 1;
  if (input.contentLength >= 350) points += 2;
  if (input.contentLength >= 1200) points += 1;
  if (input.signalCount >= 1) points += 1;
  if (input.signalCount >= 3) points += 1;
  if (input.pageCount >= 2) points += 1;
  if (input.pageCount >= 3) points += 1;
  if (input.failedPageCount >= 1) points -= 1;
  if (input.usedRelaxedFallback) points -= 2;
  if (input.contentLength < 160) points -= 2;

  const bounded = Math.max(0, Math.min(9, points));
  if (bounded >= 7) {
    return "high";
  }
  if (bounded >= 4) {
    return "medium";
  }
  return "low";
}

async function loadChromium(): Promise<BrowserTypeLike | null> {
  try {
    const playwrightModule = await import("playwright");
    const chromium = playwrightModule.chromium as unknown;
    if (chromium && typeof chromium === "object" && "launch" in chromium) {
      return chromium as BrowserTypeLike;
    }
  } catch {
    return null;
  }

  return null;
}

async function renderHtmlWithBrowser(url: string): Promise<string | null> {
  const chromium = await loadChromium();
  if (!chromium) {
    return null;
  }

  let browser: BrowserLike | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      userAgent: "WebsiteRoastAI/1.0 (+https://local.dev)",
    });

    try {
      const page = await context.newPage();
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
      return await page.evaluate(() => document.documentElement.outerHTML);
    } finally {
      await context.close();
    }
  } catch {
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function shouldUseRenderedFallback(page: PageExtractResult): boolean {
  const headingCount = page.h1.length + page.h2.length;
  return page.content.length < 160 && headingCount === 0 && page.anchors.length === 0;
}

async function fetchWithRetry(url: string): Promise<FetchWithRetryResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "WebsiteRoastAI/1.0 (+https://local.dev)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (response.ok) {
        return {
          response,
          retryUsed: attempt > 1,
        };
      }

      if (attempt < MAX_FETCH_ATTEMPTS && isRetryableStatus(response.status)) {
        continue;
      }

      throw new Error(`Could not fetch website content (HTTP ${response.status}).`);
    } catch (error) {
      lastError = new Error(`Could not fetch website content (${getErrorReason(error)}).`);

      if (attempt < MAX_FETCH_ATTEMPTS) {
        continue;
      }
    }
  }

  throw lastError ?? new Error("Could not fetch website content (unknown reason).");
}

function buildPageExtractResult(
  pageUrl: string,
  role: CrawlPageRole,
  html: string,
  retryUsed: boolean,
  renderedFallbackUsed: boolean,
): PageExtractResult {
  const [title = "No title found."] = extractTagContent(html, "title");
  const h1 = extractTagContent(html, "h1").slice(0, 12);
  const h2 = extractTagContent(html, "h2").slice(0, 20);
  const description = extractMetaDescription(html);
  const anchors = extractAnchorSignals(html);
  const visible = extractVisibleText(html);
  const content = visible.text.slice(0, MAX_CONTENT_CHARS);

  return {
    pageUrl,
    role,
    title,
    description,
    h1,
    h2,
    anchors,
    content,
    visible,
    retryUsed,
    html,
    renderedFallbackUsed,
  };
}

async function extractPage(
  pageUrl: string,
  role: CrawlPageRole,
): Promise<PageExtractResult> {
  const { response, retryUsed } = await fetchWithRetry(pageUrl);
  const html = await response.text();
  const staticPage = buildPageExtractResult(pageUrl, role, html, retryUsed, false);

  if (!shouldUseRenderedFallback(staticPage)) {
    return staticPage;
  }

  const renderedHtml = await renderHtmlWithBrowser(pageUrl);
  if (!renderedHtml) {
    return staticPage;
  }

  const renderedPage = buildPageExtractResult(
    pageUrl,
    role,
    renderedHtml,
    retryUsed,
    true,
  );

  if (
    renderedPage.content.length > staticPage.content.length ||
    renderedPage.anchors.length > staticPage.anchors.length ||
    renderedPage.h1.length + renderedPage.h2.length >
      staticPage.h1.length + staticPage.h2.length
  ) {
    return renderedPage;
  }

  return staticPage;
}

export async function scrapeWebsite(url: string): Promise<ScrapedWebsiteData> {
  const homepage = await extractPage(url, "home");
  const candidates = rankInternalCandidatePages(url, homepage.anchors);
  const additionalPages: PageExtractResult[] = [];
  const failedUrls: string[] = [];

  for (const candidate of candidates) {
    try {
      const page = await extractPage(candidate.url, candidate.role);
      additionalPages.push(page);
    } catch {
      failedUrls.push(candidate.url);
    }
  }

  const pages = [homepage, ...additionalPages].slice(0, MAX_TOTAL_PAGES);

  const titles = pages.map((page) => page.title);
  const descriptions = pages.map((page) => page.description);
  const h1 = [...new Set(pages.flatMap((page) => page.h1))].slice(0, 14);
  const h2 = [...new Set(pages.flatMap((page) => page.h2))].slice(0, 28);
  const combinedContentRaw = pages
    .map((page) => {
      let label = page.role.toUpperCase();
      try {
        const parsed = new URL(page.pageUrl);
        label = `${label} ${parsed.pathname || "/"}`;
      } catch {
        label = page.role.toUpperCase();
      }
      return `[${label}] ${page.content}`;
    })
    .join(" ");
  const content = normalizeWhitespace(combinedContentRaw).slice(0, MAX_CONTENT_CHARS);
  const contentSnippet = content.slice(0, MAX_SNIPPET_CHARS);
  const contentLength = content.length;

  const anchors = pages.flatMap((page) => page.anchors).slice(0, 1200);
  const phraseCorpus = [
    ...titles,
    ...descriptions,
    h1.join(" "),
    h2.join(" "),
    content,
    anchors.map((anchor) => anchor.text).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const ctas = detectCtaSignals(phraseCorpus, anchors);
  const trustSignals = detectTrustSignals(phraseCorpus);
  const contactSignals = [
    ...new Set(
      pages.flatMap((page) =>
        extractContactSignals(page.html, page.content, page.anchors),
      ),
    ),
  ].slice(0, 10);
  const genericPhrasesFound = detectPhraseHits(phraseCorpus, GENERIC_PHRASES);

  const title =
    titles.find((value) => value !== "No title found." && value.trim().length > 0) ??
    "No title found.";
  const description =
    descriptions.find(
      (value) => value !== "No meta description found." && value.trim().length > 0,
    ) ?? "No meta description found.";

  const visualHints = detectVisualHints(homepage.html, homepage.h1[0], homepage.anchors);
  const retryUsed = pages.some((page) => page.retryUsed);
  const usedRelaxedFallback = pages.some((page) => page.visible.usedRelaxedFallback);

  const crawlStrategy: CrawlStrategy = pages.length > 1 ? "multi_page" : "single_page";
  const pageSummaries: CrawlPageSummary[] = pages.map((page) => ({
    url: page.pageUrl,
    role: page.role,
    title: page.title,
    contentLength: page.content.length,
    headingCount: page.h1.length + page.h2.length,
  }));

  const scrapeQuality = computeScrapeQuality({
    title,
    description,
    headingCount: h1.length + h2.length,
    contentLength,
    signalCount:
      ctas.length +
      trustSignals.length +
      contactSignals.length +
      genericPhrasesFound.length,
    usedRelaxedFallback,
    pageCount: pages.length,
    failedPageCount: failedUrls.length,
  });

  return {
    url,
    title,
    description,
    headings: { h1, h2 },
    content,
    contentSnippet,
    ctas,
    trustSignals,
    contactSignals,
    genericPhrasesFound,
    visualHints,
    crawl: {
      strategy: crawlStrategy,
      pageCount: pages.length,
      visitedUrls: pages.map((page) => page.pageUrl),
      failedUrls,
      pages: pageSummaries,
    },
    contentLength,
    retryUsed,
    usedRelaxedFallback,
    scrapeQuality,
  };
}
