import "server-only";
import crypto from "node:crypto";

export type PaystackInitializeInput = {
  email: string;
  amountZar: number;
  callbackUrl: string;
  reference: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type PaystackVerifyResult = {
  reference: string;
  status: string;
  amountKobo: number;
  currency: string | null;
  customerEmail: string | null;
  metadata: Record<string, unknown>;
  raw: unknown;
};

function getPaystackSecretKey(): string | null {
  const value = process.env.PAYSTACK_SECRET_KEY?.trim();
  return value ? value : null;
}

function getPaystackBaseUrl(): string {
  return "https://api.paystack.co";
}

function getPaystackHeaders(secretKey: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${secretKey}`);
  headers.set("Content-Type", "application/json");
  return headers;
}

function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, 320);
}

function toAmountKobo(amountZar: number): number {
  if (!Number.isFinite(amountZar)) {
    throw new Error("Invalid amount.");
  }
  return Math.round(Math.max(1, amountZar) * 100);
}

type PaystackEnvelope<T> = {
  status?: unknown;
  message?: unknown;
  data?: T;
};

function parseEnvelopeData<T>(value: unknown): T {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Paystack response.");
  }

  const payload = value as PaystackEnvelope<T>;
  if (payload.status !== true || !payload.data) {
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : "Paystack request failed.";
    throw new Error(message);
  }

  return payload.data;
}

export function createPaystackReference(reportId: string): string {
  const random = crypto.randomBytes(6).toString("hex");
  return `wra_${reportId.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}_${random}`;
}

export async function initializePaystackTransaction(
  input: PaystackInitializeInput,
): Promise<PaystackInitializeResult> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("A valid email is required for checkout.");
  }

  const response = await fetch(`${getPaystackBaseUrl()}/transaction/initialize`, {
    method: "POST",
    headers: getPaystackHeaders(secret),
    body: JSON.stringify({
      email,
      amount: toAmountKobo(input.amountZar),
      currency: "ZAR",
      callback_url: input.callbackUrl,
      reference: input.reference,
      metadata: input.metadata ?? {},
    }),
  });

  const raw = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof raw === "object" &&
      raw &&
      "message" in raw &&
      typeof (raw as { message?: unknown }).message === "string"
        ? ((raw as { message: string }).message || "").trim()
        : "";
    throw new Error(message || "Failed to initialize Paystack transaction.");
  }

  const data = parseEnvelopeData<{
    authorization_url?: unknown;
    access_code?: unknown;
    reference?: unknown;
  }>(raw);

  if (
    typeof data.authorization_url !== "string" ||
    typeof data.access_code !== "string" ||
    typeof data.reference !== "string"
  ) {
    throw new Error("Paystack returned incomplete checkout data.");
  }

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifyResult> {
  const secret = getPaystackSecretKey();
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    throw new Error("Missing Paystack reference.");
  }

  const response = await fetch(
    `${getPaystackBaseUrl()}/transaction/verify/${encodeURIComponent(normalizedReference)}`,
    {
      method: "GET",
      headers: getPaystackHeaders(secret),
    },
  );

  const raw = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof raw === "object" &&
      raw &&
      "message" in raw &&
      typeof (raw as { message?: unknown }).message === "string"
        ? ((raw as { message: string }).message || "").trim()
        : "";
    throw new Error(message || "Failed to verify Paystack transaction.");
  }

  const data = parseEnvelopeData<{
    reference?: unknown;
    status?: unknown;
    amount?: unknown;
    currency?: unknown;
    customer?: {
      email?: unknown;
    };
    metadata?: unknown;
  }>(raw);

  return {
    reference:
      typeof data.reference === "string" ? data.reference : normalizedReference,
    status: typeof data.status === "string" ? data.status : "",
    amountKobo:
      typeof data.amount === "number" && Number.isFinite(data.amount)
        ? data.amount
        : 0,
    currency: typeof data.currency === "string" ? data.currency : null,
    customerEmail:
      typeof data.customer?.email === "string" ? data.customer.email : null,
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : {},
    raw,
  };
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getPaystackSecretKey();
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const normalizedProvided = signatureHeader.trim().toLowerCase();
  const normalizedExpected = expected.toLowerCase();

  if (normalizedProvided.length !== normalizedExpected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(normalizedProvided, "utf8"),
    Buffer.from(normalizedExpected, "utf8"),
  );
}
