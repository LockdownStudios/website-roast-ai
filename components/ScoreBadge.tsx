import type { ScoreLabel } from "@/lib/types";

type ScoreBadgeProps = {
  score: number;
  label: ScoreLabel;
};

function getTone(score: number) {
  if (score <= 2.5) {
    return {
      ring: "ring-red-500/45",
      text: "text-red-300",
      chip: "bg-red-500/15 text-red-200 border-red-400/30",
    };
  }

  if (score <= 4.5) {
    return {
      ring: "ring-orange-400/45",
      text: "text-orange-200",
      chip: "bg-orange-500/15 text-orange-200 border-orange-400/30",
    };
  }

  if (score <= 6.5) {
    return {
      ring: "ring-yellow-400/45",
      text: "text-yellow-200",
      chip: "bg-yellow-500/15 text-yellow-200 border-yellow-400/30",
    };
  }

  if (score <= 8.5) {
    return {
      ring: "ring-cyan-400/45",
      text: "text-cyan-200",
      chip: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
    };
  }

  return {
    ring: "ring-emerald-400/45",
    text: "text-emerald-200",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  };
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  const normalized = Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
  const tone = getTone(normalized);
  const display = normalized.toFixed(1);

  return (
    <div
      className={`inline-flex flex-col items-center rounded-2xl bg-black/35 px-7 py-6 text-center ring-1 ${tone.ring}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        Score
      </span>
      <span className={`font-display text-7xl leading-none ${tone.text}`}>
        {display}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/75">
        out of 10
      </span>
      <span
        className={`mt-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${tone.chip}`}
      >
        {label}
      </span>
    </div>
  );
}
