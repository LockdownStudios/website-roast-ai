import PDFDocument from "pdfkit";

type Block = { kind: "heading" | "body" | "box" | "small" | "scores"; title?: string; text: string };
export type CompactReport = {
  scorecards?: Array<{label:string;value:number|null;group?:string}>;
  scorecardTitle?: string;
  scoreMaximum?: 10 | 100;
  name: string; url: string; score?: number; meta: string;
  summary: string; leak: string; strengths: string[]; verdict: string;
  coverage: string; technical: string;
  findings: Array<{ headline: string; observation: string; consequence?: string; fix: string; source?: string }>;
};

/** At most two pages, preflighted at readable sizes. Never clip or drop findings. */
export function renderCompactReportPdf(report: CompactReport, draft = false): Promise<Buffer> {
  const clean = (text: string) => text.replace(/[\u2190-\u21ff]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  const scoreGroups = [...new Set(report.scorecards?.map(card=>card.group||'Scores'))].flatMap(label=>{
    const cards=report.scorecards!.filter(card=>(card.group||'Scores')===label);
    return Array.from({length:Math.ceil(cards.length/5)},(_,index)=>({label,cards:cards.slice(index*5,index*5+5)}));
  });
  const repeatedLeak=!!report.scorecards?.length&&report.findings.some(finding=>clean(finding.observation)===clean(report.leak));
  const page1: Block[] = [
    ...(report.scorecards?.length ? [{kind:'scores' as const,text:''}] : []),
    { kind: "heading", text: "The Roast" }, { kind: "body", text: report.summary },
    ...(!repeatedLeak?[{kind:'box' as const,title:'Single Biggest Leak',text:report.leak}]:[]),
    ...(report.strengths.length ? [{ kind: "heading" as const, text: "Keep The Good Stuff" }, { kind: "body" as const, text: report.strengths.join(" / ") }] : []),
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
    const bottom = 778;
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const titleWidth=report.score===undefined?width:width-108;
    const titleSize=18;
    const titleHeight=doc.font('Helvetica-Bold').fontSize(titleSize).heightOfString(clean(report.name),{width:titleWidth,lineGap:0});
    const urlY=45+titleHeight+4;
    const urlHeight=doc.font('Helvetica').fontSize(7.5).heightOfString(clean(report.url),{width,lineGap:1});
    const metaY=urlY+urlHeight+3;
    const metaHeight=doc.fontSize(7.5).heightOfString(clean(report.meta),{width,lineGap:1});
    const firstPageStart=Math.ceil(metaY+metaHeight+8);
    function layout(blocks: Block[], start: number, font: number) {
      let y = start;
      const rows = blocks.map(block => {
        if(block.kind==='scores'){const height=scoreGroups.length*30+5;const row={block,y,height,size:10,titleHeight:0};y+=height+3;return row;}
        const inset = block.kind === "box" ? 20 : 0;
        const size = block.kind === "heading" ? 12 : block.kind === "small" ? 7.5 : font;
        doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size);
        const titleHeight = block.title ? doc.font("Helvetica-Bold").fontSize(block.kind === "small" ? 8 : 10).heightOfString(clean(block.title).toUpperCase(), { width: width - inset, lineGap: 1 }) + 4 : 0;
        const height = titleHeight + doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size).heightOfString(clean(block.text), { width: width - inset, lineGap: 1 }) + (block.kind === "box" ? 12 : block.kind === "heading" ? 7 : 5);
        const row = { block, y, height, size, titleHeight };
        y += height + (block.kind === "box" ? 4 : 0);
        return row;
      });
      return { rows, fits: y <= bottom };
    }
    let plans: ReturnType<typeof layout>[] = [];
    for(const font of [10,9.5]){
      const single = layout([...page1, { kind: "heading", text: "The Problems. The Fixes." }, ...groups.flat(), { kind: "heading", text: "The Verdict" }, { kind: "body", text: report.verdict }, { kind: "small", title: "Checks & coverage", text: [report.technical, report.coverage].filter(Boolean).join(" ") }], firstPageStart, font);
      if(single.fits){plans=[single];break;}
    }
    for (const font of [10, 9.5]) {
      if (plans.length) break;
      const candidates: Array<{ plans: ReturnType<typeof layout>[]; imbalance: number }> = [];
      for (let split = 0; split <= Math.min(2, groups.length - 1); split++) {
        const first: Block[] = [...page1, ...(split ? [{ kind: "heading" as const, text: "The Problems. The Fixes." }, ...groups.slice(0, split).flat()] : [])];
        const second: Block[] = [{ kind: "heading", text: split ? "The Roast Continues" : "The Problems. The Fixes." }, ...groups.slice(split).flat(), { kind: "heading", text: "The Verdict" }, { kind: "body", text: report.verdict }, { kind: "small", title: "Checks & coverage", text: [report.technical, report.coverage].filter(Boolean).join(" ") }];
        const a = layout(first, firstPageStart, font), b = layout(second, 61, font);
        if (a.fits && b.fits) candidates.push({ plans: [a, b], imbalance: Math.abs(a.rows.at(-1)!.y + a.rows.at(-1)!.height - b.rows.at(-1)!.y - b.rows.at(-1)!.height) });
      }
      if (candidates.length) { candidates.sort((a, b) => a.imbalance - b.imbalance); plans = candidates[0].plans; break; }
    }
    if (!plans.length) { reject(new Error("Report exceeds the two-page editorial budget. Shorten the narrative; content was not clipped or omitted.")); doc.end(); return; }
    plans.forEach((plan, page) => {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#090d14");
      if (!page) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffd7b2").text("WEBSITE ROAST AI", 42, 29, { width, height: 12 });
        doc.fontSize(titleSize).fillColor("#f6f7fb").text(clean(report.name), 42, 45, { width:titleWidth, height:titleHeight+1,lineGap:0 });
        if (report.score !== undefined) doc.fontSize(19).fillColor("#ffd7b2").text(report.scoreMaximum===100?`${Math.round(report.score)}/100`:`${report.score.toFixed(1)}/10`, 460, 45, { width: 93, align: "right", height: 25 });
        doc.font("Helvetica").fontSize(7.5).fillColor("#9aa5b7").text(clean(report.url),42,urlY,{width,height:urlHeight+1,lineGap:1});
        doc.text(clean(report.meta),42,metaY,{width,height:metaHeight+1,lineGap:1});
      } else doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffd7b2").text(`WEBSITE ROAST AI / ${clean(report.name)}`, 42, 39, { width, height: 18 });
      plan!.rows.forEach(({ block, y, height, size, titleHeight }) => {
        if(block.kind==='scores'){
          scoreGroups.forEach((group,index)=>{
            const top=y+index*30,cellWidth=(width-76)/group.cards.length;
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#cbd5e1').text(clean(group.label),42,top+4,{width:70,height:13});
            doc.font('Helvetica').fontSize(7).fillColor('#9aa5b7').text('out of 100',42,top+17,{width:70,height:10});
            group.cards.forEach((card,column)=>{const x=118+column*cellWidth;doc.font('Helvetica').fontSize(7).fillColor('#9aa5b7').text(clean(card.label),x,top+2,{width:cellWidth-6,height:10});doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffd7b2').text(card.value===null?'N/A':String(card.value),x,top+13,{width:cellWidth-6,height:14});});
            doc.moveTo(42,top+29).lineTo(553,top+29).lineWidth(.5).strokeColor('#263346').stroke();
          });return;
        }
        const inset = block.kind === "box" ? 10 : 0;
        if (block.kind === "box") {
          doc.roundedRect(42, y, width, height, 4).fillAndStroke("#0e1520", "#263346");
          doc.rect(42, y, 2.5, height).fill("#f76b1c");
        }
        const top = y + (block.kind === "box" ? 6 : 0);
        if (block.title) doc.font("Helvetica-Bold").fontSize(block.kind === "small" ? 8 : 10).fillColor("#ffd7b2").text(clean(block.title), 42 + inset, top, { width: width - inset * 2, height: titleHeight, lineGap: 1 });
        doc.font(block.kind === "heading" ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(block.kind === "small" ? "#9aa5b7" : "#f6f7fb").text(clean(block.text), 42 + inset, top + titleHeight, { width: width - inset * 2, height: height - titleHeight, lineGap: 1 });
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
