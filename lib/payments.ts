import "server-only";
import type { PaymentTransaction } from "./types";
import {
  getRecentPaymentTransactionsFromSupabase,
  savePaymentTransactionToSupabase,
} from "./supabase";

type RecordPaymentInput = {
  reference: string;
  reportId: string;
  userId?: string | null;
  email?: string | null;
  amountKobo: number;
  currency?: string | null;
  status: PaymentTransaction["status"];
  providerStatus?: string | null;
  providerMessage?: string | null;
  authorizationUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordPaymentTransaction(input: RecordPaymentInput) {
  const now = new Date().toISOString();
  const payment: PaymentTransaction = {
    reference: input.reference,
    reportId: input.reportId,
    userId: input.userId ?? undefined,
    email: input.email ?? undefined,
    amountKobo: Math.max(1, Math.round(input.amountKobo)),
    currency: (input.currency || "ZAR").toUpperCase(),
    status: input.status,
    providerStatus: input.providerStatus ?? undefined,
    providerMessage: input.providerMessage ?? undefined,
    authorizationUrl: input.authorizationUrl ?? undefined,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };

  const saved = await savePaymentTransactionToSupabase(payment);
  if (!saved) {
    console.warn("[payments] payment audit write skipped or failed", {
      reference: input.reference,
      reportId: input.reportId,
      status: input.status,
    });
  }
}

export async function getRecentPaymentTransactions(limit = 12) {
  return (await getRecentPaymentTransactionsFromSupabase(limit)) ?? [];
}
