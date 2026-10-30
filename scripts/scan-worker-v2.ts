import {loadEnvConfig} from '@next/env';
import {scanStorage,checkpoint} from '../lib/scan-v2/storage';
import {processScan} from '../lib/scan-v2/processor';
import type {ScanJob} from '../lib/scan-v2/contract';
import {installWorkerFetchGuard} from '../lib/scan-v2/network';
loadEnvConfig(process.cwd());
const measurementProvider=process.env.ROAST_V2_MEASUREMENT_PROVIDER || 'pagespeed';
if(!['pagespeed','local'].includes(measurementProvider))throw new Error('ROAST_V2_MEASUREMENT_PROVIDER must be pagespeed or local.');
console.log(`Technical measurement provider: ${measurementProvider}. Paid AI ${process.env.ROAST_V2_AI_ENABLED==='1'?'enabled (metered)':'disabled'}.`);
process.env.ROAST_WORKER_NETWORK_GUARD='1';installWorkerFetchGuard();
const workerId=crypto.randomUUID();
const heartbeat=()=>scanStorage('roast_workers_v2?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:workerId,heartbeat_at:new Date().toISOString()})});
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){
 const localMeasure=measurementProvider==='local'?(await import('./local-lighthouse')).measureLocalLighthouse:undefined;
 let nextPrune=0;
 while(!stopping){
  try {
   if(Date.now()>nextPrune){await scanStorage('rpc/prune_roast_artifacts_v2',{method:'POST',body:'{}'});nextPrune=Date.now()+86400000;}
   await heartbeat();
   const rows=await scanStorage('rpc/claim_roast_job_v2',{method:'POST',body:'{}'});const job=rows?.[0] as ScanJob|undefined;
   if(!job){await new Promise(resolve=>setTimeout(resolve,3000));continue;}
   const timer=setInterval(()=>{void Promise.all([heartbeat(),scanStorage(`roast_jobs_v2?id=eq.${job.id}&lease_token=eq.${job.lease_token}`,{method:'PATCH',body:JSON.stringify({lease_until:new Date(Date.now()+300000).toISOString()})})]).catch(()=>{stopping=true;});},30000);
   const deadline=setTimeout(()=>{console.error('Worker deadline exceeded; exiting so the durable lease can recover.');process.exit(1);},480000);
   try{await processScan(job,localMeasure?{measure:localMeasure}:{});}catch{await checkpoint(job,{status:job.result?'partial':'failed'}).catch(()=>undefined);}finally{clearInterval(timer);clearTimeout(deadline);}
  } catch {console.error('Scan worker storage unavailable; waiting before retry.');await new Promise(resolve=>setTimeout(resolve,10000));}
 }
}
void main();
