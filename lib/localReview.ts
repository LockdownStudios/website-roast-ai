import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RoastResultPayload, ScrapedWebsiteData, WebsiteScoring } from "./types";

export const LOCAL_REVIEW_SITES = [
  ["tashas-openai-accuracy-20261028", "Terra cost test (review failed)"],
  ["mogodi-v32", "Mogodi new test"],
  ["reinke-v32", "Reinke new test"],
  ["dorotian-v32", "Dorotian new test"],
  ["bakoor-v32", "Bakoor new test"],
  ["tashas-v31", "Tashas corrected test"],
  ["tashas-cafe", "Tashas Cafe"],
  ["mogodi-lodge", "Mogodi Lodge"],
  ["reinke", "Reinke"],
  ["dorotian-funerals", "Dorotian Funerals"],
  ["bakoor-akkommodasie", "Bakoor Akkommodasie"],
] as const;

export const LOCAL_REVIEW_NOTES: Record<string, string> = {
  "tashas-openai-accuracy-20261028": "28 October Terra cost test: two live requests used 23,768 input and 2,350 output tokens, including 23,762 cache-write input tokens. Estimated cost: USD 0.087617 including cache writes, before tax/currency conversion. Saved ten-page evidence was reused, with no visual pixels. The reviewer rejected unsupported booking/visibility claims and scoring assumptions. This draft is withheld; no automatic retry was made and the failed attempt still incurred cost.",
  "mogodi-v32": "AI review passed, but manual review found demo pages still dominating the sample. Crawl selection has since been corrected; this test predates that fix. A fresh AI retest is required before sending.",
  "reinke-v32": "Withheld: evidence validation failed. Crawl selection has since been corrected to prioritise real offerings and avoid translated duplicates. A fresh AI retest is required.",
  "dorotian-v32": "AI review passed; visual capture was unavailable and no visual score was assigned. Manual review found insensitive wording. Tone safeguards have since been tightened; a fresh AI retest is required before sending.",
  "bakoor-v32": "No approved AI report: the API returned credit_balance_exhausted. The new crawl recognises Afrikaans booking/contact actions and guest testimonials. Restore the API balance before retesting.",
  "tashas-v31": "Corrected local test: customer journeys and score drivers now share CTA evidence. AI evidence review passed. Manual review still required: the homepage capture may show an intro screen rather than the settled page; do not treat the numerical visual score as a whole-site judgement.",
  "tashas-cafe": "Manual QA: changes needed. The narrative identifies dining correctly, but the score drivers incorrectly infer professional services and suggest a consultation. Treat the score as provisional.",
  "mogodi-lodge": "Manual QA: changes needed. The booking CTA is recognised in the narrative but missed by the scorer. Separate hidden cart markup and sitemap-discovered demo pages from visible customer-journey evidence.",
  reinke: "Manual QA: withheld. The live homepage has a prominent Find a Dealer action. The draft and crawl did not adequately represent this dealer-led journey; multilingual duplicate pages also used much of the crawl sample.",
  "dorotian-funerals": "Manual QA: withheld. The writer invented an agent-confirmation-before-activation process. Recommendations must not present unverified business procedures as facts, and the downloadable plans still need evaluation.",
  "bakoor-akkommodasie": "Manual QA: no completed AI report. Five pages and screenshots were captured, but the model request timed out. The site has Afrikaans accommodation descriptions, guest testimonials and contact information; fallback wording is not an acceptable substitute.",
};

export async function getLocalReview(name?: string): Promise<{
  url: string; roast: RoastResultPayload; scoring: WebsiteScoring; scraped: ScrapedWebsiteData; error?: string;
} | null> {
  if (process.env.NODE_ENV !== "development") return null;
  if (name && !/^[a-z0-9-]+$/.test(name)) return null;
  try {
    return JSON.parse(await readFile(name
      ? path.join(process.cwd(), "tmp", "roast-batch", `${name}.json`)
      : path.join(process.cwd(), "tmp", "reviewed-smoke-result.json"), "utf8"));
  } catch { return null; }
}
