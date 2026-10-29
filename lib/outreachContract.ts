import { normalizeTechnicalChecks } from "./technicalAudit";
import type { OutreachAudit } from "./types";

export const MIN_OUTREACH_FINDINGS = 1;
export const OUTREACH_CONTRACT_VERSION = "outreach-v2";

export function parseOutreach(value: unknown): OutreachAudit {
  const audit = value as OutreachAudit;
  if (audit?.technicalChecks) normalizeTechnicalChecks(audit.technicalChecks);
  const text = (value: unknown, max: number) => typeof value === "string" && !!value.trim() && value.length <= max;
  if (!audit || !text(audit.summary, 450) || !text(audit.recommendationReason, 350) || !text(audit.scope, 700) || !["small improvements", "targeted refresh", "substantial remodel"].includes(audit.recommendation)) throw new Error("Invalid outreach summary, scope or recommendation.");
  if (!Array.isArray(audit.strengths) || audit.strengths.length < 1 || audit.strengths.length > 3 || audit.strengths.some(item => !text(item, 180))) throw new Error("Outreach requires specific strengths.");
  if (!Array.isArray(audit.images) || audit.images.length !== 2 || audit.images.some(image => !text(image.label, 100) || !text(image.sourceUrl, 2000) || typeof image.dataUrl !== "string" || image.dataUrl.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl))) throw new Error("Outreach requires two bounded captured screenshots.");
  if (!Array.isArray(audit.findings) || audit.findings.length < MIN_OUTREACH_FINDINGS || audit.findings.length > 5) throw new Error("Outreach requires 1-5 concise, evidenced findings.");
  for (const [index, finding] of audit.findings.entries()) {
    for (const [field, max] of [["headline", 90], ["observed", 180], ["pageUrl", 2000], ["consequence", 160], ["fix", 220], ["evidence", 180]] as const) {
      if (field === "headline" && finding[field] === undefined) continue;
      if (!text(finding[field], max)) throw new Error(`Outreach finding ${index + 1}: ${field} must contain 1-${max} characters.`);
    }
    if (!["visual", "navigation", "interaction", "content", "technical"].includes(finding.category) || ![null, 0, 1].includes(finding.imageIndex)) throw new Error(`Outreach finding ${index + 1}: invalid category or screenshot reference.`);
  }
  if (new Set(audit.findings.map(f => f.observed.trim().toLowerCase())).size !== audit.findings.length) throw new Error("Outreach findings must be distinct.");
  for (const url of [...audit.images.map(image => image.sourceUrl), ...audit.findings.map(f => f.pageUrl)]) {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("Outreach evidence requires public page URLs.");
  }
  if (!audit.findings.some(finding => finding.category === "visual" && finding.imageIndex !== null)) throw new Error("A visual mini-audit requires an image-grounded visual finding.");
  return audit;
}

const boundedText = (max: number) => ({ type: "string", pattern: `^[\\s\\S]{1,${max}}$` });
export const outreachResponseFormat = { type: "json_schema", json_schema: { name: "website_outreach_mini_audit", strict: true, schema: {
  type: "object", additionalProperties: false, properties: {
    summary: boundedText(450), strengths: { type: "array", minItems: 1, maxItems: 3, items: boundedText(180) }, recommendation: { type: "string", enum: ["small improvements", "targeted refresh", "substantial remodel"] }, recommendationReason: boundedText(350),
    findings: { type: "array", minItems: MIN_OUTREACH_FINDINGS, maxItems: 5, items: { type: "object", additionalProperties: false, properties: { headline: boundedText(90), category: { type: "string", enum: ["visual", "navigation", "interaction", "content", "technical"] }, observed: boundedText(180), pageId: { type: ["string", "null"], pattern: "^p(0|[1-9][0-9]*)$" }, evidenceId: { type: ["string", "null"], pattern: "^e(0|[1-9][0-9]*)$" }, consequence: boundedText(160), fix: boundedText(220), evidence: boundedText(180), imageIndex: { type: ["integer", "null"], enum: [null, 0, 1] } }, required: ["headline", "category", "observed", "pageId", "evidenceId", "consequence", "fix", "evidence", "imageIndex"] } }
  }, required: ["summary", "strengths", "recommendation", "recommendationReason", "findings"]
} } };

export function resolveOutreachCitations(raw: { findings: Array<Record<string, unknown>> }, catalog: { pages: string[]; entries: Array<[string, string, number[]]> }, images: OutreachAudit["images"]) {
  return { ...raw, findings: raw.findings.map(finding => {
    if (finding.imageIndex === 0 || finding.imageIndex === 1) return { ...finding, pageUrl: images[finding.imageIndex].sourceUrl, evidence: `${images[finding.imageIndex].label}; imageIndex=${finding.imageIndex} (zero-based).` };
    const entryIndex = typeof finding.evidenceId === "string" && /^e(?:0|[1-9]\d*)$/.test(finding.evidenceId) ? Number(finding.evidenceId.slice(1)) : NaN;
    const pageIndex = typeof finding.pageId === "string" && /^p(?:0|[1-9]\d*)$/.test(finding.pageId) ? Number(finding.pageId.slice(1)) : NaN;
    if (!Number.isInteger(entryIndex) || !Number.isInteger(pageIndex)) throw new Error("Citation requires exact evidence and page IDs.");
    const entry = catalog.entries[entryIndex as number];
    if (!entry || !entry[2].includes(pageIndex as number)) throw new Error("Citation refers to evidence from a different page.");
    return { ...finding, evidence: entry[1].slice(0, 180), pageUrl: catalog.pages[pageIndex as number] };
  }) };
}
