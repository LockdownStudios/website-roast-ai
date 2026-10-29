import type { RoastClaim } from "./types";

type Catalog = { pages: string[]; entries: Array<[string, string, number[]]> };
/** Source, URL and quotation come from the dossier, never from model-transcribed punctuation. */
export function resolveClaimReferences(value: unknown, catalog: Catalog): RoastClaim[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 6) throw new Error("Supply 3-6 claim references using evidence and page IDs.");
  return value.map(item => {
    if (!item || typeof item.claim !== "string" || !item.claim.trim() || typeof item.evidenceId !== "string" || !/^e(?:0|[1-9]\d*)$/.test(item.evidenceId) || typeof item.pageId !== "string" || !/^p(?:0|[1-9]\d*)$/.test(item.pageId)) throw new Error("Invalid claim reference.");
    const evidenceIndex = Number(item.evidenceId.slice(1)), pageIndex = Number(item.pageId.slice(1));
    const entry = catalog.entries[evidenceIndex];
    if (!entry || !entry[2].includes(pageIndex) || !catalog.pages[pageIndex]) throw new Error("Claim reference does not belong to the cited page.");
    if (!["first_impression", "single_biggest_leak", "mistake", "lost_customers", "high_impact", "score"].includes(item.target) || !["high", "medium", "low"].includes(item.severity) || !["observed", "inference"].includes(item.certainty)) throw new Error("Invalid claim classification.");
    return { claim: item.claim.trim(), target: item.target, severity: item.severity, certainty: item.certainty, source: entry[0] as RoastClaim["source"], sourceUrl: catalog.pages[pageIndex], evidence: entry[1].slice(0, 180) };
  });
}
