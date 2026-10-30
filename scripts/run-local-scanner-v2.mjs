import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const office=path.resolve(root,'../Web Design/lockdown-office-secure');
const ai=process.argv.includes('--ai');
const port=(flag,fallback)=>{const index=process.argv.indexOf(flag);const value=index<0?fallback:Number(process.argv[index+1]);if(!Number.isInteger(value)||value<1024||value>65535)throw new Error(`Invalid ${flag}`);return value;};
const roastPort=port('--roast-port',3000),officePort=port('--office-port',3001);
if(roastPort===officePort)throw new Error('Office and Roast AI need different ports');
if(!existsSync(path.join(office,'node_modules/next/dist/bin/next')))throw new Error('Office dependencies are missing; run npm ci in the Office project first.');
const shared=randomBytes(32).toString('base64url');
const common={...process.env,ROAST_AI_MAX_RUN_USD:'0.10',ROAST_V2_AI_ENABLED:ai?'1':'0',ROAST_V2_ENABLED:'1',ROAST_V2_PUBLIC_ENABLED:'0',ROAST_V2_MEASUREMENT_PROVIDER:process.argv.includes('--pagespeed')?'pagespeed':'local'};
const check=spawn(process.execPath,['--conditions','react-server','--import','tsx','scripts/check-scan-v2-setup.ts'],{cwd:root,env:common,stdio:'inherit',windowsHide:true});
const code=await new Promise(resolve=>check.on('exit',resolve));
if(code!==0)process.exit(typeof code==='number'?code:1);
console.log(ai?'Local AI mode: queued authorized scans may use credits, capped at US$0.10 per run.':'Local measurement-only mode: no paid AI generation.');
console.log(`Office preview: http://localhost:${officePort}/office/scanner?batch=1`);
console.log('Keep this terminal open. Ctrl+C stops only the child processes started by this launcher.');
const children=[];
let closing=false;
function stop(){
 if(closing)return;closing=true;
 for(const child of children){
  if(!child.pid)continue;
  if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  else child.kill('SIGTERM');
 }
 setTimeout(()=>process.exit(0),1000);
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
function run(cwd,args,env){const child=spawn(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});children.push(child);child.on('error',error=>{console.error(error.message);stop();});child.on('exit',()=>{if(!closing){console.error('A local scanner process exited. Stopping this launcher’s remaining processes.');stop();}});}
run(root,['node_modules/next/dist/bin/next','dev','--port',String(roastPort)],{...common,OFFICE_ROAST_API_SECRET:shared,NEXT_PUBLIC_SITE_URL:`http://localhost:${roastPort}`});
run(office,['node_modules/next/dist/bin/next','dev','--port',String(officePort)],{...process.env,WEB_ROAST_API_BASE_URL:`http://localhost:${roastPort}`,WEB_ROAST_API_SECRET:shared,NEXT_PUBLIC_SITE_URL:`http://localhost:${officePort}`});
run(root,['--conditions','react-server','--import','tsx','scripts/scan-worker-v2.ts'],{...common,OFFICE_ROAST_API_SECRET:shared,...(ai?{ROAST_AI_ENABLED:'1',ROAST_AI_ALLOW_LOCAL:'1'}:{})});
