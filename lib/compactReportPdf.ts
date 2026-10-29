import PDFDocument from "pdfkit";

type Block = { kind: "heading" | "body" | "box" | "small"; title?: string; text: string };
export type CompactReport = {
  name: string; url: string; score?: number; meta: string;
  summary: string; leak: string; strengths: string[]; verdict: string;
  coverage: string; technical: string;
  findings: Array<{ headline: string; observation: string; consequence?: string; fix: string; source?: string }>;
};

/** At most two pages, preflighted at readable sizes. Never clip or drop findings. */
export function renderCompactReportPdf(report: CompactReport, draft = false): Promise<Buffer> {
  const clean = (text: string) => text.replace(/[\u2190-\u21ff]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  const page1: Block[] = [
    { kind: "heading", text: "The Roast" }, { kind: "body", text: report.summary },
    { kind: "box", title: "Single Biggest Leak", text: report.leak },
    ...(report.strengths.length ? [{ kind: "heading" as const, text: "Keep The Good Stuff" }, { kind: "body" as const, text: report.strengths.join(" • ") }] : []),
  ];
  const groups: Block[][] = [];
  report.findings.forEach((finding, index) => {
    const group: Block[] = [{ kind: "box", title: `${index + 1}. ${finding.headline}`, text: [finding.observation, finding.consequence, finding.fix ? `The fix: ${finding.fix}` : ""].filter(Boolean).join(" ") }];
    if (finding.source) {
      let source = finding.source;
      try { const url = new URL(source); source = `${url.hostname}${url.pathname}`; } catch { /* Legacy display-only source. */ }
      group.push({ kind: "small", text: `Evidence page: ${source}` });
    }
    groups.push(group);
  });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, autoFirstPage: false, bufferPages: true, info: { Title: `${report.name} - Website Roast`, Author: "Website Roast AI" } });
    const width = 511.28;
    const bottom = 770;
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    function layout(blocks: Block[], start: number, font: number) {
      let y = start;
      const rows = blocks.map(block => {
        const inset = block.kind === "box" ? 24 : 0;
        const size = block.kind === "heading" ? 14 : block.kind === "small" ? 8 : font;
        doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size);
        const titleHeight = block.title ? doc.font("Helvetica-Bold").fontSize(block.kind === "small" ? 8 : 10).heightOfString(clean(block.title).toUpperCase(), { width: width - inset, lineGap: 1 }) + 4 : 0;
        const height = titleHeight + doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size).heightOfString(clean(block.text), { width: width - inset, lineGap: block.kind === "small" ? 1 : 2 }) + (block.kind === "box" ? 16 : block.kind === "heading" ? 11 : 8);
        const row = { block, y, height, size, titleHeight };
        y += height + (block.kind === "box" ? 5 : 0);
        return row;
      });
      return { rows, fits: y <= bottom };
    }
    let plans: ReturnType<typeof layout>[] = [];
    const single = layout([...page1, { kind: "heading", text: "The Problems. The Fixes." }, ...groups.flat(), { kind: "heading", text: "The Verdict" }, { kind: "body", text: report.verdict }, { kind: "small", title: "Checks & coverage", text: [report.technical, report.coverage].filter(Boolean).join(" ") }], 151, 10.5);
    if (single.fits) plans = [single];
    for (const font of [10.5, 10, 9.5]) {
      if (plans.length) break;
      const candidates: Array<{ plans: ReturnType<typeof layout>[]; imbalance: number }> = [];
      for (let split = 0; split <= Math.min(2, groups.length - 1); split++) {
        const first: Block[] = [...page1, ...(split ? [{ kind: "heading" as const, text: "The Problems. The Fixes." }, ...groups.slice(0, split).flat()] : [])];
        const second: Block[] = [{ kind: "heading", text: split ? "The Roast Continues" : "The Problems. The Fixes." }, ...groups.slice(split).flat(), { kind: "heading", text: "The Verdict" }, { kind: "body", text: report.verdict }, { kind: "small", title: "Checks & coverage", text: [report.technical, report.coverage].filter(Boolean).join(" ") }];
        const a = layout(first, 151, font), b = layout(second, 65, font);
        if (a.fits && b.fits) candidates.push({ plans: [a, b], imbalance: Math.abs(a.rows.at(-1)!.y + a.rows.at(-1)!.height - b.rows.at(-1)!.y - b.rows.at(-1)!.height) });
      }
      if (candidates.length) { candidates.sort((a, b) => a.imbalance - b.imbalance); plans = candidates[0].plans; break; }
    }
    if (!plans.length) { reject(new Error("Report exceeds the two-page editorial budget. Shorten the narrative; content was not clipped or omitted.")); doc.end(); return; }
    plans.forEach((plan, page) => {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#090d14");
      if (!page) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffd7b2").text("WEBSITE ROAST AI", 42, 38, { width, height: 16 });
        doc.fontSize(23).fillColor("#f6f7fb").text(clean(report.name), 42, 58, { width: report.score === undefined ? width : width - 100, height: 58 });
        if (report.score !== undefined) doc.fontSize(22).fillColor("#ffd7b2").text(`${report.score.toFixed(1)}/10`, 460, 61, { width: 93, align: "right", height: 30 });
        doc.font("Helvetica").fontSize(8).fillColor("#9aa5b7").text(report.url, 42, 118, { width, height: 15 });
        doc.text(report.meta, 42, 133, { width, height: 14 });
      } else doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffd7b2").text(`WEBSITE ROAST AI / ${clean(report.name)}`, 42, 39, { width, height: 18 });
      plan!.rows.forEach(({ block, y, height, size, titleHeight }) => {
        const inset = block.kind === "box" ? 12 : 0;
        if (block.kind === "box") {
          doc.roundedRect(42, y, width, height, 7).fillAndStroke("#111826", "#263346");
          doc.rect(42, y, 5, height).fill("#f76b1c");
        }
        const top = y + (block.kind === "box" ? 8 : 0);
        if (block.title) doc.font("Helvetica-Bold").fontSize(block.kind === "small" ? 8 : 10).fillColor("#ffd7b2").text(clean(block.title).toUpperCase(), 42 + inset, top, { width: width - inset * 2, height: titleHeight, lineGap: 1 });
        doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(block.kind === "small" ? "#9aa5b7" : "#f6f7fb").text(clean(block.text), 42 + inset, top + titleHeight, { width: width - inset * 2, height: height - titleHeight, lineGap: block.kind === "small" ? 1 : 2 });
        if (block.kind === "heading") doc.moveTo(42, y + height - 6).lineTo(553, y + height - 6).strokeColor("#f76b1c").stroke();
      });
      if (draft) {
        doc.rect(0, 0, doc.page.width, 24).fill("#f76b1c");
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#070708").text("INTERNAL DRAFT - NOT APPROVED FOR CLIENTS", 42, 8, { width, height: 13, align: "center" });
      }
      doc.font("Helvetica").fontSize(7).fillColor("#9aa5b7").text(`Lockdown Studios | ${draft ? "Internal draft" : "Website Roast"} | ${page + 1}/${plans.length}`, 42, 789, { width, height: 10, lineBreak: false });
    });
    doc.end();
  });
}
