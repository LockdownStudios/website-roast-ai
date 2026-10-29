export type VisualReadiness = {
  settled: boolean;
  waitedMs: number;
  reasons: string[];
};

// Self-contained so Playwright can serialize this into the page context.
export async function waitForVisualReadiness(timeoutMs: number): Promise<VisualReadiness> {
  const started = Date.now();
  let previous = "";
  let stableSamples = 0;
  let reasons: string[] = [];
  do {
    reasons = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const visible = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) return false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) return false;
      }
      return true;
    };
    // FontFaceSet.status includes fonts used only by hidden/off-screen content.
    // Only pending fonts used by visible text can invalidate this viewport.
    if (document.fonts.status !== "loaded" && [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,label,span')].filter(visible).slice(0, 160).some(element => {
      const text = (element.textContent || "").trim().slice(0, 80);
      if (!text) return false;
      const style = getComputedStyle(element);
      try { return !document.fonts.check(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text); }
      catch { return true; }
    })) reasons.push("Fonts still loading");
    if ([...document.querySelectorAll("a, button, [role=button]")].some(element => visible(element) && /^skip(?: intro)?$/i.test((element.textContent || "").trim()))) {
      reasons.push("Intro screen requires interaction");
    }
    const pendingImages = [...document.images].filter(image => visible(image) && !image.complete);
    if (pendingImages.length) reasons.push("Visible images still loading");
    if ([...document.images].some(image => visible(image) && image.complete && image.naturalWidth === 0)) reasons.push("Visible image failed to load");
    const loaders = document.querySelectorAll('.preloader, #preloader, .page-loader, #page-loader, .loading-screen, [aria-busy="true"]');
    if ([...loaders].some(element => {
      if (!visible(element)) return false;
      // A small spinner inside a large body/main is not a page overlay.
      // Only inherit coverage from an actual positioned overlay wrapper.
      let surface = element;
      for (let node = element.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (["fixed", "absolute"].includes(getComputedStyle(node).position)) {
          surface = node;
          break;
        }
      }
      const style = getComputedStyle(surface);
      const namedLoader = element.matches('.preloader, #preloader, .page-loader, #page-loader, .loading-screen');
      if (!namedLoader && !["fixed", "absolute"].includes(style.position)) return false;
      const rect = surface.getBoundingClientRect();
      const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
      const right = Math.min(width, rect.right), bottom = Math.min(height, rect.bottom);
      if (Math.max(0, right - left) * Math.max(0, bottom - top) <= width * height * 0.2) return false;
      // Retained loader elements behind the finished content are not occluding it.
      return [0.25, 0.5, 0.75].some(fraction => {
        const hit = document.elementFromPoint(left + (right - left) * fraction, top + (bottom - top) * fraction);
        return Boolean(hit && (hit === surface || surface.contains(hit)));
      });
    })) reasons.push("Loading overlay remains visible");
    const anchors = [...document.querySelectorAll('h1, h2, main, header, [role="main"]')].filter(visible).slice(0, 12);
    const signature = [document.documentElement.scrollHeight, ...anchors.flatMap(element => {
      const rect = element.getBoundingClientRect();
      return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
    })].join("|");
    stableSamples = signature === previous ? stableSamples + 1 : 0;
    previous = signature;
    if (stableSamples < 2) reasons.push("Layout still changing");
    if (!reasons.length && Date.now() - started >= 1200) return { settled: true, waitedMs: Date.now() - started, reasons: [] };
    await new Promise(resolve => setTimeout(resolve, 300));
  } while (Date.now() - started < timeoutMs);
  return { settled: false, waitedMs: Date.now() - started, reasons };
}
