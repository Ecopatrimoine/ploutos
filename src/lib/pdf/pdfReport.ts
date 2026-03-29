// ─── PDF RAPPORT PATRIMONIAL ──────────────────────────────────────────────────
// Fonction pure — aucun setState, aucun hook React
// Prend tous ses paramètres, génère le HTML et ouvre une popup d'impression

import { n, euro, isAV, isPERType } from "../calculs/utils";
import type { PatrimonialData, IrOptions, Hypothesis } from "../../types/patrimoine";

type IrResult = any;
type IfiResult = any;
type SuccessionResult = any;
type HypothesisResult = {
  hypothesis: Hypothesis;
  ir: IrResult | null;
  ifi: IfiResult | null;
  succession: SuccessionResult | null;
  differences: any[];
};

export interface PdfReportParams {
  sections: Record<string, boolean>;
  data: PatrimonialData;
  ir: IrResult;
  ifi: IfiResult;
  succession: SuccessionResult;
  irOptions: IrOptions;
  cabinet: Record<string, string>;
  clientName: string;
  notes: string;
  logoSrc: string;
  hypothesisResults: HypothesisResult[];
}

export function buildAndPrintPdf(params: PdfReportParams) {
  const { sections, data, ir, ifi, succession, irOptions, cabinet, clientName, notes, logoSrc, hypothesisResults } = params;

  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const dateTimeStr = new Date().toLocaleString("fr-FR");
  const immobilierBrut = data.properties.reduce((s, p) => s + n(p.value), 0);
  const immobilierNet = data.properties.reduce((s, p) => {
    const debt = n(p.loanCapitalRemaining);
    const insurRate = p.loanInsurance ? Math.min(100, Math.max(0, n(p.loanInsuranceRate))) : 0;
    return s + Math.max(0, n(p.value) - Math.max(0, debt * (1 - insurRate / 100)));
  }, 0);
  const placementsTotal = data.placements.reduce((s, p) => s + n(p.value), 0);
  const avTotal = data.placements.filter((p) => isAV(p.type) || isPERType(p.type)).reduce((s, p) => s + n(p.value), 0);
  const patrimoineTotal = immobilierNet + placementsTotal;
  const coupleLabel: Record<string,string> = { married:"Marié(s)", pacs:"Pacsé(s)", cohab:"Concubinage", single:"Célibataire", divorced:"Divorcé(e)", widowed:"Veuf/Veuve" };
  const showIFI = ifi.ifi > 0;
  const clientName2 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || clientName || "Client";
  const logoSrc2 = cabinet.logoSrc || logoSrc || "";

  const kpi = (label: string, value: string, sub?: string, accent = false) =>
    `<div class="kpi${accent?" kpi-accent":""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;
  const sec = (title: string, body: string) =>
    `<div class="section"><div class="section-title">${title}</div>${body}</div>`;
  const tbl = (headers: string[], rows: string[][], hl?: number) =>
    `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${i%2===0?"row-even":"row-odd"}">${row.map((cell,j)=>`<td${j===hl?' class="highlight"':""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const pH = (title: string) =>
    `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName2} · ${dateStr}</div></div>`;
  const pF = (label: string) =>
    `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"} · ${label}</span><span>${dateStr}</span></div>`;

  const hbar = (items: {label:string;value:number;color:string}[], width=420) => {
    const maxVal=Math.max(...items.map(i=>i.value),1);
    const rowH=28; const lW=140; const bW=width-lW-85; const svgH=items.length*rowH+8;
    return `<svg width="${width}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
      const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
      return `<text x="${lW-8}" y="${y+14}" text-anchor="end" font-size="8" fill="#555" font-family="Lato,sans-serif">${item.label}</text>
      <rect x="${lW}" y="${y+2}" width="${bw}" height="16" rx="4" fill="${item.color}" opacity="0.88"/>
      <text x="${lW+bw+6}" y="${y+14}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
    }).join("")}</svg>`;
  };

  const segB = (segs:{label:string;value:number;color:string}[], width=420) => {
    const total=segs.reduce((s,i)=>s+i.value,0); if(total<=0) return "";
    let x=0;
    const rects=segs.map(seg=>{ const w=(seg.value/total)*width;
      const r=`<rect x="${x}" y="0" width="${w}" height="18" fill="${seg.color}"/><text x="${x+w/2}" y="13" text-anchor="middle" font-size="7.5" fill="white" font-family="Lato,sans-serif" font-weight="700">${Math.round(seg.value/total*100)}%</text>`;
      x+=w; return r; }).join("");
    const legend=segs.map((seg,i)=>`<g transform="translate(${i*200},0)"><circle cx="7" cy="7" r="5" fill="${seg.color}"/><text x="16" y="12" font-size="8" fill="#444" font-family="Lato,sans-serif">${seg.label} — ${euro(seg.value)}</text></g>`).join("");
    return `<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="18" rx="4" fill="#e5e7eb"/>${rects}<g transform="translate(0,26)">${legend}</g></svg>`;
  };

  const wfall = () => {
    const fraisPro=ir.retainedExpenses||0;
    const perDed=ir.perDeductionCalc||0;
    const autresDed=Math.max(0,(ir.deductibleCharges||0)-perDed);
    const items=[
      {label:"Revenus bruts",value:ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0),color:"#101B3B",type:"add"},
      ...(fraisPro>0?[{label:irOptions.expenseMode1==="actual"||irOptions.expenseMode2==="actual"?"Frais réels":"Abatt. 10%",value:fraisPro,color:"#60a5fa",type:"ded"}]:[]),
      ...(perDed>0?[{label:"Versements PER",value:perDed,color:"#a78bfa",type:"ded"}]:[]),
      ...(autresDed>0?[{label:"Autres déductions",value:autresDed,color:"#86efac",type:"ded"}]:[]),
      {label:"Rev. net imposable",value:ir.revenuNetGlobal,color:"#26428B",type:"total"},
      {label:"IR barème",value:ir.bareme||0,color:"#dc2626",type:"tax"},
      ...(ir.foncierSocialLevy>0?[{label:"Prél. sociaux",value:ir.foncierSocialLevy,color:"#f97316",type:"tax"}]:[]),
      ...(ir.totalPFU>0?[{label:"PFU placements",value:ir.totalPFU,color:"#f97316",type:"tax"}]:[]),
      ...(ir.avRachatImpot>0?[{label:"Fiscalité AV",value:ir.avRachatImpot,color:"#f97316",type:"tax"}]:[]),
      {label:"IR total dû",value:ir.finalIR,color:"#b91c1c",type:"result"},
    ];
    const maxVal=Math.max(...items.map(i=>i.value),1);
    const rowH=26; const lW=140; const bW=260; const svgH=items.length*rowH+8;
    return `<svg width="${lW+bW+90}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
      const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
      const isDed=item.type==="ded"; const isTax=item.type==="tax";
      return `<text x="${lW-6}" y="${y+13}" text-anchor="end" font-size="8" fill="${isDed?"#92400e":isTax?"#c2410c":"#555"}" font-family="Lato,sans-serif">${isDed?"− ":isTax?"+ ":""}${item.label}</text>
      <rect x="${lW}" y="${y+1}" width="${bw}" height="15" rx="3" fill="${item.color}" opacity="${isDed?0.55:0.9}"/>
      <text x="${lW+bw+6}" y="${y+13}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
    }).join("")}</svg>`;
  };

  // ── Donut SVG ──────────────────────────────────────────────────────────────
  const donut = (segs:{value:number;color:string;label:string}[], cx=80, cy=80, r=60, ri=40) => {
    const total=segs.reduce((s,i)=>s+i.value,0); if(total<=0) return "";
    let angle=-Math.PI/2;
    const paths=segs.map(seg=>{
      const a=seg.value/total*2*Math.PI;
      const x1=cx+r*Math.cos(angle); const y1=cy+r*Math.sin(angle);
      const x2=cx+r*Math.cos(angle+a); const y2=cy+r*Math.sin(angle+a);
      const ix1=cx+ri*Math.cos(angle+a); const iy1=cy+ri*Math.sin(angle+a);
      const ix2=cx+ri*Math.cos(angle); const iy2=cy+ri*Math.sin(angle);
      const lg=a>Math.PI?1:0;
      const path=`M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${ix1},${iy1} A${ri},${ri} 0 ${lg},0 ${ix2},${iy2} Z`;
      angle+=a;
      return `<path d="${path}" fill="${seg.color}" opacity="0.9"/>`;
    }).join("");
    const legend=segs.map((seg,i)=>`<g transform="translate(0,${i*14})"><circle cx="5" cy="5" r="4" fill="${seg.color}"/><text x="13" y="9" font-size="7" fill="#444" font-family="Lato,sans-serif">${seg.label} (${Math.round(seg.value/total*100)}%)</text></g>`).join("");
    return `<svg width="240" height="180" xmlns="http://www.w3.org/2000/svg"><g transform="translate(10,10)">${paths}</g><g transform="translate(180,30)">${legend}</g></svg>`;
  };

  // ── Jauge demi-cercle ───────────────────────────────────────────────────────
  const gauge = (pct:number, label:string, value:string, color:string, w=130) => {
    const r=50; const cx=w/2; const cy=58;
    const clampedPct=Math.min(1,Math.max(0,pct));
    const angle=Math.PI+clampedPct*Math.PI;
    const nx=cx+r*Math.cos(angle); const ny=cy+r*Math.sin(angle);
    const zones=[{c:"#22c55e",f:0,t:0.33},{c:"#E3AF64",f:0.33,t:0.66},{c:"#dc2626",f:0.66,t:1}];
    const arcPath=(from:number,to:number)=>{
      const a1=Math.PI+from*Math.PI; const a2=Math.PI+to*Math.PI;
      const x1=cx+r*Math.cos(a1); const y1=cy+r*Math.sin(a1);
      const x2=cx+r*Math.cos(a2); const y2=cy+r*Math.sin(a2);
      return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`;
    };
    return `<svg width="${w}" height="70" viewBox="0 0 ${w} 70" xmlns="http://www.w3.org/2000/svg">
      ${zones.map(z=>`<path d="${arcPath(z.f,z.t)}" fill="none" stroke="${z.c}" stroke-width="10" stroke-linecap="butt"/>`).join("")}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#101B3B" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="#101B3B"/>
      <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="8" font-weight="700" fill="#101B3B" font-family="Lato,sans-serif">${value}</text>
      <text x="${cx}" y="${cy+24}" text-anchor="middle" font-size="6.5" fill="#888" font-family="Lato,sans-serif">${label}</text>
    </svg>`;
  };

  // ── Waterfall successoral ───────────────────────────────────────────────────
  const succWaterfall = () => {
    const avCapital=(succession.avLines||[]).reduce((s:number,l:any)=>s+l.amount,0);
    const avTax=(succession.avLines||[]).reduce((s:number,l:any)=>s+l.totalTax,0);
    const totalDroits=succession.totalSuccessionRights||0;
    const netSucc=succession.activeNet-totalDroits;
    const netAv=avCapital-avTax;
    const total=Math.max(succession.activeNet+avCapital,1);
    const steps=[
      {label:"Actif successoral",value:succession.activeNet,color:"#101B3B",ratio:succession.activeNet/total},
      {label:"Droits succession",value:-totalDroits,color:"#dc2626",ratio:totalDroits/total},
      {label:"Net succession",value:netSucc,color:"#16a34a",ratio:netSucc/total,sep:true},
      ...(avCapital>0?[
        {label:"Capital AV",value:avCapital,color:"#26428B",ratio:avCapital/total},
        {label:"Fiscalité AV",value:-avTax,color:"#f97316",ratio:avTax/total},
        {label:"Net AV",value:netAv,color:"#16a34a",ratio:netAv/total,sep:true},
      ]:[]),
      {label:"Total net transmis",value:netSucc+netAv,color:"#101B3B",ratio:(netSucc+netAv)/total,total:true},
    ];
    const W=420; const lW=130; const bW=W-lW-90; const rowH=24;
    const svgH=steps.length*rowH+8;
    return `<svg width="${W}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${steps.map((s:any,i)=>{
      const bw=Math.max(2,Math.abs(s.ratio)*bW); const y=i*rowH+4;
      const isNeg=s.value<0;
      const sepLine=s.sep?`<line x1="${lW}" y1="${y}" x2="${W-85}" y2="${y}" stroke="#e5e0d8" stroke-width="0.5"/>`:"";
      return `${sepLine}
        <text x="${lW-6}" y="${y+13}" text-anchor="end" font-size="7.5" fill="${isNeg?"#c2410c":s.total?"#101B3B":"#555"}" font-family="Lato,sans-serif" font-weight="${s.total?700:400}">${s.label}</text>
        <rect x="${lW}" y="${y+2}" width="${bw}" height="14" rx="3" fill="${isNeg?"rgba(220,38,38,0.15)":s.color}" opacity="${s.total?1:0.8}"/>
        <text x="${lW+bw+6}" y="${y+13}" font-size="7.5" fill="${isNeg?"#dc2626":s.color}" font-family="Lato,sans-serif" font-weight="${s.total?700:400}">${isNeg?"−":""}${euro(Math.abs(s.value))}</text>`;
    }).join("")}</svg>`;
  };

  // ── Barres comparatives hypothèses ─────────────────────────────────────────
  const hypoBarChart = () => {
    if(activeHypos.length===0) return "";
    const cats=["IR","IFI","Succession"];
    const baseVals=[ir.finalIR,ifi.ifi,succession.totalRights||0];
    const colors=["#101B3B","#26428B","#E3AF64","#8094D4","#C4A882"];
    const allHypos=[{name:"Base",vals:baseVals,color:"#9ca3af"},...activeHypos.slice(0,4).map((h,i)=>({name:h.hypothesis.name,vals:[h.ir!.finalIR,h.ifi!.ifi,h.succession!.totalRights||0],color:colors[i]}))];
    const maxVal=Math.max(...allHypos.flatMap(h=>h.vals),1);
    const W=420; const H=150; const bW=Math.floor((W-60)/(cats.length*allHypos.length+cats.length)); const gapCat=12;
    return `<svg width="${W}" height="${H+30}" xmlns="http://www.w3.org/2000/svg">
      ${cats.map((cat,ci)=>{
        const xBase=30+ci*(allHypos.length*bW+gapCat);
        return `${allHypos.map((h,hi)=>{
          const val=h.vals[ci]; const bh=Math.max(2,val/maxVal*H); const x=xBase+hi*bW; const y=H-bh;
          return `<rect x="${x}" y="${y}" width="${bW-2}" height="${bh}" rx="2" fill="${h.color}" opacity="0.85"/>`;
        }).join("")}
        <text x="${xBase+allHypos.length*bW/2}" y="${H+12}" text-anchor="middle" font-size="7.5" fill="#555" font-family="Lato,sans-serif">${cat}</text>`;
      }).join("")}
      <g transform="translate(0,${H+22})">${allHypos.map((h,i)=>`<g transform="translate(${i*80},0)"><rect x="0" y="0" width="8" height="8" rx="2" fill="${h.color}"/><text x="12" y="8" font-size="6.5" fill="#444" font-family="Lato,sans-serif">${h.name.substring(0,10)}</text></g>`).join("")}</g>
    </svg>`;
  };

  const activeHypos=hypothesisResults.filter(h=>h.ir&&h.ifi&&h.succession&&h.hypothesis.savedAt);
  const sign=(v:number)=>v>0?"+":"";
  const cls=(v:number)=>Math.abs(v)<1?"neutral":v<0?"pos":"neg";
  const heirRows=succession.results.map((r:any)=>[
    r.name||"—",r.relation,
    euro(r.grossReceived+r.nueValue+(r.usufructRawValue||0)*(succession.demembrementPct?.usufruct??1)+r.avReceived),
    euro(r.successionTaxable),euro(r.avDuties>0?r.avDuties:0),
    euro(r.successionDuties),`<strong>${euro(r.grossReceived+r.nueValue+(r.usufructRawValue||0)*(succession.demembrementPct?.usufruct??1)-r.successionDuties+(r.avNetReceived||0))}</strong>`,
  ]);

  const css=`
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Lato','Helvetica Neue',Arial,sans-serif;font-size:9pt;color:#333;background:#fff;}
  .cover{height:100vh;background:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:0;page-break-after:always;position:relative;overflow:hidden;}
  .cover-inner{padding:56px 60px;flex:1;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2;}
  .cover-logo{max-height:52px;max-width:180px;}
  .cover-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 0;}
  .cover-doc-type{font-size:11pt;font-weight:700;color:${cabinet.colorSky};text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;}
  .cover-client{font-size:28pt;font-weight:900;color:${cabinet.colorNavy};line-height:1.1;margin-bottom:8px;}
  .cover-date{font-size:10pt;color:#777;margin-bottom:20px;}
  .cover-bar{width:60px;height:4px;background:linear-gradient(90deg,${cabinet.colorGold},${cabinet.colorBlue||"#516AC7"});border-radius:2px;margin-bottom:16px;}
  .cover-tagline{font-size:9pt;color:#999;font-style:italic;}
  .cover-footer{font-size:7.5pt;color:#bbb;}
  .cover-shape1{position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:${cabinet.colorNavy};opacity:0.04;z-index:1;}
  .cover-shape2{position:absolute;top:40px;right:40px;width:120px;height:120px;border-radius:50%;background:${cabinet.colorGold};opacity:0.10;z-index:1;}
  .cover-shape3{position:absolute;bottom:80px;right:-30px;width:200px;height:200px;background:${cabinet.colorSky};opacity:0.07;transform:rotate(45deg);z-index:1;}
  .cover-shape4{position:absolute;bottom:-40px;left:220px;width:160px;height:160px;border-radius:50%;background:${cabinet.colorGold};opacity:0.08;z-index:1;}
  .cover-shape5{position:absolute;top:0;left:0;width:6px;height:100%;background:linear-gradient(180deg,${cabinet.colorNavy} 0%,${cabinet.colorGold} 100%);z-index:3;}
  .page{padding:34px 42px;page-break-after:always;}
  .page:last-child{page-break-after:auto;}
  .page-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${cabinet.colorGold};padding-bottom:8px;margin-bottom:20px;}
  .page-header-title{font-size:13pt;font-weight:700;color:${cabinet.colorNavy};}
  .page-header-client{font-size:8pt;color:${cabinet.colorSky};font-weight:600;}
  .page-footer{margin-top:20px;border-top:1px solid #e5e0d8;padding-top:7px;font-size:7pt;color:#aaa;display:flex;justify-content:space-between;}
  .section{margin-bottom:18px;}
  .section-title{font-size:8.5pt;font-weight:700;color:${cabinet.colorSky};border-left:3px solid ${cabinet.colorGold};padding-left:8px;margin-bottom:9px;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px;}
  .kpi-grid-3{grid-template-columns:repeat(3,1fr);}
  .kpi-grid-2{grid-template-columns:repeat(2,1fr);}
  .kpi{background:linear-gradient(160deg,${cabinet.colorCream} 0%,#fff8f0 100%);border:0.5px solid rgba(227,175,100,0.3);border-radius:10px;padding:9px 11px;box-shadow:0 1px 2px rgba(0,0,0,0.03);}
  .kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
  .kpi-value{font-size:13pt;font-weight:700;color:#101B3B;line-height:1;}
  .kpi-sub{font-size:7pt;color:#777;margin-top:2px;}
  .kpi-accent{background:linear-gradient(160deg,${cabinet.colorNavy} 0%,${cabinet.colorSky} 100%);border-color:${cabinet.colorSky};}
  .kpi-accent .kpi-label{color:rgba(255,255,255,0.7);}
  .kpi-accent .kpi-value{color:${cabinet.colorGold};}
  .kpi-accent .kpi-sub{color:rgba(255,255,255,0.5);}
  table{width:100%;border-collapse:collapse;font-size:7.5pt;margin-bottom:4px;}
  th{background:linear-gradient(90deg,rgba(227,175,100,0.18) 0%,rgba(227,175,100,0.06) 100%);text-align:left;padding:5px 7px;font-weight:700;color:${cabinet.colorSky};border-bottom:2px solid rgba(227,175,100,0.35);font-size:7pt;text-transform:uppercase;letter-spacing:0.3px;}
  td{padding:4px 7px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:top;}
  .row-even{background:#fff;} .row-odd{background:rgba(251,236,215,0.14);}
  td.highlight{font-weight:700;color:#101B3B;}
  .graph-box{background:linear-gradient(160deg,#f9f8f7 0%,#fff 100%);border:0.5px solid rgba(227,175,100,0.25);border-radius:10px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .graph-title{font-size:7.5pt;font-weight:700;color:${cabinet.colorSky};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:9px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px;}
  .info-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 14px;margin-bottom:8px;}
  .info-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.04);}
  .info-row:last-child{border-bottom:none;}
  .info-label{color:#666;font-size:8pt;} .info-value{font-weight:600;color:#101B3B;font-size:8pt;}
  .legal-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 14px;margin-bottom:11px;font-size:8.5pt;line-height:1.6;}
  .legal-title{font-weight:700;color:${cabinet.colorSky};margin-bottom:5px;font-size:9pt;}
  .legal-block ul{padding-left:16px;} .legal-block li{margin-bottom:3px;}
  .demarche-block{border:1px solid rgba(227,175,100,0.22);border-radius:10px;padding:16px;background:linear-gradient(135deg,${cabinet.colorNavy}06 0%,${cabinet.colorGold}0a 100%);}
  .demarche-step{display:flex;align-items:flex-start;gap:11px;margin-bottom:12px;}
  .demarche-step:last-child{margin-bottom:0;}
  .demarche-num{width:26px;height:26px;border-radius:50%;background:${cabinet.colorNavy};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9.5pt;font-weight:700;flex-shrink:0;}
  .demarche-text{font-size:8.5pt;line-height:1.5;} .demarche-text strong{color:${cabinet.colorNavy};}
  .hypo-block{background:linear-gradient(160deg,#f9f8f7 0%,#fff 100%);border:0.5px solid rgba(227,175,100,0.3);border-radius:12px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.04);}
  .hypo-title{font-size:11pt;font-weight:700;color:${cabinet.colorNavy};margin-bottom:3px;}
  .hypo-notes{font-size:8pt;color:#555;font-style:italic;background:rgba(227,175,100,0.1);padding:5px 9px;border-radius:4px;margin-bottom:9px;border-left:3px solid ${cabinet.colorGold};}
  .hypo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:9px 0;}
  .hypo-kpi{background:#fff;border:1px solid rgba(227,175,100,0.2);border-radius:6px;padding:7px 9px;}
  .hypo-kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;margin-bottom:2px;}
  .hypo-kpi-value{font-size:11pt;font-weight:700;color:#101B3B;}
  .hypo-kpi-delta{font-size:7pt;font-weight:600;margin-top:2px;}
  .pos{color:#16a34a;} .neg{color:#dc2626;} .neutral{color:#888;}
  .notes-box{background:#f8f7f6;border:1px solid rgba(227,175,100,0.2);border-radius:8px;padding:12px 14px;font-size:8.5pt;white-space:pre-wrap;min-height:50px;color:#333;line-height:1.6;}
  .mentions{font-size:7pt;color:#888;line-height:1.5;}
  .besoins-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:11px;}
  .besoin-card{border:1.5px solid ${cabinet.colorNavy};border-radius:8px;padding:11px 13px;}
  .besoin-card-title{font-weight:700;font-size:9pt;text-align:center;margin-bottom:7px;color:${cabinet.colorNavy};}
  .besoin-item{margin-bottom:4px;font-size:8pt;line-height:1.4;display:flex;align-items:flex-start;gap:2px;}
  .profil-card{background:linear-gradient(135deg,${cabinet.colorNavy}08 0%,${cabinet.colorGold}12 100%);border:1px solid rgba(227,175,100,0.25);border-radius:10px;padding:14px;text-align:center;margin-bottom:12px;}
  .profil-badge{display:inline-block;padding:5px 18px;border-radius:20px;font-weight:900;font-size:13pt;color:#fff;margin:7px 0;}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:18px;}
  .sign-box{border:1px dashed #bbb;border-radius:8px;min-height:72px;padding:10px;background:#fafafa;}
  .sign-label{font-weight:700;font-size:8.5pt;margin-bottom:3px;color:${cabinet.colorSky};}
  .sign-check{display:flex;align-items:flex-start;gap:7px;font-size:8.5pt;line-height:1.5;margin-bottom:5px;}
  @media print{
    @page{margin:0.9cm 1.1cm;size:A4;}
    .cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .kpi,.hypo-block,.hypo-kpi,.graph-box,.demarche-block,.besoin-card,.profil-card{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }`;

  const makeCover = (docType: string) => {
    const totalFiscal=ir.finalIR+ifi.ifi+(succession.totalRights||0);
    const maxFiscal=Math.max(totalFiscal,ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0),1);
    const irPct=ir.finalIR/Math.max(ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0),1);
    const ifiPct=ifi.ifi>0?Math.min(1,ifi.ifi/Math.max(ifi.netTaxable,1)):0;
    const succPct=Math.min(1,(succession.totalRights||0)/Math.max(succession.activeNet||1,1));
    return `
<div class="cover">
  <div class="cover-shape1"></div><div class="cover-shape2"></div><div class="cover-shape3"></div><div class="cover-shape4"></div>
  <!-- Bandeau top dégradé -->
  <div style="position:absolute;top:0;left:0;width:100%;height:6px;background:linear-gradient(90deg,${cabinet.colorNavy} 0%,${cabinet.colorGold} 60%,${cabinet.colorSky} 100%);z-index:4;"></div>
  <!-- Barre verticale gauche -->
  <div class="cover-shape5"></div>
  <div class="cover-inner">
    <!-- Header logo + date -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>${logoSrc2?`<img src="${logoSrc2}" class="cover-logo" alt="Logo"/>`:`<div style="font-size:17pt;font-weight:900;color:${cabinet.colorNavy}">${cabinet.cabinetName||"Ploutos"}</div>`}</div>
      <div style="text-align:right;font-size:7.5pt;color:#aaa;margin-top:4px;">${cabinet.orias?`ORIAS n° <strong style="color:#666">${cabinet.orias}</strong><br/>`:""}${dateStr}</div>
    </div>
    <!-- Corps cover -->
    <div class="cover-body">
      <div style="display:inline-block;background:${cabinet.colorNavy};color:${cabinet.colorGold};font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:5px 16px;border-radius:20px;margin-bottom:22px;">${docType}</div>
      <div class="cover-client">${clientName2}</div>
      ${data.coupleStatus!=="single"&&[data.person2FirstName,data.person2LastName].filter(Boolean).join(" ")?`<div style="font-size:13pt;color:${cabinet.colorSky};font-weight:600;margin-top:-4px;margin-bottom:10px;">&amp; ${[data.person2FirstName,data.person2LastName].filter(Boolean).join(" ")}</div>`:"<div style='margin-bottom:16px'></div>"}
      <div class="cover-date">${dateStr}</div>
      <div class="cover-bar"></div>
      <!-- Accroche sans données sensibles -->
      <div style="margin-top:28px;max-width:480px;">
        <div style="background:rgba(16,27,59,0.04);border-radius:12px;padding:16px 18px;border-left:4px solid ${cabinet.colorGold};">
          <div style="font-size:9pt;font-weight:700;color:${cabinet.colorNavy};margin-bottom:6px;">Analyse patrimoniale complète</div>
          <div style="font-size:8pt;color:#666;line-height:1.6;">Ce rapport présente une synthèse de votre situation patrimoniale, fiscale et successorale, établie sur la base des informations recueillies lors de notre entretien.</div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          ${sections.bilan?`<div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">📊 Bilan patrimonial</div>`:""}
          ${sections.ir?`<div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">📈 Fiscalité IR</div>`:""}
          ${showIFI&&sections.ifi?`<div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">🏛️ IFI</div>`:""}
          ${sections.succession?`<div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">⚖️ Succession</div>`:""}
          ${sections.hypos&&activeHypos.length>0?`<div style="background:rgba(227,175,100,0.15);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">💡 ${activeHypos.length} scénario${activeHypos.length>1?"s":""}</div>`:""}
        </div>
      </div>
    </div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Rapport confidentiel · ${dateStr}</div>
  </div>
</div>`;
  };


  const pageCabinet = () => `<div class="page">
  ${pH("Notre cabinet & notre démarche")}
  <div class="two-col">
    <div>${sec("À propos",`<div class="info-block">
      ${cabinet.cabinetName?`<div class="info-row"><span class="info-label">Cabinet</span><span class="info-value">${cabinet.cabinetName}</span></div>`:""}
      ${cabinet.orias?`<div class="info-row"><span class="info-label">ORIAS</span><span class="info-value">${cabinet.orias}</span></div>`:""}
      ${cabinet.ville?`<div class="info-row"><span class="info-label">Ville</span><span class="info-value">${cabinet.ville}</span></div>`:""}
      ${cabinet.tel?`<div class="info-row"><span class="info-label">Tél.</span><span class="info-value">${cabinet.tel}</span></div>`:""}
      ${cabinet.email?`<div class="info-row"><span class="info-label">Email</span><span class="info-value">${cabinet.email}</span></div>`:""}
      ${cabinet.conseiller?`<div class="info-row"><span class="info-label">Conseiller</span><span class="info-value">${cabinet.conseiller}</span></div>`:""}
    </div>`)}</div>
    <div>${sec("Objet du document",`<div class="info-block" style="font-size:8.5pt;line-height:1.6;color:#444;">
      <p>Ce rapport patrimonial est établi sur la base des informations que vous nous avez communiquées lors de notre entretien. Il a pour objectif de dresser un état des lieux complet de votre situation patrimoniale et fiscale, d'identifier les opportunités d'optimisation et de vous proposer des pistes adaptées à vos objectifs, votre horizon et votre profil.</p>
      <p style="margin-top:6px;font-size:7.5pt;color:#888;font-style:italic">Document remis à titre indicatif — simulation non contractuelle. Ne constitue pas un conseil en investissement au sens de MIF2, ni un conseil fiscal ou juridique.</p>
    </div>`)}</div>
  </div>
  ${sec("Notre démarche en 5 étapes",`<div class="demarche-block">
    <div class="demarche-step"><div class="demarche-num">1</div><div class="demarche-text"><strong>Collecte</strong> — Recueil de votre situation personnelle, professionnelle, patrimoniale et fiscale.</div></div>
    <div class="demarche-step"><div class="demarche-num">2</div><div class="demarche-text"><strong>Analyse</strong> — Étude de votre patrimoine, revenus et fiscalité actuelle (IR, IFI, succession).</div></div>
    <div class="demarche-step"><div class="demarche-num">3</div><div class="demarche-text"><strong>Optimisation</strong> — Simulation de scénarios pour mesurer l'impact fiscal de différentes stratégies.</div></div>
    <div class="demarche-step"><div class="demarche-num">4</div><div class="demarche-text"><strong>Recommandations</strong> — Propositions adaptées à votre profil, objectifs et horizon de placement.</div></div>
    <div class="demarche-step"><div class="demarche-num">5</div><div class="demarche-text"><strong>Suivi</strong> — Mise à jour régulière en fonction de votre situation et de la législation.</div></div>
  </div>`)}
  ${pF("Rapport confidentiel")}
</div>`;

  const pageFamille = () => `<div class="page">
  ${pH("Composition familiale")}
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1FirstName||data.person1LastName?`<div class="info-row"><span class="info-label">Identité</span><span class="info-value">${[data.person1FirstName,data.person1LastName].filter(Boolean).join(" ")}</span></div>`:""}
      ${data.person1BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${data.person1Handicap?`<div class="info-row"><span class="info-label">Handicap</span><span class="info-value" style="color:#dc2626">Oui</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(data.person2FirstName||data.person2LastName)?sec("Personne 2",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${[data.person2FirstName,data.person2LastName].filter(Boolean).join(" ")}</span></div>
      ${data.person2BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${sec("Situation familiale",`<div class="info-block">
    <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${coupleLabel[data.coupleStatus]||data.coupleStatus}</span></div>
    ${data.coupleStatus==="married"?`<div class="info-row"><span class="info-label">Régime</span><span class="info-value">${{communaute_legale:"Communauté légale",separation_biens:"Séparation de biens",communaute_universelle:"Communauté universelle",participation_acquets:"Participation aux acquêts"}[data.matrimonialRegime]||data.matrimonialRegime}</span></div>`:""}
    <div class="info-row"><span class="info-label">Quotient familial</span><span class="info-value">${ir.parts} part(s)</span></div>
    <div class="info-row"><span class="info-label">Enfants</span><span class="info-value">${data.childrenData.length}</span></div>
  </div>`)}
  ${data.childrenData.length>0?sec("Enfants",tbl(
    ["Prénom","Naissance","Lien","Garde","Rattaché","Handicap"],
    data.childrenData.map(c=>[
      c.firstName||"—",
      c.birthDate?new Date(c.birthDate).toLocaleDateString("fr-FR"):"—",
      ({common_child:"Commun",person1_only:"P1 seul",person2_only:"P2 seul"} as Record<string,string>)[c.parentLink]||c.parentLink,
      ({full:"Pleine",alternate:"Alternée"} as Record<string,string>)[c.custody]||c.custody,
      c.rattached?"Oui":"Non",c.handicap?"Oui":"Non",
    ])
  )):""}
  ${pF("Composition familiale")}
</div>`;

  const pageTravail = () => `<div class="page">
  ${pH("Situation professionnelle & Revenus")}
  <div class="kpi-grid kpi-grid-3">
    ${kpi("Revenus bruts",euro(ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0)))}
    ${kpi("Rev. net imposable",euro(ir.revenuNetGlobal))}
    ${kpi("IR estimé",euro(ir.finalIR),"",true)}
  </div>
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${n(data.salary1)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary1))}</span></div>`:""}
      ${n(data.ca1)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca1))}</span></div>`:""}
      ${n(data.pensions)>0?`<div class="info-row"><span class="info-label">Pensions/retraites</span><span class="info-value">${euro(n(data.pensions))}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(n(data.salary2)>0||n(data.ca2)>0)?sec("Personne 2",`<div class="info-block">
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
      ${n(data.salary2)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary2))}</span></div>`:""}
      ${n(data.ca2)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca2))}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${(ir.retainedExpenses>0||ir.deductibleCharges>0)?sec("Déductions",`<div class="info-block">
    ${ir.retainedExpenses>0?`<div class="info-row"><span class="info-label">${irOptions.expenseMode1==="actual"||irOptions.expenseMode2==="actual"?"Frais réels":"Abattement 10%"}</span><span class="info-value">${euro(ir.retainedExpenses)}</span></div>`:""}
    ${(ir.perDeductionCalc||0)>0?`<div class="info-row"><span class="info-label">PER déductible</span><span class="info-value">${euro(ir.perDeductionCalc||0)}</span></div>`:""}
    ${Math.max(0,(ir.deductibleCharges||0)-(ir.perDeductionCalc||0))>0?`<div class="info-row"><span class="info-label">Autres déductions</span><span class="info-value">${euro(Math.max(0,(ir.deductibleCharges||0)-(ir.perDeductionCalc||0)))}</span></div>`:""}
  </div>`):""}
  ${pF("Situation professionnelle")}
</div>`;

  const pageBilan = () => {
    const patItems=[
      {label:"Immobilier net",value:immobilierNet,color:"#101B3B"},
      {label:"AV / PER",value:avTotal,color:"#26428B"},
      {label:"Autres placements",value:Math.max(0,placementsTotal-avTotal),color:"#E3AF64"},
    ].filter(i=>i.value>0);
    let s2=0; let d2=0;
    for(const p of data.placements){
      const val=n(p.value);
      if(["Livret A","LDDS","LEP","Livret jeune","Compte courant","Compte épargne"].includes(p.type)){s2+=val;}
      else if(p.type==="Assurance-vie fonds euros"){s2+=val;}
      else if(p.type==="Assurance-vie unités de compte"||p.type==="Contrat de capitalisation"){
        const uc=Math.min(100,Math.max(0,n(p.ucRatio)||100));
        d2+=val*uc/100; s2+=val*(100-uc)/100;
      } else{d2+=val;}
    }
    const t2=s2+d2;
    return `<div class="page">
  ${pH("Bilan patrimonial")}
  <div class="kpi-grid">
    ${kpi("Patrimoine total",euro(patrimoineTotal),"",true)}
    ${kpi("Immobilier net",euro(immobilierNet))}
    ${kpi("Placements",euro(placementsTotal))}
    ${kpi("Passif",euro(data.properties.reduce((s,p)=>s+n(p.loanCapitalRemaining),0)))}
  </div>
  <div class="two-col">
    ${patItems.length>0?`<div>${sec("Répartition patrimoniale",`<div class="graph-box"><div class="graph-title">Par classe d'actifs</div>${donut(patItems.map(i=>({value:i.value,color:i.color,label:i.label})),80,80,65,38)}</div>`)}</div>`:"<div></div>"}
    <div>
      ${t2>0?sec("Exposition au risque",`<div class="graph-box"><div class="graph-title">Sécurisé vs Dynamique</div>${segB([{label:"Sécurisé",value:s2,color:"#101B3B"},{label:"Dynamique",value:d2,color:"#E3AF64"}],240)}</div>`):""}
      ${patrimoineTotal>0?sec("Fiscalité patrimoniale",`<div class="graph-box">
        <div class="graph-title">Charge fiscale annuelle estimée</div>
        ${hbar([
          ...(ir.finalIR>0?[{label:"Impôt sur le revenu",value:ir.finalIR,color:"#101B3B"}]:[]),
          ...(ifi.ifi>0?[{label:"IFI",value:ifi.ifi,color:"#dc2626"}]:[]),
          ...(succession.totalRights>0?[{label:"Droits succession",value:succession.totalRights,color:"#E3AF64"}]:[]),
        ],240)}
      </div>`):""}
    </div>
  </div>
  ${data.properties.length>0?sec("Immobilier",tbl(["Bien","Type","Valeur brute","Cap. restant","Loyer/an"],data.properties.map(p=>[p.name||p.type,p.type,euro(n(p.value)),n(p.loanCapitalRemaining)>0?euro(n(p.loanCapitalRemaining)):"—",n(p.rentGrossAnnual)>0?euro(n(p.rentGrossAnnual)):"—"]))):""}
  ${data.placements.length>0?sec("Placements",tbl(["Placement","Type","Propriétaire","Valeur"],data.placements.map(p=>[p.name||p.type,p.type,p.ownership==="common"?"Commun":p.ownership==="person1"?[data.person1FirstName,data.person1LastName].filter(Boolean).join(" ")||"P1":[data.person2FirstName,data.person2LastName].filter(Boolean).join(" ")||"P2",euro(n(p.value))]))):""}
  ${pF("Bilan patrimonial")}
</div>`;
  };

  const pageIR = () => `<div class="page">
  ${pH("Impôt sur le Revenu")}
  <div class="kpi-grid">
    ${kpi("IR total",euro(ir.finalIR),"",true)}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("Taux moyen",`${((ir.averageRate||0)*100).toFixed(1)}%`)}
    ${kpi("Quotient familial",`${ir.parts} part(s)`,`RNG : ${euro(ir.revenuNetGlobal)}`)}
  </div>
  ${sec("Décomposition du calcul fiscal",`<div class="graph-box"><div class="graph-title">De vos revenus à l'impôt</div>${wfall()}</div>`)}
  ${ir.foncierBrut>0?sec("Revenus fonciers",`<div class="kpi-grid kpi-grid-3">
    ${kpi("Loyers bruts",euro(ir.foncierBrut))}${kpi("Foncier taxable",euro(ir.taxableFonciers))}${kpi("Prél. sociaux",euro(ir.foncierSocialLevy))}
  </div>`):""}
  ${pF("IR — Rapport confidentiel")}
</div>`;

  const pageIFI = () => showIFI ? `<div class="page">
  ${pH("Impôt sur la Fortune Immobilière")}
  <div class="kpi-grid">
    ${kpi("Actif net taxable",euro(ifi.netTaxable),"",true)}
    ${kpi("IFI brut",euro(ifi.grossIfi))}
    ${kpi("Décote",euro(ifi.decote))}
    ${kpi("IFI net dû",euro(ifi.ifi),"",true)}
  </div>
  ${ifi.lines&&ifi.lines.length>0?sec("Biens taxables",tbl(
    ["Bien","Type","Valeur brute","Abatt. RP","Dette déd.","Net taxable"],
    ifi.lines.map((l:any)=>[l.name,l.type,euro(l.grossValue),euro(l.residenceAbatement),euro(l.deductibleDebt),euro(l.taxableNet)]),5
  )):""}
  ${pF("IFI — Rapport confidentiel")}
</div>` : "";

  const pageSuccession = () => `<div class="page">
  ${pH("Succession")}
  <div class="kpi-grid">
    ${kpi("Actif successoral net",euro(succession.activeNet||0),"",true)}
    ${kpi("Droits totaux",euro(succession.totalRights||0),"",true)}
    ${kpi("Défunt",succession.deceasedKey==="person1"?[data.person1FirstName,data.person1LastName].filter(Boolean).join(" "):[data.person2FirstName,data.person2LastName].filter(Boolean).join(" "))}
    ${succession.pieData&&succession.pieData.length>0?kpi("Réserve légale",euro(succession.pieData[0]?.value||0)):kpi("Héritiers",`${succession.results.length}`)}
  </div>
  <div class="two-col" style="margin-bottom:10px">
    ${succession.activeNet>0?`<div>${sec("De l'actif au net transmis",`<div class="graph-box"><div class="graph-title">Flux successoral consolidé</div>${succWaterfall()}</div>`)}</div>`:"<div></div>"}
    ${succession.receivedPieData&&succession.receivedPieData.length>0?`<div>${sec("Répartition par héritier",`<div class="graph-box"><div class="graph-title">Net reçu par héritier</div>${hbar(succession.receivedPieData.map((d:any,i:number)=>({label:d.name||"Héritier "+(i+1),value:d.value,color:["#101B3B","#26428B","#E3AF64","#8094D4","#C4A882"][i%5]})),240)}</div>`)}</div>`:"<div></div>"}
  </div>
  ${succession.results.length>0?sec("Détail par héritier",tbl(
    ["Héritier","Lien","Actif reçu","Base taxable","Droits AV","Droits succ.","Net estimé"],
    heirRows,6
  )):""}
  ${pF("Succession — Rapport confidentiel")}
</div>`;

  const pageHypos = () => activeHypos.length>0?`<div class="page">
  ${pH("Scénarios d'optimisation")}
  ${sec("Comparatif graphique",`<div class="graph-box"><div class="graph-title">IR / IFI / Succession — Base vs Scénarios</div>${hypoBarChart()}</div>`)}
  ${activeHypos.map(h=>{
    const hIR=h.ir!.finalIR; const hIFI=h.ifi!.ifi; const hSucc=h.succession!.totalRights||0;
    const dIR=hIR-ir.finalIR; const dIFI=hIFI-ifi.ifi; const dSucc=hSucc-(succession.totalRights||0);
    return `<div class="hypo-block">
      <div class="hypo-title">${h.hypothesis.name}</div>
      ${h.hypothesis.objective?`<div style="font-size:8pt;color:#26428B;font-weight:600;margin-bottom:3px">Objectif : ${h.hypothesis.objective}</div>`:""}
      ${h.hypothesis.notes?`<div class="hypo-notes">${h.hypothesis.notes}</div>`:""}
      <div class="hypo-grid">
        <div class="hypo-kpi"><div class="hypo-kpi-label">IR</div><div class="hypo-kpi-value">${euro(hIR)}</div><div class="hypo-kpi-delta ${cls(dIR)}">${sign(dIR)}${euro(Math.abs(dIR))}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">IFI</div><div class="hypo-kpi-value">${euro(hIFI)}</div><div class="hypo-kpi-delta ${cls(dIFI)}">${sign(dIFI)}${euro(Math.abs(dIFI))}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">Succession</div><div class="hypo-kpi-value">${euro(hSucc)}</div><div class="hypo-kpi-delta ${cls(dSucc)}">${sign(dSucc)}${euro(Math.abs(dSucc))}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">Total fiscal</div><div class="hypo-kpi-value">${euro(hIR+hIFI+hSucc)}</div><div class="hypo-kpi-delta ${cls(dIR+dIFI+dSucc)}">${sign(dIR+dIFI+dSucc)}${euro(Math.abs(dIR+dIFI+dSucc))}</div></div>
      </div>
    </div>`;
  }).join("")}
  ${pF("Scénarios")}
</div>`:"";

  const pageMentions = () => `<div class="page">
  ${pH("Notes & Mentions légales")}
  ${sec("Notes du conseiller",`<div class="notes-box">${notes||"Aucune note saisie."}</div>`)}
  ${sec("Mentions légales",`<div class="mentions">
    <p><strong>Nature :</strong> Simulation établie sur la base des informations communiquées. Ne constitue pas un conseil en investissement, juridique ou fiscal.</p><br/>
    <p><strong>Limites :</strong> Calculs basés sur la législation en vigueur à la date d'édition. Situations particulières exclues (Dutreil, SCI, holding, démembrement complexe…).</p><br/>
    <p><strong>Confidentialité :</strong> Document strictement confidentiel. Toute reproduction interdite sans accord préalable.</p><br/>
    <p>Généré le <strong>${dateTimeStr}</strong> par ${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS ${cabinet.orias}`:""}</p>
  </div>`)}
  ${pF("Rapport confidentiel")}
</div>`;

  const pages = [
    makeCover("Rapport patrimonial"),
    sections.cabinet ? pageCabinet() : "",
    sections.famille ? pageFamille() : "",
    sections.travail ? pageTravail() : "",
    sections.bilan ? pageBilan() : "",
    sections.ir ? pageIR() : "",
    sections.ifi && showIFI ? pageIFI() : "",
    sections.succession ? pageSuccession() : "",
    sections.hypos && activeHypos.length>0 ? pageHypos() : "",
    sections.mentions ? pageMentions() : "",
  ].filter(Boolean).join("");

  const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport — ${clientName2}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

  const popup=window.open("","_blank","width=900,height=700,scrollbars=yes");
  if(!popup){alert("Autorise les popups pour ce site.");return;}
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(()=>{popup.print();},500);
}
