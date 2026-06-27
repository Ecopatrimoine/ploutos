// ─── Page PDF — Capitaux décès & rentes de survie (HORS actif successoral) ──
//
// Page DÉCLARÉE via le contrat (engine/contrat.ts), patron Succession A/B.
// Tous les capitaux et rentes affichés ici sont EXONÉRÉS et HORS actif
// successoral : ils n'entrent dans aucune masse civile ni aucun droit. Les
// rentes sont ANNUELLES (€/an) et ne sont JAMAIS additionnées aux capitaux.
//
// AUCUNE logique fiscale dans la page : elle affiche des valeurs DÉJÀ dérivées
// par le moteur (assiette990I / natureAssiette / duties, via l'adapter). La
// bascule détaillé/simple (detailMode) est purement de présentation.

import {
  header,
  bandeKPI,
  sousTitreSection,
  encartNotreLecture,
  noteIconee,
  euro,
  icones,
  type KpiItem,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

// ─── Types de page ─────────────────────────────────────────────────────────

export type CapitauxDecesCaisse = {
  source: string;
  capital: number | null;            // null = TO_VERIFY → « Donnée non disponible »
  donneeIndisponible: boolean;
  capitalOrphelinTotal?: number;
  devolution: {
    beneficiaire: string;
    relation: string;
    montant: number;
    origine: "capital_principal" | "capital_orphelin";
  }[];
};

export type CapitauxDecesRente = {
  source: string;
  type: "conjoint" | "education" | "survie_orphelin";
  montantAnnuel: number;
};

export type CapitauxDecesPrive = {
  contrat: string;
  beneficiary: string;
  relation: string;
  sharePct: number;
  montant: number;
  natureAssiette: "primes_avant70" | "capital";
  assiette990I: number;
  before70Taxable: number;
  duties: number;
  beneficiairesARenseigner?: boolean;
};

export type CapitauxDecesBranche = {
  source: string;
  capital: number | null;
  categorie: "cadres" | "nonCadres";
  donneeIndisponible: boolean;
};

export type CapitauxDecesRenteEducationBranche = {
  enfantPrenom: string;
  ageActuel: number | null;
  montantAnnuelCourant: number | null;
  donneeIndisponible: boolean;
  source: string;
};

export type CapitauxDecesRenteConjointBranche = {
  montantAnnuel: number;
  dureeMaxAnnees: number;
  beneficiaireNom: string;
  source: string;
  donneeIndisponible: boolean;
};

export type CapitauxDecesPageData = {
  // En-tête
  clientName: string;
  dateStr: string;
  // KPI (3 totaux DÉJÀ dérivés par le moteur)
  exonereCaisses: number;
  exonereBranche: number;
  capitalAssurance: number;          // total transmis (PAS le « 990 I net »)
  // Section 1 — régimes obligatoires
  caisses: CapitauxDecesCaisse[];
  // Box rentes (rentesSurvieAnnuelles UNIQUEMENT : caisses + contrats individuels)
  rentes: CapitauxDecesRente[];
  // Section 2 — prévoyance décès privée
  detailMode: boolean;               // true dès qu'un contrat est rachetable (natureAssiette=capital)
  prives: CapitauxDecesPrive[];
  // Section 3 — prévoyance collective de branche
  branche: CapitauxDecesBranche[];
  renteEducationBranche: CapitauxDecesRenteEducationBranche[];
  renteConjointBranche: CapitauxDecesRenteConjointBranche[];
  // Queue
  notreLecture: string;
  totalRentesAnnuelles: number;      // agrégat annuel (box + branche) pour la synthèse
  // Pied (parité API ; rendu par le feeder/coquille)
  pagePosition: string;
  cabinetLibellePied: string;
};

const ABATTEMENT_990I = 152_500;

// ─── Page ────────────────────────────────────────────────────────────────

export function pageCapitauxDeces(t: Tokens, d: CapitauxDecesPageData): string {
  const blocs: Bloc[] = [];

  // Header (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Transmission — capitaux décès",
      titre: "Capitaux décès & rentes de survie",
      sousTitre: "Hors actif successoral — flux exonérés",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Bande KPI (3 indicateurs) + note.
  const kpis: KpiItem[] = [
    { label: "Exonéré · caisses", value: euro(d.exonereCaisses), type: "main" },
    { label: "Exonéré · branche (CCN)", value: euro(d.exonereBranche), type: "normal" },
    { label: "Capital décès assurance", value: euro(d.capitalAssurance), type: "normal" },
  ];
  blocs.push({
    kind: "insecable",
    html: `${bandeKPI(t, kpis)}
    <div class="foot">Capitaux et rentes <strong>hors actif successoral</strong> : ils n'entrent dans aucune masse ni aucun droit. Les rentes (€/an) ne sont <strong>jamais additionnées</strong> aux capitaux.</div>`,
  });

  // ─── Section 1 — Régimes obligatoires (caisses) ──
  if (d.caisses.length > 0) {
    blocs.push({
      kind: "insecable",
      solidaireAvecSuivant: true,
      html: `<div style="margin-top:18px">${sousTitreSection(t, "Régimes obligatoires (caisses)")}</div>`,
    });
    for (const c of d.caisses) {
      blocs.push({ kind: "insecable", html: carteCaisse(t, c) });
    }
  }

  // ─── Box rentes de survie / éducation (annuelles) — visuellement distincte ──
  if (d.rentes.length > 0) {
    blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: boxRentes(t, d.rentes) });
  }

  // ─── Section 2 — Prévoyance décès privée (bascule detailMode) ──
  if (d.prives.length > 0) {
    blocs.push({
      kind: "insecable",
      solidaireAvecSuivant: true,
      html: `<div style="margin-top:18px">${sousTitreSection(t, "Prévoyance décès privée")}</div>`,
    });
    if (d.detailMode) {
      for (const html of cartesPrivesDetaille(t, d.prives)) {
        blocs.push({ kind: "insecable", html });
      }
    } else {
      blocs.push({ kind: "insecable", html: listePrivesSimple(t, d.prives) });
      blocs.push({ kind: "insecable", html: noteGlobalePrives(t) });
    }
  }

  // ─── Section 3 — Prévoyance collective de branche ──
  if (d.branche.length > 0 || d.renteEducationBranche.length > 0 || d.renteConjointBranche.length > 0) {
    blocs.push({
      kind: "insecable",
      solidaireAvecSuivant: true,
      html: `<div style="margin-top:18px">${sousTitreSection(t, "Prévoyance collective de branche (CCN)")}</div>`,
    });
    blocs.push({ kind: "insecable", secableEnDernierRecours: true, html: blocBranche(t, d) });
  }

  // ─── Queue épinglée : « Notre lecture » + bandeau de synthèse consolidé ──
  blocs.push({ kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) });
  blocs.push({ kind: "queue", html: bandeauSynthese(t, d) });

  return compilerPageContrat(blocs);
}

// ─── Helpers de présentation (pure mise en forme, aucun calcul fiscal) ──────

function relationLabel(r: string): string {
  const map: Record<string, string> = {
    conjoint: "Conjoint",
    pacs_partner: "Partenaire PACS",
    enfant: "Enfant",
    ascendant: "Ascendant",
    autre: "Autre",
  };
  return map[String(r || "").toLowerCase()] || (r || "—");
}

function renteLabel(type: CapitauxDecesRente["type"]): string {
  switch (type) {
    case "conjoint": return "Rente de survie du conjoint";
    case "education": return "Rente éducation";
    case "survie_orphelin": return "Rente survie / orphelin";
  }
}

function capitalLabel(capital: number | null, donneeIndisponible: boolean): string {
  return (donneeIndisponible || capital == null) ? "Donnée non disponible" : euro(capital);
}

function carteCaisse(t: Tokens, c: CapitauxDecesCaisse): string {
  const indispo = c.donneeIndisponible || c.capital == null;
  const capHtml = indispo
    ? `<span class="lt" style="font-size:11px;color:${t.texteFaibleClair};font-style:italic">${capitalLabel(c.capital, c.donneeIndisponible)}</span>`
    : `<span class="lt" style="font-size:13px;font-weight:700;color:${t.navy}">${euro(c.capital)}</span> <span class="lt" style="font-size:10px;font-weight:700;color:${t.succes}">· exonéré</span>`;

  const orphelin = (c.capitalOrphelinTotal && c.capitalOrphelinTotal > 0)
    ? `<div class="lt" style="font-size:10px;color:${t.texteFaible};margin-top:3px">dont capital orphelin : ${euro(c.capitalOrphelinTotal)}</div>`
    : "";

  const devo = c.devolution.length > 0
    ? `<div style="margin-top:8px;border-top:1px solid ${t.bordureClaire};padding-top:7px">
        ${c.devolution.map(r => `<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0">
          <span class="lt" style="font-size:10.5px;color:${t.texte}">${r.beneficiaire} <span style="color:${t.texteFaible}">(${relationLabel(r.relation)}${r.origine === "capital_orphelin" ? " · orphelin" : ""})</span></span>
          <span class="lt" style="font-size:10.5px;font-weight:700;color:${t.navy}">${euro(r.montant)}</span>
        </div>`).join("")}
      </div>`
    : `<div class="lt" style="font-size:10px;color:${t.texteFaibleClair};font-style:italic;margin-top:6px">Bénéficiaire à déterminer</div>`;

  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:12px 15px;margin-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
      <span class="lt" style="font-size:12px;font-weight:700;color:${t.navy}">${c.source}</span>
      <span style="text-align:right">${capHtml}</span>
    </div>
    ${orphelin}
    ${devo}
  </div>`;
}

function boxRentes(t: Tokens, rentes: CapitauxDecesRente[]): string {
  const lignes = rentes.map(r => `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0">
      <span class="lt" style="font-size:11px;color:${t.texte}">${renteLabel(r.type)} <span style="color:${t.texteFaible}">· ${r.source}</span></span>
      <span class="lt" style="font-size:11px;font-weight:700;color:${t.navy}">${euro(r.montantAnnuel)} <span style="font-weight:400;color:${t.texteFaible}">/ an</span></span>
    </div>`).join("");
  return `<div data-box-rentes style="margin-top:14px;border:0.5px solid ${t.bordureEncart};border-left:3px solid ${t.or};border-radius:8px;padding:12px 15px;background:${t.fondEncart}">
    <div class="lt" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${t.eyebrowOr};font-weight:700">Rentes de survie / éducation (annuelles)</div>
    <div style="margin-top:8px">${lignes}</div>
    <div class="lt" style="font-size:9px;color:${t.texteFaible};margin-top:8px;font-style:italic">Flux exonéré, versé chaque année — jamais additionné aux capitaux ni aux droits.</div>
  </div>`;
}

// MODE SIMPLE : liste plate (bénéficiaire + capital transmis) + 1 note globale.
function listePrivesSimple(t: Tokens, prives: CapitauxDecesPrive[]): string {
  const lignes = prives.map((l, i) => {
    const border = i === prives.length - 1 ? "" : `border-bottom:1px solid ${t.bordureClaire};`;
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;${border}">
      <span class="lt" style="font-size:11px;color:${t.texte}">${l.beneficiary || "Bénéficiaire à renseigner"} <span style="color:${t.texteFaible}">(${relationLabel(l.relation)}) · ${l.contrat}</span></span>
      <span class="lt" style="font-size:11.5px;font-weight:700;color:${t.navy}">${euro(l.montant)}</span>
    </div>`;
  }).join("");
  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:4px 15px;margin-top:10px">${lignes}</div>`;
}

function noteGlobalePrives(t: Tokens): string {
  return `<div data-note-prive-globale style="margin-top:0">${noteIconee(t, {
    iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
    texteHtml: "Contrats <strong>temporaires non rachetables</strong> : le prélèvement 990 I porte sur la seule <strong>dernière prime</strong> versée — généralement négligeable. La fiscalité n'est détaillée que pour les contrats à valeur de rachat.",
    style: "discrete",
  })}</div>`;
}

// MODE DÉTAILLÉ : groupé PAR CONTRAT, 2 sous-groupes par nature.
function cartesPrivesDetaille(t: Tokens, prives: CapitauxDecesPrive[]): string[] {
  const ordre: string[] = [];
  const groupes = new Map<string, CapitauxDecesPrive[]>();
  for (const l of prives) {
    const k = l.contrat || "Contrat";
    if (!groupes.has(k)) { groupes.set(k, []); ordre.push(k); }
    groupes.get(k)!.push(l);
  }
  return ordre.map(contrat => {
    const lignes = groupes.get(contrat)!;
    const temporaire = lignes.filter(l => l.natureAssiette === "primes_avant70");
    const rachetable = lignes.filter(l => l.natureAssiette === "capital");
    const sousGroupes: string[] = [];
    if (temporaire.length > 0) sousGroupes.push(sousGroupeNature(t, "temporaire", temporaire));
    if (rachetable.length > 0) sousGroupes.push(sousGroupeNature(t, "rachetable", rachetable));
    return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:12px 15px;margin-top:10px">
      <div class="lt" style="font-size:12px;font-weight:700;color:${t.navy}">${contrat}</div>
      ${sousGroupes.join("")}
    </div>`;
  });
}

function sousGroupeNature(t: Tokens, nature: "temporaire" | "rachetable", lignes: CapitauxDecesPrive[]): string {
  const label = nature === "temporaire" ? "Temporaire non rachetable" : "Vie entière rachetable";
  const tag = `<span data-nature-tag="${nature}" class="lt" style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${t.thOr};background:${t.fondTableau};border:0.5px solid ${t.bordureSeuilRail};border-radius:5px;padding:2px 8px;margin-top:9px">${label}</span>`;

  const rows = lignes.map(l => `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0">
      <span class="lt" style="font-size:11px;color:${t.texte}">${l.beneficiary || "Bénéficiaire à renseigner"} <span style="color:${t.texteFaible}">(${relationLabel(l.relation)}${l.sharePct ? ` · ${l.sharePct}%` : ""})</span></span>
      <span class="lt" style="font-size:11px;font-weight:700;color:${t.navy}">${euro(l.montant)}</span>
    </div>`).join("");

  // Le traitement 990 I n'est affiché QUE pour le groupe rachetable (assiette = capital).
  const bloc990I = nature === "rachetable" ? bloc990IRachetable(t, lignes) : "";

  return `<div style="margin-top:2px">
    ${tag}
    <div style="margin-top:4px">${rows}</div>
    ${bloc990I}
  </div>`;
}

function bloc990IRachetable(t: Tokens, lignes: CapitauxDecesPrive[]): string {
  // Agrégation de valeurs DÉJÀ dérivées par le moteur (aucun recalcul fiscal).
  const assiette = lignes.reduce((a, l) => a + (l.assiette990I || 0), 0);
  const duties = lignes.reduce((a, l) => a + (l.duties || 0), 0);
  const cellule = (libelle: string, valeur: string, couleur: string) =>
    `<div><div class="lt" style="font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;color:${t.texteFaibleClair}">${libelle}</div><div class="lt" style="font-size:11px;font-weight:700;color:${couleur};margin-top:2px">${valeur}</div></div>`;
  return `<div data-bloc-990i style="margin-top:8px;border-top:1px solid ${t.bordureClaire};padding-top:7px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    ${cellule("Assiette 990 I", euro(assiette), t.navy)}
    ${cellule("Abattement / bénéf.", euro(ABATTEMENT_990I), t.navy)}
    ${cellule("Droits 990 I", duties > 0 ? euro(duties) : "exonéré", duties > 0 ? t.thOr : t.succes)}
  </div>`;
}

function blocBranche(t: Tokens, d: CapitauxDecesPageData): string {
  const ligne = (gauche: string, droiteHtml: string) =>
    `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0">
      <span class="lt" style="font-size:11px;color:${t.texte}">${gauche}</span>
      <span style="text-align:right">${droiteHtml}</span>
    </div>`;

  const capitaux = d.branche.map(b => {
    const cat = b.categorie === "cadres" ? "Cadres" : "Non-cadres";
    const indispo = b.donneeIndisponible || b.capital == null;
    const val = indispo
      ? `<span class="lt" style="font-size:10.5px;color:${t.texteFaibleClair};font-style:italic">${capitalLabel(b.capital, b.donneeIndisponible)}</span>`
      : `<span class="lt" style="font-size:11.5px;font-weight:700;color:${t.navy}">${euro(b.capital)}</span> <span class="lt" style="font-size:9.5px;font-weight:700;color:${t.succes}">· exonéré</span>`;
    return ligne(`Capital décès de branche <span style="color:${t.texteFaible}">· ${cat} · ${b.source}</span>`, val);
  }).join("");

  const educ = d.renteEducationBranche.map(r => {
    const indispo = r.donneeIndisponible || r.montantAnnuelCourant == null;
    const age = r.ageActuel != null ? ` · ${r.ageActuel} ans` : "";
    const val = indispo
      ? `<span class="lt" style="font-size:11px;color:${t.texteFaibleClair};font-style:italic">Donnée non disponible</span>`
      : `<span class="lt" style="font-size:11px;font-weight:700;color:${t.navy}">${euro(r.montantAnnuelCourant)} <span style="font-weight:400;color:${t.texteFaible}">/ an</span></span>`;
    return ligne(`Rente éducation <span style="color:${t.texteFaible}">· ${r.enfantPrenom}${age}</span>`, val);
  }).join("");

  const conj = d.renteConjointBranche.map(r => {
    const indispo = r.donneeIndisponible;
    const duree = r.dureeMaxAnnees ? ` · ${r.dureeMaxAnnees} ans max` : "";
    const val = indispo
      ? `<span class="lt" style="font-size:11px;color:${t.texteFaibleClair};font-style:italic">Donnée non disponible</span>`
      : `<span class="lt" style="font-size:11px;font-weight:700;color:${t.navy}">${euro(r.montantAnnuel)} <span style="font-weight:400;color:${t.texteFaible}">/ an</span></span>`;
    return ligne(`Rente conjoint substitutive <span style="color:${t.texteFaible}">· ${r.beneficiaireNom || "conjoint survivant"}${duree}</span>`, val);
  }).join("");

  return `<div style="border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:8px 15px;margin-top:10px">
    ${capitaux}${educ}${conj}
  </div>`;
}

function bandeauSynthese(t: Tokens, d: CapitauxDecesPageData): string {
  const stat = (label: string, valeur: string, sub?: string) => `<div style="text-align:center;flex:1">
    <div class="lt" style="font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:${t.cream}cc">${label}</div>
    <div class="ser" style="font-size:17px;font-weight:600;color:${t.kpiOrPale};margin-top:3px;white-space:nowrap">${valeur}</div>
    ${sub ? `<div class="lt" style="font-size:8px;color:rgba(255,255,255,.55);margin-top:1px">${sub}</div>` : ""}
  </div>`;
  return `<div style="margin-top:20px;background:${t.navy};border-radius:9px;padding:14px 18px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
      ${stat("Exonéré (caisses + branche)", euro(d.exonereCaisses + d.exonereBranche))}
      ${stat("Capital décès assurance", euro(d.capitalAssurance))}
      ${stat("Rentes de survie / an", euro(d.totalRentesAnnuelles), "toutes sources")}
    </div>
    <div class="lt" style="font-size:8.5px;color:rgba(255,255,255,.6);text-align:center;margin-top:10px;line-height:1.4">Hors actif successoral · les rentes (€/an) ne sont jamais additionnées aux capitaux ni aux droits.</div>
  </div>`;
}
