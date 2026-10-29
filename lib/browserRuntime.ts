import "server-only";

export async function browserLaunchOptions() {
  if (process.env.VERCEL === "1" && process.platform === "linux") {
    const { default: chromium } = await import("@sparticuz/chromium");
    // Single-process Chromium cannot safely handle our isolated parallel
    // desktop/mobile contexts. Vercel runs with the supplied no-sandbox flags.
    return { headless: true, args: chromium.args.filter(arg => arg !== "--single-process"), executablePath: await chromium.executablePath() };
  }
  return { headless: true, args: ["--disable-dev-shm-usage"] };
}
