import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateOutreachAudit } from "../lib/outreach";
import { scoreWebsite } from "../lib/scoring";
import { isClientReadyReport } from "../lib/reportQuality";
import {STUDIO_CATEGORIES,studioScorecard} from '../lib/scan-v2/rubric';
import { ROAST_VOICE_BRIEF, ROAST_EDITOR_INSTRUCTION, ROAST_VOICE_VERSION } from '../lib/roastVoice';
async function main() {
  const env={...process.env}, original=globalThis.fetch;
  let calls=0;
  const fixture=JSON.parse(readFileSync('fixtures/roast-report-sample.json','utf8'));
  const scraped={...fixture.scraped,visualAudit:{available:true,desktop:{captureReadiness:{settled:true},screenshotDataUrl:'data:image/jpeg;base64,YQ=='},mobile:{captureReadiness:{settled:true},screenshotDataUrl:'data:image/jpeg;base64,YQ=='}}};
  const draft={summary:'A focused refresh for the opening.',strengths:['The company identifies its service.'],recommendation:'small improvements',recommendationReason:'Preserve the existing identity.',findings:[{headline:'Give the opening some breathing room.',category:'visual',observed:'The opening could be clearer.',consequence:'The next step may take longer to find.',fix:'Shorten the first paragraph.',evidence:'mobile',imageIndex:1,pageId:null,evidenceId:null}]};
  const final={...draft,summary:'The opening is doing a little too much talking.',findings:[{...draft.findings[0],observed:'The mobile capture contains a multiline opening paragraph.'}]};
  let withStudio=false;
  const studio=STUDIO_CATEGORIES.map(category=>({category,level:3,reason:'Scoped to the visible sampled presentation.',imageIndex:category==='mobile'?1:0,evidenceId:null,pageId:null}));
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('ledger.test'))return new Response(null,{status:204});
    if(String(url).endsWith('/input_tokens'))return Response.json({input_tokens:9000});
    assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
    calls++;
    const body=JSON.parse(String(init?.body));
    const instructions=body.messages.filter((message:{role:string})=>message.role==='system').map((message:{content:string})=>message.content).join('\n');
    assert.ok(instructions.includes(ROAST_VOICE_BRIEF),'Writer and editor must use the same editorial direction');
    if(calls===2)assert.ok(instructions.includes(ROAST_EDITOR_INSTRUCTION),'The final editor must actively restore voice when a draft is bland');
    assert.equal(body.response_format.json_schema.name,calls===1?'website_outreach_mini_audit':'reviewed_outreach');
    const scores=withStudio?{studioAssessments:studio.map(item=>({...item,level:calls===2&&item.category==='design'?2:item.level}))}:{};
    return Response.json({usage:{prompt_tokens:9000,completion_tokens:650},choices:[{finish_reason:'stop',message:{content:JSON.stringify(calls===1?{...draft,...scores}:{evidenceSupported:true,businessAppropriate:true,scopeHonest:true,actionsUseful:true,issues:[],approvedAudit:{...final,...scores}})}}]});
  };
  try {
    Object.assign(process.env,{ROAST_AI_ENABLED:'1',ROAST_AI_ALLOW_LOCAL:'1',ROAST_AI_PROVIDER:'openai',ROAST_AI_MODEL:'gpt-5.6-terra',ROAST_AI_ALLOWED_MODELS:'gpt-5.6-terra',ROAST_AI_MAX_RUN_USD:'0.10',SUPABASE_URL:'https://ledger.test',SUPABASE_SERVICE_ROLE_KEY:'fake',OPENAI_API_KEY:'fake'});
    const result=await generateOutreachAudit(scraped,scoreWebsite(fixture.scraped),{channel:'office'});
    assert.equal(calls,2,'Editing must replace the second call, never add a paid retry');
    assert.equal(isClientReadyReport(result.roast),true);
    assert.equal(result.roast.first_impression,final.summary);
    assert.equal(result.roast.mistakes[0],final.findings[0].observed);
    assert.equal(result.roast.outreach?.findings[0].observed,final.findings[0].observed);
    assert.equal(result.roast.outreach?.editorialVersion,ROAST_VOICE_VERSION);
    calls=0;withStudio=true;
    const graded=await generateOutreachAudit(scraped,scoreWebsite(fixture.scraped),{channel:'office'},{studio:true});
    assert.equal(calls,2,'Studio grading must share the writer/editor calls');
    assert.equal(graded.roast.outreach?.studioAssessments?.find(item=>item.category==='design')?.level,2,'Only the editor’s corrected grades may be retained');
    assert.equal(studioScorecard(graded.roast.outreach!.studioAssessments!,[]).overall,null,'Missing technical evidence must withhold the overall');
    console.log('Editor generation integration passed: writer + editor only, corrected client summary/findings, independent final approval and original evidence preserved. Mock calls only.');
  } finally {globalThis.fetch=original;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
