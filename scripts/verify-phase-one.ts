import { generateRoastWithUsage } from "../lib/ai";
import { isClientReadyReport } from "../lib/reportQuality";
import { diagnoseWebsite } from "../lib/diagnosis";
import type { ScrapedWebsiteData, WebsiteScoring } from "../lib/types";

function strongScoring(): WebsiteScoring {
  return {
    score: 9,
    rawScore: 90,
    confidence: 90,
    breakdown: {
      clarity: 25,
      trust: 25,
      CTA: 20,
      differentiation: 20,
      design_hint: 10,
    },
    findings: [],
    evidence: [],
    penalties: [],
    bonuses: [],
    singleBiggestLeak: "No material conversion leak established by the current scan.",
  };
}

function strongSite(input: {
  url: string;
  title: string;
  description: string;
  h1: string;
  h2: string[];
  content: string;
  ctas: string[];
  trustSignals: string[];
}): ScrapedWebsiteData {
  return {
    ...input,
    headings: { h1: [input.h1], h2: input.h2 },
    contentSnippet: input.content,
    contactSignals: ["Phone and email available"],
    genericPhrasesFound: [],
    visualHints: {
      aboveFoldCtaLikely: true,
      heroHeadingEarly: true,
      formAboveFoldLikely: false,
      trustTokenAboveFold: true,
      buttonCount: 4,
      linkCount: 15,
    },
    contentLength: input.content.length,
    retryUsed: false,
    usedRelaxedFallback: false,
    scrapeQuality: "high",
  };
}

async function main() {
  const scoring = strongScoring();
  const lodge = strongSite({
    url: "https://example-lodge.test/",
    title: "Example Lodge | Mountain Accommodation",
    description: "Book mountain rooms directly with clear rates and live availability.",
    h1: "Mountain stays at Example Lodge",
    h2: ["Rooms and rates", "Guest reviews", "Amenities", "Cancellation policy"],
    content:
      "Example Lodge offers rooms, suites, clear rates, live availability, amenities, a gallery, verified guest reviews, secure booking and a cancellation policy.",
    ctas: ["Check Availability", "Book Direct"],
    trustSignals: ["Verified guest reviews", "Secure booking", "Cancellation policy"],
  });
  const lodgeDiagnosis = diagnoseWebsite(lodge, scoring);
  if (lodgeDiagnosis.primaryPainpoints.includes("wrong_cta_for_intent")) {
    throw new Error("Strong lodge was incorrectly assigned a CTA painpoint.");
  }
  if (lodgeDiagnosis.primaryPainpoints.includes("thin_authority_proof")) {
    throw new Error("Strong lodge was incorrectly assigned a trust painpoint.");
  }

  const store = strongSite({
    url: "https://example-store.test/",
    title: "Example Store | Solar Products",
    description: "Shop solar products with stock, prices, delivery and warranty details.",
    h1: "Solar products ready to buy online",
    h2: ["Shop by category", "Best sellers", "Delivery", "Returns and warranty"],
    content:
      "Browse solar panels, batteries and inverters by category. Product cards show price, stock and compatibility. Secure payment, delivery, returns, warranty and support are explained before checkout.",
    ctas: ["Shop Now", "Add to Cart", "Checkout"],
    trustSignals: ["Secure payment", "Warranty", "Verified reviews"],
  });
  const storeDiagnosis = diagnoseWebsite(store, scoring);
  if (storeDiagnosis.primaryPainpoints.includes("poor_product_discovery")) {
    throw new Error("Strong store was assigned product-discovery pain solely by industry.");
  }

  // Synthetic pixels are used only with the mocked provider below; never a live audit.
  const viewport = { width: 1440, height: 900, sampledElementCount: 0, aboveFoldElementCount: 0, ctaCount: 0, primaryCtaAboveFold: false, primaryCtaContrast: 0, primaryCtaAreaRatio: 0, averageTextContrast: 0, lowContrastTextShare: 0, averageFontSize: 16, headingCountAboveFold: 0, uniqueColorBuckets: 0, uniqueFontFamilies: 1, animatedElementShare: 0, autoplayMediaCount: 0, captureReadiness: { settled: true, waitedMs: 0, reasons: [] }, screenshotDataUrl: "data:image/jpeg;base64,YQ==" };
  lodge.visualAudit = { available: true, sampledAt: new Date().toISOString(), findings: [], evidence: [], desktop: { ...viewport, viewport: "desktop" } as NonNullable<typeof lodge.visualAudit>["desktop"], mobile: { ...viewport, viewport: "mobile" } as NonNullable<typeof lodge.visualAudit>["mobile"] };
  for (const [provider, model] of [["openai", "gpt-5.6-terra"], ["openai", "gpt-4o-mini"], ["deepseek", "deepseek-flash"]] as const) {
  const originalKey = process.env.OPENAI_API_KEY;
  const policyNames = ["ROAST_AI_PROVIDER", "DEEPSEEK_API_KEY", "ROAST_AI_ENABLED", "ROAST_AI_ALLOW_LOCAL", "ROAST_AI_MODEL", "ROAST_AI_ALLOWED_MODELS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previousPolicy = Object.fromEntries(policyNames.map(name => [name, process.env[name]]));
  Object.assign(process.env, { ROAST_AI_ENABLED: "1", ROAST_AI_ALLOW_LOCAL: "1", ROAST_AI_MODEL: "gpt-4o-mini", ROAST_AI_ALLOWED_MODELS: "gpt-4o-mini", SUPABASE_URL: "https://ledger.test", SUPABASE_SERVICE_ROLE_KEY: "fake-service-role" });
  Object.assign(process.env, { ROAST_AI_PROVIDER: provider, DEEPSEEK_API_KEY: "test-deepseek-key", ROAST_AI_MODEL: model, ROAST_AI_ALLOWED_MODELS: model });
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  const isReview = (body: { messages?: Array<{ content?: unknown }> }) => body.messages?.some(message => typeof message.content === "string" && message.content.includes("You independently review website audits"));
  globalThis.fetch = async (_url, init) => {
    if (String(_url).endsWith("/responses/input_tokens")) return Response.json({ input_tokens: 2000 });
    if (String(_url).includes("/rest/v1/rpc/")) return new Response(JSON.stringify({ allowed: true }));
    if (String(_url).includes("/rest/v1/roast_ai_runs")) return new Response(null, { status: 204 });
    const body = JSON.parse(String(init?.body || "{}"));
    if (String(_url) !== (provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions")) throw new Error("Unexpected provider endpoint; refusing network access.");
    if (model === "gpt-5.6-terra" && (JSON.stringify(body).match(/"type":"image_url"/g) || []).length !== 2) throw new Error("Full Terra writer and reviewer must both receive desktop/mobile images.");
    if (provider === "deepseek" && (body.response_format.type !== "json_object" || !body.max_tokens || body.max_completion_tokens)) throw new Error("DeepSeek format or output cap was not adapted.");
    if (model === "gpt-5.6-terra" && (body.model !== model || body.reasoning_effort !== "none" || body.service_tier !== "default" || !body.max_completion_tokens)) throw new Error("Terra request controls were not applied.");
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    const prompt = typeof userMessage?.content === "string" ? userMessage.content : userMessage?.content?.[0]?.text || "";
    const catalogLine = prompt.split("\n").find((line: string) => line.startsWith('{"format":'));
    const catalog = catalogLine ? JSON.parse(catalogLine) : null;
    const reference = (source: string, quote: string, target: string, claim: string) => {
      const entry = catalog.entries.find((item: { source: string; text: string }) => item.source === source && item.text.includes(quote));
      if (!entry) throw new Error("Missing mock evidence");
      return { claim, evidenceId: entry.id, pageId: entry.pageIds[0], severity: "medium", target, certainty: "observed" };
    };
    if (isReview(body)) return new Response(JSON.stringify({ usage: { prompt_tokens: 2000, completion_tokens: 500 },
        choices: [{ message: {
      content: JSON.stringify({ evidenceSupported: true, businessAppropriate: true, scopeHonest: true, actionsUseful: true, issues: [] })
    } }] }), { status: 200 });
    return (
    new Response(
      JSON.stringify({
        usage: { prompt_tokens: 2000, completion_tokens: 500 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 9,
                diagnosis: { ...diagnoseWebsite(lodge, scoring), summary: "The supplied evidence supports room selection and booking enquiries, without proving a completed reservation." },
                first_impression: "The booking path is clear and well supported by the page.",
                single_biggest_leak: "The room comparison could explain the differences between suites more precisely.",
                findings: [{ headline: "The rooms need a comparison, not a guessing game.", observation: "The rooms section names the options but gives little help comparing suite features.", fix: "Where: Rooms section | Fix: Add a comparison row | Example: Compare capacity, view, amenities and rate." }],
                lost_customers: "Guests comparing room types may need another visit before deciding which stay fits them.",
                quick_fixes: ["Where: Rooms section | Fix: Add a comparison row | Example: Compare capacity, view, amenities and rate."],
                high_impact: "Make suite selection faster with a concise room comparison.",
                tone_summary: "A strong booking path with one avoidable room-selection pause.",
                evidence: ["Rooms and rates", "Check Availability"],
                claim_contract: [
                  reference("cta", "Check Availability", "first_impression", "Booking CTA is present"),
                  reference("h2", "Rooms and rates", "single_biggest_leak", "Room comparison is thin"),
                  reference("trust", "Verified guest reviews", "mistake", "Guest proof is present"),
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
  };

  try {
    const generated = await generateRoastWithUsage(lodge, scoring);
    if (!generated.aiUsed || generated.fallbackUsed || generated.roast.generation?.mode !== "ai") {
      throw new Error("Valid model output was not recorded as AI-generated.");
    }
    if (generated.roast.mistakes.length !== 1) {
      throw new Error("A valid single finding was replaced or padded.");
    }
    if (generated.roast.first_impression !== "The booking path is clear and well supported by the page.") {
      throw new Error("Calm, accurate model wording was replaced by tone enforcement.");
    }
    if (generated.roast.diagnosis?.summary !== "The supplied evidence supports room selection and booking enquiries, without proving a completed reservation.") throw new Error("The model business diagnosis was overwritten by a preset.");
    if (generated.roast.findings?.[0]?.fix !== generated.roast.quick_fixes[0]) throw new Error("Finding/fix projection lost its pairing.");
    if (!isClientReadyReport(generated.roast)) throw new Error("Reviewed AI report did not pass the shared gate.");
    if (generated.roast.generation?.provider !== provider) throw new Error("Report provider provenance was lost.");
    const passingFetch = globalThis.fetch;
    let rejectedReviews = 0;
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      if (isReview(body)) {
        rejectedReviews += 1;
        return new Response(JSON.stringify({ usage: { prompt_tokens: 2000, completion_tokens: 500 }, choices: [{ message: { content: JSON.stringify({
          evidenceSupported: false, businessAppropriate: true, scopeHonest: false, actionsUseful: true,
          issues: [{ field: "/report/findings/0/observation", quote: "The rooms section", reason: "A heading alone does not prove comparison details are absent." }]
        }) } }] }), { status: 200 });
      }
      return passingFetch(url, init);
    };
    const rejected = await generateRoastWithUsage(lodge, scoring);
    if (isClientReadyReport(rejected.roast) || rejected.aiUsed || !rejected.fallbackUsed || rejectedReviews !== 1) {
      throw new Error("Unsupported report passed the gate or exceeded bounded review attempts.");
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of policyNames) {
      if (previousPolicy[name] === undefined) delete process.env[name];
      else process.env[name] = previousPolicy[name];
    }
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
  }

  console.log("Phase 1 evidence and provenance checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
