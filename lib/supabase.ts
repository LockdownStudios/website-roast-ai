import "server-only";
import type {
  AnalyticsEvent,
  PaymentTransaction,
  RoastFeedbackEntry,
  StoredRoastReport,
  ToneAccuracy,
} from "./types";

type SupabaseRoastRow = {
  id: string;
  url: string;
  user_id: string | null;
  scrape_hash: string;
  scraped: unknown;
  scoring: unknown;
  roast: unknown;
  created_at: string;
};

type SupabaseAnalyticsRow = {
  name: string;
  session_id: string;
  variant: "A" | "B" | null;
  metadata: Record<string, string | number | boolean> | null;
  created_at: string;
};

type SupabaseFeedbackRow = {
  report_id: string;
  user_id: string | null;
  session_id: string;
  url: string;
  score_at_review: number;
  score_accuracy: number;
  tone_accuracy: ToneAccuracy;
  notes: string | null;
  created_at: string;
};

type SupabasePaymentTransactionRow = {
  reference: string;
  report_id: string;
  user_id: string | null;
  email: string | null;
  amount_kobo: number;
  currency: string;
  status: PaymentTransaction["status"];
  provider_status: string | null;
  provider_message: string | null;
  authorization_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const ROAST_SELECT =
  "id,url,user_id,scrape_hash,scraped,scoring,roast,created_at";
const ANALYTICS_SELECT = "name,session_id,variant,metadata,created_at";
const FEEDBACK_SELECT =
  "report_id,user_id,session_id,url,score_at_review,score_accuracy,tone_accuracy,notes,created_at";
const PAYMENT_SELECT =
  "reference,report_id,user_id,email,amount_kobo,currency,status,provider_status,provider_message,authorization_url,metadata,created_at,updated_at";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getSupabaseUrl(): string | null {
  const value = process.env.SUPABASE_URL?.trim();
  return value ? value : null;
}

function getSupabaseKey(): string | null {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  return value ? value : null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

function buildRestUrl(path: string, params?: URLSearchParams): string {
  const base = getSupabaseUrl();
  if (!base) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  const url = new URL(`/rest/v1/${path}`, base);
  if (params) {
    url.search = params.toString();
  }
  return url.toString();
}

function toRoastRow(report: StoredRoastReport): SupabaseRoastRow {
  return {
    id: report.id,
    url: report.url,
    user_id: report.userId ?? null,
    scrape_hash: report.scrapeHash,
    scraped: report.scraped,
    scoring: report.scoring,
    roast: report.roast,
    created_at: report.createdAt,
  };
}

function fromRoastRow(row: SupabaseRoastRow): unknown {
  return {
    id: row.id,
    url: row.url,
    userId: typeof row.user_id === "string" ? row.user_id : undefined,
    scrapeHash: row.scrape_hash,
    scraped: row.scraped,
    scoring: row.scoring,
    roast: row.roast,
    createdAt: row.created_at,
  };
}

function fromAnalyticsRow(row: SupabaseAnalyticsRow): AnalyticsEvent | null {
  if (
    typeof row.name !== "string" ||
    typeof row.session_id !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  if (
    row.name !== "landing_view" &&
    row.name !== "roast_submit" &&
    row.name !== "roast_success" &&
    row.name !== "roast_error" &&
    row.name !== "result_view"
  ) {
    return null;
  }

  return {
    name: row.name,
    sessionId: row.session_id,
    timestamp: row.created_at,
    variant: row.variant === "A" || row.variant === "B" ? row.variant : undefined,
    metadata:
      row.metadata && typeof row.metadata === "object" ? row.metadata : undefined,
  };
}

function isToneAccuracy(value: unknown): value is ToneAccuracy {
  return value === "too_soft" || value === "balanced" || value === "too_harsh";
}

function fromFeedbackRow(row: SupabaseFeedbackRow): RoastFeedbackEntry | null {
  if (
    typeof row.report_id !== "string" ||
    typeof row.session_id !== "string" ||
    typeof row.url !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  const scoreAtReview = Number(row.score_at_review);
  const scoreAccuracy = Number(row.score_accuracy);
  if (
    !Number.isFinite(scoreAtReview) ||
    !Number.isFinite(scoreAccuracy) ||
    !isToneAccuracy(row.tone_accuracy)
  ) {
    return null;
  }

  return {
    reportId: row.report_id,
    userId: typeof row.user_id === "string" ? row.user_id : undefined,
    sessionId: row.session_id,
    url: row.url,
    scoreAtReview: Math.round(Math.max(0, Math.min(10, scoreAtReview)) * 10) / 10,
    scoreAccuracy: Math.round(Math.max(1, Math.min(5, scoreAccuracy))),
    toneAccuracy: row.tone_accuracy,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    createdAt: row.created_at,
  };
}

function fromPaymentTransactionRow(
  row: SupabasePaymentTransactionRow,
): PaymentTransaction | null {
  if (
    typeof row.reference !== "string" ||
    typeof row.report_id !== "string" ||
    typeof row.currency !== "string" ||
    typeof row.status !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  const amountKobo = Number(row.amount_kobo);
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    return null;
  }

  return {
    reference: row.reference,
    reportId: row.report_id,
    userId: typeof row.user_id === "string" ? row.user_id : undefined,
    email: typeof row.email === "string" ? row.email : undefined,
    amountKobo: Math.round(amountKobo),
    currency: row.currency,
    status: row.status,
    providerStatus:
      typeof row.provider_status === "string" ? row.provider_status : undefined,
    providerMessage:
      typeof row.provider_message === "string" ? row.provider_message : undefined,
    authorizationUrl:
      typeof row.authorization_url === "string" ? row.authorization_url : undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function supabaseFetch<T>(
  path: string,
  init: RequestInit,
  params?: URLSearchParams,
): Promise<T | null> {
  const key = getSupabaseKey();
  if (!key || !isSupabaseConfigured()) {
    return null;
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(buildRestUrl(path, params), {
      ...init,
      headers,
    });
  } catch (error) {
    console.error("[supabase] request failed", {
      path,
      error: toErrorMessage(error),
    });
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[supabase] request rejected", {
      path,
      status: response.status,
      body: body.slice(0, 800),
    });
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }

  return JSON.parse(raw) as T;
}

async function supabaseWrite(
  path: string,
  body: unknown,
  preferHeader?: string,
): Promise<boolean> {
  const key = getSupabaseKey();
  if (!key || !isSupabaseConfigured()) {
    return false;
  }

  const headers = new Headers();
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  if (preferHeader) {
    headers.set("Prefer", preferHeader);
  }

  let response: Response;
  try {
    response = await fetch(buildRestUrl(path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[supabase] write failed", {
      path,
      error: toErrorMessage(error),
    });
    return false;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[supabase] write rejected", {
      path,
      status: response.status,
      body: body.slice(0, 800),
    });
  }

  return response.ok;
}

export async function saveRoastReportToSupabase(
  report: StoredRoastReport,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const payload = [toRoastRow(report)];
  const result = await supabaseFetch<SupabaseRoastRow[]>(
    "roast_reports?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  return Array.isArray(result);
}

export async function getRoastReportByIdFromSupabase(
  id: string,
): Promise<unknown | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: ROAST_SELECT,
    id: `eq.${id}`,
    limit: "1",
  });

  const rows = await supabaseFetch<SupabaseRoastRow[]>(
    "roast_reports",
    { method: "GET" },
    params,
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return fromRoastRow(rows[0]);
}

export async function findRoastReportByUrlAndHashFromSupabase(
  url: string,
  scrapeHash: string,
): Promise<unknown | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: ROAST_SELECT,
    url: `eq.${url}`,
    scrape_hash: `eq.${scrapeHash}`,
    order: "created_at.desc",
    limit: "1",
  });

  const rows = await supabaseFetch<SupabaseRoastRow[]>(
    "roast_reports",
    { method: "GET" },
    params,
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return fromRoastRow(rows[0]);
}

export async function getRoastReportsByUserIdFromSupabase(
  userId: string,
  limit: number,
): Promise<unknown[] | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: ROAST_SELECT,
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: String(limit),
  });

  const rows = await supabaseFetch<SupabaseRoastRow[]>(
    "roast_reports",
    { method: "GET" },
    params,
  );

  if (!rows) {
    return null;
  }

  return rows.map((row) => fromRoastRow(row));
}

export async function saveAnalyticsEventToSupabase(
  event: AnalyticsEvent,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const payload = {
    name: event.name,
    session_id: event.sessionId,
    variant: event.variant ?? null,
    metadata: event.metadata ?? {},
    created_at: event.timestamp,
  };

  return supabaseWrite("analytics_events", payload, "return=minimal");
}

export async function getAnalyticsEventsFromSupabase(
  limit: number,
): Promise<AnalyticsEvent[] | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: ANALYTICS_SELECT,
    order: "created_at.asc",
    limit: String(limit),
  });

  const rows = await supabaseFetch<SupabaseAnalyticsRow[]>(
    "analytics_events",
    { method: "GET" },
    params,
  );

  if (!rows) {
    return null;
  }

  return rows.flatMap((row) => {
    const normalized = fromAnalyticsRow(row);
    return normalized ? [normalized] : [];
  });
}

export async function saveRoastFeedbackToSupabase(
  feedback: RoastFeedbackEntry,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const payload = {
    report_id: feedback.reportId,
    user_id: feedback.userId ?? null,
    session_id: feedback.sessionId,
    url: feedback.url,
    score_at_review: feedback.scoreAtReview,
    score_accuracy: feedback.scoreAccuracy,
    tone_accuracy: feedback.toneAccuracy,
    notes: feedback.notes ?? null,
    created_at: feedback.createdAt,
  };

  return supabaseWrite(
    "roast_feedback?on_conflict=report_id,session_id",
    payload,
    "resolution=merge-duplicates,return=minimal",
  );
}

export async function getRoastFeedbackFromSupabase(
  limit: number,
): Promise<RoastFeedbackEntry[] | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: FEEDBACK_SELECT,
    order: "created_at.asc",
    limit: String(limit),
  });

  const rows = await supabaseFetch<SupabaseFeedbackRow[]>(
    "roast_feedback",
    { method: "GET" },
    params,
  );

  if (!rows) {
    return null;
  }

  return rows.flatMap((row) => {
    const normalized = fromFeedbackRow(row);
    return normalized ? [normalized] : [];
  });
}

export async function savePaymentTransactionToSupabase(
  payment: PaymentTransaction,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const payload = {
    reference: payment.reference,
    report_id: payment.reportId,
    user_id: payment.userId ?? null,
    email: payment.email ?? null,
    amount_kobo: payment.amountKobo,
    currency: payment.currency,
    status: payment.status,
    provider_status: payment.providerStatus ?? null,
    provider_message: payment.providerMessage ?? null,
    authorization_url: payment.authorizationUrl ?? null,
    metadata: payment.metadata ?? {},
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  };

  return supabaseWrite(
    "payment_transactions?on_conflict=reference",
    payload,
    "resolution=merge-duplicates,return=minimal",
  );
}

export async function getRecentPaymentTransactionsFromSupabase(
  limit: number,
): Promise<PaymentTransaction[] | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const params = new URLSearchParams({
    select: PAYMENT_SELECT,
    order: "updated_at.desc",
    limit: String(limit),
  });

  const rows = await supabaseFetch<SupabasePaymentTransactionRow[]>(
    "payment_transactions",
    { method: "GET" },
    params,
  );

  if (!rows) {
    return null;
  }

  return rows.flatMap((row) => {
    const normalized = fromPaymentTransactionRow(row);
    return normalized ? [normalized] : [];
  });
}
