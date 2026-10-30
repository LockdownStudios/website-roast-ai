import "server-only";
import type { ScanJob } from "./contract";
export async function scanStorage(path:string,init:RequestInit={}) {
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)throw new Error("Scan storage is not configured.");
  const response=await fetch(new URL(`/rest/v1/${path}`,base),{...init,signal:AbortSignal.timeout(12000),headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...init.headers},cache:"no-store"});
  if(!response.ok)throw new Error(`Scan storage failed (${response.status}); no result was confirmed.`);
  const body=await response.text();return body?JSON.parse(body):null;
}
export async function getScan(id:string):Promise<ScanJob|null> { const rows=await scanStorage(`roast_jobs_v2?id=eq.${encodeURIComponent(id)}&limit=1`);return rows?.[0] || null; }
export async function checkpoint(job:ScanJob,patch:Partial<ScanJob>) {
  const rows=await scanStorage(`roast_jobs_v2?id=eq.${job.id}&lease_token=eq.${job.lease_token}`,{method:"PATCH",body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
  if(!rows?.length)throw new Error("Worker lease lost; processing stopped.");
  Object.assign(job,rows[0]);
}
