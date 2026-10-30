import {overallScore, type TechnicalResult} from './contract';

export const STUDIO_RUBRIC_VERSION = 'studio-rubric-v1-preview';
export const STUDIO_CATEGORIES = ['design', 'mobile', 'clarity', 'trust', 'journey'] as const;
export type StudioCategory = typeof STUDIO_CATEGORIES[number];
export type StudioAssessment = {category: StudioCategory; level: number | null; reason: string; imageIndex: number | null; pageUrl?: string; evidence?: string};
export const STUDIO_RUBRIC_PROMPT = `Also assess the five studio categories using studio-rubric-v1-preview. These are scoped professional judgements, not Google measurements. For each category return one level (0-4 or null), a brief evidence-grounded reason and a citation. Each reason must be ONE complete sentence within 160 characters; never start a second sentence or cut off a word to fit. null means insufficient evidence; never grade missing data as zero. Design and mobile require an actual screenshot citation. Other categories require a relevant screenshot or exact text citation. Judge only the sampled pages, never claim a whole-site absence. Do not use industry stereotypes or assume every business needs a quote form.
Level anchors:
design: 0 visibly unusable; 1 major visible hierarchy/consistency problems; 2 mixed hierarchy/spacing; 3 coherent hierarchy and consistent styling; 4 unusually polished composition with clear priorities.
mobile: 0 captured content unusable; 1 major visible reading/action obstacles; 2 usable with visible friction; 3 readable and clearly prioritised; 4 particularly effective mobile presentation. Do not imply untested forms or scrolling work.
clarity: 0 visible offer contradictory; 1 difficult to identify the offer; 2 understandable but poorly prioritised; 3 clear offer and audience; 4 concise, distinctive offer with a clear next decision.
trust: 0 contradictory identity/proof in the sampled evidence; 1 weakly explained identity; 2 identifiable business with limited relevant proof in the sample; 3 clear identity and relevant attributable proof; 4 specific, well-integrated substantiation. Unseen proof is unknown, not absent; insufficient coverage requires null.
journey: 0 an observed route contradicts its stated purpose; 1 next decision visibly confusing; 2 appropriate route with visible friction; 3 appropriate and clear next action; 4 especially well-prioritised action and useful reassurance. Base the action on the actual offer and observed routes; never claim a successful booking, payment or enquiry submission without a recorded test.
Levels map to 0/25/50/75/100 in server code. Explain mixed evidence candidly. Only the independent editor's final assessments are used. Return every category exactly once. A score must never override a measured technical result.`;

export const studioAssessmentSchema = {
  type: 'array', minItems: 5, maxItems: 5,
  items: {type:'object',additionalProperties:false,properties:{
    category:{type:'string',enum:[...STUDIO_CATEGORIES]}, level:{type:['integer','null'],enum:[null,0,1,2,3,4]},
    reason:{type:'string',pattern:'^[\\s\\S]{1,160}$'},
    imageIndex:{type:['integer','null'],enum:[null,0,1]},
    evidenceId:{type:['string','null'],pattern:'^e(0|[1-9][0-9]*)$'},
    pageId:{type:['string','null'],pattern:'^p(0|[1-9][0-9]*)$'},
  },required:['category','level','reason','imageIndex','evidenceId','pageId']},
};

export function validateStudioAssessments(value: unknown): asserts value is StudioAssessment[] {
  if (!Array.isArray(value) || value.length !== 5 || new Set(value.map(item => item.category)).size !== 5) throw new Error('Studio rubric requires each category exactly once');
  for (const item of value) {
    if (!STUDIO_CATEGORIES.includes(item.category) || ![null,0,1,2,3,4].includes(item.level) || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 160 || ![null,0,1].includes(item.imageIndex)) throw new Error('Invalid studio assessment');
    if (item.level !== null) {
      if (typeof item.pageUrl !== 'string' || !/^https?:$/.test(new URL(item.pageUrl).protocol) || typeof item.evidence !== 'string' || !item.evidence.trim()) throw new Error('A studio score needs attributable evidence');
      if (['design','mobile'].includes(item.category) && item.imageIndex === null) throw new Error('Visual studio scores require screenshot evidence');
      if (item.category === 'mobile' && item.imageIndex !== 1) throw new Error('Mobile grading requires the mobile screenshot');
    }
  }
}

export function studioScorecard(assessments: StudioAssessment[], technical: TechnicalResult[]) {
  validateStudioAssessments(assessments);
  const studio = assessments.map(item => ({category:item.category,score:item.level === null ? null : item.level*25,reason:studioDisplayReason(item.reason),pageUrl:item.pageUrl,rubric:STUDIO_RUBRIC_VERSION}));
  const values = Object.fromEntries(studio.map(item => [item.category,item.score]));
  // Mobile is the declared primary technical profile; never average devices silently.
  const measured = technical.find(run => run.device === 'mobile');
  return {studio, overall:overallScore({...values,...measured?.scores})};
}

/** Keep an approved complete sentence if a field-limit cut left a second
 * sentence unfinished. Raw source assessment/citations remain unchanged. */
export function studioDisplayReason(reason:string) {
  const value=reason.trim();
  if(/[.!?]$/.test(value))return value;
  return value.match(/^[\s\S]*[.!?](?=\s|$)/)?.[0] || value;
}
