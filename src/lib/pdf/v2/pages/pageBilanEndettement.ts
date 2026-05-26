// ─── Lot 9 — Page Bilan patrimonial v2 (taux d'endettement bancaire) ────
//
// Reproduit fidèlement la maquette
//   revue-preview/pdf/refonte_pdf_bilan_taux_endettement_methode_bancaire.html
//
// Réutilise les primitives v2 : header, bandeKPI (compact), sct,
// cascadeRevenus avec extensions (type "total" + largeurs personnalisées
// + sansEncadre), encartNotreLecture, piedPage, coquillePage.

import {
  header,
  bandeKPI,
  sousTitreSection,
  cascadeRevenus,
  encartNotreLecture,
  piedPage,
  coquillePage,
  euro,
  type CascadeItem,
} from "../primitives";
import type { Tokens } from "../tokens";

export type BilanEndettementPageData = {
  // En-tête
  clientName: string;       // "Dubreuil"
  dateStr: string;          // "25 mai 2026"
  // KPI
  patrimoineNet: number;        // 1 248 600
  actifBrut: number;            // 1 460 000
  passifTotal: number;          // 211 400
  tauxEndettement: string;      // "25 %"
  // Note méthode bancaire sous KPI
  noteKpi: string;
  // ─── Détail du calcul du taux d'endettement (transparence pédagogique) ─
  // Affiché dans un encart sobre entre la note méthode et la cascade. Permet
  // au client de refaire le calcul à partir des chiffres réels du dossier.
  calculTaux: {
    chargesCreditAnnuelles: number;   // ex: 18 600
    assuranceCreditAnnuelle: number;  // ex: 1 200
    salairesNetsAnnuels: number;      // ex: 74 000
    loyersBrutsAnnuels: number;       // ex: 7 429 (utilisé brut, puis retenus à 70 %)
    quotitLoyers?: number;            // par défaut 0.70 (HCSF)
    autresRevenusRetenus?: number;    // ex: pensions ; par défaut 0
  };
  // Cascade répartition (5 actifs + 2 crédits + total)
  immobilier: number;             // 953 400
  placementsFinanciers: number;   // 318 600
  assuranceVieEtPER: number;      // 188 000
  creditImmobilier: number;       // 185 000  (montant positif, affiché négatif dans la cascade)
  autresCredits: number;          // 26 400
  // (patrimoineNet utilisé pour la ligne totale)
  // Notre lecture
  notreLecture: string;
  // Pied
  pagePosition: string;     // "1 / 8"
  cabinetLibellePied: string;
};

export function pageBilanEndettement(t: Tokens, d: BilanEndettementPageData): string {
  // ─── KPI band (compact, 4 KPI ; le 1er navy) ──
  const kpis = [
    { label: "Patrimoine net",         value: euro(d.patrimoineNet), type: "main"   as const },
    { label: "Actif brut",             value: euro(d.actifBrut),     type: "normal" as const },
    { label: "Passif (tous crédits)",  value: euro(d.passifTotal),   type: "normal" as const },
    { label: "Taux d'endettement",     value: d.tauxEndettement,     type: "normal" as const },
  ];

  // ─── Encart « Méthode de calcul » (transparence pédagogique) ─────────────
  // Reprend les chiffres réels du dossier pour expliquer le 25 %.
  const q = d.calculTaux.quotitLoyers ?? 0.70;
  const loyersRetenus = Math.round(d.calculTaux.loyersBrutsAnnuels * q);
  const autresRev = d.calculTaux.autresRevenusRetenus || 0;
  const totalCharges = d.calculTaux.chargesCreditAnnuelles + d.calculTaux.assuranceCreditAnnuelle;
  const totalRevenus = d.calculTaux.salairesNetsAnnuels + loyersRetenus + autresRev;
  const tauxCalcule = totalRevenus > 0 ? (totalCharges / totalRevenus) * 100 : 0;
  const tauxCalculeFmt = tauxCalcule.toFixed(1).replace(".", ",") + " %";
  const ligneCalc = (label: string, valeur: string, opts: { gras?: boolean; topSeparator?: boolean; couleurValeur?: string } = {}) => {
    const border = opts.topSeparator ? `border-top:1px solid ${t.bordureClaire};padding-top:5px;margin-top:3px;` : "";
    const weight = opts.gras ? "font-weight:700;" : "";
    const colorV = opts.couleurValeur || t.navy;
    return `<div style="display:flex;justify-content:space-between;font-size:10.5px;color:${t.texte};padding:2px 0;${border}">
      <span class="lt">${label}</span>
      <span class="lt" style="${weight}color:${colorV}">${valeur}</span>
    </div>`;
  };
  const encartCalcul = `
    <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px;border:0.5px solid ${t.bordureClaire};border-radius:8px;padding:11px 14px;background:${t.fondTableauAlt}">
      <div>
        <div class="lt" style="font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:${t.eyebrowOr};font-weight:700;margin-bottom:5px">Charges retenues</div>
        ${ligneCalc("Mensualité crédit (× 12)", euro(d.calculTaux.chargesCreditAnnuelles))}
        ${ligneCalc("Assurance emprunteur",     euro(d.calculTaux.assuranceCreditAnnuelle))}
        ${ligneCalc("Total charges",            euro(totalCharges), { gras: true, topSeparator: true })}
      </div>
      <div>
        <div class="lt" style="font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:${t.eyebrowOr};font-weight:700;margin-bottom:5px">Revenus retenus</div>
        ${ligneCalc("Salaires nets",            euro(d.calculTaux.salairesNetsAnnuels))}
        ${ligneCalc(`Loyers retenus (${Math.round(q * 100)} %)`, euro(loyersRetenus))}
        ${autresRev > 0 ? ligneCalc("Autres revenus", euro(autresRev)) : ""}
        ${ligneCalc("Total revenus",            euro(totalRevenus), { gras: true, topSeparator: true })}
      </div>
      <div style="grid-column:1 / -1;border-top:1px solid ${t.bordureMoyenne};padding-top:8px;margin-top:2px;display:flex;justify-content:space-between;align-items:baseline">
        <span class="lt" style="font-size:10.5px;color:${t.texteFaible}">${euro(totalCharges)} / ${euro(totalRevenus)} =</span>
        <span class="lt" style="font-size:13px;font-weight:700;color:${t.navy}">${tauxCalculeFmt}</span>
      </div>
    </div>
  `;

  // ─── Cascade répartition : échelle = actif brut (immobilier + placements
  //     + AV/PER). Les crédits s'affichent en or pâle bordé. Le total à 100 %.
  const echelle = d.actifBrut || 1;
  const pct = (v: number) => Math.min(100, Math.round((v / echelle) * 100));

  const items: CascadeItem[] = [
    { label: "Immobilier (valeur brute)",       pct: pct(d.immobilier),           valeur: euro(d.immobilier),           type: "revenu" },
    { label: "Placements financiers",            pct: pct(d.placementsFinanciers), valeur: euro(d.placementsFinanciers), type: "netImposable" },
    { label: "Assurance-vie & PER",              pct: pct(d.assuranceVieEtPER),    valeur: euro(d.assuranceVieEtPER),    type: "impot" },
    { label: "− Crédit affecté à l'immobilier",  pct: pct(d.creditImmobilier),     valeur: `− ${euro(d.creditImmobilier)}`, type: "deduction" },
    { label: "− Autres crédits (auto, conso)",   pct: pct(d.autresCredits),       valeur: `− ${euro(d.autresCredits)}`,   type: "deduction" },
    { label: "= Patrimoine net",                 pct: 100,                          valeur: euro(d.patrimoineNet),         type: "total",   valeurFontSize: "12.5px" },
  ];

  const contenu = `
    ${header(t, {
      eyebrow: "Vue d'ensemble",
      titre: "Bilan patrimonial",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}
    <div class="foot">${d.noteKpi}</div>

    ${encartCalcul}

    <div style="margin-top:18px">
      ${sousTitreSection(t, "Répartition du patrimoine net")}
      ${cascadeRevenus(t, items, {
        largeurLabel: "202px",
        largeurValeur: "92px",
        sansEncadre: true,
      })}
    </div>

    ${encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
