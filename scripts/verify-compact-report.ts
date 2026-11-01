import assert from "node:assert/strict";
import { renderCompactReportPdf, type CompactReport } from "../lib/compactReportPdf";

async function main() {
  const report: CompactReport = {
    name: "Example Lodge", url: "https://example.com/", meta: "Sampled review", score: 5,
    summary: "The booking button has arrived. The supporting information missed the bus.",
    leak: "The observed room choices need clearer context near the existing booking action.",
    strengths: ["The location promise is clear."], verdict: "A focused refresh is appropriate.",
    coverage: "No booking submission tested.", technical: "Metadata sampled; performance untested.",
    findings: Array.from({ length: 5 }, (_, index) => ({ headline: `Finding ${index + 1}: give the next step some context.`, observation: "An observed layout decision needs clearer explanation.", consequence: "Guests may need another step to decide.", fix: `Fix ${index + 1}: explain the existing action with verified information.`, source: "example.com/rooms" })),
  };
  const pdf = await renderCompactReportPdf(report, true);
  assert.equal((pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length, 2,'Five paired findings use the reference layout across two readable pages');
  const longer=await renderCompactReportPdf({...report,findings:report.findings.map(finding=>({...finding,observation:('An observed layout decision needs clearer explanation. ').repeat(6)}))});
  assert.equal((longer.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,2,'Longer copy must keep its readable second page');
  assert.ok((pdf.toString("latin1").match(/\/Subtype \/Image/g)||[]).length<=2, "Only the small logo and its transparency mask may be embedded, never website captures");
  const short = await renderCompactReportPdf({ ...report, findings: [report.findings[0]] });
  assert.equal((short.toString("latin1").match(/\/Type \/Page\b/g) || []).length, 1, "Short reports should not force an empty second page");
  const scorecards=[...Array.from({length:5},(_,i)=>({group:'Studio',label:`Assessment ${i+1}`,value:75})),...['Mobile lab','Desktop lab'].flatMap(group=>['Performance','SEO','Accessibility','Best practices'].map(label=>({group,label,value:90})))];
  const measured=await renderCompactReportPdf({...report,scoreMaximum:100,score:78,scorecards});
  assert.equal((measured.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,2,'Five findings and all thirteen saved studio/lab scores must retain a usable two-page report');
  await assert.rejects(renderCompactReportPdf({ ...report, findings: [{ headline: "Too much copy", observation: "word ".repeat(5000), fix: "Edit the narrative." }] }), /two-page editorial budget/);
  console.log("Compact report checks passed: one or two pages, text-only PDF, overflow withheld without clipping. No paid calls.");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
