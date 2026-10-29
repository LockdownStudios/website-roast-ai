import type { TechnicalCheck } from "./types";

// These are observations of the fetched HTML, not a Lighthouse or security audit.
export function technicalChecksFromHtml(pages: Array<{ url: string; html: string }>): TechnicalCheck[] {
  if (!pages.length) return [{ name: "HTML checks", status: "not_tested", detail: "No page HTML was available for technical checks.", pageUrls: [] }];
  const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
  const snapshots = pages.map(page => {
    const html = page.html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
    const metas = (html.match(/<meta\b[^>]*>/gi) || []).map(attributes);
    const links = (html.match(/<link\b[^>]*>/gi) || []).map(attributes);
    const images = (html.match(/<img\b[^>]*>/gi) || []).map(attributes);
    return { ...page, title: /<title\b[^>]*>\s*[^<\s]/i.test(html), description: metas.some(m => m.name?.toLowerCase() === "description" && m.content?.trim()), viewport: metas.some(m => m.name?.toLowerCase() === "viewport" && /width\s*=\s*device-width/i.test(m.content || "")), canonical: links.some(l => l.rel?.toLowerCase().split(/\s+/).includes("canonical") && l.href?.trim()), noindex: metas.some(m => /^(robots|googlebot)$/i.test(m.name || "") && /\b(noindex|none)\b/i.test(m.content || "")), missingAlt: images.filter(i => !("alt" in i)).length, imageCount: images.length };
  });
  const check = (name: string, matching: typeof snapshots, good: string, caution: string): TechnicalCheck => ({ name, status: matching.length ? "review" : "observed", detail: matching.length ? `${matching.length}/${pages.length} fetched pages: ${caution}` : good, pageUrls: (matching.length ? matching : snapshots).map(p => p.url) });
  return [
    check("Page titles", snapshots.filter(p => !p.title), "A non-empty title element was found on every fetched page.", "no non-empty title element found in the fetched HTML; verify the rendered page before changing it."),
    check("Search descriptions", snapshots.filter(p => !p.description), "Description metadata was found on every fetched page; wording quality still needs editorial review.", "no non-empty description metadata found in the fetched HTML. This is not a search-ranking measurement."),
    check("Mobile viewport", snapshots.filter(p => !p.viewport), "Device-width viewport metadata was found; this alone does not prove a good mobile layout.", "no device-width viewport configuration found in the fetched HTML; confirm the live DOM."),
    check("Canonical declarations", snapshots.filter(p => !p.canonical), "Canonical declarations were found; their targets and search-engine interpretation were not tested.", "no canonical declaration found in the fetched HTML. Review whether one is appropriate; absence alone is not a defect."),
    check("Indexing directives", snapshots.filter(p => p.noindex), "No noindex directive was found in fetched meta tags. Robots.txt, HTTP headers and actual index coverage were not checked.", "a noindex/none meta directive was found. Confirm whether excluding these pages is intentional."),
    check("Image alt attributes", snapshots.filter(p => p.missingAlt > 0), "All image tags observed in fetched HTML had an alt attribute; descriptive quality was not assessed.", "one or more image tags lacked an alt attribute. Review informative images; empty alt can be correct for decorative images."),
    { name: "Speed and Core Web Vitals", status: "not_tested", detail: "No Lighthouse, field performance or Core Web Vitals measurement was run. Crawl duration is not page-load speed.", pageUrls: [] },
    { name: "Forms, payments and security", status: "not_tested", detail: "No form/booking/payment submission, vulnerability scan or complete link-health test was performed.", pageUrls: [] },
  ];
}

export function normalizeTechnicalChecks(value: unknown): TechnicalCheck[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length > 12 || value.some(c => !c || typeof c.name !== "string" || c.name.length > 100 || !["observed", "review", "not_tested"].includes(c.status) || typeof c.detail !== "string" || c.detail.length > 700 || !Array.isArray(c.pageUrls) || c.pageUrls.some((url: unknown) => typeof url !== "string" || !/^https?:\/\//i.test(url)))) throw new Error("Invalid technical evidence.");
  return value;
}
