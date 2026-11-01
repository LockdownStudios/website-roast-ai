import { readFileSync } from "node:fs";
import path from "node:path";
export const REPORT_COLORS = {
  background: "#090d14", black: "#070708", surface: "#111826", score: "#182335",
  line: "#263346", muted: "#9aa5b7", text: "#f6f7fb", accent: "#f76b1c", soft: "#ffd7b2",
};
export const REPORT_PRODUCT_URL = "https://website-roast-ai-peach.vercel.app/";
export const REPORT_LAYOUT_VERSION = "lockdown-seattle-2026-11-01";
export function reportLogo(): Buffer | undefined {
  try { return readFileSync(path.join(process.cwd(), "public", "brand", "lockdown-logo-192.png")); }
  catch { return undefined; }
}
