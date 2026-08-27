import "server-only";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser | null;
};

export type AuthRequestResult = {
  ok: boolean;
  status: number;
  error?: string;
};

function getSupabaseUrl(): string | null {
  const value = process.env.SUPABASE_URL?.trim();
  return value ? value : null;
}

function getSupabaseAuthKey(): string | null {
  const value =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return value ? value : null;
}

function getAuthHeaders(accessToken?: string): Headers {
  const key = getSupabaseAuthKey();
  const headers = new Headers();
  if (key) {
    headers.set("apikey", key);
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else if (key) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  headers.set("Content-Type", "application/json");
  return headers;
}

function authEndpoint(path: string): string | null {
  const base = getSupabaseUrl();
  if (!base) {
    return null;
  }

  const url = new URL(`/auth/v1/${path}`, base);
  return url.toString();
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

function extractAuthErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const keys = ["error_description", "msg", "message", "error"];
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function postAuthOtp(body: Record<string, unknown>): Promise<AuthRequestResult> {
  const endpoint = authEndpoint("otp");
  if (!endpoint) {
    return { ok: false, status: 500, error: "Supabase URL is not configured." };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  let errorMessage = `Supabase auth request failed (${response.status}).`;
  try {
    const payload = (await response.json()) as unknown;
    const parsed = extractAuthErrorMessage(payload);
    if (parsed) {
      errorMessage = parsed;
    }
  } catch {
    try {
      const text = (await response.text()).trim();
      if (text) {
        errorMessage = text;
      }
    } catch {
      // Ignore secondary parse failures.
    }
  }

  return {
    ok: false,
    status: response.status,
    error: errorMessage,
  };
}

export async function sendMagicLinkEmail(input: {
  email: string;
  redirectTo: string;
}): Promise<AuthRequestResult> {
  return postAuthOtp({
      email: input.email,
      create_user: true,
      email_redirect_to: input.redirectTo,
  });
}

export async function sendEmailOtpCode(input: {
  email: string;
}): Promise<AuthRequestResult> {
  return postAuthOtp({
    email: input.email,
    create_user: true,
  });
}

export async function getSupabaseUserFromAccessToken(
  accessToken: string,
): Promise<AuthUser | null> {
  const endpoint = authEndpoint("user");
  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    id?: unknown;
    email?: unknown;
  };

  if (typeof payload.id !== "string" || !payload.id.trim()) {
    return null;
  }

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

const OTP_VERIFY_TYPES = new Set([
  "magiclink",
  "email",
  "signup",
  "recovery",
  "invite",
  "email_change",
]);

function normalizeOtpVerifyType(value: string | null): string {
  if (!value) {
    return "magiclink";
  }

  const normalized = value.trim().toLowerCase();
  return OTP_VERIFY_TYPES.has(normalized) ? normalized : "magiclink";
}

function parseAuthSessionPayload(payload: {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: {
    id?: unknown;
    email?: unknown;
  };
}): AuthSession | null {
  if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
    return null;
  }

  const user =
    payload.user && typeof payload.user.id === "string" && payload.user.id.trim()
      ? {
          id: payload.user.id,
          email: typeof payload.user.email === "string" ? payload.user.email : null,
        }
      : null;

  return {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    user,
  };
}

export async function exchangeMagicLinkToken(input: {
  tokenHash: string;
  type?: string | null;
}): Promise<AuthSession | null> {
  const endpoint = authEndpoint("verify");
  if (!endpoint) {
    return null;
  }

  const tokenHash = input.tokenHash.trim();
  if (!tokenHash) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      token_hash: tokenHash,
      type: normalizeOtpVerifyType(input.type ?? null),
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    user?: {
      id?: unknown;
      email?: unknown;
    };
  };
  return parseAuthSessionPayload(payload);
}

export async function verifyEmailOtpCode(input: {
  email: string;
  code: string;
}): Promise<AuthSession | null> {
  const endpoint = authEndpoint("verify");
  if (!endpoint) {
    return null;
  }

  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  if (!email || !code) {
    return null;
  }

  // Supabase can issue OTPs under different verification types depending on user state.
  // Try the common variants so first-time signups and returning logins both work.
  const verifyTypes: string[] = ["email", "magiclink", "signup"];

  for (const verifyType of verifyTypes) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        type: verifyType,
        email,
        token: code,
      }),
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: {
        id?: unknown;
        email?: unknown;
      };
    };

    const session = parseAuthSessionPayload(payload);
    if (session) {
      return session;
    }
  }

  return null;
}
