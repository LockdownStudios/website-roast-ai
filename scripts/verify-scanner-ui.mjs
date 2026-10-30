import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// UI-only regression against a local dev server. All scan API traffic is mocked;
// this does not exercise the production worker or authorize a paid generation.
const origin=process.env.SCANNER_TEST_URL||'http://localhost:3000';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('UI fixture test is restricted to localhost');
const id='00000000-0000-4000-8000-000000000001';
const names=['collection','visual','mobile','desktop','narrative','report'];
const technical={device:'mobile',url:'https://example.test/',measuredAt:new Date().toISOString(),engine:'Lighthouse UI fixture (synthetic)',scores:{performance:80,seo:80,accessibility:80,'best-practices':80},metrics:{'largest-contentful-paint':2400},issues:[]};
const result={version:'scan-v2.1',url:technical.url,outcome:'complete',technical:[technical],overall:77,studio:['design','mobile','clarity','trust','journey'].map(category=>({category,score:75,reason:'Synthetic UI fixture, not a website assessment.',rubric:'studio-rubric-v1-preview'})),clientReportReady:true,narrative:{summary:'Synthetic UI fixture. No real business was audited.',strengths:['Synthetic fixture only.'],findings:[{headline:'Fixture finding',observed:'A UI-only observation.',consequence:'This is test content.',fix:'Inspect the UI result.',pageUrl:technical.url}],recommendationReason:'Not a client report.'},limitations:['Internal synthetic fixture; no live audit or AI request.']};
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',error=>console.error('Browser error:',error.message));
 let submissions=0,lookups=0;
 await page.route(`${origin}/api/scans**`,async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST'){submissions++;return route.fulfill({json:{id,jobs:[{id,url:technical.url,status:'queued'}],errors:[]}});}
  if(!url.searchParams.get('id'))return route.fulfill({json:{jobs:[{id,url:technical.url,status:'queued'}]}});
  lookups++;
  const complete=lookups>=2;
  return route.fulfill({json:{id,url:technical.url,status:complete?'complete':'running',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),stages:Object.fromEntries(names.map(name=>[name,{status:complete?(name==='desktop'?'unavailable':'complete'):(name==='collection'?'complete':'running'),message:'Synthetic saved stage'}])),result:complete?result:null}});
 });
 await page.goto(`${origin}/scanner`,{waitUntil:'networkidle'});
 await page.getByRole('navigation',{name:'Saved scans'}).waitFor({timeout:20000});
 await page.getByLabel('Website URL',{exact:true}).fill(technical.url);
 await page.getByRole('button',{name:'Start scan',exact:true}).click();
 await page.getByText('report: complete',{exact:true}).waitFor({timeout:20000,state:'attached'});
 assert.equal(submissions,1);
 assert.match(await page.locator('main.scanner').innerText(),/Overall: 77\/100/);
 assert.equal(await page.getByRole('button',{name:'Download available report',exact:true}).isEnabled(),true);
 await page.reload({waitUntil:'networkidle'});
 await page.getByText('report: complete',{exact:true}).waitFor({state:'attached'});
 assert.equal(submissions,1,'Refresh must resume the existing job without another submission');
 await mkdir('tmp',{recursive:true});
 await page.screenshot({path:'tmp/scan-v2-ui-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'tmp/scan-v2-ui-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Scanner must not overflow the mobile viewport');
 console.log('Scanner UI fixtures passed: persisted stages, 100-point score, PDF readiness, refresh without resubmission and mobile width. API mocked; no live worker or paid AI test.');
}finally{await browser.close();}
