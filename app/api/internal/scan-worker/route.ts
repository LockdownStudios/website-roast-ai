import { NextRequest, NextResponse } from "next/server";
import { areRoastJobsEnabled, claimNextRoastScanJob, finishRoastScanJob } from "@/lib/roastJobs";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const workerSecret = process.env.ROAST_JOB_WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(
    (workerSecret && authorization === `Bearer ${workerSecret}`) ||
      (cronSecret && authorization === `Bearer ${cronSecret}`),
  );
}

async function runWorker(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!areRoastJobsEnabled()) return NextResponse.json({ error: "Background scans are not enabled." }, { status: 409 });

  const job = await claimNextRoastScanJob();
  if (!job) return NextResponse.json({ processed: false });

  try {
    const response = await fetch(new URL("/api/roast", request.nextUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-roast-worker-secret": process.env.ROAST_JOB_WORKER_SECRET! },
      body: JSON.stringify({ url: job.url, workerUserId: job.userId }),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!response.ok || !payload?.id) throw new Error(payload?.error || `Worker roast failed (${response.status}).`);
    await finishRoastScanJob(job.id, { reportId: payload.id });
    return NextResponse.json({ processed: true, jobId: job.id, reportId: payload.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker roast failed.";
    await finishRoastScanJob(job.id, { errorMessage: message });
    return NextResponse.json({ processed: true, jobId: job.id, failed: true });
  }
}

export async function GET(request: NextRequest) {
  return runWorker(request);
}

export async function POST(request: NextRequest) {
  return runWorker(request);
}
