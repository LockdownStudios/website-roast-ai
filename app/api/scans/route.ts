import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseUserFromAccessToken,extractBearerToken} from '@/lib/auth';
import {publicScanUrl} from '@/lib/scan-v2/url';
import {scanStorage,getScan} from '@/lib/scan-v2/storage';
import {renderCompactReportPdf} from '@/lib/compactReportPdf';
import {scanPresentation} from '@/lib/scan-v2/presentation';
import {renderCompactReportHtml} from '@/lib/compactReportHtml';
import {rateLimit} from '@/lib/rateLimit';
import {SCAN_VERSION} from '@/lib/scan-v2/contract';
export const dynamic='force-dynamic';
async function identity(request:NextRequest) {
 const token=extractBearerToken(request.headers.get('authorization'))||'',secret=process.env.OFFICE_ROAST_API_SECRET||'';
 const tokenBytes=Buffer.from(token),secretBytes=Buffer.from(secret);
 if(secret && tokenBytes.length===secretBytes.length && timingSafeEqual(tokenBytes,secretBytes)) {
  const owner=request.headers.get('x-office-owner')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner))throw new Error('Unauthorized');
  return {owner:`office:${owner}`,channel:'office' as const};
 }
 if(process.env.ROAST_V2_PUBLIC_ENABLED!=='1')throw new Error('Unauthorized');
 const user=token?await getSupabaseUserFromAccessToken(token):null;if(!user)throw new Error('Unauthorized');
 return {owner:`public:${user.id}`,channel:'public' as const};
}
export async function POST(request:NextRequest){try{
 const actor=await identity(request);
 const rate=rateLimit(`scan-v2:${actor.owner}`,{limit:30,windowMs:60000});if(rate.limited)return NextResponse.json({error:'Too many simultaneous submissions.'},{status:429});
 if(process.env.ROAST_V2_ENABLED!=='1')return NextResponse.json({error:'The durable scanner has not been enabled by the operator.'},{status:503});
 const workers=await scanStorage(`roast_workers_v2?heartbeat_at=gte.${encodeURIComponent(new Date(Date.now()-90000).toISOString())}&limit=1`);
 const raw=await request.text();if(Buffer.byteLength(raw)>50000)return NextResponse.json({error:'Scan submission is too large'},{status:413});
 let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid JSON submission'},{status:400});}
 if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid scan submission'},{status:400});
 const inputs=actor.channel==='office'&&Array.isArray(body.urls)?body.urls:[body.url];
 if(inputs.length<1||inputs.length>(actor.channel==='office'?20:1))return NextResponse.json({error:'Submit between 1 and 20 Office URLs.'},{status:400});
 let urls:string[];try{urls=[...new Set(await Promise.all(inputs.map((value:unknown)=>publicScanUrl(value))))];}catch{return NextResponse.json({error:'One or more website URLs are invalid, unavailable in DNS, or not public. No jobs were accepted.'},{status:400});}
 const profile=actor.channel==='office'&&body.profile==='full'?'full':'outreach';
 const jobs:Array<{id:string;url:string;status:string}>=[],errors:Array<{url:string;error:string}>=[];
 for(const url of urls){
  const params=new URLSearchParams({owner_id:`eq.${actor.owner}`,channel:`eq.${actor.channel}`,url:`eq.${url}`,profile:`eq.${profile}`,status:'in.(queued,running)',limit:'1',select:'id,url,status'});
  try{
   let rows=await scanStorage(`roast_jobs_v2?${params}`);
   if(!rows?.[0]&&body.forceRefresh!==true){
    const cached=new URLSearchParams(params);cached.set('status','in.(complete,partial)');cached.set('updated_at',`gte.${new Date(Date.now()-6*60*60*1000).toISOString()}`);cached.set('result->>version',`eq.${SCAN_VERSION}`);cached.set('order','created_at.desc');rows=await scanStorage(`roast_jobs_v2?${cached}`);
   }
   if(!rows?.[0]&&!workers?.length)throw new Error('No scan worker is online');
   if(!rows?.[0]){try{rows=await scanStorage('roast_jobs_v2',{method:'POST',body:JSON.stringify({owner_id:actor.owner,channel:actor.channel,url,profile})});}catch{rows=await scanStorage(`roast_jobs_v2?${params}`);}}
   if(!rows?.[0])throw new Error('Job not confirmed');
   jobs.push({id:rows[0].id,url,status:rows[0].status});
  }catch{errors.push({url,error:workers?.length?'Job was not confirmed in storage.':'No scan worker is online; no new job was accepted.'});}
 }
 return NextResponse.json({id:jobs[0]?.id,jobs,errors,error:jobs.length?undefined:errors[0]?.error||'No scan jobs were accepted.'},{status:jobs.length?202:503});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Scan request failed'},{status:error instanceof Error&&error.message==='Unauthorized'?401:503});}}
export async function GET(request:NextRequest){try{
 const actor=await identity(request),id=request.nextUrl.searchParams.get('id')||'';
 if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:'Invalid scan ID'},{status:400});
 if(!id){const rows=await scanStorage(`roast_jobs_v2?${new URLSearchParams({owner_id:`eq.${actor.owner}`,channel:`eq.${actor.channel}`,select:'id,url,status,created_at',order:'created_at.desc',limit:'20'})}`);return NextResponse.json({jobs:rows},{headers:{'Cache-Control':'private, no-store'}});}
 const job=await getScan(id);if(!job||job.owner_id!==actor.owner||job.channel!==actor.channel)return NextResponse.json({error:'Scan not found'},{status:404});
 if(request.nextUrl.searchParams.get('format')==='json'){
  const artifacts=await scanStorage(`roast_artifacts_v2?job_id=eq.${id}&select=device,payload`);
  return NextResponse.json({result:job.result,audits:artifacts||[],retention:'Raw audit artifacts are retained for 30 days.'},{headers:{'Content-Disposition':'attachment; filename="website-scan-diagnostics.json"','Cache-Control':'private, no-store'}});
 }
 if(request.nextUrl.searchParams.get('format')==='html'){
  if(!job.result || !job.result.technical.length&&!job.result.narrative)return NextResponse.json({error:'No supported results are ready.'},{status:409});
  return new Response(renderCompactReportHtml(scanPresentation(job.result)),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",'Cache-Control':'private, no-store'}});
 }
 if(request.nextUrl.searchParams.get('format')==='pdf'){
  if(!job.result || job.result.clientReportReady===false || !job.result.technical.length&&!job.result.narrative)return NextResponse.json({error:'A client PDF has not passed report preflight. Available web results and diagnostics are retained.'},{status:409});
  return new Response(new Uint8Array(await renderCompactReportPdf(scanPresentation(job.result))),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="website-scan.pdf"','Cache-Control':'private, no-store'}});
 }
 return NextResponse.json({id:job.id,url:job.url,status:job.status,profile:job.profile,cancelRequested:job.cancel_requested,stages:job.stages,result:job.result,aiUsage:job.checkpoint.aiUsage,preview:request.nextUrl.searchParams.get('preview')==='1'&&typeof job.checkpoint.preview==='string'?job.checkpoint.preview:undefined,createdAt:job.created_at,updatedAt:job.updated_at},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Scan lookup failed'},{status:error instanceof Error&&error.message==='Unauthorized'?401:503});}}

export async function PATCH(request:NextRequest){try{
 const actor=await identity(request),id=request.nextUrl.searchParams.get('id')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:'Invalid scan ID'},{status:400});
 const job=await getScan(id);if(!job||job.owner_id!==actor.owner||job.channel!==actor.channel)return NextResponse.json({error:'Scan not found'},{status:404});
 if(!['queued','running'].includes(job.status))return NextResponse.json({status:job.status,cancelRequested:job.cancel_requested});
 const body=await request.json().catch(()=>({}));
 if(body?.action==='prioritize'){
  const rows=await scanStorage(`roast_jobs_v2?id=eq.${id}&status=eq.queued`,{method:'PATCH',body:JSON.stringify({priority:10,updated_at:new Date().toISOString()})});
  return NextResponse.json({prioritized:!!rows?.length},{headers:{'Cache-Control':'private, no-store'}});
 }
 const rows=await scanStorage(`roast_jobs_v2?id=eq.${id}&status=in.(queued,running)`,{method:'PATCH',body:JSON.stringify({cancel_requested:true,updated_at:new Date().toISOString()})});
 return NextResponse.json({status:rows?.[0]?.status||job.status,cancelRequested:!!rows?.[0]?.cancel_requested},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Stop request failed'},{status:error instanceof Error&&error.message==='Unauthorized'?401:503});}}
