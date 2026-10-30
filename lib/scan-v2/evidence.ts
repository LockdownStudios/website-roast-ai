import type {TechnicalResult} from './contract';
import type {TechnicalCheck} from '../types';

/** Feed the same measured facts to the writer and editor; never convert HTML hints to scores. */
export function measuredEvidence(existing: TechnicalCheck[] = [], runs: TechnicalResult[]): TechnicalCheck[] {
  if (!runs.length) return existing;
  return [
    ...existing.filter(check => check.name !== 'Speed and Core Web Vitals').slice(0, 7),
    ...runs.map(run => ({
      name: `${run.engine} — ${run.device}`,
      status: 'observed' as const,
      detail: `${run.measuredAt}. Tested page only. ${Object.entries(run.scores).map(([key, value]) => `${key}: ${value === null ? 'unavailable' : `${value}/100`}`).join('; ')}. Lab metrics, not measured business outcomes or full-site compliance.`,
      pageUrls: [run.url],
    })),
    ...runs.flatMap(run => run.issues.slice(0, 2).map(issue => ({
      name: `${run.device}: ${issue.title}`.slice(0, 100),
      status: 'review' as const,
      detail: `${issue.category} automated check ${issue.id} failed on this tested page. Confirm context before recommending a change.`,
      pageUrls: [run.url],
    }))),
  ].slice(0, 12);
}
