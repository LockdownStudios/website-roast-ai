"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthStatus } from "@/components/AuthStatus";
import { ScrollScrubVideo } from "@/components/ScrollScrubVideo";
import { UrlInput } from "@/components/UrlInput";
import { getOrCreateLandingVariant, trackClientEvent } from "@/lib/clientAnalytics";
import type { LandingVariant } from "@/lib/types";

const failureBullets = [
  "Visitors do not understand what you do",
  "Your offer is not clear",
  "There is no reason to trust you",
  "No strong call-to-action",
];

const steps = [
  {
    title: "Paste your website",
    detail: "Drop your URL. No setup. No waiting room.",
  },
  {
    title: "We analyze conversion signals",
    detail: "Messaging clarity, trust, CTA strength, differentiation, and structure.",
  },
  {
    title: "Get the roast instantly",
    detail: "Sharp truth. Actionable fixes. No polite filler.",
  },
];

const heroCopy: Record<
  LandingVariant,
  {
    titleTop: string;
    titleHighlightA: string;
    titleBottom: string;
    titleHighlightB: string;
    subheadline: string;
  }
> = {
  A: {
    titleTop: "Your Website Looks",
    titleHighlightA: " Fine.",
    titleBottom: "But It Is Probably",
    titleHighlightB: " Losing Customers.",
    subheadline:
      "Get a brutally honest breakdown of what is actually hurting your conversions in 30 seconds.",
  },
  B: {
    titleTop: "Your Homepage Is",
    titleHighlightA: " Pretty.",
    titleBottom: "Your Conversion Rate",
    titleHighlightB: " Is Not.",
    subheadline:
      "Paste your URL and get the blunt truth about why visitors bounce without buying.",
  },
};

export default function Home() {
  const [variant, setVariant] = useState<LandingVariant>("A");
  const trackedLandingRef = useRef(false);
  const copy = heroCopy[variant];

  useEffect(() => {
    const resolved = getOrCreateLandingVariant();
    const timer = window.setTimeout(() => {
      setVariant(resolved);
    }, 0);

    if (!trackedLandingRef.current) {
      trackedLandingRef.current = true;
      void trackClientEvent({
        name: "landing_view",
        variant: resolved,
        metadata: {
          path: "/",
        },
      });
    }

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          href="/my-reports"
          className="inline-flex rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:border-accent/50 hover:text-accent-soft"
        >
          My Reports
        </Link>
        <AuthStatus />
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-surface/90 px-6 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:px-10 sm:py-10">
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-stretch">
          <div className="flex-1">
            <p className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-soft">
              Website Roast AI
            </p>

            <h1 className="mt-5 font-display text-5xl uppercase leading-[0.93] tracking-wide text-white sm:text-7xl">
              {copy.titleTop}
              <span className="text-accent">{copy.titleHighlightA}</span>
              <br />
              {copy.titleBottom}
              <span className="text-accent">{copy.titleHighlightB}</span>
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted sm:text-xl">
              {copy.subheadline}
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-white/85">
                No generic fluff
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-white/85">
                No polite lies
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-white/85">
                No signup required
              </span>
            </div>
          </div>

          <aside className="w-full rounded-3xl border border-white/12 bg-black/25 p-5 lg:max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Roast Your Website
            </p>
            <p className="mt-2 text-sm text-white/80">
              Paste your URL. We show what is killing conversion before the next visitor bounces.
            </p>
            <UrlInput
              className="mt-4"
              showLabel={false}
              placeholder="Enter your website URL..."
              buttonText="Roast My Website"
              microcopy="No signup required. Instant results."
              variant={variant}
              context="hero"
            />
          </aside>
        </div>
      </section>

      <ScrollScrubVideo
        src="/videos/Website_Roast_AI_audit_202606170008-scrub.mp4"
        poster="/videos/Website_Roast_AI_audit_202606170008-poster.jpg"
      />

      <section className="mx-auto mt-10 w-full max-w-5xl">
        <p className="text-center text-xl font-semibold leading-relaxed text-white sm:text-2xl">
          Most websites do not fail because of traffic.
          <br />
          They fail because they do not convert.
        </p>
        <ul className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-2">
          {failureBullets.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-medium text-white/90 sm:text-base"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-10 w-full max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-surface-soft/80 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sample Roast Preview
          </p>
          <div className="mt-5 rounded-2xl border border-accent/30 bg-black/25 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-soft">
              Score
            </p>
            <p className="mt-1 font-display text-6xl leading-none text-white">
              5.8 <span className="text-2xl text-muted">/ 10</span>
            </p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
                First impression
              </p>
              <p className="mt-2 text-base text-white/90">
                &quot;This site feels generic and forgettable.&quot;
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">
                Mistakes
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-white/90">
                <li>No clear headline</li>
                <li>Weak CTA</li>
                <li>No proof</li>
              </ul>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 border-t border-white/8 bg-background/86" />
          <p className="relative mt-4 text-sm font-black uppercase tracking-[0.15em] text-accent-soft">
            Unlock full breakdown -&gt;
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 w-full max-w-5xl rounded-3xl border border-white/12 bg-black/20 p-6 sm:p-8">
        <h2 className="text-center font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          How It Works
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-white/10 bg-surface/70 p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Step 0{index + 1}
              </p>
              <h3 className="mt-2 text-lg font-black text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 w-full max-w-5xl rounded-3xl border border-white/12 bg-surface/70 px-6 py-10 text-center sm:px-10">
        <h2 className="font-display text-4xl uppercase tracking-wide text-white sm:text-6xl">
          If your website does not convert,
          <span className="text-accent"> it is bleeding money.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-muted">
          You could be losing 20-40% of potential customers just because your message is not clear.
        </p>
      </section>

      <section className="mx-auto mt-10 w-full max-w-5xl rounded-3xl border border-accent/30 bg-accent/10 px-5 py-8 sm:px-8">
        <h2 className="text-center font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          Want the hard truth about your homepage?
        </h2>
        <UrlInput
          center
          className="mx-auto mt-6 w-full max-w-3xl"
          showLabel={false}
          placeholder="Enter your website URL..."
          buttonText="Roast My Website"
          microcopy="No signup required. Instant results."
          variant={variant}
          context="bottom"
        />
      </section>

      <footer className="mx-auto mt-10 flex w-full max-w-5xl flex-col items-center border-t border-white/10 py-6 text-center">
        <p className="font-display text-3xl uppercase tracking-wide text-white">
          Website Roast AI
        </p>
        <p className="mt-1 text-sm text-muted">
          Your homepage talks. We tell you why it does not sell.
        </p>
      </footer>
    </main>
  );
}
