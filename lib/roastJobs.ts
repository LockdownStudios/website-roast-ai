import "server-only";

export type RoastScanJob = {
  id: string;
  url: string;
  userId?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  reportId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

function baseUrl() {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error("SUPABASE_URL is not configured.");
  return value;
}

function key() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for scan jobs.");
  return value;
}

function enabled() {
  return process.env.ROAST_ASYNC_JOBS === "1";
}

function map(row: Record<string, unknown>): RoastScanJob | null {
  if (typeof row.id !== "string" || typeof row.url !== "string" || typeof row.status !== "string" || typeof row.created_at !== "string" || typeof row.updated_at !== "string") return null;
  if (!["queued", "running", "succeeded", "failed"].includes(row.status)) return null;
  return { id: row.id, url: row.url, userId: typeof row.user_id === "string" ? row.user_id : undefined, status: row.status as RoastScanJob["status"], attempts: Number(row.attempts) || 0, maxAttempts: Number(row.max_attempts) || 2, reportId: typeof row.report_id === "string" ? row.report_id : undefined, errorMessage: typeof row.error_message === "string" ? row.error_message : undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function request(path: string, init: RequestInit) {
  const serviceKey = key();
  const response = await fetch(new URL(`/rest/v1/${path}`, baseUrl()), { ...init, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Scan job storage rejected the request (${response.status}).`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function areRoastJobsEnabled() { return enabled() && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }

export async function enqueueRoastScan(url: string, userId?: string) {
  const rows = await request("roast_scan_jobs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ url, user_id: userId ?? null }) });
  const job = Array.isArray(rows) ? map(rows[0] || {}) : null;
  if (!job) throw new Error("Could not create the roast scan job.");
  return job;
}

export async function getRoastScanJob(id: string) {
  const rows = await request(`roast_scan_jobs?id=eq.${encodeURIComponent(id)}&limit=1`, { method: "GET" });
  return Array.isArray(rows) ? map(rows[0] || {}) : null;
}

export async function claimNextRoastScanJob() {
  const rows = await request("rpc/claim_next_roast_scan_job", { method: "POST", body: "{}" });
  return rows && typeof rows === "object" ? map(rows as Record<string, unknown>) : null;
}

export async function finishRoastScanJob(id: string, result: { reportId?: string; errorMessage?: string }) {
  const succeeded = Boolean(result.reportId);
  await request(`roast_scan_jobs?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: succeeded ? "succeeded" : "failed", report_id: result.reportId ?? null, error_message: result.errorMessage?.slice(0, 1000) ?? null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
}
