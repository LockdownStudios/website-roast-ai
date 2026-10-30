import {publicScanUrl} from '../lib/scan-v2/url.ts';

/** @param {Pick<import('puppeteer-core').Page,'setRequestInterception'|'on'>} page */
export async function guardLighthousePage(page) {
  const checked=new Map();
  const blocked=[];
  await page.setRequestInterception(true);
  page.on('request',async request=>{
      try {
        const target=new URL(request.url());
        if(!['http:','https:'].includes(target.protocol)||target.username||target.password||target.port&&!['80','443'].includes(target.port))throw new Error('Unsupported resource');
        if((checked.get(target.origin)||0)<Date.now()){
          await publicScanUrl(target.href);
          checked.set(target.origin,Date.now()+30000);
        }
        if(!request.isInterceptResolutionHandled())await request.continue();
      } catch {
        if(blocked.length<20){try{const target=new URL(request.url());blocked.push(`${target.protocol}//${target.host}`);}catch{blocked.push('invalid URL');}}
        if(!request.isInterceptResolutionHandled())await request.abort('blockedbyclient').catch(()=>undefined);
      }
  });
  return {blocked};
}
