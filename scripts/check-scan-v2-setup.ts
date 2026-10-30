import {loadEnvConfig} from '@next/env';
import {scanStorage} from '../lib/scan-v2/storage';
import {maxAiRunUsd} from '../lib/aiCost';
loadEnvConfig(process.cwd(),true);

async function main(){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Add the Roast AI Supabase URL and service-role key privately to web-roast/.env.local.');
 if(maxAiRunUsd()>0.10)throw new Error('Set ROAST_AI_MAX_RUN_USD to 0.10 or less before local worker testing.');
 console.log('Checking the Roast AI database schema. No scan, email or AI generation will be requested.');
 const checks=await Promise.allSettled([
  scanStorage('roast_jobs_v2?select=id,priority&limit=0'),
  scanStorage('roast_artifacts_v2?select=job_id&limit=0'),
  scanStorage('roast_workers_v2?select=id&limit=0'),
  scanStorage('roast_ai_runs?select=id&limit=0'),
 ]);
 const labels=['V2 jobs/priority','V2 artifacts','V2 worker heartbeat','AI usage ledger'];
 checks.forEach((result,index)=>console.log(`${labels[index]}: ${result.status==='fulfilled'?'OK':result.reason instanceof Error?result.reason.message:'unavailable'}`));
 if(checks.some(result=>result.status==='rejected'))throw new Error('The V2 database checks did not pass. If this is the first setup, run the COMPLETE 20261030_durable_scans_v2.sql migration in Roast AI Supabase. Also check connectivity and the existing AI usage ledger migration. No worker was started.');
 if(process.env.ROAST_V2_AI_ENABLED==='1'){
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is missing. Do not paste it into chat.');
  console.log('AI mode selected. Provider credentials are present, but were not authenticated or billed by this check.');
 }else console.log('Measurement-only mode selected; paid AI generation is disabled.');
 const local=process.env.ROAST_V2_MEASUREMENT_PROVIDER==='local';
 console.log(`V2 tables are readable. Application AI ceiling: US$${maxAiRunUsd().toFixed(2)}. ${local?'Local Lighthouse selected; no PageSpeed API key or quota used.':process.env.PAGESPEED_API_KEY?'PageSpeed key configured.':'No PageSpeed key configured; anonymous quota may be restrictive.'}`);
 if(process.argv.includes('--worker')){
  const workers=await scanStorage(`roast_workers_v2?heartbeat_at=gte.${encodeURIComponent(new Date(Date.now()-90000).toISOString())}&select=heartbeat_at&order=heartbeat_at.desc&limit=1`);
  if(!workers?.length)throw new Error('No recent worker heartbeat. Keep npm run dev:scanner running in another terminal.');
  console.log(`Worker online; latest heartbeat ${Math.max(0,Math.round((Date.now()-Date.parse(workers[0].heartbeat_at))/1000))} seconds ago.`);
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Setup check failed');process.exitCode=1;});
