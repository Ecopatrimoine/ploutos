// ─── Lot Dossier client — Page Cabinet v2 (À propos & démarche) ──────
//
// Page d'ouverture du rapport patrimonial : présentation du cabinet (nom,
// ORIAS, ville, contact, conseiller) + objet du document + démarche en 5
// étapes numérotées.

import {
  header,
  sousTitreSection,
  piedPage,
  coquillePage,
} from "../primitives";
import type { Tokens } from "../tokens";

export type CabinetInfoLigne = {
  label: string;          // "Cabinet" / "ORIAS" / "Ville" / "Tél." / "Email" / "Conseiller"
  valeur: string;
};

export type DemarcheEtape = {
  num: number;
  titre: string;          // "Collecte" / "Analyse" / etc.
  description: string;
};

export type CabinetPageData = {
  clientName: string;
  dateStr: string;
  infosCabinet: CabinetInfoLigne[];
  objetDocument: string;          // paragraphe libre
  /** Mention de portée (MIF2 / non-contractuel) affichée en italique sous l'objet. */
  porteeMif2?: string;
  demarcheEtapes: DemarcheEtape[];
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageCabinet(t: Tokens, d: CabinetPageData): string {
  const renderInfoRow = (l: CabinetInfoLigne) => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid ${t.bordureClaire}">
      <span style="font-size:10.5px;color:${t.texteFaible}">${l.label}</span>
      <span style="font-size:10.5px;color:${t.texte};font-weight:500;text-align:right">${l.valeur}</span>
    </div>`;

  const renderEtape = (e: DemarcheEtape) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid ${t.bordureClaire}">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${t.or};color:${t.fondEncart};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${e.num}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:${t.navy};margin-bottom:2px">${e.titre}</div>
        <div style="font-size:10.5px;color:${t.texte};line-height:1.5">${e.description}</div>
      </div>
    </div>`;

  const contenu = `
    ${header(t, {
      eyebrow: "À propos",
      titre: "Cabinet & démarche",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    <div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
        ${sousTitreSection(t, "À propos")}
        <div style="margin-top:6px">
          ${d.infosCabinet.map(renderInfoRow).join("")}
        </div>
      </div>
      <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
        ${sousTitreSection(t, "Objet du document")}
        <div style="margin-top:6px;font-size:10.5px;line-height:1.55;color:${t.texte}">${d.objetDocument}</div>
        ${d.porteeMif2 ? `<div style="margin-top:8px;font-size:9.5px;line-height:1.55;color:${t.texteFaibleClair};font-style:italic">${d.porteeMif2}</div>` : ""}
      </div>
    </div>

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Notre démarche")}
      <div style="margin-top:6px">${d.demarcheEtapes.map(renderEtape).join("")}</div>
    </div>
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
