"use client";

const ACCESS_TOKEN_KEY = "wra_access_token";
const REFRESH_TOKEN_KEY = "wra_refresh_token";
const USER_KEY = "wra_auth_user";

export type ClientAuthUser = {
  id: string;
  email: string | null;
};

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

export function getAccessToken(): string | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const token = storage.getItem(ACCESS_TOKEN_KEY);
  return token && token.trim() ? token : null;
}

export function setAuthTokens(accessToken: string, refreshToken?: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthSession(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

export function getStoredAuthUser(): ClientAuthUser | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ClientAuthUser>;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) {
      return null;
    }
    return {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
    };
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: ClientAuthUser | null): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!user) {
    storage.removeItem(USER_KEY);
    return;
  }

  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function parseAndStoreAuthFromHash(hash: string): {
  accessToken: string;
  refreshToken?: string;
} | null {
  const normalized =
    hash.startsWith("#") || hash.startsWith("?") ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalized);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? undefined;

  if (!accessToken) {
    return null;
  }

  setAuthTokens(accessToken, refreshToken);
  return { accessToken, refreshToken };
}

export async function fetchCurrentAuthUser(
  token = getAccessToken(),
): Promise<ClientAuthUser | null> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as {
      user?: { id?: string; email?: string | null };
    };

    if (!response.ok || !payload.user || typeof payload.user.id !== "string") {
      return null;
    }

    const user: ClientAuthUser = {
      id: payload.user.id,
      email: typeof payload.user.email === "string" ? payload.user.email : null,
    };
    setStoredAuthUser(user);
    return user;
  } catch {
    return null;
  }
}

export async function exchangeMagicLinkTokenOnServer(input: {
  tokenHash: string;
  type?: string | null;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  user: ClientAuthUser | null;
} | null> {
  if (!input.tokenHash.trim()) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tokenHash: input.tokenHash,
        type: input.type ?? null,
      }),
    });

    const payload = (await response.json()) as {
      accessToken?: unknown;
      refreshToken?: unknown;
      user?: { id?: unknown; email?: unknown };
    };

    if (!response.ok || typeof payload.accessToken !== "string") {
      return null;
    }

    return {
      accessToken: payload.accessToken,
      refreshToken:
        typeof payload.refreshToken === "string"
          ? payload.refreshToken
          : undefined,
      user:
        payload.user && typeof payload.user.id === "string"
          ? {
              id: payload.user.id,
              email:
                typeof payload.user.email === "string"
                  ? payload.user.email
                  : null,
            }
          : null,
    };
  } catch {
    return null;
  }
}
