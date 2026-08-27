import Link from "next/link";
import { AuthMagicLinkForm } from "@/components/AuthMagicLinkForm";
import { AuthStatus } from "@/components/AuthStatus";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
          >
            {"<- Back"}
          </Link>
          <AuthStatus />
        </div>

        <section className="rounded-3xl border border-white/12 bg-surface/85 p-6 shadow-xl shadow-black/40 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Account Access
          </p>
          <h1 className="mt-3 font-display text-5xl uppercase tracking-wide text-white">
            Sign In
          </h1>
          <p className="mt-3 text-sm text-muted">
            Use your email to get a 6-digit login code. No password required.
          </p>

          <AuthMagicLinkForm className="mt-6" />
        </section>
      </div>
    </main>
  );
}
