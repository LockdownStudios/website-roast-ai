import assert from "node:assert/strict";
import { compactEvidence, promptEvidenceCatalog } from "../lib/compactEvidence";

const records = [
  { source: "cta", sourceUrl: "https://example.test/a", text: "View menu" },
  { source: "cta", sourceUrl: "https://example.test/b", text: "View menu" },
  { source: "cta", sourceUrl: "https://example.test/a", text: "View menu" },
  { source: "content", sourceUrl: "https://example.test/a", text: "Reservations available only at this branch." },
  { source: "content", sourceUrl: "https://example.test/b", text: "Please call for information." },
];
const packed = compactEvidence(records);
const expanded = packed.entries.flatMap(([source, text, pages]) => pages.map(page => ({ source, text, sourceUrl: packed.pages[page] })));
const unique = (items: typeof records) => [...new Set(items.map(item => JSON.stringify([item.source, item.sourceUrl, item.text])))].sort();
assert.deepEqual(unique(expanded), unique(records));
assert.deepEqual(packed.entries[0][2], [0, 1]);
assert.deepEqual(packed.entries[1][2], [0], "Branch-only policy must not spread to another page");
assert.equal(compactEvidence([]).entries.length, 0);
assert.equal(JSON.stringify(records[0]), JSON.stringify({ source: "cta", sourceUrl: "https://example.test/a", text: "View menu" }));
console.log("Evidence packing passes: exact text, all page references, branch-specific attribution, deduplication and empty input.");

const labelled = promptEvidenceCatalog(records);
assert.equal(labelled.entries[0].id, "e0");
assert.deepEqual(labelled.entries[0].pageIds, ["p0", "p1"]);
assert.equal(labelled.pages[1].url, records[1].sourceUrl);
