// ─── Lot 9 — Page Couverture v2 (refonte visuelle) ──────────────────────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_couverture_C_retouchee.html
//
// Spécificités vs pages thématiques :
//   • fond crème (et non blanc) — défini par tokens.cream
//   • liseré latéral gauche : 10px navy + 3px or (pas de header eyebrow + titre Fraunces + filet)
//   • motif décoratif d'arcs or en bas à droite (primitive motifArcsBasDroit)
//   • logo : soit image fournie (cabinet.logoSrc), soit cercle avec initiales calculées
//   • titre principal serif Fraunces 33px (multi-ligne possible)
//   • pied texte simple « Document strictement confidentiel — <cabinet> »

import { motifArcsBasDroit, initialesDe } from "../primitives";
import type { Tokens } from "../tokens";

export type CouverturePageData = {
  /** Nom complet du cabinet (ex: "EcoPatrimoine Conseil"). */
  cabinetNom: string;
  /** Sous-titre / dénomination courte (ex: "CONSEIL"). Si absent, dérivé du nom (mot 2 majuscules). */
  cabinetSousTitre?: string;
  /** Logo cabinet en data URL ou URL. Si absent, on affiche les initiales dans un cercle bordé or. */
  cabinetLogoSrc?: string;
  /** Numéro ORIAS (affiché en haut à droite). */
  orias?: string;
  /** Eyebrow doré au-dessus du titre (ex: "Conseil en gestion de patrimoine"). */
  eyebrowDocument: string;
  /** Titre principal en serif Fraunces (ex: "Rapport patrimonial"). Sauts de ligne via "\n". */
  titreDocument: string;
  /** Nom du / des client(s) (ex: "Hélène & Marc Dubreuil"). */
  clientName: string;
  /** Date de génération formatée (ex: "25 mai 2026"). */
  dateStr: string;
  /** Mention pied (par défaut : "Document strictement confidentiel — <cabinetNom>"). */
  mentionPied?: string;
};

export function pageCouverture(t: Tokens, d: CouverturePageData): string {
  const sousTitre = d.cabinetSousTitre || (() => {
    // Si nom = "EcoPatrimoine Conseil" → sous-titre = "CONSEIL"
    const mots = (d.cabinetNom || "").trim().split(/\s+/).filter(Boolean);
    return mots.length > 1 ? mots[mots.length - 1].toUpperCase() : "";
  })();

  const cabinetTitrePrincipal = (() => {
    // Si "EcoPatrimoine Conseil" → on affiche "EcoPatrimoine" en grand, et "CONSEIL" en petit dessous.
    const mots = (d.cabinetNom || "").trim().split(/\s+/).filter(Boolean);
    return mots.length > 1 ? mots.slice(0, -1).join(" ") : d.cabinetNom;
  })();

  const logoBloc = d.cabinetLogoSrc
    ? `<div style="width:42px;height:42px;border-radius:50%;border:1.5px solid ${t.or};display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden">
        <img src="${d.cabinetLogoSrc}" alt="${d.cabinetNom}" style="max-width:100%;max-height:100%;object-fit:contain" />
      </div>`
    : `<div style="width:42px;height:42px;border-radius:50%;border:1.5px solid ${t.or};display:flex;align-items:center;justify-content:center;flex:none">
        <span class="ser" style="font-size:14px;font-weight:600;color:${t.navy}">${initialesDe(d.cabinetNom)}</span>
      </div>`;

  const oriasBloc = d.orias
    ? `<div class="lt" style="font-size:10.5px;color:${t.texteFaible};line-height:1.55;text-align:right">ORIAS<br>${d.orias}</div>`
    : "";

  const mentionPied = d.mentionPied || `Document strictement confidentiel — ${d.cabinetNom}`;

  // Titre principal — supporte "\n" pour des sauts de ligne explicites
  const titreHtml = d.titreDocument.split("\n").join("<br>");

  return `
    <div style="position:relative;width:210mm;height:297mm;overflow:hidden;background:${t.cream}">
      <!-- Liseré latéral gauche : 10px navy + 3px or -->
      <div style="position:absolute;left:0;top:0;bottom:0;width:10px;background:${t.navy}"></div>
      <div style="position:absolute;left:10px;top:0;bottom:0;width:3px;background:${t.or}"></div>

      <!-- Motif décoratif d'arcs or en bas à droite -->
      ${motifArcsBasDroit(t, 300)}

      <!-- Contenu principal (avec padding adapté au liseré) -->
      <div style="padding:40px 42px 0 56px;position:relative;z-index:1">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:center;gap:11px">
            ${logoBloc}
            <div style="line-height:1.1">
              <div class="ser" style="font-size:15px;color:${t.navy}">${cabinetTitrePrincipal}</div>
              ${sousTitre ? `<div class="lt" style="font-size:9px;letter-spacing:.22em;color:${t.eyebrowOr};margin-top:2px">${sousTitre}</div>` : ""}
            </div>
          </div>
          ${oriasBloc}
        </div>

        <div style="height:1px;background:${t.bordureMoyenne};margin-top:28px"></div>

        <!-- Bloc central : titre du document + nom + date -->
        <!-- Lot 9 itération : polices centrales × 2 vs maquette (titre 33→66, nom 19→38, date 11.5→23, eyebrows 10/11→20/22). -->
        <div style="margin-top:90px">
          <div class="lt" style="font-size:22px;letter-spacing:.2em;text-transform:uppercase;color:${t.eyebrowOr}">${d.eyebrowDocument}</div>
          <div class="ser" style="font-size:66px;font-weight:600;color:${t.navy};line-height:1.08;margin-top:18px">${titreHtml}</div>
          <div style="width:96px;height:6px;background:${t.or};margin:34px 0 40px"></div>
          <div class="lt" style="font-size:20px;letter-spacing:.2em;text-transform:uppercase;color:${t.texteFaible}">Préparé pour</div>
          <div class="ser" style="font-size:38px;color:${t.navy};margin-top:8px">${d.clientName}</div>
          <div class="lt" style="margin-top:10px;font-size:23px;color:${t.texteFaible}">${d.dateStr}</div>
        </div>
      </div>

      <!-- Pied : trait + mention confidentialité -->
      <div style="position:absolute;left:56px;right:42px;bottom:30px;border-top:1px solid ${t.bordureMoyenne};padding-top:11px">
        <span class="lt" style="font-size:10px;color:${t.texteFaible}">${mentionPied}</span>
      </div>
    </div>
  `;
}
