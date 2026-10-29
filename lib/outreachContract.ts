import { normalizeTechnicalChecks } from "./technicalAudit";
import type { OutreachAudit } from "./types";

export function parseOutreach(value: unknown): OutreachAudit {
  const audit = value as OutreachAudit;
  if (audit?.technicalChecks) normalizeTechnicalChecks(audit.technicalChecks);
  const text = (value: unknown, max: number) => typeof value === "string" && !!value.trim() && value.length <= max;
  if (!audit || !text(audit.summary, 450) || !text(audit.recommendationReason, 350) || !text(audit.scope, 700) || !["small improvements", "targeted refresh", "substantial remodel"].includes(audit.recommendation)) throw new Error("Invalid outreach summary, scope or recommendation.");
  if (!Array.isArray(audit.strengths) || audit.strengths.length < 1 || audit.strengths.length > 3 || audit.strengths.some(item => !text(item, 180))) throw new Error("Outreach requires specific strengths.");
  if (!Array.isArray(audit.images) || audit.images.length !== 2 || audit.images.some(image => !text(image.label, 100) || !text(image.sourceUrl, 2000) || typeof image.dataUrl !== "string" || image.dataUrl.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl))) throw new Error("Outreach requires two bounded captured screenshots.");
  if (!Array.isArray(audit.findings) || audit.findings.length < 3 || audit.findings.length > 5 || audit.findings.some(finding => !["visual", "navigation", "interaction", "content", "technical"].includes(finding.category) || (finding.headline !== undefined && !text(finding.headline, 90)) || !text(finding.observed, 180) || !text(finding.pageUrl, 2000) || !text(finding.consequence, 160) || !text(finding.fix, 220) || !text(finding.evidence, 180) || ![null, 0, 1].includes(finding.imageIndex))) throw new Error("Outreach requires 3-5 concise, evidenced findings.");
  if (new Set(audit.findings.map(f => f.observed.trim().toLowerCase())).size !== audit.findings.length) throw new Error("Outreach findings must be distinct.");
  for (const url of [...audit.images.map(image => image.sourceUrl), ...audit.findings.map(f => f.pageUrl)]) {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("Outreach evidence requires public page URLs.");
  }
  if (!audit.findings.some(finding => finding.category === "visual" && finding.imageIndex !== null)) throw new Error("A visual mini-audit requires an image-grounded visual finding.");
  return audit;
}

const text = { type: "string" };
export const outreachResponseFormat = { type: "json_schema", json_schema: { name: "website_outreach_mini_audit", strict: true, schema: {
  type: "object", additionalProperties: false, properties: {
    summary: text, strengths: { type: "array", items: text }, recommendation: { type: "string", enum: ["small improvements", "targeted refresh", "substantial remodel"] }, recommendationReason: text,
    findings: { type: "array", items: { type: "object", additionalProperties: false, properties: { headline: text, category: { type: "string", enum: ["visual", "navigation", "interaction", "content", "technical"] }, observed: text, pageId: { type: ["string", "null"] }, evidenceId: { type: ["string", "null"] }, consequence: text, fix: text, evidence: text, imageIndex: { type: ["integer", "null"] } }, required: ["headline", "category", "observed", "pageId", "evidenceId", "consequence", "fix", "evidence", "imageIndex"] } }
  }, required: ["summary", "strengths", "recommendation", "recommendationReason", "findings"]
} } };

export function resolveOutreachCitations(raw: { findings: Array<Record<string, unknown>> }, catalog: { pages: string[]; entries: Array<[string, string, number[]]> }, images: OutreachAudit["images"]) {
  return { ...raw, findings: raw.findings.map(finding => {
    if (finding.imageIndex === 0 || finding.imageIndex === 1) return { ...finding, pageUrl: images[finding.imageIndex].sourceUrl };
    const entryIndex = typeof finding.evidenceId === "string" && /^e(?:0|[1-9]\d*)$/.test(finding.evidenceId) ? Number(finding.evidenceId.slice(1)) : NaN;
    const pageIndex = typeof finding.pageId === "string" && /^p(?:0|[1-9]\d*)$/.test(finding.pageId) ? Number(finding.pageId.slice(1)) : NaN;
    if (!Number.isInteger(entryIndex) || !Number.isInteger(pageIndex)) throw new Error("Citation requires exact evidence and page IDs.");
    const entry = catalog.entries[entryIndex as number];
    if (!entry || !entry[2].includes(pageIndex as number)) throw new Error("Citation refers to evidence from a different page.");
    return { ...finding, evidence: entry[1].slice(0, 180), pageUrl: catalog.pages[pageIndex as number] };
  }) };
}
