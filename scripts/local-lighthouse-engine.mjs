// Run directly under Node, WITHOUT tsx/esbuild. Lighthouse serializes functions
// for Chrome; transpiler-injected __name helpers break those browser functions.
import lighthouse,{desktopConfig} from 'lighthouse';
import puppeteer from 'puppeteer-core';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {publicScanUrl} from '../lib/scan-v2/url.ts';
import {guardLighthousePage} from './lighthouse-network.mjs';

let browser;
process.on('SIGTERM',()=>{void (browser?.close()||Promise.resolve()).finally(()=>process.exit(1));});
process.once('message',async input=>{
  let response;
  try {
    const {url,device}=input||{};
    if(!['mobile','desktop'].includes(device))throw new Error('Unsupported audit device');
    const target=await publicScanUrl(url);
    const executablePath=chromium.executablePath();
    if(!existsSync(executablePath))throw new Error('Local audit browser missing. Run npx playwright install chromium.');
    browser=await puppeteer.launch({executablePath,headless:true,pipe:true,defaultViewport:null,ignoreDefaultArgs:['--enable-automation'],args:['--disable-dev-shm-usage'],timeout:30000,protocolTimeout:60000});
    const page=await browser.newPage();
    await page.setBypassServiceWorker(true);
    const guard=await guardLighthousePage(page);
    const failures=[];
    const documents=[];
    page.on('requestfailed',request=>{if(failures.length<20)failures.push({origin:new URL(request.url()).origin,error:request.failure()?.errorText});});
    page.on('response',response=>{if(response.request().isNavigationRequest()&&documents.length<8)documents.push({origin:new URL(response.url()).origin,status:response.status()});});
    const result=await lighthouse(target,{logLevel:'error',output:'json',onlyCategories:['performance','seo','accessibility','best-practices'],throttlingMethod:'simulate',maxWaitForLoad:45000,maxWaitForFcp:20000},device==='desktop'?desktopConfig:undefined,page);
    if(!result?.lhr)throw new Error('Local Lighthouse did not return measurements');
    if(result.lhr.runtimeError)throw new Error(JSON.stringify({code:result.lhr.runtimeError.code,documents,blocked:guard.blocked,failures,warnings:result.lhr.runWarnings?.slice(0,2)}));
    await publicScanUrl(result.lhr.finalUrl||result.lhr.finalDisplayedUrl);
    response={ok:true,audit:{lighthouseResult:result.lhr,measurementEnvironment:{provider:'local-lighthouse',throttling:'simulate',browser:await browser.version()}}};
  }catch(error){response={ok:false,error:error instanceof Error?error.message.slice(0,500):'Local Lighthouse failed'};}
  finally{await browser?.close().catch(()=>undefined);}
  process.send?.(response,()=>process.disconnect());
});
