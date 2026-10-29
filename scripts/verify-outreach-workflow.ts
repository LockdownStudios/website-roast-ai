import assert from "node:assert/strict";
import { resolveEditedOutreach } from "../lib/outreachEditor";
import { reusableOfficeReport } from "../lib/officeRoastCache";
import { withBrowserSlot } from "../lib/browserRuntime";
import { REPORT_REVIEW_VERSION } from "../lib/reportQuality";
import type { OutreachAudit, StoredRoastReport } from "../lib/types";

async function main() {
  const image = { label: "Desktop homepage", sourceUrl: "https://example.com/", dataUrl: "data:image/jpeg;base64,YQ==" };
  const original: OutreachAudit = { summary: "A useful focused refresh.", strengths: ["A clear company name."], recommendation: "small improvements", recommendationReason: "Keep the existing identity.", scope: "Homepage captures only; no forms submitted.", images: [image, {...image,label:"Mobile homepage"}], findings: [{ headline:"Give the opening some breathing room.", category:"visual", observed:"The mobile opening contains a large text block.", consequence:"The next step may take longer to identify.", fix:"Shorten the opening copy.", evidence:"Mobile capture",pageUrl:image.sourceUrl,imageIndex:1 }] };
  const raw = { ...original, images: undefined, scope: undefined, findings: original.findings.map(f => ({ ...f, evidenceId:null,pageId:null,observed:"The mobile screenshot shows a multiline opening heading." })) };
  const checks = { evidenceSupported:true,businessAppropriate:true,scopeHonest:true,actionsUseful:true,issues:[],approvedAudit:raw };
  const catalog = {pages:[image.sourceUrl],entries:[["heading","Exact title",[0]]] as Array<[string,string,number[]]>};
  const edited = resolveEditedOutreach(checks, original, catalog);
  assert.equal(edited.review.passed,true);
  assert.notEqual(edited.audit.findings[0].observed,original.findings[0].observed,"Use the edited copy, not the rejected draft");
  assert.equal(edited.audit.images,original.images,"Editor cannot replace captured evidence");
  assert.throws(()=>resolveEditedOutreach({...checks,approvedAudit:null},original,catalog),/complete final report/);
  assert.throws(()=>resolveEditedOutreach({...checks,approvedAudit:{...raw,findings:[{...raw.findings[0],imageIndex:null,evidenceId:'e99',pageId:'p0'}]}},original,catalog),/different page/);
  const rejected = resolveEditedOutreach({...checks,evidenceSupported:false,approvedAudit:null,issues:[{field:'/report/outreach/summary',quote:original.summary,reason:'Unsupported interpretation.'}]},original,catalog);
  assert.equal(rejected.review.passed,false,"Unfixable evidence must never be approved");
  const now = Date.now();
  const report = {url:image.sourceUrl,createdAt:new Date(now-1000).toISOString(),roast:{outreach:edited.audit,contractVersion:'2026-09-v1',access:{tier:'full_unlocked',unlockSource:'office',priceZar:49},generation:{mode:'ai',review:{version:REPORT_REVIEW_VERSION,passed:true,issues:[],checkedAt:new Date(now).toISOString()}},claim_contract:[{claim:'Observed',source:'visual',evidence:'Capture',severity:'medium'}]}} as unknown as StoredRoastReport;
  assert.equal(reusableOfficeReport(report,image.sourceUrl,now),true);
  assert.equal(reusableOfficeReport({...report,createdAt:new Date(now-7*3600000).toISOString()},image.sourceUrl,now),false);
  assert.equal(reusableOfficeReport(report,'https://other.test/',now),false);
  assert.equal(reusableOfficeReport({...report,roast:{...report.roast,generation:{...report.roast.generation!,mode:'hybrid'}}},image.sourceUrl,now),false);
  let active=0,max=0;
  await Promise.all([1,2,3].map(()=>withBrowserSlot(async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;})));
  assert.equal(max,1,"Parallel evidence work must not race browser processes");
  await assert.rejects(withBrowserSlot(async()=>{throw new Error('test');}),/test/);
  assert.equal(await withBrowserSlot(async()=>true),true,"A failed browser operation must release its slot");
  console.log('Outreach workflow passed: corrected final copy, failed-review gate, source preservation, fresh/expired cache and serialized browser resources. No AI calls.');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});

