import type { Category, TechnicalResult } from "./contract";
export class MeasurementProviderError extends Error {
  constructor(public readonly status:number){super(`PageSpeed measurement unavailable (${status}).`);this.name='MeasurementProviderError';}
}
export function parseLighthouse(payload: unknown, device: "mobile" | "desktop"): TechnicalResult {
  const value = payload as { lighthouseResult?: { finalUrl?: string; finalDisplayedUrl?:string; fetchTime?: string; lighthouseVersion?: string; runtimeError?: {message?:string}; categories?: Record<string,{score?:number; auditRefs?:Array<{id:string;weight:number}>}>; audits?:Record<string,{title?:string;description?:string;score?:number|null;numericValue?:number;scoreDisplayMode?:string}> }; loadingExperience?: unknown };
  const run = value?.lighthouseResult;
  const finalUrl=run?.finalUrl || run?.finalDisplayedUrl;
  if (!run?.categories || !finalUrl || run.runtimeError) throw new Error(run?.runtimeError?.message || "No Lighthouse measurement returned.");
  const scores = {} as TechnicalResult["scores"], issues:TechnicalResult["issues"]=[], metrics:Record<string,number>={};
  for (const key of ["performance","seo","accessibility","best-practices"] as Category[]) {
    const category=run.categories[key], score=category?.score;
    scores[key]=typeof score === "number" && Number.isFinite(score) && score>=0 && score<=1 ? Math.round(score*100) : null;
    for(const reference of category?.auditRefs || []) {
      const audit=run.audits?.[reference.id];
      if(audit && typeof audit.score === "number" && audit.score<1 && reference.weight>0 && !["manual","notApplicable","informative"].includes(audit.scoreDisplayMode || "")) issues.push({id:reference.id,title:audit.title || reference.id,detail:audit.description || "",category:key});
    }
  }
  for(const id of ["largest-contentful-paint","cumulative-layout-shift","total-blocking-time","first-contentful-paint","speed-index"]) {const n=run.audits?.[id]?.numericValue;if(typeof n === "number" && Number.isFinite(n))metrics[id]=n;}
  return {device,url:finalUrl,measuredAt:run.fetchTime || new Date().toISOString(),engine:`Lighthouse ${run.lighthouseVersion || "unknown"}`,scores,metrics,issues,fieldData:value.loadingExperience};
}
export async function measurePage(url:string,device:"mobile"|"desktop"):Promise<TechnicalResult> {
  const endpoint=new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url",url);endpoint.searchParams.set("strategy",device);
  for(const category of ["performance","seo","accessibility","best-practices"])endpoint.searchParams.append("category",category);
  if(process.env.PAGESPEED_API_KEY)endpoint.searchParams.set("key",process.env.PAGESPEED_API_KEY);
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(90000),redirect:"error"});
  if(!response.ok)throw new MeasurementProviderError(response.status);
  const rawAudit:unknown=await response.json();
  return {...parseLighthouse(rawAudit,device),rawAudit};
}
