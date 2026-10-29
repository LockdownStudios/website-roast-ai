import { businessDiagnosisSchema } from "./diagnosis";

const text = { type: "string" };
const list = { type: "array", items: text };

export const reportResponseFormat = { type: "json_schema", json_schema: {
  name: "website_roast_report", strict: true, schema: {
    type: "object", additionalProperties: false,
    properties: {
      score: { type: "number" }, score_label: text, diagnosis: businessDiagnosisSchema(),
      first_impression: text, single_biggest_leak: text, findings: { type: "array", items: { type: "object", additionalProperties: false, properties: { headline: text, observation: text, fix: text }, required: ["headline", "observation", "fix"] } },
      lost_customers: text, high_impact: text, tone_summary: text, evidence: list,
      claim_contract: { type: "array", items: { type: "object", additionalProperties: false, properties: {
        claim: text, evidenceId: text, pageId: text, target: { type: "string", enum: ["first_impression", "single_biggest_leak", "mistake", "lost_customers", "high_impact", "score"] },
        severity: { type: "string", enum: ["high", "medium", "low"] }, certainty: { type: "string", enum: ["observed", "inference"] }
      }, required: ["claim", "evidenceId", "pageId", "target", "severity", "certainty"] } }
    }, required: ["score", "score_label", "diagnosis", "first_impression", "single_biggest_leak", "findings", "lost_customers", "high_impact", "tone_summary", "evidence", "claim_contract"]
  }
} };
