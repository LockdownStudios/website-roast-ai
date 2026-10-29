export type PairedFinding = { headline: string; observation: string; fix: string };

export function parsePairedFindings(value: unknown): PairedFinding[] {
  const text = (v: unknown, max: number) => typeof v === "string" && !!v.trim() && v.length <= max;
  if (!Array.isArray(value) || value.length < 1 || value.length > 5 || value.some(f => !f || !text(f.headline, 90) || !text(f.observation, 420) || !text(f.fix, 260))) throw new Error("Return 1-5 findings with a headline, observation and its own specific fix.");
  if (new Set(value.map(f => f.observation.trim().toLowerCase())).size !== value.length) throw new Error("Findings must be distinct.");
  return value.map(f => ({ headline: f.headline.trim(), observation: f.observation.trim(), fix: f.fix.trim() }));
}

/** Legacy display fields are projections of the same records, never separately generated arrays. */
export function projectPairedFindings(findings: PairedFinding[]) {
  return { mistakes: findings.map(f => f.observation), quick_fixes: findings.map(f => f.fix) };
}
