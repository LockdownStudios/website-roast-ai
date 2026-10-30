export const SCAN_VERSION = "scan-v2.1";
export const STAGES = ["collection", "visual", "mobile", "desktop", "narrative", "report"] as const;
export type Stage = typeof STAGES[number];
export type State = "queued" | "running" | "complete" | "unavailable";
export type Category = "performance" | "seo" | "accessibility" | "best-practices";
export type TechnicalResult = { device: "mobile" | "desktop"; url: string; measuredAt: string; engine: string; scores: Record<Category, number | null>; metrics: Record<string, number>; issues: Array<{ id: string; title: string; detail: string; category: Category }>; fieldData?: unknown; /** Kept only in the private worker checkpoint, excluded from normal polling. */ rawAudit?: unknown };
export type ScanResult = { version: typeof SCAN_VERSION; url: string; scope?: string; outcome: "complete" | "partial" | "unable-to-assess"; technical: TechnicalResult[]; overall: number | null; studio: Array<{ category: string; score: number | null; reason: string; rubric?: string; pageUrl?: string }>; clientReportReady?: boolean; reportId?: string; narrative?: { summary: string; strengths: string[]; findings: Array<{ headline?: string; observed: string; consequence: string; fix: string; pageUrl: string }>; recommendationReason: string }; limitations: string[] };
export type ScanJob = { id: string; owner_id: string; channel: "office" | "public"; url: string; profile: "outreach" | "full"; status: "queued" | "running" | "complete" | "partial" | "failed"; stages: Partial<Record<Stage, { status: State; message: string; at: string }>>; checkpoint: Record<string, unknown>; result: ScanResult | null; created_at: string; updated_at: string; lease_token: string | null; ai_started: boolean; cancel_requested: boolean };
export const WEIGHTS = { design:20, mobile:15, journey:15, clarity:10, trust:10, performance:10, accessibility:10, seo:5, "best-practices":5 } as const;
export function overallScore(values: Partial<Record<keyof typeof WEIGHTS, number | null>>) {
  if (Object.keys(WEIGHTS).some(key => typeof values[key as keyof typeof WEIGHTS] !== "number" || !Number.isFinite(values[key as keyof typeof WEIGHTS]) || values[key as keyof typeof WEIGHTS]! < 0 || values[key as keyof typeof WEIGHTS]! > 100)) return null;
  return Math.round(Object.entries(WEIGHTS).reduce((sum,[key,weight]) => sum + values[key as keyof typeof WEIGHTS]! * weight / 100,0));
}
