import PDFDocument from "pdfkit";
import { REPORT_COLORS as C, REPORT_LAYOUT_VERSION, REPORT_PRODUCT_URL, reportLogo } from "./reportBrand";

export type CompactReport = {
  scorecards?: Array<{label:string;value:number|null;group?:string;maximum?:10|100}>;
  scorecardTitle?: string;
  scoreMaximum?: 10 | 100;
  name: string; url: string; score?: number; meta: string;
  summary: string; leak: string; strengths: string[]; verdict: string;
  coverage: string; technical: string;
  priorityFixes?: string[];
  customerFriction?: string;
  findings: Array<{ headline: string; observation: string; consequence?: string; fix: string; source?: string }>;
};

/** Branded paired panels; saved copy is never rewritten, clipped or truncated. */
export function renderCompactReportPdf(report: CompactReport, draft = false): Promise<Buffer> {
  const clean = (text:string) => text.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,"-").replace(/\s+/g," ").trim();
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:42,autoFirstPage:false,bufferPages:true,info:{Title:`${report.name} - Website Roast`,Author:"Lockdown Studios",Subject:REPORT_LAYOUT_VERSION}});
    const chunks:Buffer[]=[];
    doc.on("data",chunk=>chunks.push(chunk));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);
    const x=42,width=511.28,bottom=775,gap=12,column=(width-gap)/2;
    let leading=2;
    const font=(size:number,bold=false)=>doc.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);
    const measure=(value:string,w:number,size:number,bold=false)=>value?font(size,bold).heightOfString(clean(value),{width:w,lineGap:leading}):0;
    const text=(value:string,left:number,top:number,w:number,size:number,bold=false,color=C.text)=>{
      if(!value)return;
      const h=measure(value,w,size,bold);
      font(size,bold).fillColor(color).text(clean(value),left,top,{width:w,height:h+1,lineGap:leading});
    };
    type Panel={title:string;body:string;small?:boolean};
    const panelHeight=(p:Panel,w:number,size:number)=>(size===9?22:26)+measure(p.title,w-24,9,true)+measure(p.body,w-24,p.small?8.2:size);
    const panel=(p:Panel,left:number,top:number,w:number,h:number,size:number)=>{
      doc.roundedRect(left,top,w,h,7).fillAndStroke(C.surface,C.line);doc.rect(left,top,4,h).fill(C.accent);
      text(p.title,left+12,top+10,w-24,9,true,C.soft);
      text(p.body,left+12,top+16+measure(p.title,w-24,9,true),w-24,p.small?8.2:size);
    };
    type Section={finding?:number;height:(size:number,start:boolean)=>number;draw:(top:number,size:number,start:boolean)=>void};
    const sections:Section[]=[];
    const full=(p:Panel)=>sections.push({height:size=>panelHeight(p,width,size),draw:(top,size)=>panel(p,x,top,width,panelHeight(p,width,size),size)});
    if(report.strengths.length)full({title:"THE ROAST / CLIENT QUICK READ",body:report.summary});
    const focus:Panel[]=report.strengths.length?[{title:"SINGLE BIGGEST LEAK",body:report.leak},{title:"KEEP THE GOOD STUFF",body:report.strengths.join("\n\n")}]:[{title:"THE ROAST / CLIENT QUICK READ",body:report.summary},{title:"SINGLE BIGGEST LEAK",body:report.leak}];
    const focusWidth=focus.length===2?column:width;
    sections.push({height:size=>Math.max(...focus.map(p=>panelHeight(p,focusWidth,size))),draw:(top,size)=>{
      const h=Math.max(...focus.map(p=>panelHeight(p,focusWidth,size)));
      focus.forEach((p,i)=>panel(p,x+i*(column+gap),top,focusWidth,h,size));
    }});
    for(const group of [...new Set(report.scorecards?.map(card=>card.group||"Scores"))]){
      const cards=report.scorecards!.filter(card=>(card.group||"Scores")===group);
      sections.push({height:size=>(size===9?16:22)+Math.ceil(cards.length/(size===9?5:4))*(size===9?35:51),draw:(top,size)=>{
        const columns=size===9?5:4,rowStep=size===9?35:51,titleH=size===9?16:22;
        text(group.toUpperCase(),x,top,width,size===9?9:11,true,C.soft);
        cards.forEach((card,i)=>{
          const w=(width-(columns-1)*gap)/columns,left=x+(i%columns)*(w+gap),y=top+titleH+Math.floor(i/columns)*rowStep;
          doc.roundedRect(left,y,w,size===9?30:43,6).fillAndStroke(C.score,C.line);
          text(card.label,left+8,y+(size===9?3:6),w-16,size===9?6.8:7.3,false,C.muted);
          text(card.value===null?"Not assessed":`${card.value}/${card.maximum||100}`,left+8,y+(size===9?15:20),w-16,card.value===null?8:size===9?11:15,true,C.soft);
        });
      }});
    }
    if(!report.priorityFixes?.length)report.findings.forEach((finding,index)=>{
      const heading=(start:boolean)=>index===0||start?29:0,leftTitle=`${index+1}. ${finding.headline}`;
      const observed=[finding.observation,finding.consequence].filter(Boolean).join(" ");
      const source=finding.source?`Evidence page: ${finding.source}`:"";
      const issueWidth=finding.fix?column:width;
      const rowHeight=(size:number)=>Math.max((size===9?26:30)+measure(leftTitle,issueWidth-24,9,true)+measure(observed,issueWidth-24,size)+(source?9+measure(source,issueWidth-24,7.5):0),finding.fix?panelHeight({title:`${index+1}. QUICK WIN`,body:finding.fix},column,size):0);
      sections.push({finding:index,height:(size,start)=>heading(start)+rowHeight(size),draw:(top,size,start)=>{
        if(heading(start)){
          text(index===0?"THE PROBLEMS. THE FIXES.":"THE ROAST CONTINUES",x,top,width,12,true);
          doc.moveTo(x,top+20).lineTo(x+width,top+20).lineWidth(1).strokeColor(C.accent).stroke();
        }
        const y=top+heading(start),h=rowHeight(size);
        panel({title:leftTitle,body:observed},x,y,issueWidth,h,size);
        if(source)text(source,x+12,y+h-10-measure(source,issueWidth-24,7.5),issueWidth-24,7.5,false,C.muted);
        if(finding.fix)panel({title:`${index+1}. QUICK WIN`,body:finding.fix},x+column+gap,y,column,h,size);
      }});
    });
    if(report.customerFriction)full({title:"POSSIBLE CUSTOMER FRICTION",body:report.customerFriction});
    full({title:"THE VERDICT / RECOMMENDED NEXT STEP",body:report.verdict});
    if(report.priorityFixes?.length){
      // Legacy arrays are independent lists, even when they have equal lengths.
      // A shared row or number would invent an issue-to-fix relationship.
      const lists=[{title:"TOP ISSUES",items:report.findings.map(f=>[f.headline,f.observation,f.consequence,f.source?`Evidence page: ${f.source}`:""].filter(Boolean).join(" "))},{title:"QUICK WINS / PRIORITY FIXES",items:report.priorityFixes}];
      const listHeight=(items:string[],size:number)=>36+items.reduce((total,item)=>total+measure(item,column-34,size)+8,0);
      sections.push({height:size=>Math.max(...lists.map(list=>listHeight(list.items,size))),draw:(top,size)=>{
        const h=Math.max(...lists.map(list=>listHeight(list.items,size)));
        lists.forEach((list,index)=>{
          const left=x+index*(column+gap);
          doc.roundedRect(left,top,column,h,7).fillAndStroke(C.surface,C.line);
          text(list.title,left+12,top+10,column-24,9,true,C.soft);
          let y=top+29;
          for(const item of list.items){doc.circle(left+12,y+4,1.6).fill(C.accent);text(item,left+20,y,column-34,size);y+=measure(item,column-34,size)+8;}
        });
      }});
    }
    full({title:"CHECKS & COVERAGE / REVIEW SCOPE",body:[report.technical,report.coverage].filter(Boolean).join(" "),small:true});
    const title=`${report.name} Website Roast`,titleSize=title.length>55?23:27;
    const titleY=110,titleH=measure(title,width,titleSize,true),metaY=titleY+titleH+14,metaW=width-130;
    const urlH=measure(report.url,metaW-20,8.5,true),metaH=measure(report.meta,metaW-20,8.2);
    const infoH=Math.max(82,urlH+metaH+32),firstStart=metaY+infoH+14;
    const plan=(items:Section[],start:number,size:number)=>{
      let y=start;
      const sectionGap=size===9?8:10;
      const rows=items.map((section,i)=>{const height=section.height(size,i===0);const row={section,y,height,start:i===0};y+=height+sectionGap;return row;});
      return {rows,end:y-sectionGap,fits:y-sectionGap<=bottom};
    };
    let plans:ReturnType<typeof plan>[]=[],bodySize=10;
    for(const size of [10,9.5,9]){
      leading=size===9?1:2;
      const single=plan(sections,firstStart,size);
      if(single.fits){plans=[single];bodySize=size;break;}
      const candidates=[];
      for(let split=2;split<sections.length;split++){
        const a=plan(sections.slice(0,split),firstStart,size),b=plan(sections.slice(split),78,size);
        if(a.fits&&b.fits)candidates.push({plans:[a,b],imbalance:Math.abs(a.end-b.end)});
      }
      if(candidates.length){candidates.sort((a,b)=>a.imbalance-b.imbalance);plans=candidates[0].plans;bodySize=size;break;}
    }
    if(!plans.length){reject(new Error("Report exceeds the two-page editorial budget. Content was not clipped or omitted."));doc.end();return;}
    const logo=reportLogo();
    plans.forEach((page,index)=>{
      doc.addPage();doc.rect(0,0,doc.page.width,doc.page.height).fill(C.background);
      if(!index){
        doc.rect(0,0,doc.page.width,80).fill(C.surface);doc.rect(0,78,doc.page.width,2).fill(C.accent);
        if(logo)doc.image(logo,x,24,{fit:[32,32]});
        text("LOCKDOWN STUDIOS",x+(logo?43:0),27,width-50,11,true);
        text("Website Roast Report",x+(logo?43:0),44,width-50,8,false,C.muted);
        text("ROAST REPORT",x,95,width,8,true,C.soft);text(title,x,titleY,width,titleSize,true);
        doc.roundedRect(x,metaY,metaW,infoH,7).fillAndStroke(C.black,C.line);
        text(report.url,x+10,metaY+10,metaW-20,8.5,true);
        text(report.meta,x+10,metaY+19+urlH,metaW-20,8.2,false,C.muted);
        const bx=x+width-118;
        doc.roundedRect(bx,metaY,118,infoH,9).fillAndStroke(C.black,C.line);
        text("SCORE",bx+12,metaY+10,94,8,true,C.muted);
        text(report.score===undefined?"Not assessed":report.scoreMaximum===100?String(Math.round(report.score)):report.score.toFixed(1),bx+12,metaY+27,94,report.score===undefined?11:31,true,C.soft);
        if(report.score!==undefined)text(`OUT OF ${report.scoreMaximum||10}`,bx+12,metaY+infoH-18,94,7.5,true,C.muted);
      }else{
        text("LOCKDOWN STUDIOS / WEBSITE ROAST",x,25,width,8,true,C.soft);
        text("REPORT DETAILS",x,43,width,15,true);
        doc.moveTo(x,67).lineTo(x+width,67).lineWidth(1).strokeColor(C.accent).stroke();
      }
      page.rows.forEach(row=>row.section.draw(row.y,bodySize,row.start));
      if(draft){doc.rect(0,0,doc.page.width,19).fill(C.accent);text("INTERNAL DRAFT - NOT APPROVED FOR CLIENTS",x,5,width,7.5,true,C.black);}
      text(`Lockdown Studios | Website Roast | ${index+1}/${plans.length}`,x,792,width-120,7,false,C.muted);
      font(7).fillColor(C.muted).text("Website Roast AI",x+width-100,792,{width:100,height:10,align:"right",link:REPORT_PRODUCT_URL,lineBreak:false});
    });
    doc.end();
  });
}
