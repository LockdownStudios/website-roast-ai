"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearAuthSession,
  exchangeMagicLinkTokenOnServer,
  fetchCurrentAuthUser,
  parseAndStoreAuthFromHash,
  setAuthTokens,
  setStoredAuthUser,
} from "@/lib/clientAuth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finalizing your sign in...");

  useEffect(() => {
    void (async () => {
      const parsedFromHash = parseAndStoreAuthFromHash(window.location.hash);
      const parsedFromSearch = parsedFromHash
        ? null
        : parseAndStoreAuthFromHash(window.location.search);

      let accessToken = parsedFromHash?.accessToken ?? parsedFromSearch?.accessToken;

      if (!accessToken) {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash") ?? params.get("token");
        const type = params.get("type");

        if (tokenHash) {
          const exchanged = await exchangeMagicLinkTokenOnServer({ tokenHash, type });
          if (exchanged) {
            setAuthTokens(exchanged.accessToken, exchanged.refreshToken);
            if (exchanged.user) {
              setStoredAuthUser(exchanged.user);
            }
            accessToken = exchanged.accessToken;
          }
        }
      }

      if (!accessToken) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(window.location.search);
        const failure =
          hashParams.get("error_description") ||
          hashParams.get("error") ||
          searchParams.get("error_description") ||
          searchParams.get("error");

        setMessage(
          failure
            ? `Login failed: ${failure}. Request a fresh magic link.`
            : "Login link is invalid or expired.",
        );
        return;
      }

      const user = await fetchCurrentAuthUser(accessToken);
      if (!user) {
        clearAuthSession();
        setMessage("Could not verify session. Request a fresh magic link.");
        return;
      }

      setStoredAuthUser(user);
      router.replace("/my-reports");
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-white/12 bg-surface/85 p-7 text-center shadow-xl shadow-black/40">
        <h1 className="font-display text-4xl uppercase tracking-wide text-white">
          Signing You In
        </h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
        >
          Back to Auth
        </Link>
      </section>
    </main>
  );
}
