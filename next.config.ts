import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@sparticuz/chromium/bin/**", "./public/brand/lockdown-logo-192.png"],
  },
};

export default nextConfig;
