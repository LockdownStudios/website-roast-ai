import { pageUrlKey } from "./pageAliases";
import type { ScrapedWebsiteData } from "./types";

export type VisualEvidence = { label: string; sourceUrl: string; dataUrl: string };
export function selectVisualEvidence(scraped: ScrapedWebsiteData, includeKeyPages: boolean): VisualEvidence[] {
  const images: VisualEvidence[] = [];
  for (const view of [scraped.visualAudit?.desktop, scraped.visualAudit?.mobile]) {
    if (view?.captureReadiness?.settled && view.screenshotDataUrl) images.push({ label: `${view.viewport} homepage viewport`, sourceUrl: scraped.url, dataUrl: view.screenshotDataUrl });
  }
  if (images.length !== 2) return [];
  const keyFor = (url: string) => pageUrlKey(scraped.crawl?.aliases?.find(alias => alias.url === url)?.canonicalUrl || url);
  const seen = new Set([keyFor(scraped.url)]);
  if (includeKeyPages) for (const page of scraped.visualAudit?.keyPages || []) {
    const key = keyFor(page.url);
    if (seen.has(key) || !page.desktop.captureReadiness?.settled || !page.desktop.screenshotDataUrl) continue;
    seen.add(key);
    images.push({ label: "Reviewed decision-page desktop viewport", sourceUrl: page.url, dataUrl: page.desktop.screenshotDataUrl });
    if (images.length >= 4) break;
  }
  return images;
}
