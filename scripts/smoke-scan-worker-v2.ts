import {loadEnvConfig} from '@next/env';
import {writeFileSync} from 'node:fs';
import {scanStorage,getScan} from '../lib/scan-v2/storage';
import type {ScanJob} from '../lib/scan-v2/contract';
loadEnvConfig(process.cwd(),true);

/** Isolated worker test; never attaches to an Office lead or sends an email.
 * Public-channel jobs cannot enter the paid Office narrative branch. */
async function main(){
 const owner='development:measurement-worker-smoke';
 const url=process.argv.includes('--control')?'https://example.com/':process.argv.includes('--business')?'https://www.propservices.co.za/':'https://www.lockdownstudios.com/';
 const profile=process.argv.includes('--full')?'full':'outreach';
 const workers=await scanStorage(`roast_workers_v2?heartbeat_at=gte.${encodeURIComponent(new Date(Date.now()-90000).toISOString())}&limit=1`);
 if(!workers?.length)throw new Error('No active development worker');
 const query=new URLSearchParams({owner_id:`eq.${owner}`,channel:'eq.public',url:`eq.${url}`,profile:`eq.${profile}`,order:'created_at.desc',limit:'1'});
 let rows=await scanStorage(`roast_jobs_v2?${query}`);
 if(!rows?.length||process.argv.includes('--fresh'))rows=await scanStorage('roast_jobs_v2',{method:'POST',body:JSON.stringify({owner_id:owner,channel:'public',url,profile,checkpoint:{developmentTest:true,paidAiForbidden:true}})});
 const id=rows?.[0]?.id;
 if(!id)throw new Error('Test job was not confirmed');
 console.log(`Measurement-only development job: ${id}. No Office lead is linked; no AI generation is allowed.`);
 let previous='';
 for(let elapsed=0;elapsed<300;elapsed+=4){
  const job=await getScan(id) as ScanJob|null;
  if(!job)throw new Error('Test job disappeared');
  if(job.ai_started)throw new Error('Unexpected AI authorization in an explicitly non-AI test');
  const state=JSON.stringify({status:job.status,stages:Object.fromEntries(Object.entries(job.stages).map(([key,value])=>[key,value?.status]))});
  if(state!==previous){console.log(state);previous=state;}
  if(['complete','partial','failed'].includes(job.status)){
   const receipt={id:job.id,status:job.status,createdAt:job.created_at,updatedAt:job.updated_at,elapsedSeconds:Math.round((Date.parse(job.updated_at)-Date.parse(job.created_at))/1000),aiAuthorized:job.ai_started,result:job.result,stages:job.stages};
   writeFileSync('tmp/live-worker-smoke-result.json',JSON.stringify(receipt,null,2));
   console.log(JSON.stringify({outcome:job.result?.outcome,measurements:job.result?.technical.map(run=>({device:run.device,scores:run.scores})),pdfReady:job.result?.clientReportReady,limitations:job.result?.limitations}));
   const expected=profile==='full'?['mobile','desktop']:['mobile'];
   if(!expected.every(device=>job.result?.technical.some(run=>run.device===device&&Object.values(run.scores).every(score=>score!==null)))||!job.result?.clientReportReady)process.exitCode=1;
   return;
  }
  await new Promise(resolve=>setTimeout(resolve,4000));
 }
 throw new Error('Test observation timed out. The saved job remains available; do not resubmit automatically.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Worker smoke check failed');process.exitCode=1;});
