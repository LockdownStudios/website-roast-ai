import {publicScanUrl} from './url';
const checked=new Map<string,number>();
export async function checkWorkerResource(url:string){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port&&!['80','443'].includes(parsed.port))throw new Error('Unsupported resource URL');const key=parsed.origin;if((checked.get(key)||0)>Date.now())return;await publicScanUrl(url);checked.set(key,Date.now()+30000);if(checked.size>1000)checked.clear();}
export function installWorkerFetchGuard(){
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  if(input instanceof Request)throw new Error('Worker requests require explicit URLs');
  let url=String(input);
  for(let hops=0;hops<6;hops++){
   await checkWorkerResource(url);const response=await original(url,{...init,redirect:init?.redirect==='error'?'error':'manual'});
   if(![301,302,303,307,308].includes(response.status)||init?.redirect==='manual'||init?.redirect==='error')return response;
   const destination=response.headers.get('location');if(!destination)return response;
   await response.body?.cancel();if(init?.method && !['GET','HEAD'].includes(init.method.toUpperCase()))throw new Error('Worker refused to redirect credentials or a write request');
   const next=new URL(destination,url);if(next.origin!==new URL(url).origin && new Headers(init?.headers).has('authorization'))throw new Error('Credential redirect refused');url=next.toString();
  }throw new Error('Too many redirects');
 };
}
export async function guardBrowserContext(value:unknown){
 if(process.env.ROAST_WORKER_NETWORK_GUARD!=='1')return;
 const context=value as {route:(pattern:string,handler:(route:{request:()=>{url:()=>string};continue:()=>Promise<void>;abort:()=>Promise<void>})=>Promise<void>)=>Promise<void>;routeWebSocket?:(pattern:string,handler:(socket:{close:()=>void})=>void)=>Promise<void>};
 await context.route('**/*',async route=>{try{await checkWorkerResource(route.request().url());await route.continue();}catch{await route.abort();}});
 await context.routeWebSocket?.('**/*',socket=>socket.close());
}
