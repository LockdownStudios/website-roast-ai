import {measureLocalLighthouse} from './local-lighthouse';
import {mkdir,writeFile} from 'node:fs/promises';

// Explicitly isolated measurement: no queue submission, Office write or AI call.
async function main(){
 const url=process.argv.includes('--control')?'https://example.com/':process.argv.includes('--business')?'https://www.propservices.co.za/':'https://www.lockdownstudios.com/';
 const measured=await measureLocalLighthouse(url,'mobile');
 await mkdir('tmp',{recursive:true});
 await writeFile('tmp/local-lighthouse-smoke.json',JSON.stringify(measured,null,2));
 console.log(JSON.stringify({url:measured.url,engine:measured.engine,scores:measured.scores,metrics:measured.metrics,issues:measured.issues.length,aiCalls:0}));
 if(Object.values(measured.scores).some(score=>score===null))process.exitCode=1;
}
void main().catch(error=>{console.error(error instanceof Error?error.stack:'Local measurement failed');process.exitCode=1;});
