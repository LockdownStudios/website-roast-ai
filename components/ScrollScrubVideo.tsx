"use client";

import { useEffect, useRef, useState } from "react";

type ScrollScrubVideoProps = {
  src: string;
  poster?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ScrollScrubVideo({ src, poster }: ScrollScrubVideoProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;

    if (!section || !video) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const readScrollProgress = () => {
      const rect = section.getBoundingClientRect();
      const scrollDistance = Math.max(rect.height - window.innerHeight, 1);
      return clamp(-rect.top / scrollDistance, 0, 1);
    };

    const renderFrame = () => {
      frameRef.current = null;

      targetProgressRef.current = readScrollProgress();
      const currentProgress = displayedProgressRef.current;
      const distance = targetProgressRef.current - currentProgress;
      const nextProgress = prefersReducedMotion
        ? targetProgressRef.current
        : currentProgress + distance * 0.22;
      const settledProgress =
        Math.abs(targetProgressRef.current - nextProgress) < 0.001
          ? targetProgressRef.current
          : nextProgress;

      displayedProgressRef.current = settledProgress;

      if (Math.abs(settledProgress - progressRef.current) > 0.004) {
        progressRef.current = settledProgress;
        setProgress(settledProgress);
      }

      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      if (duration > 0) {
        const targetTime = prefersReducedMotion
          ? duration * 0.55
          : duration * settledProgress;

        if (Math.abs(video.currentTime - targetTime) > 0.012) {
          video.currentTime = targetTime;
        }
      }

      if (
        !prefersReducedMotion
        && Math.abs(targetProgressRef.current - displayedProgressRef.current) > 0.001
      ) {
        requestFrame();
      }
    };

    const requestFrame = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(renderFrame);
      }
    };

    const syncTarget = () => {
      targetProgressRef.current = readScrollProgress();
      requestFrame();
    };

    video.pause();
    requestFrame();

    video.addEventListener("loadedmetadata", syncTarget);
    window.addEventListener("scroll", syncTarget, { passive: true });
    window.addEventListener("resize", syncTarget);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      video.removeEventListener("loadedmetadata", syncTarget);
      window.removeEventListener("scroll", syncTarget);
      window.removeEventListener("resize", syncTarget);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative -mx-5 mt-10 h-[320vh] overflow-clip border-y border-white/10 bg-black sm:-mx-8 lg:-mx-12"
    >
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          muted
          playsInline
          preload="auto"
          poster={poster}
          src={src}
          aria-hidden="true"
        />

        <div className="absolute inset-0 bg-background/58" />
        <div className="absolute inset-y-0 left-0 w-[56%] bg-background/54" />
        <div className="absolute inset-x-0 top-0 h-28 bg-background/92" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-background/92" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft">
              Conversion Autopsy
            </p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-[0.95] tracking-wide text-white sm:text-7xl">
              See the weak spots light up before visitors leave.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-xl">
              The audit follows the first impression path: message clarity, proof,
              call-to-action strength, and trust signals.
            </p>
          </div>

          <div className="flex max-w-2xl flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/85">
            <span className="border border-white/15 bg-black/35 px-3 py-2">
              Clarity
            </span>
            <span className="border border-white/15 bg-black/35 px-3 py-2">
              Proof
            </span>
            <span className="border border-white/15 bg-black/35 px-3 py-2">
              CTA
            </span>
            <span className="border border-white/15 bg-black/35 px-3 py-2">
              Trust
            </span>
          </div>
        </div>

        <div
          className="absolute inset-x-5 bottom-6 h-1 overflow-hidden bg-white/10 sm:inset-x-8 lg:inset-x-12"
          aria-hidden="true"
        >
          <div
            className="h-full bg-accent"
            style={{ transform: `scaleX(${progress})`, transformOrigin: "left" }}
          />
        </div>
      </div>
    </section>
  );
}
