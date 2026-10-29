import "server-only";

export async function browserLaunchOptions() {
  if (process.env.VERCEL === "1" && process.platform === "linux") {
    const { default: chromium } = await import("@sparticuz/chromium");
    return { headless: true, args: chromium.args, executablePath: await chromium.executablePath() };
  }
  return { headless: true, args: ["--disable-dev-shm-usage"] };
}
