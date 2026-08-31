import "server-only";
import { clampToRange, roundToOne } from "./scoringConfig";
import type {
  VisualAudit,
  VisualSummaryScores,
  VisualViewportMetrics,
  VisualViewportName,
} from "./types";

type BrowserTypeLike = {
  launch: (options: {
    headless?: boolean;
    args?: string[];
  }) => Promise<BrowserLike>;
};

type BrowserLike = {
  close: () => Promise<void>;
  newContext: (options: {
    viewport: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
  }) => Promise<BrowserContextLike>;
};

type BrowserContextLike = {
  close: () => Promise<void>;
  newPage: () => Promise<PageLike>;
};

type PageLike = {
  goto: (
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ) => Promise<void>;
  waitForTimeout: (timeout: number) => Promise<void>;
  evaluate: {
    <Result, Arg>(fn: (arg: Arg) => Result, arg: Arg): Promise<Result>;
    <Result>(script: string): Promise<Result>;
  };
};

type ViewportPreset = {
  name: VisualViewportName;
  width: number;
  height: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
};

type ViewportRawMetrics = Omit<
  VisualViewportMetrics,
  "viewport" | "width" | "height"
>;

const CTA_REGEX_SOURCE =
  "(book|schedule|quote|consult|call|apply|start|sign\\s*up|get\\s*started|trial|buy\\s*now|shop\\s*now|contact|talk|speak|demo)";

const VIEWPORTS: ViewportPreset[] = [
  {
    name: "desktop",
    width: 1440,
    height: 900,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function roundInt(value: number): number {
  return Math.round(value);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cleanUnavailableReason(reason: string): string {
  if (/playwright|browserType\.launch|chromium|executable/i.test(reason)) {
    return "visual rendering is unavailable in this environment";
  }

  return reason.trim() || "visual rendering is unavailable";
}

function unavailableAudit(reason: string): VisualAudit {
  const cleanReason = cleanUnavailableReason(reason);

  return {
    available: false,
    sampledAt: nowIso(),
    reason: cleanReason,
    findings: [],
    evidence: [],
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

async function loadChromium(): Promise<BrowserTypeLike | null> {
  try {
    const playwrightModule = await import("playwright");
    const chromium = playwrightModule.chromium as unknown;
    if (chromium && typeof chromium === "object" && "launch" in chromium) {
      return chromium as BrowserTypeLike;
    }
    return null;
  } catch {
    return null;
  }
}

function scoreCtaProminence(viewport: VisualViewportMetrics): number {
  if (viewport.ctaCount === 0) {
    return 4;
  }

  const ctaDepth = Math.min(35, viewport.ctaCount * 8);
  const placement = viewport.primaryCtaAboveFold ? 25 : 6;
  const contrast = clampToRange((viewport.primaryCtaContrast - 2.5) * 10, 0, 25);
  const area = clampToRange(viewport.primaryCtaAreaRatio * 280, 0, 15);

  return roundInt(clampToRange(ctaDepth + placement + contrast + area, 0, 100));
}

function scoreReadability(viewport: VisualViewportMetrics): number {
  const contrast = clampToRange((viewport.averageTextContrast - 2.5) * 18, 0, 75);
  const fontSize = clampToRange((viewport.averageFontSize - 13) * 5, 0, 25);
  const lowContrastPenalty = clampToRange(viewport.lowContrastTextShare * 80, 0, 45);

  return roundInt(clampToRange(contrast + fontSize - lowContrastPenalty, 0, 100));
}

function scoreHierarchy(viewport: VisualViewportMetrics): number {
  const heading = viewport.headingCountAboveFold >= 1 ? 30 : 8;
  const ctaPlacement = viewport.primaryCtaAboveFold ? 25 : 7;
  const clutterDistance = Math.abs(viewport.aboveFoldElementCount - 48);
  const clutter = clampToRange(35 - clutterDistance * 0.65, 0, 35);
  const ctaScale = clampToRange(viewport.primaryCtaAreaRatio * 250, 0, 10);

  return roundInt(clampToRange(heading + ctaPlacement + clutter + ctaScale, 0, 100));
}

function scoreConsistency(viewport: VisualViewportMetrics): number {
  const color =
    viewport.uniqueColorBuckets <= 8
      ? 55
      : viewport.uniqueColorBuckets <= 12
        ? 44
        : viewport.uniqueColorBuckets <= 18
          ? 26
          : 12;
  const fonts =
    viewport.uniqueFontFamilies <= 2
      ? 30
      : viewport.uniqueFontFamilies <= 3
        ? 22
        : viewport.uniqueFontFamilies <= 5
          ? 12
          : 4;

  return clampToRange(color + fonts, 0, 100);
}

function scoreMotionDistraction(viewport: VisualViewportMetrics): number {
  const shareComponent = viewport.animatedElementShare * 220;
  const mediaComponent = viewport.autoplayMediaCount * 25;
  return roundInt(clampToRange(shareComponent + mediaComponent, 0, 100));
}

function buildVisualSummary(
  desktop: VisualViewportMetrics,
  mobile: VisualViewportMetrics,
): VisualSummaryScores {
  const desktopScores = {
    ctaProminence: scoreCtaProminence(desktop),
    readability: scoreReadability(desktop),
    hierarchy: scoreHierarchy(desktop),
    consistency: scoreConsistency(desktop),
    motionDistraction: scoreMotionDistraction(desktop),
  };

  const mobileScores = {
    ctaProminence: scoreCtaProminence(mobile),
    readability: scoreReadability(mobile),
    hierarchy: scoreHierarchy(mobile),
    consistency: scoreConsistency(mobile),
    motionDistraction: scoreMotionDistraction(mobile),
  };

  return {
    ctaProminence: roundInt(average([desktopScores.ctaProminence, mobileScores.ctaProminence])),
    readability: roundInt(average([desktopScores.readability, mobileScores.readability])),
    hierarchy: roundInt(average([desktopScores.hierarchy, mobileScores.hierarchy])),
    consistency: roundInt(average([desktopScores.consistency, mobileScores.consistency])),
    motionDistraction: roundInt(
      average([desktopScores.motionDistraction, mobileScores.motionDistraction]),
    ),
  };
}

function describeViewport(viewport: VisualViewportMetrics): string {
  const primaryText = viewport.primaryCtaText ? `"${viewport.primaryCtaText}"` : "none";
  return `${viewport.viewport}: CTA count=${viewport.ctaCount}, primary=${primaryText}, aboveFold=${String(viewport.primaryCtaAboveFold)}, CTA contrast=${roundToOne(viewport.primaryCtaContrast)}, readability contrast=${roundToOne(viewport.averageTextContrast)}, low-contrast text=${roundInt(viewport.lowContrastTextShare * 100)}%, color buckets=${viewport.uniqueColorBuckets}, font families=${viewport.uniqueFontFamilies}, animated share=${roundInt(viewport.animatedElementShare * 100)}%`;
}

function buildFindings(
  summary: VisualSummaryScores,
  desktop: VisualViewportMetrics,
  mobile: VisualViewportMetrics,
): string[] {
  const findings: string[] = [];

  if (summary.ctaProminence < 45) {
    findings.push("Primary CTA is visually weak or buried above the fold.");
  }

  if (summary.readability < 50) {
    findings.push("Text readability is weak due to low contrast or cramped typography.");
  }

  if (summary.hierarchy < 50) {
    findings.push("Above-the-fold hierarchy is cluttered, so the main message does not land fast.");
  }

  if (summary.consistency < 45) {
    findings.push("Visual style feels inconsistent (too many color buckets or font styles).");
  }

  if (summary.motionDistraction > 60) {
    findings.push("Motion density is high enough to distract from conversion actions.");
  }

  if (desktop.primaryCtaAboveFold && !mobile.primaryCtaAboveFold) {
    findings.push("CTA is visible on desktop but weakly placed on mobile.");
  }

  if (findings.length === 0) {
    findings.push("Visual conversion signals are directionally solid across desktop and mobile.");
  }

  return findings.slice(0, 8);
}

function buildEvidence(
  summary: VisualSummaryScores,
  desktop: VisualViewportMetrics,
  mobile: VisualViewportMetrics,
): string[] {
  return [
    `Visual score summary -> CTA prominence ${summary.ctaProminence}/100, readability ${summary.readability}/100, hierarchy ${summary.hierarchy}/100, consistency ${summary.consistency}/100, motion distraction ${summary.motionDistraction}/100.`,
    describeViewport(desktop),
    describeViewport(mobile),
  ];
}

async function analyzeViewport(
  browser: BrowserLike,
  url: string,
  preset: ViewportPreset,
): Promise<VisualViewportMetrics> {
  const context = await browser.newContext({
    viewport: { width: preset.width, height: preset.height },
    isMobile: preset.isMobile,
    hasTouch: preset.hasTouch,
    userAgent: preset.userAgent,
  });

  try {
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 9000,
    });
    await page.waitForTimeout(450);
    await page.evaluate<void>("var __name = (fn) => fn;");

    const raw = await page.evaluate<ViewportRawMetrics, { ctaPattern: string }>(
      ({ ctaPattern }) => {
        type Rgb = { r: number; g: number; b: number };
        type CtaCandidate = {
          text: string;
          areaRatio: number;
          contrast: number;
          aboveFold: boolean;
          score: number;
        };

        const ctaRegex = new RegExp(ctaPattern, "i");
        const viewportWidth = Math.max(1, window.innerWidth);
        const viewportHeight = Math.max(1, window.innerHeight);
        const viewportArea = viewportWidth * viewportHeight;

        const clamp = (value: number, min: number, max: number): number =>
          Math.max(min, Math.min(max, value));

        const normalizeText = (value: string): string =>
          value.replace(/\s+/g, " ").trim();

        const parseDurationMs = (value: string): number => {
          const parts = value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
          let max = 0;
          for (const part of parts) {
            if (part.endsWith("ms")) {
              const parsed = Number.parseFloat(part.replace("ms", ""));
              if (Number.isFinite(parsed)) {
                max = Math.max(max, parsed);
              }
              continue;
            }
            if (part.endsWith("s")) {
              const parsed = Number.parseFloat(part.replace("s", ""));
              if (Number.isFinite(parsed)) {
                max = Math.max(max, parsed * 1000);
              }
            }
          }
          return max;
        };

        const parseRgb = (value: string): Rgb | null => {
          const matched = value
            .replace(/\s+/g, "")
            .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/i);
          if (!matched) {
            return null;
          }
          return {
            r: Number.parseInt(matched[1], 10),
            g: Number.parseInt(matched[2], 10),
            b: Number.parseInt(matched[3], 10),
          };
        };

        const isTransparent = (value: string): boolean =>
          value === "transparent" || /^rgba\(0,0,0,0\)$/i.test(value.replace(/\s+/g, ""));

        const toBucket = (rgb: Rgb): string => {
          const bucket = (channel: number): number => Math.floor(channel / 32);
          return `${bucket(rgb.r)}-${bucket(rgb.g)}-${bucket(rgb.b)}`;
        };

        const toLinear = (channel: number): number => {
          const c = channel / 255;
          if (c <= 0.03928) {
            return c / 12.92;
          }
          return ((c + 0.055) / 1.055) ** 2.4;
        };

        const luminance = (rgb: Rgb): number =>
          0.2126 * toLinear(rgb.r) +
          0.7152 * toLinear(rgb.g) +
          0.0722 * toLinear(rgb.b);

        const contrastRatio = (a: Rgb, b: Rgb): number => {
          const l1 = luminance(a);
          const l2 = luminance(b);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const bodyStyle = window.getComputedStyle(document.body);
        const bodyBackground = parseRgb(bodyStyle.backgroundColor) ?? {
          r: 255,
          g: 255,
          b: 255,
        };

        const resolveBackground = (element: Element): Rgb => {
          let current: Element | null = element;
          let steps = 0;
          while (current && steps < 8) {
            const style = window.getComputedStyle(current);
            const color = style.backgroundColor;
            if (!isTransparent(color)) {
              const parsed = parseRgb(color);
              if (parsed) {
                return parsed;
              }
            }
            current = current.parentElement;
            steps += 1;
          }
          return bodyBackground;
        };

        const colorBuckets = new Set<string>();
        const fontFamilies = new Set<string>();
        const ctaCandidates: CtaCandidate[] = [];

        let sampledElementCount = 0;
        let aboveFoldElementCount = 0;
        let animatedElementCount = 0;
        let autoplayMediaCount = 0;
        let headingCountAboveFold = 0;
        let textContrastTotal = 0;
        let textContrastSamples = 0;
        let lowContrastTextCount = 0;
        let fontSizeTotal = 0;
        let fontSizeSamples = 0;

        const nodes = Array.from(document.querySelectorAll("body *")).slice(0, 2800);

        for (const node of nodes) {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);

          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number.parseFloat(style.opacity || "1") < 0.05
          ) {
            continue;
          }

          const rect = element.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) {
            continue;
          }

          const inViewport =
            rect.bottom > 0 &&
            rect.top < viewportHeight &&
            rect.right > 0 &&
            rect.left < viewportWidth;
          if (!inViewport) {
            continue;
          }

          sampledElementCount += 1;

          const aboveFold = rect.top < viewportHeight && rect.bottom > 0;
          if (aboveFold) {
            aboveFoldElementCount += 1;
          }

          const animationMs = parseDurationMs(style.animationDuration);
          const transitionMs = parseDurationMs(style.transitionDuration);
          if (aboveFold && (animationMs >= 120 || transitionMs >= 300)) {
            animatedElementCount += 1;
          }

          if (
            aboveFold &&
            element.tagName.toLowerCase() === "video" &&
            (element as HTMLVideoElement).autoplay
          ) {
            autoplayMediaCount += 1;
          }

          const foreground = parseRgb(style.color);
          const background = resolveBackground(element);

          if (foreground) {
            colorBuckets.add(toBucket(foreground));
          }
          colorBuckets.add(toBucket(background));

          const firstFont = normalizeText(
            style.fontFamily.split(",")[0]?.replace(/["']/g, "") ?? "",
          ).toLowerCase();
          if (firstFont) {
            fontFamilies.add(firstFont);
          }

          const tag = element.tagName.toLowerCase();
          if (aboveFold && /^(h1|h2|h3)$/.test(tag)) {
            headingCountAboveFold += 1;
          }

          const text = normalizeText(
            (element.innerText ||
              (element as HTMLInputElement).value ||
              element.getAttribute("aria-label") ||
              element.textContent ||
              ""),
          );

          const isTextCandidate =
            text.length >= 2 &&
            rect.width >= 24 &&
            /^(p|span|a|button|li|h1|h2|h3|h4|h5|h6|label|small|strong|input|div)$/.test(
              tag,
            );

          if (isTextCandidate && foreground) {
            const contrast = contrastRatio(foreground, background);
            textContrastTotal += contrast;
            textContrastSamples += 1;
            if (contrast < 3.5) {
              lowContrastTextCount += 1;
            }

            const fontSize = Number.parseFloat(style.fontSize || "0");
            if (Number.isFinite(fontSize) && fontSize > 0) {
              fontSizeTotal += fontSize;
              fontSizeSamples += 1;
            }
          }

          const role = (element.getAttribute("role") || "").toLowerCase();
          const className = normalizeText(String(element.className || "")).toLowerCase();
          const isInteractive =
            tag === "a" ||
            tag === "button" ||
            tag === "input" ||
            role === "button" ||
            className.includes("btn");

          if (isInteractive && text && ctaRegex.test(text.toLowerCase())) {
            const areaRatio = clamp((rect.width * rect.height) / viewportArea, 0, 1);
            const contrast = foreground ? contrastRatio(foreground, background) : 0;
            const score =
              areaRatio * 100 + contrast * 5 + (aboveFold ? 25 : 0) + clamp(text.length, 0, 40) * 0.1;
            ctaCandidates.push({
              text: text.slice(0, 90),
              areaRatio,
              contrast,
              aboveFold,
              score,
            });
          }
        }

        ctaCandidates.sort((left, right) => right.score - left.score);
        const primary = ctaCandidates[0];

        const averageTextContrast =
          textContrastSamples > 0 ? textContrastTotal / textContrastSamples : 0;
        const lowContrastTextShare =
          textContrastSamples > 0 ? lowContrastTextCount / textContrastSamples : 0;
        const averageFontSize = fontSizeSamples > 0 ? fontSizeTotal / fontSizeSamples : 0;
        const animatedElementShare =
          aboveFoldElementCount > 0 ? animatedElementCount / aboveFoldElementCount : 0;

        return {
          sampledElementCount,
          aboveFoldElementCount,
          ctaCount: ctaCandidates.length,
          primaryCtaText: primary?.text,
          primaryCtaAboveFold: Boolean(primary?.aboveFold),
          primaryCtaContrast: primary ? Number(primary.contrast.toFixed(2)) : 0,
          primaryCtaAreaRatio: primary ? Number(primary.areaRatio.toFixed(4)) : 0,
          averageTextContrast: Number(averageTextContrast.toFixed(2)),
          lowContrastTextShare: Number(lowContrastTextShare.toFixed(4)),
          averageFontSize: Number(averageFontSize.toFixed(2)),
          headingCountAboveFold,
          uniqueColorBuckets: colorBuckets.size,
          uniqueFontFamilies: fontFamilies.size,
          animatedElementShare: Number(animatedElementShare.toFixed(4)),
          autoplayMediaCount,
        };
      },
      {
        ctaPattern: CTA_REGEX_SOURCE,
      },
    );

    return {
      viewport: preset.name,
      width: preset.width,
      height: preset.height,
      sampledElementCount: raw.sampledElementCount,
      aboveFoldElementCount: raw.aboveFoldElementCount,
      ctaCount: raw.ctaCount,
      primaryCtaText: raw.primaryCtaText,
      primaryCtaAboveFold: raw.primaryCtaAboveFold,
      primaryCtaContrast: raw.primaryCtaContrast,
      primaryCtaAreaRatio: raw.primaryCtaAreaRatio,
      averageTextContrast: raw.averageTextContrast,
      lowContrastTextShare: raw.lowContrastTextShare,
      averageFontSize: raw.averageFontSize,
      headingCountAboveFold: raw.headingCountAboveFold,
      uniqueColorBuckets: raw.uniqueColorBuckets,
      uniqueFontFamilies: raw.uniqueFontFamilies,
      animatedElementShare: raw.animatedElementShare,
      autoplayMediaCount: raw.autoplayMediaCount,
    };
  } finally {
    await context.close();
  }
}

export async function analyzeVisualSignals(url: string): Promise<VisualAudit> {
  if (process.env.DISABLE_VISUAL_ANALYSIS === "1") {
    return unavailableAudit("disabled by DISABLE_VISUAL_ANALYSIS=1");
  }

  const normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return unavailableAudit("invalid URL protocol for visual analysis");
  }

  const chromium = await loadChromium();
  if (!chromium) {
    return unavailableAudit("Playwright is not available in this environment");
  }

  let browser: BrowserLike | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });

    const [desktop, mobile] = await withTimeout(
      Promise.all([
        analyzeViewport(browser, normalized, VIEWPORTS[0]),
        analyzeViewport(browser, normalized, VIEWPORTS[1]),
      ]),
      20000,
      "Visual analysis",
    );
    const summary = buildVisualSummary(desktop, mobile);
    const findings = buildFindings(summary, desktop, mobile);
    const evidence = buildEvidence(summary, desktop, mobile);

    return {
      available: true,
      sampledAt: nowIso(),
      desktop,
      mobile,
      summary,
      findings,
      evidence,
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "failed to render page for visual analysis";
    return unavailableAudit(reason);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
