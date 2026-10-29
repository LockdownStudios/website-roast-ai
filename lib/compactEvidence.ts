type EvidenceRecord = { source: string; sourceUrl: string; text: string };

// Lossless packing: repeated text and page URLs are sent once, without dropping sources.
export function compactEvidence(records: EvidenceRecord[]) {
  const pages: string[] = [];
  const pageIds = new Map<string, number>();
  const entries: Array<[string, string, number[]]> = [];
  const groups = new Map<string, number>();
  for (const record of records) {
    let page = pageIds.get(record.sourceUrl);
    if (page === undefined) { page = pages.length; pages.push(record.sourceUrl); pageIds.set(record.sourceUrl, page); }
    const key = JSON.stringify([record.source, record.text]);
    const existing = groups.get(key);
    if (existing === undefined) { groups.set(key, entries.length); entries.push([record.source, record.text, [page]]); }
    else if (!entries[existing][2].includes(page)) entries[existing][2].push(page);
  }
  return { format: "[source, exact text, page indexes into pages]", pages, entries };
}

// Put the identifier beside the text: models should copy IDs, never count array positions.
export function promptEvidenceCatalog(records: EvidenceRecord[]) {
  const compact = compactEvidence(records);
  return {
    format: "Explicit evidence/page IDs. Copy IDs exactly; never count array positions.",
    pages: compact.pages.map((url, index) => ({ id: `p${index}`, url })),
    entries: compact.entries.map(([source, text, pages], index) => ({ id: `e${index}`, source, text, pageIds: pages.map(page => `p${page}`) })),
  };
}
