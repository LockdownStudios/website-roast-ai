export function pageUrlKey(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/index\.(?:html?|php)$/i, "/").replace(/\/+$/, "") || "/";
    return `${url.origin}${path}${url.search}`;
  } catch { return value; }
}

export function deduplicatePages<T>(input: T[], read: (page: T) => { url: string; title: string; content: string }) {
  const pages: T[] = [];
  const aliases: Array<{ url: string; canonicalUrl: string }> = [];
  const urls = new Map<string, string>();
  const contents = new Map<string, string>();
  for (const page of input) {
    const data = read(page), key = pageUrlKey(data.url);
    const text = data.content.replace(/\s+/g, " ").trim();
    const contentKey = text.length >= 200 ? JSON.stringify([key.replace(/\.html?(?=\?|$)/i, ""), data.title.trim(), text]) : "";
    const canonical = urls.get(key) || (contentKey && contents.get(contentKey));
    if (canonical) { if (canonical !== data.url) aliases.push({ url: data.url, canonicalUrl: canonical }); continue; }
    urls.set(key, data.url);
    if (contentKey) contents.set(contentKey, data.url);
    pages.push(page);
  }
  return { pages, aliases };
}
