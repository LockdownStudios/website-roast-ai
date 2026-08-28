import type { NextRequest } from "next/server";
import { POST as authExchangePost } from "@/lib/api-routes/auth/exchange/route";
import { POST as authMagicLinkPost } from "@/lib/api-routes/auth/magic-link/route";
import { GET as authMeGet } from "@/lib/api-routes/auth/me/route";
import { POST as authOtpStartPost } from "@/lib/api-routes/auth/otp/start/route";
import { POST as authOtpVerifyPost } from "@/lib/api-routes/auth/otp/verify/route";
import { POST as feedbackPost } from "@/lib/api-routes/feedback/route";
import { GET as internalBenchmarksGet } from "@/lib/api-routes/internal/benchmarks/route";
import { POST as internalCalibratePost } from "@/lib/api-routes/internal/calibrate/route";
import { POST as internalOfficeRoastPost } from "@/lib/api-routes/internal/office-roast/route";
import { POST as paystackInitializePost } from "@/lib/api-routes/paystack/initialize/route";
import { GET as paystackVerifyGet } from "@/lib/api-routes/paystack/verify/route";
import { POST as paystackWebhookPost } from "@/lib/api-routes/paystack/webhook/route";
import { GET as reportsMineGet } from "@/lib/api-routes/reports/mine/route";
import { GET as reportsDownloadGet } from "@/lib/api-routes/reports/download/route";
import { POST as reportsUnlockPost } from "@/lib/api-routes/reports/unlock/route";
import { GET as roastGet, POST as roastPost } from "@/lib/api-routes/roast/route";
import { POST as trackPost } from "@/lib/api-routes/track/route";
import { GET as trackSummaryGet } from "@/lib/api-routes/track/summary/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ApiMethod = "GET" | "POST";
type ApiContext = { params: Promise<{ path: string[] }> };
type ApiHandler = (request: NextRequest) => Response | Promise<Response>;

const routes: Record<string, Partial<Record<ApiMethod, ApiHandler>>> = {
  "auth/exchange": { POST: authExchangePost },
  "auth/magic-link": { POST: authMagicLinkPost },
  "auth/me": { GET: authMeGet },
  "auth/otp/start": { POST: authOtpStartPost },
  "auth/otp/verify": { POST: authOtpVerifyPost },
  feedback: { POST: feedbackPost },
  "internal/benchmarks": { GET: internalBenchmarksGet },
  "internal/calibrate": { POST: internalCalibratePost },
  "internal/office-roast": { POST: internalOfficeRoastPost },
  "paystack/initialize": { POST: paystackInitializePost },
  "paystack/verify": { GET: paystackVerifyGet },
  "paystack/webhook": { POST: paystackWebhookPost },
  "reports/download": { GET: reportsDownloadGet },
  "reports/mine": { GET: reportsMineGet },
  "reports/unlock": { POST: reportsUnlockPost },
  roast: { GET: roastGet, POST: roastPost },
  track: { POST: trackPost },
  "track/summary": { GET: trackSummaryGet }
};

export async function GET(request: NextRequest, context: ApiContext) {
  return dispatch(request, context, "GET");
}

export async function POST(request: NextRequest, context: ApiContext) {
  return dispatch(request, context, "POST");
}

export async function OPTIONS(_request: NextRequest, context: ApiContext) {
  const route = await routeKey(context);
  const methods = routes[route] ? allowedMethods(route) : [];

  return new Response(null, {
    status: methods.length ? 204 : 404,
    headers: methods.length ? { Allow: methods.join(", ") } : undefined
  });
}

async function dispatch(request: NextRequest, context: ApiContext, method: ApiMethod) {
  const route = await routeKey(context);
  const routeHandlers = routes[route];
  const handler = routeHandlers?.[method];

  if (!routeHandlers) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!handler) {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: allowedMethods(route).join(", ") }
      }
    );
  }

  return handler(request);
}

async function routeKey(context: ApiContext) {
  const { path } = await context.params;
  return path.join("/");
}

function allowedMethods(route: string) {
  return Object.keys(routes[route] ?? {}).concat("OPTIONS");
}
