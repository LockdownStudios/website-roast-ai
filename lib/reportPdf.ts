import "server-only";
import PDFDocument from "pdfkit";
import { buildImplementationBlueprint } from "./implementationGuide";
import { BREAKDOWN_KEYS, CATEGORY_WEIGHTS, categoryRatio } from "./scoringConfig";
import type {
  ReportAccess,
  RoastResultPayload,
  ScrapedWebsiteData,
  StoredRoastReport,
  WebsiteScoring,
} from "./types";

const ROAST_BG = "#090d14";
const ROAST_BLACK = "#070708";
const ROAST_SURFACE = "#111826";
const ROAST_SURFACE_SOFT = "#182335";
const ROAST_LINE = "#263346";
const ROAST_MUTED = "#9aa5b7";
const ROAST_TEXT = "#f6f7fb";
const ROAST_ACCENT = "#f76b1c";
const ROAST_ACCENT_SOFT = "#ffd7b2";

const BREAKDOWN_LABELS: Record<keyof WebsiteScoring["breakdown"], string> = {
  clarity: "Clarity",
  trust: "Trust",
  CTA: "CTA",
  differentiation: "Differentiation",
  design_hint: "Structure",
};

type RenderRoastReportPdfOptions = {
  access: ReportAccess;
  isUnlocked: boolean;
};

export function roastReportFilename(report: StoredRoastReport): string {
  const subject = reportSubject(report.url, report.scraped);
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${slug || "website"}-${report.id.slice(0, 8)}-roast-report.pdf`;
}

export async function renderRoastReportPdf(
  report: StoredRoastReport,
  options: RenderRoastReportPdfOptions,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `${reportSubject(report.url, report.scraped)} Website Roast Report`,
        Author: "Website Roast AI",
        Subject: "Conversion website roast report",
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawCover(doc, report, options);
    addContentPage(doc);
    drawReportBody(doc, report, options);
    doc.end();
  });
}

function drawReportBody(
  doc: PDFKit.PDFDocument,
  report: StoredRoastReport,
  options: RenderRoastReportPdfOptions,
) {
  const subject = reportSubject(report.url, report.scraped);
  const roast = report.roast;
  const scoring = report.scoring;

  drawSectionTitle(doc, "The Roast");
  drawParagraph(doc, cleanReportText(roast.first_impression, subject), 12, ROAST_TEXT);
  drawCallout(doc, "Single Biggest Leak", cleanReportText(roast.single_biggest_leak, subject));

  drawSectionTitle(doc, "Top Mistakes");
  drawBullets(doc, cleanList(roast.mistakes, subject, options.isUnlocked ? 5 : 3));

  if (options.isUnlocked) {
    drawSectionTitle(doc, "Score Snapshot");
    drawScoreGrid(doc, scoring);
    drawSectionTitle(doc, "Lost Customers");
    drawParagraph(doc, cleanReportText(roast.lost_customers, subject), 11, ROAST_TEXT);
    drawSectionTitle(doc, "Priority Fixes");
    drawBullets(doc, priorityFixes(report, subject));
    drawSectionTitle(doc, "High Impact Improvement");
    drawParagraph(doc, cleanReportText(roast.high_impact, subject), 11, ROAST_TEXT);
    drawBlueprint(doc, report, subject);
  } else {
    drawLockedNotice(doc, options.access);
  }

  drawFooter(doc, report, options);
}

function drawCover(
  doc: PDFKit.PDFDocument,
  report: StoredRoastReport,
  options: RenderRoastReportPdfOptions,
) {
  const width = doc.page.width;
  const height = doc.page.height;
  const subject = reportSubject(report.url, report.scraped);
  const firstImpression = cleanReportText(report.roast.first_impression, subject);
  const firstMistake = cleanList(report.roast.mistakes, subject, 1)[0] || report.roast.single_biggest_leak;
  const blueprint = buildImplementationBlueprint(report.scraped, report.scoring);
  const topLeak = cleanReportText(report.roast.single_biggest_leak || firstMistake, subject);

  doc.rect(0, 0, width, height).fill(ROAST_BLACK);
  doc.rect(0, 0, width, 170).fill(ROAST_SURFACE);
  doc.rect(0, 168, width, 2).fill(ROAST_ACCENT);

  doc.roundedRect(48, 48, 46, 46, 8).fillAndStroke(ROAST_BG, ROAST_ACCENT);
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(ROAST_ACCENT_SOFT)
    .text("WRA", 48, 64, { width: 46, align: "center" });
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(ROAST_TEXT)
    .text("WEBSITE ROAST AI", 110, 54);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(ROAST_MUTED)
    .text(options.isUnlocked ? "Full Report" : "Preview Report", 110, 72);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(ROAST_ACCENT_SOFT)
    .text("ROAST REPORT", 48, 188, { characterSpacing: 1.4 });
  doc
    .font("Helvetica-Bold")
    .fontSize(subject.length > 34 ? 34 : 40)
    .fillColor(ROAST_TEXT)
    .text(subject, 48, 212, { width: width - 96, lineGap: 2 });

  drawScoreBadge(doc, width - 182, 322, report.roast.score, report.roast.score_label);

  const details = [
    visibleUrl(report.url),
    `Generated ${formatDate(report.createdAt)}`,
    options.isUnlocked ? "Full report unlocked" : `Preview only - unlock for R${options.access.priceZar}`,
  ];
  let y = 326;
  details.forEach((detail) => {
    doc.roundedRect(48, y, width - 260, 30, 6).fillAndStroke(ROAST_BG, ROAST_LINE);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(ROAST_TEXT)
      .text(cleanText(detail), 60, y + 10, { width: width - 285 });
    y += 42;
  });

  const briefY = 476;
  doc.roundedRect(48, briefY, width - 96, 194, 8).fillAndStroke(ROAST_SURFACE, ROAST_LINE);
  doc.rect(48, briefY, 7, 194).fill(ROAST_ACCENT);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(ROAST_ACCENT_SOFT)
    .text("QUICK READ", 66, briefY + 16, { characterSpacing: 0.8 });
  doc.font("Helvetica").fontSize(10.5).fillColor(ROAST_TEXT).text(firstImpression, 66, briefY + 36, {
    width: width - 132,
    height: 50,
    ellipsis: true,
    lineGap: 3,
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(ROAST_MUTED)
    .text("TOP LEAK", 66, briefY + 98, { characterSpacing: 0.8 });
  doc.font("Helvetica").fontSize(10).fillColor(ROAST_TEXT).text(cleanText(topLeak || firstMistake), 132, briefY + 95, {
    width: width - 180,
    height: 42,
    ellipsis: true,
    lineGap: 2,
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(ROAST_MUTED)
    .text("NEXT ACTION", 66, briefY + 150, { characterSpacing: 0.8 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ROAST_ACCENT_SOFT).text(blueprint.primaryCta, 152, briefY + 147, {
    width: width - 200,
    height: 22,
    ellipsis: true,
  });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(ROAST_MUTED)
    .text("A conversion-focused teardown built from public website signals.", 48, height - 84, {
      width: width - 96,
    });
}

function drawBlueprint(
  doc: PDFKit.PDFDocument,
  report: StoredRoastReport,
  subject: string,
) {
  const blueprint = buildImplementationBlueprint(report.scraped, report.scoring);

  drawSectionTitle(doc, "Implementation Blueprint");
  drawCallout(
    doc,
    blueprint.primaryCtaSource === "detected"
      ? "Primary CTA Detected"
      : "Recommended Primary CTA",
    blueprint.primaryCta,
  );

  drawSubheading(doc, "Priority Focus");
  drawBullets(
    doc,
    cleanList(blueprint.priorities.map(formatPriorityLine), subject, 3),
  );

  drawSubheading(doc, "Suggested Page Order");
  drawBullets(doc, cleanList(blueprint.structureOrder, subject, 6));

  drawSubheading(doc, "7-Day Action Plan");
  drawBullets(doc, cleanList(blueprint.sevenDayPlan, subject, 7));
}

function priorityFixes(report: StoredRoastReport, subject: string): string[] {
  const blueprint = buildImplementationBlueprint(report.scraped, report.scoring);
  const fixes = blueprint.fixes.slice(0, 4).map((fix) => {
    const firstStep = fix.how[0] ?? fix.why;
    const impact = fix.impact ? `Impact: ${fix.impact}.` : "";
    const effort = fix.effort ? `Effort: ${fix.effort}.` : "";
    return `${fix.where}: ${fix.title}. ${firstStep} ${impact} ${effort} Example: ${fix.example}`;
  });

  return cleanList(fixes.length > 0 ? fixes : report.roast.quick_fixes, subject, 4);
}

function drawScoreGrid(doc: PDFKit.PDFDocument, scoring: WebsiteScoring) {
  const gap = 12;
  const cardWidth = (contentWidth(doc) - gap) / 2;
  const cardHeight = 64;
  let x = doc.page.margins.left;
  let y = doc.y;

  BREAKDOWN_KEYS.forEach((key, index) => {
    if (index > 0 && index % 2 === 0) {
      x = doc.page.margins.left;
      y += cardHeight + gap;
    }
    ensureRoom(doc, cardHeight + 18);
    doc.roundedRect(x, y, cardWidth, cardHeight, 8).fillAndStroke(ROAST_SURFACE_SOFT, ROAST_LINE);
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(ROAST_MUTED)
      .text(BREAKDOWN_LABELS[key].toUpperCase(), x + 12, y + 12, {
        width: cardWidth - 24,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(ROAST_ACCENT_SOFT)
      .text(`${scoring.breakdown[key].toFixed(1)}/${CATEGORY_WEIGHTS[key]}`, x + 12, y + 30, {
        width: cardWidth - 90,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(ROAST_TEXT)
      .text(`${Math.round(categoryRatio(key, scoring.breakdown[key]) * 100)}%`, x + cardWidth - 68, y + 36, {
        width: 54,
        align: "right",
      });
    x += cardWidth + gap;
  });

  doc.y = y + cardHeight + 22;
}

function drawLockedNotice(doc: PDFKit.PDFDocument, access: ReportAccess) {
  drawSectionTitle(doc, "Full Report Locked");
  drawCallout(
    doc,
    `Unlock for R${access.priceZar}`,
    "The full report includes score breakdowns, lost-customer analysis, priority fixes, and the implementation blueprint.",
  );
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureRoom(doc, 56);
  doc.x = doc.page.margins.left;
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(ROAST_TEXT)
    .text(title.toUpperCase());
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(ROAST_ACCENT)
    .stroke();
  doc.moveDown(1.05);
}

function drawSubheading(doc: PDFKit.PDFDocument, title: string) {
  ensureRoom(doc, 32);
  doc.x = doc.page.margins.left;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(ROAST_ACCENT_SOFT)
    .text(title.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.4);
}

function drawParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  fontSize = 11,
  color = ROAST_TEXT,
) {
  if (!text) {
    return;
  }
  const width = contentWidth(doc);
  const height = doc.heightOfString(text, { width, lineGap: 4 });
  ensureRoom(doc, height + 18);
  doc.font("Helvetica").fontSize(fontSize).fillColor(color).text(text, {
    width,
    lineGap: 4,
  });
  doc.moveDown(0.9);
}

function drawBullets(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item) => {
    const text = cleanText(item);
    if (!text) {
      return;
    }
    doc.font("Helvetica").fontSize(10.5);
    const textHeight = doc.heightOfString(text, {
      width: contentWidth(doc) - 18,
      lineGap: 3,
    });
    ensureRoom(doc, textHeight + 16);
    const y = doc.y;
    doc.circle(doc.page.margins.left + 4, y + 6, 2.4).fill(ROAST_ACCENT);
    doc.font("Helvetica").fontSize(10.5).fillColor(ROAST_TEXT).text(text, doc.page.margins.left + 18, y, {
      width: contentWidth(doc) - 18,
      lineGap: 3,
    });
    doc.moveDown(0.55);
  });
  doc.moveDown(0.5);
}

function drawCallout(doc: PDFKit.PDFDocument, title: string, text: string) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return;
  }
  const innerWidth = contentWidth(doc) - 32;
  const textHeight = doc.heightOfString(cleaned, { width: innerWidth, lineGap: 3 });
  const height = Math.max(84, textHeight + 52);
  ensureRoom(doc, height + 18);
  const x = doc.page.margins.left;
  const y = doc.y;

  doc.roundedRect(x, y, contentWidth(doc), height, 8).fillAndStroke(ROAST_SURFACE, ROAST_LINE);
  doc.rect(x, y, 6, height).fill(ROAST_ACCENT);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(ROAST_ACCENT_SOFT)
    .text(title.toUpperCase(), x + 18, y + 16, { width: innerWidth });
  doc.font("Helvetica").fontSize(11).fillColor(ROAST_TEXT).text(cleaned, x + 18, y + 36, {
    width: innerWidth,
    lineGap: 3,
  });
  doc.y = y + height + 18;
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  report: StoredRoastReport,
  options: RenderRoastReportPdfOptions,
) {
  ensureRoom(doc, 82);
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, contentWidth(doc), 56, 8).fillAndStroke(ROAST_BLACK, ROAST_LINE);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(ROAST_TEXT)
    .text("WEBSITE ROAST AI", doc.page.margins.left + 14, y + 13);
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(ROAST_MUTED)
    .text(
      `Report ID ${report.id} | ${options.isUnlocked ? "full report" : "preview report"} | generated from public website signals`,
      doc.page.margins.left + 14,
      y + 30,
      { width: contentWidth(doc) - 28 },
    );
}

function drawScoreBadge(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  score: number,
  label: RoastResultPayload["score_label"],
) {
  doc.roundedRect(x, y, 120, 116, 12).fillAndStroke(ROAST_BG, ROAST_LINE);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(ROAST_MUTED)
    .text(label.toUpperCase(), x, y + 17, {
      width: 120,
      align: "center",
      characterSpacing: 0.8,
    });
  doc.font("Helvetica-Bold").fontSize(42).fillColor(ROAST_ACCENT_SOFT).text(score.toFixed(1), x, y + 36, {
    width: 120,
    align: "center",
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(ROAST_MUTED)
    .text("OUT OF 10", x, y + 84, {
      width: 120,
      align: "center",
      characterSpacing: 1,
    });
}

function addContentPage(doc: PDFKit.PDFDocument) {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(ROAST_BG);
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function ensureRoom(doc: PDFKit.PDFDocument, required: number) {
  if (doc.y + required > doc.page.height - doc.page.margins.bottom) {
    addContentPage(doc);
  }
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function reportSubject(url: string, scraped?: ScrapedWebsiteData): string {
  const title = scraped?.title?.trim();
  if (title && title !== "No title found.") {
    return truncateAtWord(cleanText(title.replace(/(?:\s+[|-]\s+|:\s+).*$/, "")), 64);
  }

  const h1 = scraped?.headings.h1[0]?.trim();
  if (h1) {
    return truncateAtWord(cleanText(h1), 64);
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "This page";
  }
}

function visibleUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function cleanList(items: string[], subject: string, limit: number): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of items) {
    const value = cleanReportText(item, subject);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(value);
  }

  return cleaned.slice(0, limit);
}

function formatPriorityLine(value: string): string {
  const cleaned = value.replace(/^\d+\.\s*/, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanReportText(value: string, subject: string): string {
  return cleanText(decodeHtmlEntities(value))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\uFFFD/g, "")
    .replace(/\blocalhost(?::\d+)?\b/gi, subject)
    .replace(/\b127\.0\.0\.1(?::\d+)?\b/g, subject)
    .replace(/\b0\.0\.0\.0(?::\d+)?\b/g, subject)
    .replace(/\bTrust snapshot:/gi, "Proof gap:")
    .replace(/\bCurrent contact snapshot:/gi, "Contact gap:");
}

function cleanText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, limit: number): string {
  const cleaned = cleanText(decodeHtmlEntities(value));
  if (cleaned.length <= limit) {
    return cleaned;
  }

  const clipped = cleaned.slice(0, Math.max(0, limit - 3));
  const wordSafe = clipped.replace(/\s+\S*$/, "").trim();
  return `${(wordSafe.length >= limit * 0.65 ? wordSafe : clipped).trim()}...`;
}

function decodeHtmlEntities(value: string): string {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      entityFromCodePoint(match, Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (match, decimal: string) =>
      entityFromCodePoint(match, Number.parseInt(decimal, 10)),
    );
}

function entityFromCodePoint(fallback: string, codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
