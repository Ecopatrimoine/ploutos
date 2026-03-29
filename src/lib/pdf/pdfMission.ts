// ─── PDF LETTRE DE MISSION ────────────────────────────────────────────────────
// Fonction pure — aucun setState, aucun hook React

import { n, euro, isAV, isPERType } from "../calculs/utils";
import type { PatrimonialData, IrOptions } from "../../types/patrimoine";

type IrResult = any;
type IfiResult = any;
type SuccessionResult = any;

export interface PdfMissionParams {
  sections: Record<string, boolean>;
  data: PatrimonialData;
  ir: IrResult;
  ifi: IfiResult;
  succession: SuccessionResult;
  irOptions: IrOptions;
  cabinet: Record<string, string>;
  clientName: string;
  logoSrc: string;
  signatureSrc: string;
  mission: Record<string, any>;
}

export function buildAndPrintMission(params: PdfMissionParams) {
  const { sections, data, ir, ifi, succession, irOptions, cabinet, clientName, logoSrc, signatureSrc, mission } = params;

  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const dateTimeStr = new Date().toLocaleString("fr-FR");
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
  const clientName3 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || clientName || "Client";
  const logoSrc3 = cabinet.logoSrc || logoSrc || "";
  const p1n = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
  const p2n = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ") || "—";

  const pts = mission.attitude + mission.reactionBaisse +
    (mission.connaitFondsEuros?1:0)+(mission.investiFondsEuros?1:0)+
    (mission.connaitActions?1:0)+(mission.investiActions?3:0)+
    (mission.connaitOPCVM?1:0)+(mission.investiOPCVM?3:0)+
    (mission.connaitImmo?1:0)+(mission.investiImmo?2:0)+
    (mission.connaitTrackers?1:0)+(mission.investiTrackers?3:0)+
    (mission.connaitStructures?1:0)+(mission.investiStructures?4:0)+
    (mission.reactionPertes||0)+(mission.reactionGains||0)+
    (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0)+
    (mission.savoirUCRisque?2:0)+(mission.savoirHorizonUC?2:0)+(mission.savoirRisqueRendement?2:0);
  const profil = pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
  const profilColor = pts<=10?"#22c55e":pts<=20?"#84cc16":pts<=40?"#E3AF64":pts<=60?"#f97316":"#dc2626";

  const cb = (v: boolean) => v
    ? `<span style="display:inline-block;width:12px;height:12px;border:2px solid #26428B;border-radius:2px;background:#26428B;margin-right:5px;vertical-align:middle"></span>`
    : `<span style="display:inline-block;width:12px;height:12px;border:2px solid #bbb;border-radius:2px;margin-right:5px;vertical-align:middle"></span>`;
  const rb = (checked: boolean) => checked
    ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #26428B;background:#26428B;margin-right:5px;vertical-align:middle"></span>`
    : `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #bbb;margin-right:5px;vertical-align:middle"></span>`;

  const kpi = (label: string, value: string, sub?: string, accent = false) =>
    `<div class="kpi${accent?" kpi-accent":""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;
  const sec = (title: string, body: string) =>
    `<div class="section"><div class="section-title">${title}</div>${body}</div>`;
  const tbl = (headers: string[], rows: string[][], hl?: number) =>
    `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${i%2===0?"row-even":"row-odd"}">${row.map((cell,j)=>`<td${j===hl?' class="highlight"':""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const pH = (title: string) =>
    `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName3} · ${dateStr}</div></div>`;
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
    const fraisPro=ir.retainedExpenses||0; const perDed=ir.perDeductionCalc||0;
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

  const jaugeSvg = () => {
    const max=80; const pct=Math.min(1,pts/max);
    const cx=120; const cy=100; const r=80;
    const zones=[{c:"#22c55e",f:0,t:0.2},{c:"#84cc16",f:0.2,t:0.4},{c:"#E3AF64",f:0.4,t:0.6},{c:"#f97316",f:0.6,t:0.8},{c:"#dc2626",f:0.8,t:1}];
    const arcPath=(from:number,to:number)=>{
      const a1=Math.PI+from*Math.PI; const a2=Math.PI+to*Math.PI;
      const x1=cx+r*Math.cos(a1); const y1=cy+r*Math.sin(a1);
      const x2=cx+r*Math.cos(a2); const y2=cy+r*Math.sin(a2);
      return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`;
    };
    const angle=Math.PI+pct*Math.PI;
    const nx=cx+r*Math.cos(angle); const ny=cy+r*Math.sin(angle);
    return `<svg width="240" height="115" viewBox="0 0 240 115" xmlns="http://www.w3.org/2000/svg">
      ${zones.map(z=>`<path d="${arcPath(z.f,z.t)}" fill="none" stroke="${z.c}" stroke-width="18" stroke-linecap="butt"/>`).join("")}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#101B3B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#101B3B"/>
      <text x="${cx}" y="${cy-14}" text-anchor="middle" font-size="18" font-weight="900" fill="#101B3B" font-family="Lato,sans-serif">${pts}</text>
      <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="10" fill="#555" font-family="Lato,sans-serif">${profil}</text>
    </svg>`;
  };

  const heirRows=succession.results.map((r:any)=>[
    r.name||"—",r.relation,
    euro(r.grossReceived+r.nueValue+r.usufructRawValue*(succession.demembrementPct?.usufruct??1)+r.avReceived),
    euro(r.successionTaxable),euro(r.avDuties>0?r.avDuties:0),
    euro(r.successionDuties),`<strong>${euro(r.grossReceived+r.nueValue+r.usufructRawValue*(succession.demembrementPct?.usufruct??1)-r.successionDuties+(r.avNetReceived||0))}</strong>`,
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
  .kpi{background:linear-gradient(160deg,${cabinet.colorCream} 0%,#fff8f0 100%);border:1px solid rgba(227,175,100,0.3);border-radius:8px;padding:9px 11px;}
  .kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
  .kpi-value{font-size:13pt;font-weight:700;color:#101B3B;line-height:1;}
  .kpi-sub{font-size:7pt;color:#777;margin-top:2px;}
  .kpi-accent{background:linear-gradient(160deg,${cabinet.colorNavy} 0%,${cabinet.colorSky} 100%);border-color:${cabinet.colorSky};}
  .kpi-accent .kpi-label{color:rgba(255,255,255,0.7);}
  .kpi-accent .kpi-value{color:${cabinet.colorGold};}
  table{width:100%;border-collapse:collapse;font-size:7.5pt;margin-bottom:4px;}
  th{background:linear-gradient(90deg,rgba(227,175,100,0.18) 0%,rgba(227,175,100,0.06) 100%);text-align:left;padding:5px 7px;font-weight:700;color:${cabinet.colorSky};border-bottom:2px solid rgba(227,175,100,0.35);font-size:7pt;text-transform:uppercase;letter-spacing:0.3px;}
  td{padding:4px 7px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:top;}
  .row-even{background:#fff;} .row-odd{background:rgba(251,236,215,0.14);}
  td.highlight{font-weight:700;color:#101B3B;}
  .graph-box{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 13px;margin-bottom:7px;}
  .graph-title{font-size:7.5pt;font-weight:700;color:${cabinet.colorSky};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:9px;}
  .info-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:10px 13px;margin-bottom:7px;}
  .info-row{display:flex;justify-content:space-between;padding:2.5px 0;border-bottom:1px solid rgba(0,0,0,0.04);}
  .info-row:last-child{border-bottom:none;}
  .info-label{color:#666;font-size:8pt;} .info-value{font-weight:600;color:#101B3B;font-size:8pt;}
  .legal-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:10px 13px;margin-bottom:10px;font-size:8.5pt;line-height:1.6;}
  .legal-title{font-weight:700;color:${cabinet.colorSky};margin-bottom:4px;font-size:9pt;}
  .legal-block ul{padding-left:15px;} .legal-block li{margin-bottom:2px;}
  .besoins-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
  .besoin-card{border:1.5px solid ${cabinet.colorNavy};border-radius:8px;padding:10px 12px;}
  .besoin-card-title{font-weight:700;font-size:8.5pt;text-align:center;margin-bottom:6px;color:${cabinet.colorNavy};}
  .besoin-item{margin-bottom:3px;font-size:8pt;line-height:1.4;display:flex;align-items:flex-start;gap:2px;}
  .profil-card{background:linear-gradient(135deg,${cabinet.colorNavy}08 0%,${cabinet.colorGold}12 100%);border:1px solid rgba(227,175,100,0.25);border-radius:10px;padding:13px;text-align:center;margin-bottom:10px;}
  .profil-badge{display:inline-block;padding:5px 16px;border-radius:20px;font-weight:900;font-size:12pt;color:#fff;margin:6px 0;}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;}
  .sign-box{border:1px dashed #bbb;border-radius:8px;min-height:68px;padding:9px;background:#fafafa;}
  .sign-label{font-weight:700;font-size:8.5pt;margin-bottom:3px;color:${cabinet.colorSky};}
  .sign-check{display:flex;align-items:flex-start;gap:7px;font-size:8.5pt;line-height:1.5;margin-bottom:4px;}
  @media print{
    @page{margin:0.9cm 1.1cm;size:A4;}
    .cover,.besoin-card,.profil-card,.kpi,.graph-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }`;

  const cover = `<div class="cover">
  <div class="cover-shape1"></div><div class="cover-shape2"></div><div class="cover-shape3"></div><div class="cover-shape4"></div><div class="cover-shape5"></div>
  <!-- Bande navy gauche + gradient top -->
  <div style="position:absolute;top:0;left:0;width:100%;height:5px;background:linear-gradient(90deg,${cabinet.colorNavy} 0%,${cabinet.colorGold} 60%,${cabinet.colorSky} 100%);z-index:4;"></div>
  <div class="cover-inner">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>${logoSrc3?`<img src="${logoSrc3}" class="cover-logo" alt="Logo"/>`:
        `<div style="font-size:17pt;font-weight:900;color:${cabinet.colorNavy}">${cabinet.cabinetName||"Ploutos"}</div>`}</div>
      <div style="text-align:right;font-size:7.5pt;color:#999;margin-top:4px;">
        ${cabinet.orias?`ORIAS n° <strong>${cabinet.orias}</strong><br/>`:""}
        ${dateStr}
      </div>
    </div>
    <div class="cover-body">
      <div style="display:inline-block;background:${cabinet.colorNavy};color:${cabinet.colorGold};font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:5px 14px;border-radius:20px;margin-bottom:20px;">
        Lettre de mission &amp; Fiche Conseil
      </div>
      <div class="cover-client">${clientName3}</div>
      ${data.coupleStatus!=="single"&&p2n!=="—"?`<div style="font-size:12pt;color:${cabinet.colorSky};font-weight:600;margin-top:-4px;margin-bottom:10px;">&amp; ${p2n}</div>`:"<div style='margin-bottom:16px'></div>"}
      <div class="cover-date">${dateStr}</div>
      <div class="cover-bar"></div>
      <div style="margin-top:24px;max-width:480px;">
        <div style="background:rgba(16,27,59,0.04);border-radius:12px;padding:14px 16px;border-left:4px solid ${cabinet.colorGold};">
          <div style="font-size:8.5pt;font-weight:700;color:${cabinet.colorNavy};margin-bottom:5px;">Document précontractuel réglementaire</div>
          <div style="font-size:7.5pt;color:#666;line-height:1.6;">Lettre de mission et fiche de conseil établies conformément aux obligations DDA et MIF2, sur la base des informations recueillies lors de notre entretien.</div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">👤 Informations légales</div>
          <div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">📋 Besoins & Objectifs</div>
          <div style="background:rgba(16,27,59,0.05);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">📊 Bilan patrimonial</div>
          <div style="background:rgba(227,175,100,0.15);border-radius:8px;padding:7px 12px;font-size:7.5pt;color:${cabinet.colorNavy};font-weight:600;">🎯 Profil investisseur</div>
        </div>
      </div>
      <div class="cover-tagline" style="margin-top:20px;">En application des articles L.521-2 et R.521-2 du Code des assurances<br/>et de la directive DDA (Directive sur la Distribution d'Assurances)</div>
    </div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel · ${dateStr}</div>
  </div>
</div>`;

  const pageLegal = sections.legal ? `<div class="page">
  ${pH("Informations légales — Fiche de présentation")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:14px;">
    Madame, Monsieur, vous vous apprêtez à lire votre Fiche Information et Conseil, fournie conformément à l'article <strong>L.521-2 du Code des assurances</strong>. Elle contient les informations réglementaires inhérentes à notre qualité d'intermédiaire en assurances ainsi qu'à la nature de notre intervention, et formalise les exigences et besoins que vous nous avez communiqués.
  </p>
  <div class="two-col">
    <div>
      <div class="legal-block">
        <div class="legal-title">Qui sommes-nous ?</div>
        <p>${cabinet.cabinetName||"Le cabinet"}${cabinet.forme?`, ${cabinet.forme}`:""}, est immatriculé${cabinet.forme?.includes("SARL")||cabinet.forme?.includes("SAS")?"e":""} au RCS de ${cabinet.villeRcs||"—"} sous le n° ${cabinet.rcs||"—"} et a son siège social au ${cabinet.adresse||""} ${cabinet.codePostal||""} ${cabinet.ville||""}.</p>
        <p style="margin-top:6px"><strong>${cabinet.cabinetName||"Le cabinet"}</strong> est immatriculé à l'ORIAS (<a href="https://www.orias.fr">www.orias.fr</a>) sous le n° <strong>${cabinet.orias||"—"}</strong> en qualité de Courtier d'assurance.</p>
        <p style="margin-top:6px">L'autorité en charge du contrôle de nos opérations est l'<strong>ACPR</strong> (Autorité de Contrôle Prudentiel et de Résolution), 4 place de Budapest CS 92459, 75436 Paris Cedex 09.</p>
      </div>
      <div class="legal-block">
        <div class="legal-title">Nous contacter</div>
        <ul>
          ${cabinet.tel?`<li>Par téléphone : <strong>${cabinet.tel}</strong></li>`:""}
          ${cabinet.email?`<li>Par email : <strong>${cabinet.email}</strong></li>`:""}
          ${cabinet.adresse?`<li>Par courrier : ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</li>`:""}
        </ul>
      </div>
    </div>
    <div>
      <div class="legal-block">
        <div class="legal-title">Comment exerçons-nous ? (art. L521-2 II 1°b)</div>
        <p>Nous exerçons notre activité selon les dispositions prévues à l'article L521-2, II, 1°, b du Code des Assurances.</p>
        <ul style="margin-top:6px">
          <li>Nous ne sommes soumis à aucune obligation de travailler exclusivement avec une ou plusieurs entreprises d'assurances.</li>
          <li>Notre analyse porte sur les produits proposés par nos partenaires et non sur une analyse exhaustive de tous les produits du marché.</li>
          <li>Notre accompagnement repose sur un <em>contrôle de cohérence</em>.</li>
        </ul>
        ${cabinet.partenaires?`<p style="margin-top:6px;font-size:7.5pt;color:#666">Partenaires sélectionnés (liste non exhaustive) : ${cabinet.partenaires}.</p>`:""}
      </div>
      <div class="legal-block">
        <div class="legal-title">Responsabilité Civile Professionnelle</div>
        <ul style="margin-top:4px">
          ${cabinet.rcpAssureur?`<li>Assureur : <strong>${cabinet.rcpAssureur}</strong></li>`:""}
          ${cabinet.rcpContrat?`<li>N° contrat : ${cabinet.rcpContrat}</li>`:""}
        </ul>
        <p style="margin-top:6px;font-size:7.5pt;color:#666">Garanties minimales légales : 1 564 610 € par sinistre et 2 315 610 € par année (arrêté du 29 octobre 2024).</p>
      </div>
      <div class="legal-block">
        <div class="legal-title">Comment sommes-nous rémunérés ? (art. L521-2)</div>
        <ul style="margin-top:4px">
          <li>${rb(cabinet.remunerationType==="commission"||!cabinet.remunerationType)} Par <strong>commission</strong> versée par l'assureur (incluse dans la prime)</li>
          <li>${rb(cabinet.remunerationType==="honoraire")} Par <strong>honoraires</strong> payés directement par le client</li>
          <li>${rb(cabinet.remunerationType==="mixte")} Par une <strong>combinaison</strong> des deux (commission + honoraires)</li>
        </ul>
        <p style="margin-top:4px;font-size:7.5pt;color:#666">Notre cabinet n'entretient aucune participation directe ou indirecte ≥ 10% dans le capital d'un assureur, ni aucun assureur dans notre capital (art. L521-2 I).</p>
      </div>
    </div>
  </div>
  ${sec("Niveau de conseil délivré (art. L521-4 Code des assurances — DDA)",`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
      <div class="info-block" style="border:${cabinet.niveauConseil==='2'?'2px solid '+cabinet.colorSky:'1px solid rgba(227,175,100,0.18)'}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          ${rb(cabinet.niveauConseil!=='2')}
          <strong style="font-size:8.5pt;color:${cabinet.colorNavy}">Niveau 1 — Analyse des besoins</strong>
        </div>
        <p style="font-size:7.5pt;color:#666;line-height:1.5;">Nous formulons une recommandation cohérente avec vos besoins et exigences, sans effectuer d'analyse approfondie de tous les produits du marché.</p>
      </div>
      <div class="info-block" style="border:${cabinet.niveauConseil==='2'?'2px solid '+cabinet.colorSky:'1px solid rgba(227,175,100,0.18)'}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
          ${rb(cabinet.niveauConseil==='2')}
          <strong style="font-size:8.5pt;color:${cabinet.colorNavy}">Niveau 2 — Recommandation personnalisée</strong>
        </div>
        <p style="font-size:7.5pt;color:#666;line-height:1.5;">Notre conseil repose sur une analyse objective du marché et une évaluation approfondie de votre situation patrimoniale globale.</p>
      </div>
    </div>
  `)}
  ${sec("Durée et renouvellement de la mission",`
    <div class="info-block" style="font-size:8.5pt;line-height:1.6;">
      <p>La présente lettre de mission est conclue pour une durée d'un an à compter de sa signature. Elle se renouvelle par <strong>tacite reconduction</strong> chaque année, sauf dénonciation par l'une ou l'autre des parties par lettre recommandée avec accusé de réception, au minimum 30 jours avant l'échéance.</p>
      <p style="margin-top:6px;">Chaque partie peut résilier la mission à tout moment, sans préavis, en cas de manquement grave de l'autre partie à ses obligations.</p>
    </div>
  `)}
  ${sec("Lutte contre le blanchiment et le financement du terrorisme — LCB-FT (art. L561-1 et s. CMF)",`
    <div class="info-block" style="font-size:8.5pt;line-height:1.6;">
      <p>En application de la réglementation LCB-FT, nous sommes tenus de :</p>
      <ul style="margin-top:6px;padding-left:14px;">
        <li>Vérifier votre identité et celle des bénéficiaires effectifs (pièce d'identité en cours de validité)</li>
        <li>Nous enquérir de l'origine des fonds investis</li>
        <li>Déclarer tout soupçon à TRACFIN (Traitement du renseignement et action contre les circuits financiers clandestins)</li>
      </ul>
      <p style="margin-top:6px;"><strong>Vous vous engagez</strong> à nous communiquer tout document justificatif requis à première demande et à nous informer de toute modification significative de votre situation.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:8pt;">
        <span>${cb(true)} Pièce d'identité vérifiée</span>
        <span>${cb(mission.justifDomicile||false)} Justificatif de domicile</span>
        <span>${cb(mission.justifOrigineFonds||false)} Origine des fonds</span>
      </div>
    </div>
  `)}
  ${pF("Lettre de mission — Informations légales")}
</div>` : "";

  const pageFamilleMission = sections.famille ? `<div class="page">
  ${pH("Informations client — Composition familiale")}
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${p1n}</span></div>
      ${data.person1BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"?sec("Personne 2",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${p2n}</span></div>
      ${data.person2BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${sec("Situation & obligations fiscales",`<div class="info-block">
    <div class="info-row"><span class="info-label">Statut matrimonial</span><span class="info-value">${coupleLabel[data.coupleStatus]||data.coupleStatus}</span></div>
    ${data.coupleStatus==="married"?`<div class="info-row"><span class="info-label">Régime</span><span class="info-value">${({communaute_legale:"Communauté légale",separation_biens:"Séparation de biens",communaute_universelle:"Communauté universelle",participation_acquets:"Participation aux acquêts"} as Record<string,string>)[data.matrimonialRegime]||data.matrimonialRegime}</span></div>`:""}
    <div class="info-row"><span class="info-label">Enfants</span><span class="info-value">${data.childrenData.length}</span></div>
    <div class="info-row"><span class="info-label">FATCA</span><span class="info-value">${mission.nationaliteUS?"Oui":"Non"}</span></div>
    <div class="info-row"><span class="info-label">PPE</span><span class="info-value">${mission.ppe?"Oui"+(mission.ppeDetails?` — ${mission.ppeDetails}`:""):"Non"}</span></div>
    <div class="info-row"><span class="info-label">Assujetti IFI</span><span class="info-value">${ifi.ifi>0?"Oui":"Non"}</span></div>
  </div>`)}
  ${pF("Lettre de mission")}
</div>` : "";

  const pageTravailMission = sections.travail ? `<div class="page">
  ${pH("Situation professionnelle & Fiscale")}
  <div class="kpi-grid kpi-grid-3">
    ${kpi("Rev. net imposable",euro(ir.revenuNetGlobal))}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("IR estimé",euro(ir.finalIR),"",true)}
  </div>
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${n(data.salary1)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary1))}</span></div>`:""}
      ${n(data.ca1)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca1))}</span></div>`:""}
      ${n(data.pensions)>0?`<div class="info-row"><span class="info-label">Pensions</span><span class="info-value">${euro(n(data.pensions))}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(n(data.salary2)>0||n(data.ca2)>0)?sec("Personne 2",`<div class="info-block">
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
      ${n(data.salary2)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary2))}</span></div>`:""}
      ${n(data.ca2)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca2))}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${pF("Lettre de mission")}
</div>` : "";

  const pageBesoins = sections.besoins ? `<div class="page">
  ${pH("Besoins & Objectifs patrimoniaux")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:12px;">
    Le recueil de vos besoins et exigences est réalisé dans votre intérêt, conformément à l'article <strong>L.521-4 du Code des assurances</strong>.
  </p>
  <div class="besoins-grid">
    <div class="besoin-card"><div class="besoin-card-title">Épargne & Investissement</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_valoriser)} Valoriser votre capital</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_projet)} Financer un projet</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_completer)} Compléter vos revenus</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_transmettre)} Préparer la transmission</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Retraite</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_rente)} Rente complémentaire</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_capital)} Capital retraite</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_moderniser)} Optimiser l'épargne retraite</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Prévoyance</div>
      <div class="besoin-item">${cb(mission.besoinPrev_deces)} Garantie décès</div>
      <div class="besoin-item">${cb(mission.besoinPrev_arret)} Arrêt de travail / invalidité</div>
      <div class="besoin-item">${cb(mission.besoinPrev_fraisGen)} Frais généraux pro</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Santé</div>
      <div class="besoin-item">${cb(mission.besoinSante_hospit)} Hospitalisation</div>
      <div class="besoin-item">${cb(mission.besoinSante_depasse)} Dépassements d'honoraires</div>
      <div class="besoin-item">${cb(mission.besoinSante_depenses)} Dépenses non remboursées</div>
      <div class="besoin-item">${cb(mission.besoinSante_surcompl)} Sur-complémentaire</div>
    </div>
  </div>
  ${sec("Horizon de placement",`<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:9pt;">
    <span>${rb(mission.horizon==="0-4")} 0 à 4 ans</span>
    <span>${rb(mission.horizon==="5-8")} 5 à 8 ans</span>
    <span>${rb(mission.horizon==="9-15")} 9 à 15 ans</span>
    <span>${rb(mission.horizon==="15+")} + de 15 ans</span>
  </div>`)}
  ${sec("Préférences en matière de durabilité — ESG (MIF2 depuis 2023)",`
    <div class="two-col" style="margin-bottom:0">
      <div class="info-block" style="font-size:8pt;line-height:1.6;">
        <p style="margin-bottom:6px;font-weight:700;color:${cabinet.colorNavy}">Souhaitez-vous intégrer des critères ESG dans vos investissements ?</p>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <span>${rb(mission.esgPref==="oui")} Oui, de façon prioritaire</span>
          <span>${rb(mission.esgPref==="partiel")} Partiellement</span>
          <span>${rb(!mission.esgPref||mission.esgPref==="non")} Non / Pas de préférence</span>
        </div>
      </div>
      <div class="info-block" style="font-size:8pt;line-height:1.6;">
        <p style="margin-bottom:6px;font-weight:700;color:${cabinet.colorNavy}">Vos engagements</p>
        <ul style="padding-left:12px;color:#555;">
          <li>Nous informer de tout changement de situation (famille, revenus, patrimoine)</li>
          <li>Vérifier la conformité des contrats signés avec nos recommandations</li>
          <li>Ne pas effectuer d'opérations contraires au présent conseil sans nous en informer</li>
        </ul>
      </div>
    </div>
  `)}
  ${pF("Besoins & Objectifs")}
</div>` : "";

  const pageBilanM = sections.bilan ? (() => {
    const patItems=[{label:"Immobilier net",value:immobilierNet,color:"#101B3B"},{label:"AV/PER",value:avTotal,color:"#26428B"},{label:"Autres",value:Math.max(0,placementsTotal-avTotal),color:"#E3AF64"}].filter(i=>i.value>0);
    let s2=0; let d2=0;
    for(const p of data.placements){
      const val=n(p.value);
      if(["Livret A","LDDS","LEP","Livret jeune","Compte courant","Compte épargne"].includes(p.type)){s2+=val;}
      else if(p.type==="Assurance-vie fonds euros"){s2+=val;}
      else if(p.type==="Assurance-vie unités de compte"||p.type==="Contrat de capitalisation"){const uc=Math.min(100,Math.max(0,n(p.ucRatio)||100));d2+=val*uc/100;s2+=val*(100-uc)/100;}
      else{d2+=val;}
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
    ${patItems.length>0?`<div>${sec("Répartition",`<div class="graph-box"><div class="graph-title">Par classe</div>${hbar(patItems,240)}</div>`)}</div>`:"<div></div>"}
    ${t2>0?`<div>${sec("Exposition",`<div class="graph-box"><div class="graph-title">Sécurisé vs Dynamique</div>${segB([{label:"Sécurisé",value:s2,color:"#101B3B"},{label:"Dynamique",value:d2,color:"#E3AF64"}],240)}</div>`)}</div>`:"<div></div>"}
  </div>
  ${data.properties.length>0?sec("Immobilier",tbl(["Bien","Type","Valeur","Cap. restant","Loyer/an"],data.properties.map(p=>[p.name||p.type,p.type,euro(n(p.value)),n(p.loanCapitalRemaining)>0?euro(n(p.loanCapitalRemaining)):"—",n(p.rentGrossAnnual)>0?euro(n(p.rentGrossAnnual)):"—"]))):""}
  ${pF("Bilan patrimonial")}
</div>`;
  })() : "";

  const pageIRM = sections.ir ? `<div class="page">
  ${pH("Impôt sur le Revenu")}
  <div class="kpi-grid">
    ${kpi("IR total",euro(ir.finalIR),"",true)}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("Taux moyen",`${((ir.averageRate||0)*100).toFixed(1)}%`)}
    ${kpi("Quotient familial",`${ir.parts} part(s)`)}
  </div>
  ${sec("Décomposition",`<div class="graph-box"><div class="graph-title">De vos revenus à l'impôt</div>${wfall()}</div>`)}
  ${pF("IR")}
</div>` : "";

  const pageIFIM = sections.ifi && showIFI ? `<div class="page">
  ${pH("IFI")}
  <div class="kpi-grid">
    ${kpi("Actif net taxable",euro(ifi.netTaxable),"",true)}
    ${kpi("IFI brut",euro(ifi.grossIfi))}
    ${kpi("Décote",euro(ifi.decote))}
    ${kpi("IFI net",euro(ifi.ifi),"",true)}
  </div>
  ${ifi.lines&&ifi.lines.length>0?sec("Biens",tbl(["Bien","Type","Valeur","Abatt.","Dette","Net taxable"],ifi.lines.map((l:any)=>[l.name,l.type,euro(l.grossValue),euro(l.residenceAbatement),euro(l.deductibleDebt),euro(l.taxableNet)]),5)):""}
  ${pF("IFI")}
</div>` : "";

  const pageSuccM = sections.succession ? `<div class="page">
  ${pH("Succession")}
  <div class="kpi-grid">
    ${kpi("Actif net",euro(succession.activeNet||0),"",true)}
    ${kpi("Droits totaux",euro(succession.totalRights||0),"",true)}
    ${kpi("Défunt",succession.deceasedKey==="person1"?p1n:p2n)}
    ${succession.pieData&&succession.pieData.length>0?kpi("Réserve légale",euro(succession.pieData[0]?.value||0)):kpi("Héritiers",`${succession.results.length}`)}
  </div>
  ${succession.receivedPieData&&succession.receivedPieData.length>0?sec("Répartition",`<div class="graph-box"><div class="graph-title">Par héritier</div>${hbar(succession.receivedPieData.map((d:any,i:number)=>({label:d.name||`H${i+1}`,value:d.value,color:["#101B3B","#26428B","#E3AF64","#8094D4","#C4A882"][i%5]})),420)}</div>`):""}
  ${succession.results.length>0?sec("Détail",tbl(["Héritier","Lien","Actif reçu","Base taxable","Droits AV","Droits succ.","Net estimé"],heirRows,6)):""}
  ${pF("Succession")}
</div>` : "";

  const pageProfil = sections.profil ? `<div class="page">
  ${pH("Profil investisseur")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:12px;">
    Les questions suivantes permettent de déterminer votre profil investisseur, conformément à la recommandation <strong>ACPR 2024-R-02</strong>.
  </p>
  <div class="two-col">
    <div>
      <div class="profil-card">
        <div style="font-size:7.5pt;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Score obtenu</div>
        ${jaugeSvg()}
        <div class="profil-badge" style="background:${profilColor}">${profil}</div>
        <div style="font-size:8pt;color:#666;margin-top:3px">Score : ${pts} / 80 pts</div>
      </div>
    </div>
    <div>
      ${sec("Connaissances",`<table>
        <thead><tr><th>Instrument</th><th>Connaît</th><th>A investi</th></tr></thead>
        <tbody>
          <tr class="row-even"><td>Fonds euros</td><td>${cb(mission.connaitFondsEuros)}</td><td>${cb(mission.investiFondsEuros)}</td></tr>
          <tr class="row-odd"><td>Actions</td><td>${cb(mission.connaitActions)}</td><td>${cb(mission.investiActions)}</td></tr>
          <tr class="row-even"><td>OPCVM</td><td>${cb(mission.connaitOPCVM)}</td><td>${cb(mission.investiOPCVM)}</td></tr>
          <tr class="row-odd"><td>Immobilier</td><td>${cb(mission.connaitImmo)}</td><td>${cb(mission.investiImmo)}</td></tr>
          <tr class="row-even"><td>ETF/Trackers</td><td>${cb(mission.connaitTrackers)}</td><td>${cb(mission.investiTrackers)}</td></tr>
          <tr class="row-odd"><td>Structurés</td><td>${cb(mission.connaitStructures)}</td><td>${cb(mission.investiStructures)}</td></tr>
        </tbody>
      </table>`)}
      ${sec("Mode de gestion",`<div style="display:flex;gap:14px;font-size:9pt;margin-top:3px;">
        <span>${rb(mission.modeGestion==="")} Conseillée</span>
        <span>${rb(mission.modeGestion==="pilote")} Pilotée</span>
        <span>${rb(mission.modeGestion==="libre")} Libre</span>
      </div>`)}
    </div>
  </div>
  ${pF("Profil investisseur")}
</div>` : "";

  const pageSign = sections.signature ? `<div class="page">
  ${pH("Signature & Engagements")}
  ${sec("Attestation du client (art. R.521-2 Code des assurances)",`
    <div style="background:rgba(251,236,215,0.3);border:1px solid rgba(227,175,100,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;">
      <p style="font-size:8.5pt;color:#555;margin-bottom:8px;font-style:italic;">Le client déclare et reconnaît :</p>
      <div class="sign-check">${cb(true)} Avoir reçu et pris connaissance du présent document d'information et de conseil (DIC/DER).</div>
      <div class="sign-check">${cb(true)} Que les renseignements fournis sont complets, sincères et exacts à la date de signature.</div>
      <div class="sign-check">${cb(true)} Avoir reçu une information claire sur les caractéristiques des produits proposés et les risques associés.</div>
      <div class="sign-check">${cb(true)} S'engager à informer ${cabinet.cabinetName||"le cabinet"} de toute modification significative de sa situation (familiale, professionnelle, patrimoniale).</div>
      <div class="sign-check">${cb(true)} Avoir été informé(e) qu'une fausse déclaration intentionnelle peut entraîner la nullité du contrat (art. L113-8 Code des assurances).</div>
      <div class="sign-check">${cb(true)} Avoir pris connaissance de la politique de gestion des conflits d'intérêts du cabinet.</div>
    </div>
  `)}
  ${sec("Réclamations · Médiation · RGPD · Conflits d'intérêts",`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    <div class="info-block" style="font-size:8pt;line-height:1.6;">
      <strong style="color:${cabinet.colorSky}">📋 Réclamations (art. R.521-1)</strong>
      ${cabinet.email?`<p style="margin-top:4px">→ Email : <strong>${cabinet.email}</strong></p>`:""}
      ${cabinet.adresse?`<p>→ Courrier : ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</p>`:""}
      <p style="margin-top:4px;font-size:7.5pt;color:#666;">Accusé de réception sous 10 jours ouvrables · Réponse sous 2 mois maximum</p>
      <p style="margin-top:6px;"><strong style="color:${cabinet.colorSky}">⚖️ Médiation (art. L616-1)</strong></p>
      ${cabinet.mediateur?`<p style="margin-top:3px">Médiateur : <strong>${cabinet.mediateur}</strong></p>`:"<p style='margin-top:3px;color:#666'>Médiateur de l'Assurance — TSA 50110 — 75441 Paris Cedex 09</p>"}
      ${cabinet.mediateurUrl?`<p style="font-size:7.5pt;color:#666">${cabinet.mediateurUrl}</p>`:"<p style='font-size:7.5pt;color:#666'>www.mediation-assurance.org</p>"}
    </div>
    <div class="info-block" style="font-size:8pt;line-height:1.6;">
      <strong style="color:${cabinet.colorSky}">🔒 RGPD & Données personnelles</strong>
      <p style="margin-top:4px;font-size:7.5pt;color:#555;line-height:1.5;">Vos données sont collectées pour exécuter la présente mission. Vous disposez d'un droit d'accès, de rectification et de suppression (art. 15 à 17 RGPD). Responsable de traitement : ${cabinet.cabinetName||"le cabinet"}.</p>
      <p style="margin-top:4px;font-size:7.5pt;color:#666">Bloctel : www.bloctel.gouv.fr</p>
      <p style="margin-top:6px;"><strong style="color:${cabinet.colorSky}">⚠️ Conflits d'intérêts</strong></p>
      <p style="margin-top:3px;font-size:7.5pt;color:#555;line-height:1.5;">Le cabinet tient un registre des conflits d'intérêts conformément aux obligations MIF2. Notre politique est disponible sur demande. En cas de conflit détecté, nous vous en informerons préalablement à toute recommandation.</p>
    </div>
  </div>`)}
  <div class="sign-grid">
    <div>
      <div class="sign-label">Le client — Lu et approuvé</div>
      <div class="sign-box"></div>
      <div style="font-size:8pt;color:#888;margin-top:3px">${p1n}${data.coupleStatus!=="single"&&p2n!=="—"?` & ${p2n}`:""}</div>
    </div>
    <div>
      <div class="sign-label">Le conseiller — Fait à ${mission.lieuSignature||"—"}</div>
      <div class="sign-box">${cabinet.signatureSrc||signatureSrc?`<img src="${cabinet.signatureSrc||signatureSrc}" style="max-height:55px;max-width:150px;" alt="Signature"/>`:""}</div>
      <div style="font-size:8pt;color:#888;margin-top:3px">${cabinet.conseiller||cabinet.cabinetName||""} · ${dateStr}</div>
    </div>
  </div>
  ${pF("Lettre de mission")}
</div>` : "";

  const pages = [
    cover, pageLegal, pageFamilleMission, pageTravailMission, pageBesoins,
    pageBilanM, pageIRM, pageIFIM, pageSuccM, pageProfil, pageSign,
  ].filter(Boolean).join("\n");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Lettre de mission — ${clientName3}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

  const popup = window.open("","_blank","width=900,height=700,scrollbars=yes");
  if(!popup){alert("Autorise les popups.");return;}
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(()=>{popup.print();},500);
}
