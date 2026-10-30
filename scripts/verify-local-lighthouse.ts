import assert from 'node:assert/strict';
import {guardLighthousePage} from './lighthouse-network.mjs';
import {parseLighthouse} from '../lib/scan-v2/measurement';
import {scanPresentation} from '../lib/scan-v2/presentation';
import type {Page, HTTPRequest} from 'puppeteer-core';

async function main(){
  let onRequest:((request:HTTPRequest)=>void)|undefined;
  let intercepted=false;
  const page={setRequestInterception:async(enabled:boolean)=>{intercepted=enabled;},on:(_event:string,handler:(request:HTTPRequest)=>void)=>{onRequest=handler;}};
  await guardLighthousePage(page as unknown as Pick<Page,'setRequestInterception'|'on'>);
  assert.equal(intercepted,true);
  for(const url of ['http://127.0.0.1/','http://169.254.169.254/','http://[::1]/','https://example.test:8080/','file:///C:/private.txt','https://user:password@example.test/']){
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Request guard did not resolve')),3000);
      onRequest!({url:()=>url,isInterceptResolutionHandled:()=>false,continue:async()=>{clearTimeout(timer);reject(new Error('Unsafe request continued'));},abort:async()=>{clearTimeout(timer);resolve();}} as unknown as HTTPRequest);
    });
  }
  const measured=parseLighthouse({lighthouseResult:{finalDisplayedUrl:'https://example.test/',lighthouseVersion:'fixture',categories:{performance:{score:0},seo:{score:.91},accessibility:{score:null},'best-practices':{score:.95}}}},'desktop');
  assert.equal(measured.url,'https://example.test/');
  assert.deepEqual(measured.scores,{performance:0,seo:91,accessibility:null,'best-practices':95});
  measured.engine+=' · local lab · simulated desktop';
  const presentation=scanPresentation({version:'scan-v2.1',url:measured.url,outcome:'partial',overall:null,studio:[],technical:[measured],limitations:[]});
  assert.ok(presentation.technical?.includes('local lab'),'PDF must identify local measurement environment');
  assert.equal(measured.fieldData,undefined,'Local lab must never invent real-user field data');
  console.log('Local Lighthouse checks passed: private/credentialled/unsupported requests blocked, current LHR URL parsing, zero versus unknown scores, source labelled in PDF, no fabricated field data. No browser scan or paid AI call.');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
