import {SCAN_VERSION, STAGES, type ScanJob, type ScanResult, type Stage, type TechnicalResult} from './contract';
import {checkpoint, scanStorage} from './storage';
import {measurePage,MeasurementProviderError} from './measurement';
import {scrapeWebsite} from '../scrape';
import {analyzeVisualSignals} from '../visual';
import {scoreWebsite} from '../scoring';
import {generateOutreachAudit} from '../outreach';
import {isClientReadyReport} from '../reportQuality';
import type {ScrapedWebsiteData, VisualAudit} from '../types';
import {publicScanUrl} from './url';
import {measuredEvidence} from './evidence';
import {studioScorecard} from './rubric';
import {scanPresentation} from './presentation';
import {renderCompactReportPdf} from '../compactReportPdf';

type Services = Partial<{
  save: typeof checkpoint; measure: typeof measurePage; collect: typeof scrapeWebsite;
  capture: typeof analyzeVisualSignals; validate: typeof publicScanUrl; generate: typeof generateOutreachAudit;
}>;

export async function processScan(job: ScanJob, services: Services = {}) {
  const store = services.save || checkpoint, measure = services.measure || measurePage;
  const collect = services.collect || scrapeWebsite, capture = services.capture || analyzeVisualSignals;
  const validate = services.validate || publicScanUrl, generate = services.generate || generateOutreachAudit;
  const limitations = [...(job.result?.limitations || [])];
  let scraped = job.checkpoint.scraped as ScrapedWebsiteData | undefined;
  let visual = job.checkpoint.visual as VisualAudit | undefined;
  const technical = (job.checkpoint.technical as TechnicalResult[] | undefined) || [];

  // Parallel collectors share one serialized write queue. Build patches inside it so
  // a delayed stage cannot overwrite another stage's newer checkpoint or progress.
  let writes = Promise.resolve();
  const save = (patch: () => Partial<ScanJob>) => {
    writes = writes.then(() => store(job, patch()));
    return writes;
  };
  const stage = (id: Stage, status: 'running' | 'complete' | 'unavailable', message: string) =>
    save(() => ({stages: {...job.stages, [id]: {status, message, at: new Date().toISOString()}}}));
  const snapshot = (): ScanResult => ({
    version: SCAN_VERSION, url: job.url,
    scope: `${scraped?.crawl?.pageCount || (scraped?1:0)} public pages sampled. ${visual?.available?'Desktop and mobile homepage captures. ':''}No form, booking or payment submission was tested.`,
    outcome: technical.length || job.result?.narrative ? 'partial' : 'unable-to-assess',
    technical: technical.map(run => {
      const {rawAudit, ...publicResult} = run;
      void rawAudit;
      return publicResult;
    }),
    overall: job.result?.overall ?? null,
    studio: job.result?.studio || ['Design and UX', 'Mobile usability', 'Content clarity', 'Trust and proof', 'Customer journey and CTA']
      .map(category => ({category, score: null, reason: 'Validated studio rubric assessment not available for this scan.'})),
    narrative: job.result?.narrative,
    limitations: [...new Set(limitations)],
  });

  try {
    await validate(job.url);
    if(scraped)await stage('collection','complete',`${scraped.crawl?.pageCount||1} previously collected pages restored`);
    if(visual)await stage('visual',visual.available?'complete':'unavailable','Previous capture outcome restored');
    const collectAndCapture = async () => {
      if (job.cancel_requested) return;
      if (!scraped) {
        await stage('collection', 'running', 'Discovering and reading public pages');
        try {
          scraped = await collect(job.url);
          await save(() => ({checkpoint: {...job.checkpoint, scraped}}));
          await stage('collection', 'complete', `${scraped.crawl?.pageCount || 1} pages read`);
        } catch {
          limitations.push('Content collection failed. Business identity and recommendations were not inferred.');
          await stage('collection', 'unavailable', 'Content collection failed; technical measurements continue');
        }
      }
      if (job.cancel_requested || !scraped || visual) return;
      await stage('visual', 'running', 'Capturing the actual desktop and mobile website');
      try {
        visual = await capture(job.url);
        await save(() => ({checkpoint: {...job.checkpoint, visual, preview: visual?.desktop?.screenshotDataUrl}}));
        await stage('visual', visual.available ? 'complete' : 'unavailable', visual.available ? 'Desktop and mobile captures saved' : 'Capture unavailable; other checks continue');
      } catch {
        limitations.push('Visual capture failed. No visual judgement was inferred; other checks continue.');
        await stage('visual', 'unavailable', 'Capture failed; other checks continue');
      }
    };
    const measureDevices = async () => {
      for (const device of (job.profile === 'full' ? ['mobile', 'desktop'] : ['mobile']) as Array<'mobile' | 'desktop'>) {
        if (job.cancel_requested) break;
        if (technical.some(run => run.device === device)) {await stage(device,'complete','Saved measurement restored; no repeat audit requested');continue;}
        await stage(device, 'running', `Running real Lighthouse ${device} measurements`);
        try {
          const {rawAudit, ...measured} = await measure(job.url, device);
          technical.push(measured);
          await save(() => ({checkpoint: {...job.checkpoint, technical}, result: snapshot()}));
          await stage(device, 'complete', `${device} measurement saved`);
          if (rawAudit) {
            try {await scanStorage('roast_artifacts_v2?on_conflict=job_id,device', {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify({job_id:job.id,device,payload:rawAudit})});}
            catch {limitations.push(`${device} raw diagnostics could not be stored. Normalized measurements were retained.`);}
          }
        } catch (error) {
          limitations.push(`${device} Lighthouse measurement unavailable${error instanceof MeasurementProviderError?` (PageSpeed HTTP ${error.status})`:''}. No substitute score was generated.`);
          await stage(device, 'unavailable', `${device} measurement unavailable`);
        }
      }
    };
    // Wait for both collectors, including on failure: no orphaned collector can keep
    // working after this worker has decided to recover a failed storage lease.
    const stages = await Promise.allSettled([collectAndCapture(), measureDevices()]);
    const failure = stages.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    await save(() => ({result: snapshot()}));

    if (scraped && job.channel === 'office' && process.env.ROAST_V2_AI_ENABLED === '1' && !job.ai_started && !job.cancel_requested && visual?.available) {
      await stage('narrative', 'running', 'Writing and checking the company-specific roast');
      await save(() => ({ai_started: true}));
      try {
        if(job.cancel_requested)throw new Error('Stopped before model request');
        const evidence = {...scraped, visualAudit: visual, technicalChecks: measuredEvidence(scraped.technicalChecks, technical)};
        const generated = await generate(evidence, scoreWebsite(evidence), {channel: 'office',userId:job.owner_id.replace(/^office:/,''), reportKind: 'outreach'}, {studio:true});
        if (!isClientReadyReport(generated.roast) || !generated.roast.outreach) throw new Error('Narrative not approved');
        const audit = generated.roast.outreach;
        const narrative: NonNullable<ScanResult['narrative']> = {
          summary: audit.summary, strengths: audit.strengths, recommendationReason: audit.recommendationReason,
          findings: audit.findings.map(({headline, observed, consequence, fix, pageUrl}) => ({headline, observed, consequence, fix, pageUrl})),
        };
        const scorecard = audit.studioAssessments ? studioScorecard(audit.studioAssessments,technical) : {studio:snapshot().studio,overall:null};
        await save(() => ({result: {...snapshot(), narrative,...scorecard},checkpoint:{...job.checkpoint,aiUsage:generated.usage}}));
        await stage('narrative', 'complete', 'Evidence editor approved the narrative');
      } catch {
        limitations.push('AI narrative unavailable or unapproved. Completed technical results remain independently available.');
        await stage('narrative', 'unavailable', 'Narrative withheld; no automatic paid retry');
      }
    }
    for (const id of STAGES.filter(value => value !== 'report')) {
      if (!job.stages[id] || job.stages[id]?.status === 'running') {
        const message = job.cancel_requested ? 'Stopped at operator request; completed results retained' : id==='narrative'&&job.channel==='office'&&process.env.ROAST_V2_AI_ENABLED!=='1' ? 'Technical-only development test: paid AI is disabled' : 'Not assessed in this profile; available results retained';
        await stage(id, 'unavailable', message);
      }
    }
    const result = snapshot();
    const requiredDevices=job.profile==='full'?['mobile','desktop']:['mobile'];
    if(result.overall!==null && requiredDevices.every(device=>result.technical.some(run=>run.device===device&&Object.values(run.scores).every(value=>value!==null))))result.outcome='complete';
    await stage('report', 'running', 'Compiling and checking the two-page client report');
    let ready=false;
    if(result.technical.length || result.narrative){
      try{await renderCompactReportPdf(scanPresentation(result));ready=true;}
      catch{result.limitations.push('The compact PDF did not pass layout preflight. Web results and diagnostics remain available; no client PDF is approved.');result.outcome='partial';}
    }
    result.clientReportReady=ready;
    // Report readiness and terminal status are committed atomically. The UI cannot
    // announce a saved report in the gap before its final database write succeeds.
    await save(() => ({result, status: result.outcome === 'complete' ? 'complete' : result.outcome === 'partial' ? 'partial' : 'failed',stages:{...job.stages,report:{status:ready?'complete':'unavailable',message:ready?'Report saved; compact PDF layout checked':'No client PDF approved; available diagnostics retained',at:new Date().toISOString()}}}));
  } catch {
    // A failed save poisons the write queue. Stop on a lost lease; the database
    // recovery procedure owns the next attempt and retains successful checkpoints.
    await writes.catch(() => undefined);
    throw new Error('Scan processing interrupted; persisted checkpoints require lease recovery.');
  }
}
