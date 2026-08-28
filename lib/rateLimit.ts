type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    cleanupBuckets(now);
    return {
      limited: false,
      limit: options.limit,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
    };
  }

  existing.count += 1;
  const limited = existing.count > options.limit;

  return {
    limited,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
  };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const vercelIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || realIp || vercelIp || "unknown";
}

function cleanupBuckets(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
