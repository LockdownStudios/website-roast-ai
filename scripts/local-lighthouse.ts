// A separate native Node process prevents TypeScript transpilers from altering
// Lighthouse functions serialized to Chrome, and provides a killable deadline.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {withBrowserSlot} from '../lib/browserRuntime';
import {publicScanUrl} from '../lib/scan-v2/url';
import {parseLighthouse} from '../lib/scan-v2/measurement';
import type {TechnicalResult} from '../lib/scan-v2/contract';

export async function measureLocalLighthouse(url: string, device: 'mobile'|'desktop'): Promise<TechnicalResult> {
  const target=await publicScanUrl(url);
  return withBrowserSlot(async()=>{
    // The measurement child does not need database, email or AI credentials.
    const env:NodeJS.ProcessEnv={NODE_ENV:'production'};
    for(const [key,value] of Object.entries(process.env))if(/^(path|systemroot|windir|comspec|temp|tmp|userprofile|localappdata|appdata|home|programfiles(?:\(x86\))?|playwright_browsers_path)$/i.test(key))env[key]=value;
    const child=spawn(process.execPath,[path.resolve('scripts/local-lighthouse-engine.mjs')],{env,stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
    const rawAudit=await new Promise<unknown>((resolve,reject)=>{
      const stop=()=>{
        if(!child.pid||child.exitCode!==null)return;
        if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');
      };
      const deadline=setTimeout(()=>{stop();reject(new Error('Local Lighthouse audit deadline exceeded.'));},120000);
      child.once('error',()=>{clearTimeout(deadline);stop();reject(new Error('Local Lighthouse child could not start.'));});
      child.once('exit',()=>{clearTimeout(deadline);reject(new Error('Local Lighthouse exited before returning measurements.'));});
      child.once('message',(value:unknown)=>{
        clearTimeout(deadline);
        const result=value as {ok?:boolean;audit?:unknown;error?:string};
        if(result.ok&&result.audit)resolve(result.audit);else reject(new Error(result.error||'Local Lighthouse did not return measurements.'));
      });
      child.send!({url:target,device},error=>{if(error){clearTimeout(deadline);stop();reject(new Error('Local Lighthouse input could not be delivered.'));}});
    });
    const measured=parseLighthouse(rawAudit,device);
    await publicScanUrl(measured.url);
    return {...measured,engine:`${measured.engine} · local lab · simulated ${device}`,rawAudit};
  });
}
