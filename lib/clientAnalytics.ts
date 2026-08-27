"use client";

import type { AnalyticsEventName, LandingVariant } from "./types";

const SESSION_KEY = "wra_session_id";
const VARIANT_KEY = "wra_landing_variant";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateSessionId(): string {
  const storage = getStorage();
  if (!storage) {
    return createId("session");
  }

  const existing = storage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const created = createId("session");
  storage.setItem(SESSION_KEY, created);
  return created;
}

export function getOrCreateLandingVariant(): LandingVariant {
  const storage = getStorage();
  if (!storage) {
    return "A";
  }

  const existing = storage.getItem(VARIANT_KEY);
  if (existing === "A" || existing === "B") {
    return existing;
  }

  const created: LandingVariant = Math.random() < 0.5 ? "A" : "B";
  storage.setItem(VARIANT_KEY, created);
  return created;
}

export async function trackClientEvent(input: {
  name: AnalyticsEventName;
  sessionId?: string;
  variant?: LandingVariant;
  metadata?: Record<string, string | number | boolean>;
}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const sessionId = input.sessionId ?? getOrCreateSessionId();

  try {
    await fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        name: input.name,
        sessionId,
        variant: input.variant,
        metadata: input.metadata,
      }),
    });
  } catch {
    // Best-effort tracking.
  }
}
