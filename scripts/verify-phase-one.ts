import { generateRoastWithUsage } from "../lib/ai";
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

  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 9,
                first_impression: "The booking path is clear and well supported by the page.",
                single_biggest_leak: "The room comparison could explain the differences between suites more precisely.",
                mistakes: ["The rooms section names the options but gives little help comparing suite features."],
                lost_customers: "Guests comparing room types may need another visit before deciding which stay fits them.",
                quick_fixes: ["Where: Rooms section | Fix: Add a comparison row | Example: Compare capacity, view, amenities and rate."],
                high_impact: "Make suite selection faster with a concise room comparison.",
                tone_summary: "A strong booking path with one avoidable room-selection pause.",
                evidence: ["Rooms and rates", "Check Availability"],
                claim_contract: [
                  { claim: "Booking CTA is present", source: "cta", evidence: "Check Availability", severity: "medium", target: "first_impression", sourceUrl: "https://example-lodge.test/", certainty: "observed" },
                  { claim: "Room comparison is thin", source: "h2", evidence: "Rooms and rates", severity: "high", target: "single_biggest_leak", sourceUrl: "https://example-lodge.test/", certainty: "observed" },
                  { claim: "Guest proof is present", source: "trust", evidence: "Verified guest reviews", severity: "medium", target: "mistake", sourceUrl: "https://example-lodge.test/", certainty: "observed" },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

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
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }

  console.log("Phase 1 evidence and provenance checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
