"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearAuthSession,
  fetchCurrentAuthUser,
  getAccessToken,
  getStoredAuthUser,
  setStoredAuthUser,
  type ClientAuthUser,
} from "@/lib/clientAuth";

type AuthStatusProps = {
  className?: string;
};

export function AuthStatus({ className = "" }: AuthStatusProps) {
  const [user, setUser] = useState<ClientAuthUser | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    void (async () => {
      const storedUser = getStoredAuthUser();
      if (storedUser) {
        setUser(storedUser);
      }

      const resolved = await fetchCurrentAuthUser(token);
      if (!resolved) {
        clearAuthSession();
        setUser(null);
        return;
      }
      setUser(resolved);
    })();
  }, []);

  function onSignOut() {
    clearAuthSession();
    setStoredAuthUser(null);
    setUser(null);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {user ? (
        <>
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/85">
            {user.email ?? "Signed in"}
          </span>
          <Link
            href="/my-reports"
            className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent-soft transition hover:border-accent/55"
          >
            My Reports
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition hover:text-white"
          >
            Sign Out
          </button>
        </>
      ) : (
        <>
          <Link
            href="/auth"
            className="rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent-soft transition hover:border-accent/55"
          >
            Sign In
          </Link>
          <Link
            href="/my-reports"
            className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition hover:text-white"
          >
            My Reports
          </Link>
        </>
      )}
    </div>
  );
}
