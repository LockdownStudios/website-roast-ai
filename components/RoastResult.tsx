import type {
  ReportAccess,
  RoastResultPayload,
  ScrapedWebsiteData,
  WebsiteScoring,
} from "@/lib/types";
import { categoryRatio, CATEGORY_WEIGHTS } from "@/lib/scoringConfig";
import { buildImplementationBlueprint, toQuickFixLines } from "@/lib/implementationGuide";
import { ScoreBadge } from "./ScoreBadge";

type RoastResultProps = {
  roast: RoastResultPayload;
  scoring: WebsiteScoring;
  url: string;
  scraped?: ScrapedWebsiteData;
  isUnlocked: boolean;
  access: ReportAccess;
};

const BREAKDOWN_ITEMS: Array<{
  key: keyof WebsiteScoring["breakdown"];
  label: string;
}> = [
  { key: "clarity", label: "Clarity" },
  { key: "trust", label: "Trust" },
  { key: "CTA", label: "CTA" },
  { key: "differentiation", label: "Differentiation" },
  { key: "design_hint", label: "Structure" },
];

function LockedSection({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="rounded-2xl border border-white/15 bg-black/25 p-5">
      <h2 className="text-xl font-black uppercase tracking-wide text-white/90">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted">{copy}</p>
    </section>
  );
}

function confidenceMeta(confidence: number): {
  label: string;
  toneClass: string;
  description: string;
} {
  if (confidence >= 80) {
    return {
      label: "High confidence",
      toneClass:
        "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
      description:
        "Signal coverage is strong. This roast should be directionally reliable.",
    };
  }

  if (confidence >= 55) {
    return {
      label: "Medium confidence",
      toneClass: "border-amber-300/35 bg-amber-300/10 text-amber-100",
      description:
        "Useful read, but some sections were sparse. Verify key claims before major edits.",
    };
  }

  return {
    label: "Low confidence",
    toneClass: "border-red-300/40 bg-red-300/10 text-red-100",
    description:
      "Scraped data was thin or partially extracted. Treat this as directional and re-run if needed.",
  };
}

function scrapeQualityMeta(quality?: ScrapedWebsiteData["scrapeQuality"]): {
  label: string;
  toneClass: string;
} {
  if (quality === "high") {
    return {
      label: "Scrape quality: high",
      toneClass: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    };
  }
  if (quality === "medium") {
    return {
      label: "Scrape quality: medium",
      toneClass: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    };
  }
  if (quality === "low") {
    return {
      label: "Scrape quality: low",
      toneClass: "border-red-300/35 bg-red-300/10 text-red-100",
    };
  }
  return {
    label: "Scrape quality: unknown",
    toneClass: "border-white/20 bg-white/10 text-white/80",
  };
}

function freshnessMeta(
  freshness: "fresh" | "cached" | undefined,
): { label: string; toneClass: string } {
  if (freshness === "cached") {
    return {
      label: "Cached report",
      toneClass: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    };
  }

  return {
    label: "Fresh analysis",
    toneClass: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  };
}

function visualScoreTone(
  score: number,
  inverse = false,
): { toneClass: string; label: string } {
  const effective = inverse ? 100 - score : score;
  if (effective >= 70) {
    return {
      toneClass: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
      label: inverse ? "Low Risk" : "Strong",
    };
  }
  if (effective >= 45) {
    return {
      toneClass: "border-amber-300/35 bg-amber-300/10 text-amber-100",
      label: inverse ? "Medium Risk" : "Mixed",
    };
  }
  return {
    toneClass: "border-red-300/35 bg-red-300/10 text-red-100",
    label: inverse ? "High Risk" : "Weak",
  };
}

function listItemKey(scope: string, value: string, index: number): string {
  return `${scope}-${index}-${value}`;
}

function isLocalSubject(value: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)($|:)/i.test(value);
}

function reportSubject(url: string, scraped?: ScrapedWebsiteData): string {
  const title = scraped?.title?.trim();
  if (title && title !== "No title found.") {
    return title.replace(/\s+[|-]\s+.*$/, "").slice(0, 64);
  }

  const h1 = scraped?.headings.h1[0]?.trim();
  if (h1) {
    return h1.slice(0, 64);
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return isLocalSubject(host) ? "This page" : host;
  } catch {
    return "This page";
  }
}

function cleanReportText(value: string, subject: string): string {
  if (
    /visual analysis unavailable|browsertype\.launch|playwright install|chrome-headless-shell/i.test(
      value,
    )
  ) {
    return "";
  }

  return value
    .replace(/\blocalhost(?::\d+)?\b/gi, subject)
    .replace(/\b127\.0\.0\.1(?::\d+)?\b/g, subject)
    .replace(/\b0\.0\.0\.0(?::\d+)?\b/g, subject)
    .replace(/\bmay be the pitch\b/gi, "is the pitch")
    .replace(
      /"No trust proof detected"/gi,
      "no visible testimonials, client results, reviews, credentials, or proof near the pitch",
    )
    .replace(
      /\bNo trust proof detected\b/gi,
      "no visible testimonials, client results, reviews, credentials, or proof near the pitch",
    )
    .replace(
      /"No contact path detected"/gi,
      "no obvious email, phone, booking route, or direct contact path",
    )
    .replace(
      /\bNo contact path detected\b/gi,
      "no obvious email, phone, booking route, or direct contact path",
    )
    .replace(/"No strong CTA detected"/gi, "no clear primary CTA")
    .replace(/\bNo strong CTA detected\b/gi, "no clear primary CTA")
    .replace(/\bTrust snapshot:/gi, "Proof gap:")
    .replace(/\bCurrent contact snapshot:/gi, "Contact gap:")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueReportLines(items: string[], subject: string, limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const cleaned = cleanReportText(item, subject);
    const key = normalizeForDedupe(cleaned);
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(cleaned);
  }

  return typeof limit === "number" ? out.slice(0, limit) : out;
}

type ParsedQuickFix = {
  where?: string;
  fix: string;
  impact?: string;
  effort?: string;
  example?: string;
};

function parseQuickFixLine(value: string): ParsedQuickFix {
  const parsed: ParsedQuickFix = { fix: value };
  const fieldPattern = /(?:^|\s+\|\s+)(Where|Fix|Impact|Effort|Example):\s*/g;
  const matches = [...value.matchAll(fieldPattern)];

  if (matches.length === 0) {
    return parsed;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const label = match[1].toLowerCase();
    const start = match.index + match[0].length;
    const end = nextMatch?.index ?? value.length;
    const text = value.slice(start, end).replace(/\s+\|\s*$/, "").trim();

    if (label === "where") parsed.where = text;
    if (label === "fix") parsed.fix = text;
    if (label === "impact") parsed.impact = text;
    if (label === "effort") parsed.effort = text;
    if (label === "example") parsed.example = text;
  }

  return parsed;
}

function roastHeadline(
  toneSummary: string,
  scoring: WebsiteScoring,
): string {
  const normalizedToneSummary = toneSummary
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
  const genericHeadline = /^(you ask for trust before earning it|your page reads, but it does not sell|structure exists, persuasion does not|you are describing the business|this copy sounds like every competitor|decent shell|your page reads)$/i;

  if (toneSummary.length >= 18 && !genericHeadline.test(normalizedToneSummary)) {
    return toneSummary;
  }

  const weakest = [...BREAKDOWN_ITEMS].sort((a, b) => {
    const left = categoryRatio(a.key, scoring.breakdown[a.key]);
    const right = categoryRatio(b.key, scoring.breakdown[b.key]);
    return left - right;
  })[0]?.key;

  switch (weakest) {
    case "trust":
      return "This page asks for trust with empty hands.";
    case "CTA":
      return "The page wants applause when it needs action.";
    case "clarity":
      return "The hero makes buyers do homework before they care.";
    case "differentiation":
      return "The copy could wear a competitor's logo and nobody would notice.";
    case "design_hint":
      return "The page has parts, but no sales spine.";
    default:
      return "The page looks alive, but the sales argument is wheezing.";
  }
}

function contextualRoastLine(
  subject: string,
  scraped: ScrapedWebsiteData | undefined,
  scoring: WebsiteScoring,
): string | null {
  const source = `${subject} ${scraped?.title ?? ""} ${scraped?.description ?? ""}`;
  const sellsAudit = /\b(roast|audit|website|conversion|landing page)\b/i.test(source);
  const trustRatio = categoryRatio("trust", scoring.breakdown.trust);
  const ctaRatio = categoryRatio("CTA", scoring.breakdown.CTA);

  if (sellsAudit && trustRatio < 0.35) {
    return `${subject} is selling website judgment while its own page forgets to bring proof. That is like a fire alarm with dead batteries.`;
  }

  if (trustRatio < 0.35 && ctaRatio < 0.45) {
    return "The page wants buyer confidence while making visitors hunt for proof and a next step. That is not a funnel; it is a trust fall with no one catching.";
  }

  return null;
}

export function RoastResult({
  roast,
  scoring,
  url,
  scraped,
  isUnlocked,
  access,
}: RoastResultProps) {
  const visibleMistakes = roast.mistakes.slice(0, isUnlocked ? roast.mistakes.length : 3);
  const subject = reportSubject(url, scraped);
  const visibleUrl = (() => {
    try {
      const parsed = new URL(url);
      return isLocalSubject(parsed.hostname) ? "Local preview" : url;
    } catch {
      return url;
    }
  })();
  const evidenceLines = uniqueReportLines(
    [...roast.evidence, ...scoring.evidence],
    subject,
    8,
  );
  const confidence = confidenceMeta(scoring.confidence);
  const scrapeQuality = scrapeQualityMeta(scraped?.scrapeQuality);
  const freshness = freshnessMeta(scoring.analysisMeta?.freshness);
  const sourcePageCount =
    scoring.analysisMeta?.sourcePageCount ?? scraped?.crawl?.pageCount ?? 1;
  const crawlStrategy =
    scoring.analysisMeta?.crawlStrategy ?? scraped?.crawl?.strategy ?? "single_page";
  const engineVersion = scoring.analysisMeta?.engineVersion ?? "unknown";
  const visualAudit = scraped?.visualAudit;
  const visualSummary =
    visualAudit && visualAudit.available ? visualAudit.summary : undefined;
  const claimContract = roast.claim_contract ?? [];
  const implementationBlueprint =
    isUnlocked && scraped ? buildImplementationBlueprint(scraped, scoring) : null;
  const brutalTruths = uniqueReportLines(
    implementationBlueprint?.brutalTruths ?? [],
    subject,
    4,
  );
  const mistakeLines = uniqueReportLines(visibleMistakes, subject, isUnlocked ? 5 : 3);
  const quickFixSource = implementationBlueprint
    ? toQuickFixLines(implementationBlueprint, 4)
    : roast.quick_fixes;
  const quickFixLines = uniqueReportLines(quickFixSource, subject, 4);
  const firstImpression = cleanReportText(roast.first_impression, subject);
  const singleBiggestLeak = cleanReportText(roast.single_biggest_leak, subject);
  const lostCustomers = cleanReportText(roast.lost_customers, subject);
  const highImpact = cleanReportText(roast.high_impact, subject);
  const toneSummary = cleanReportText(roast.tone_summary, subject);
  const roastLeadHeadline = roastHeadline(toneSummary, scoring);
  const contextualRoast = contextualRoastLine(subject, scraped, scoring);
  const parsedQuickFixes = quickFixLines.slice(0, 3).map(parseQuickFixLine);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 rounded-3xl border border-white/10 bg-surface/85 p-6 shadow-2xl shadow-black/35 sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Roast Report
          </p>
          <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-white sm:text-6xl">
            {subject}
          </h1>
          <p className="mt-3 break-all text-sm text-muted">{visibleUrl}</p>
        </div>
        <ScoreBadge score={roast.score} label={roast.score_label} />
      </div>

      <section className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-soft">
          The Roast
        </p>
        <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
          {roastLeadHeadline}
        </h2>
        <p className="mt-3 text-lg leading-8 text-white/90">{firstImpression}</p>
        {contextualRoast ? (
          <p className="mt-4 rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base font-semibold leading-7 text-white">
            {cleanReportText(contextualRoast, subject)}
          </p>
        ) : null}
        {brutalTruths.length > 0 ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm font-medium text-white/85">
            {brutalTruths.slice(0, 2).map((truth, index) => (
              <li key={listItemKey("top-brutal-truth", truth, index)}>{truth}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {isUnlocked ? (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-lg font-black uppercase tracking-wide text-accent-soft">
            Score Snapshot
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {BREAKDOWN_ITEMS.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-white/10 bg-background/55 px-3 py-3 text-center"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {scoring.breakdown[item.key].toFixed(1)}
                  <span className="text-sm text-muted">
                    /{CATEGORY_WEIGHTS[item.key]}
                  </span>
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {Math.round(categoryRatio(item.key, scoring.breakdown[item.key]) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <LockedSection
          title="Score Snapshot"
          copy={`Full category scoring and confidence detail unlocks in the paid report (R${access.priceZar}).`}
        />
      )}

      <section className="rounded-2xl border border-accent/35 bg-accent/10 p-5">
        <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
          Single Biggest Leak
        </h2>
        <p className="mt-2 text-base text-white">{singleBiggestLeak}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
          Mistakes
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-white/90">
          {mistakeLines.map((mistake, index) => (
            <li key={listItemKey("mistake", mistake, index)}>{mistake}</li>
          ))}
        </ul>
      </section>

      {isUnlocked ? (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
            Lost Customers
          </h2>
          <p className="mt-2 text-base text-white/90">{lostCustomers}</p>
        </section>
      ) : (
        <LockedSection
          title="Lost Customers"
          copy="Detailed leakage analysis is included in the full paid report."
        />
      )}

      {isUnlocked ? (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
            3 Brutal Fixes
          </h2>
          <div className="mt-4 grid gap-3">
            {parsedQuickFixes.map((fix, index) => (
              <article
                key={listItemKey("quick-fix", fix.fix, index)}
                className="rounded-xl border border-white/12 bg-background/55 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Fix {index + 1}
                    </p>
                    <h3 className="mt-1 text-base font-black text-white">
                      {cleanReportText(fix.fix, subject)}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fix.impact ? (
                      <span className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                        Impact {cleanReportText(fix.impact, subject)}
                      </span>
                    ) : null}
                    {fix.effort ? (
                      <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                        Effort {cleanReportText(fix.effort, subject)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {fix.where ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    Where: {cleanReportText(fix.where, subject)}
                  </p>
                ) : null}
                {fix.example ? (
                  <p className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-white/90">
                    {cleanReportText(fix.example, subject)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <LockedSection
          title="Quick Fixes"
          copy="Action plan and priority fixes unlock with the full report."
        />
      )}

      {isUnlocked ? (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
            High Impact Improvement
          </h2>
          <p className="mt-2 text-base text-white/90">{highImpact}</p>
        </section>
      ) : (
        <LockedSection
          title="High Impact Improvement"
          copy="Unlock your single highest-leverage conversion improvement."
        />
      )}

      {implementationBlueprint ? (
        <section className="rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <h2 className="text-xl font-black uppercase tracking-wide text-accent-soft">
            Implementation Blueprint
          </h2>
          <p className="mt-2 text-sm text-white/80">
            This is your practical fix plan: what to change, where to change it,
            and example copy to start with.
          </p>

          <div className="mt-4 rounded-xl border border-white/12 bg-black/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {implementationBlueprint.primaryCtaSource === "detected"
                ? "Detected Primary CTA"
                : "Recommended Primary CTA"}
            </p>
            <p className="mt-1 text-lg font-black text-white">
              {implementationBlueprint.primaryCta}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/12 bg-black/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Priority Focus
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                {implementationBlueprint.priorities.map((item, index) => (
                  <li key={listItemKey("priority", item, index)}>
                    {cleanReportText(item, subject)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Suggested Structure Order
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                {implementationBlueprint.structureOrder.map((item, index) => (
                  <li key={listItemKey("structure", item, index)}>
                    {cleanReportText(item, subject)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {implementationBlueprint.siteSpecificObservations.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/12 bg-black/25 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Site-Specific Observations
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                {uniqueReportLines(
                  implementationBlueprint.siteSpecificObservations,
                  subject,
                  5,
                ).map((item, index) => (
                  <li key={listItemKey("observation", item, index)}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {implementationBlueprint.fixes.slice(0, 4).map((fix) => (
              <article
                key={`${fix.title}-${fix.where}`}
                className="rounded-xl border border-white/12 bg-black/25 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-black uppercase tracking-[0.13em] text-accent-soft">
                    {cleanReportText(fix.title, subject)}
                  </h3>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                      Impact {fix.impact ?? "Medium"}
                    </span>
                    <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                      Effort {fix.effort ?? "Medium"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Where: {cleanReportText(fix.where, subject)}
                </p>
                <p className="mt-2 text-sm text-white/85">
                  {cleanReportText(fix.why, subject)}
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                  {fix.how.map((step, index) => (
                    <li key={listItemKey(`${fix.title}-step`, step, index)}>
                      {cleanReportText(step, subject)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 rounded-lg border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-white/90">
                  {cleanReportText(fix.example, subject)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/12 bg-black/25 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              7-Day Action Plan
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/85">
              {implementationBlueprint.sevenDayPlan.map((step, index) => (
                <li key={listItemKey("seven-day", step, index)}>
                  {cleanReportText(step, subject)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <LockedSection
          title="Implementation Blueprint"
          copy="Unlock to get exact section-by-section changes, example copy, and a 7-day execution plan."
        />
      )}

      {isUnlocked ? (
        <details className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <summary className="cursor-pointer list-none text-sm font-black uppercase tracking-[0.15em] text-muted">
            Analysis Details
          </summary>
          <div className="mt-4 space-y-5">
            <section>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                  Reliability
                </h2>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${confidence.toneClass}`}
                >
                  {confidence.label}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${scrapeQuality.toneClass}`}
                >
                  {scrapeQuality.label}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${freshness.toneClass}`}
                >
                  {freshness.label}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted">
                Raw score {scoring.rawScore}/100 | confidence {scoring.confidence}%
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                Engine {engineVersion} | {sourcePageCount} page
                {sourcePageCount === 1 ? "" : "s"} analyzed |{" "}
                {crawlStrategy.replace("_", " ")}
              </p>
              <p className="mt-2 text-sm text-white/85">{confidence.description}</p>
              {scraped?.usedRelaxedFallback ? (
                <p className="mt-2 text-xs text-amber-100">
                  Relaxed extraction fallback was used for this site. JS-heavy pages
                  can reduce precision.
                </p>
              ) : null}
            </section>

            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                Visual Leaks
              </h2>
              {visualSummary ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-5">
                    {[
                      { label: "CTA", value: visualSummary.ctaProminence, inverse: false },
                      { label: "Readability", value: visualSummary.readability, inverse: false },
                      { label: "Hierarchy", value: visualSummary.hierarchy, inverse: false },
                      { label: "Consistency", value: visualSummary.consistency, inverse: false },
                      {
                        label: "Motion Risk",
                        value: visualSummary.motionDistraction,
                        inverse: true,
                      },
                    ].map((item) => {
                      const tone = visualScoreTone(item.value, item.inverse);
                      return (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white/10 bg-background/55 px-3 py-3 text-center"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xl font-black text-white">
                            {item.value}
                            <span className="text-sm text-muted">/100</span>
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.toneClass}`}
                          >
                            {tone.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {visualAudit?.findings && visualAudit.findings.length > 0 ? (
                    <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-white/85">
                      {uniqueReportLines(visualAudit.findings, subject, 5).map(
                        (finding, index) => (
                          <li key={listItemKey("visual-finding", finding, index)}>
                            {finding}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Visual analysis was unavailable for this run
                  {visualAudit?.reason ? `: ${visualAudit.reason}` : "."}
                </p>
              )}
            </section>

            {scoring.penalties.length > 0 || scoring.bonuses.length > 0 ? (
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                  Score Drivers
                </h2>
                {scoring.penalties.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-red-200">
                      Penalties
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/80">
                      {scoring.penalties.map((item) => (
                        <li key={`${item.label}-${item.points}-${item.reason}`}>
                          -{item.points}: {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {scoring.bonuses.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-emerald-200">
                      Bonuses
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/80">
                      {scoring.bonuses.map((item) => (
                        <li key={`${item.label}-${item.points}-${item.reason}`}>
                          +{item.points}: {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {evidenceLines.length > 0 ? (
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                  Evidence Used
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/80">
                  {evidenceLines.map((line, index) => (
                    <li key={listItemKey("evidence", line, index)}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {claimContract.length > 0 ? (
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                  Claim Contract
                </h2>
                <p className="mt-2 text-xs text-white/65">
                  Core roast claims mapped to captured evidence.
                </p>
                <div className="mt-3 space-y-2">
                  {claimContract.map((item, index) => (
                    <article
                      key={`${index}-${item.claim}-${item.source}-${item.evidence}`}
                      className="rounded-lg border border-white/12 bg-black/25 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
                          {item.source}
                        </span>
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-white/90">
                        {cleanReportText(item.claim, subject)}
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        {cleanReportText(item.evidence, subject)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {scoring.findings.length > 0 ? (
              <section>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
                  Detected Signals
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/75">
                  {uniqueReportLines(scoring.findings, subject, 6).map(
                    (finding, index) => (
                      <li key={listItemKey("scoring-finding", finding, index)}>
                        {finding}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
