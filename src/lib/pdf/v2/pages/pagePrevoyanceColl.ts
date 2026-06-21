// ─── Page Prévoyance collective v2 — pagination adaptative (1 ou 2 feuilles) ────
//
// Trois chemins (Lot pagination) :
//   a) inactif        -> 1 feuille : message centré (regionCorpsCentree) + DDA en slot.
//   b) actif & fusion -> 1 feuille PLEINE : header + KPI + convention + audit +
//                        obligations + DDA en slot (decide par tientSurUneFeuille,
//                        conservateur : jamais de clip).
//   c) actif & 2-feuilles -> feuille 1 « Conformité » (header + KPI + convention en
//                        zone haute, PUIS corps audit CENTRÉ via regionCorpsCentree)
//                        + feuille 2 « Obligations » (inchangée, DDA en slot, v1.20.0).
// La DDA est TOUJOURS sur le slot signature NATIF de coquillePage (epinglee bottom:42px),
// presente exactement une fois, sur la derniere/unique feuille. Le bloc "Constats"
// (doublon de l'audit) reste retire du PDF.

import {
  header,
  bandeKPI,
  sousTitreSection,
  tableauTitresDores,
  noteIconee,
  piedPage,
  coquillePage,
  icones,
  tientSurUneFeuille,
  regionCorpsCentree,
  H_HEADER_PX,
  H_BANDE_KPI_PX,
  H_SOUSTITRE_SERIF_PX,
  H_LIGNE_TEXTE_PX,
  CHARS_PAR_LIGNE_CONVENTION,
  RESERVE_BAS_PX,
  RESERVE_PIED_PX,
  type CountsFeuilleCollective,
} from "../primitives";
import type { Tokens } from "../tokens";
import type { ControleConformite, ControleStatut } from "../../../prevoyance/types";
import type {
  VueObligationsFusionnee,
  ValeurFusionnee,
  VerdictFusionne,
} from "../../../prevoyance/comparaison-branche-vue";

export type PrevoyanceCollPageData = {
  active: boolean;
  clientName: string;
  dateStr: string;
  sousTitre: string;          // ex: "Dirigeant analysé : Pierre — SARL DUPONT"
  scoreGlobal: string;        // "67 %"
  effectifLibelle: string;    // "12 salariés"
  entrepriseLibelle: string;  // "SARL DUPONT"
  ccnLibelle: string;         // "IDCC 1486" ou "—"
  controles: ControleConformite[];
  champApplicationCCN: string | null;
  // Vue FUSIONNEE obligations de branche + gap (meme source que l'ecran Lot 5).
  // null en etat inactif. Rendue sur la feuille 2.
  vueObligations: VueObligationsFusionnee | null;
  mentionDDA: string;
  pagePosition: string;
  cabinetLibellePied: string;
};

const STATUT_LABEL: Record<ControleStatut, { label: string; color: string }> = {
  conforme:       { label: "Conforme",        color: "#2F7D5B" },
  non_conforme:   { label: "Non conforme",    color: "#DC2626" },
  vigilance:      { label: "Vigilance",       color: "#B07A1E" },
  non_applicable: { label: "Non applicable",  color: "#6B7280" },
};

const COULEUR_SEVERITE: Record<string, { bg: string; border: string; texte: string; label: string }> = {
  non_conformite: { bg: "#FBEAEA", border: "#DC2626", texte: "#7A1F1F", label: "NON-CONFORMITÉ" },
  alerte:         { bg: "#FBEDED", border: "#EF4444", texte: "#9B2C2C", label: "ALERTE" },
  attention:      { bg: "#FBF3E3", border: "#F59E0B", texte: "#7C4A04", label: "ATTENTION" },
  info:           { bg: "#EEF1F5", border: "#3B82F6", texte: "#1E3A8A", label: "INFO" },
};

// Code couleur des verdicts gap — aligne sur STATUT_LABEL de l'audit (coherence) :
// conforme=vert, insuffisant=rouge, indetermine(=A etudier)=ambre, non_applicable=gris.
const VERDICT_COULEUR: Record<string, string> = {
  conforme: "#2F7D5B",
  insuffisant: "#DC2626",
  indetermine: "#B07A1E",
  non_applicable: "#6B7280",
};

// ─── Helpers section obligations fusionnees (feuille 2) ───────────────────────

// ValeurFusionnee -> HTML cellule. null -> "—" ; commun -> texte ; split -> 2 lignes.
function valeurHTML(t: Tokens, v: ValeurFusionnee | null): string {
  if (!v) return `<span style="color:${t.texteFaible}">—</span>`;
  if ("commun" in v) return v.commun;
  return (
    `<div><span style="color:${t.texteFaible};font-weight:600">Cadres :</span> ${v.cadres}</div>` +
    `<div style="margin-top:2px"><span style="color:${t.texteFaible};font-weight:600">Non-cadres :</span> ${v.nonCadres}</div>`
  );
}

function pastilleHTML(label: string, color: string): string {
  return `<span style="display:inline-block;border:1px solid ${color};border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:700;color:${color};background:#fff">${label}</span>`;
}

// VerdictFusionne (+ libelle parallele) -> pastille(s) colorees.
function verdictHTML(t: Tokens, verdict: VerdictFusionne | null, label: ValeurFusionnee | null): string {
  if (!verdict) return "";
  if ("commun" in verdict) {
    const lab = label && "commun" in label ? label.commun : "";
    return pastilleHTML(lab, VERDICT_COULEUR[verdict.commun] ?? t.texteFaible);
  }
  const lc = label && "cadres" in label ? label.cadres : "";
  const ln = label && "cadres" in label ? label.nonCadres : "";
  return (
    `<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">` +
    pastilleHTML(`Cadres : ${lc}`, VERDICT_COULEUR[verdict.cadres] ?? t.texteFaible) +
    pastilleHTML(`Non-cadres : ${ln}`, VERDICT_COULEUR[verdict.nonCadres] ?? t.texteFaible) +
    `</div>`
  );
}

function compteurHTML(n: number, label: string, color: string, bg: string): string {
  return `<span style="display:inline-block;border:1px solid ${color};border-radius:8px;padding:3px 10px;font-size:10px;font-weight:700;color:${color};background:${bg}">${n} ${label}</span>`;
}

// Section obligations fusionnees — miroir de l'ecran (Lot 5). Ne rend QUE des
// chaines de la vue (source unique) -> rien a verifier cote DDA.
function sectionObligationsFusionnee(t: Tokens, vue: VueObligationsFusionnee): string {
  const titre = sousTitreSection(t, "Obligations de prevoyance de branche");
  const statut = `<div style="font-size:10.5px;color:${t.texteFaible};margin-top:2px;margin-bottom:4px">${vue.statutLabel}</div>`;
  const avertissement = vue.afficherAvertissementIncomplet
    ? `<div style="break-inside:avoid;border:1px solid ${COULEUR_SEVERITE.attention.border};border-radius:8px;background:${COULEUR_SEVERITE.attention.bg};padding:8px 12px;margin-top:6px;font-size:10px;color:${COULEUR_SEVERITE.attention.texte}">Donnees de branche partiellement documentees : verification manuelle conseillee.</div>`
    : "";

  // Etat vide propre : aucune ligne -> statutLabel seul, pas de tableau.
  if (vue.lignes.length === 0) {
    return `${titre}${statut}${avertissement}`;
  }

  // Synthese chiffree (uniquement si comparaison realisee).
  const synthese =
    vue.afficherComparaison && vue.synthese
      ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;margin-bottom:2px">` +
        compteurHTML(vue.synthese.conformes, "conformes", "#2F7D5B", "rgba(47,125,91,0.08)") +
        compteurHTML(vue.synthese.insuffisants, "insuffisante(s)", "#DC2626", "rgba(220,38,38,0.08)") +
        compteurHTML(vue.synthese.aEtudier, "a etudier", "#B07A1E", "rgba(176,122,30,0.10)") +
        `</div>`
      : "";

  // Bandeau "comparaison non realisee" si aucun souscrit (chaine miroir de l'ecran).
  const bandeau = !vue.afficherComparaison
    ? `<div style="break-inside:avoid;border:1px solid ${t.bordureClaire};border-radius:8px;background:${t.fondTableauAlt};padding:8px 12px;margin-top:6px;font-size:10px;color:${t.texteFaible}">Aucune garantie souscrite renseignee — comparaison non realisee.</div>`
    : "";

  // Tableau unique : colonnes selon afficherComparaison.
  const tableau = vue.afficherComparaison
    ? tableauTitresDores(t, {
        cols: [
          { label: "Garantie", align: "left", width: "20%" },
          { label: "Obligation de branche", align: "left", width: "34%" },
          { label: "Souscrit", align: "left", width: "24%" },
          { label: "Verdict", align: "left", width: "22%" },
        ],
        rows: vue.lignes.map((l) =>
          l.estReference
            ? [
                { value: l.garantieLabel, bold: true },
                { value: valeurHTML(t, l.obligation), color: t.texte },
                { value: `<span style="font-style:italic;color:${t.texteFaible}">reference</span>` },
                { value: "" },
              ]
            : [
                { value: l.garantieLabel, bold: true },
                { value: valeurHTML(t, l.obligation), color: t.texte },
                { value: valeurHTML(t, l.souscrit), color: t.texte },
                { value: verdictHTML(t, l.verdict, l.verdictLabel) },
              ]
        ),
      })
    : tableauTitresDores(t, {
        cols: [
          { label: "Garantie", align: "left", width: "30%" },
          { label: "Obligation de branche", align: "left", width: "70%" },
        ],
        rows: vue.lignes.map((l) => [
          { value: l.garantieLabel, bold: true },
          { value: valeurHTML(t, l.obligation), color: t.texte },
        ]),
      });

  // Notes de bas de feuille.
  const notes: string[] = [];
  if (vue.nonPrevues.length > 0) {
    notes.push(`Non prevue par la branche : ${vue.nonPrevues.map((n) => n.garantieLabel).join(", ")}.`);
  }
  // Decision David : la note maintien s'affiche des qu'une ligne estReference existe.
  if (vue.lignes.some((l) => l.estReference)) {
    notes.push("Le maintien employeur est deja integre a la projection (Prevoyance personnelle).");
  }
  const notesHTML =
    notes.length > 0
      ? `<div style="margin-top:8px;font-size:9.5px;color:${t.texteFaible};line-height:1.5">${notes.map((n) => `<div>${n}</div>`).join("")}</div>`
      : "";

  return `${titre}${statut}${avertissement}${synthese}${bandeau}${tableau}${notesHTML}`;
}

// ─── Page (pagination adaptative : 1 ou 2 feuilles) ───────────────────────────

export function pagePrevoyanceColl(t: Tokens, d: PrevoyanceCollPageData): string {
  const pied = piedPage(t, { gauche: d.cabinetLibellePied, droite: d.pagePosition });
  // Mention DDA : rendue UNE seule fois, en bas de la DERNIERE (ou unique) feuille,
  // via le slot signature NATIF de coquillePage (epinglee bottom:42px, v1.20.0).
  const ddaNote = noteIconee(t, {
    iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
    texteHtml: d.mentionDDA,
    style: "discrete",
  });

  // ── Chemin a) Module inactif : 1 feuille, message centre, DDA en slot ──
  // reserveBas = RESERVE_BAS_PX (120) : la DDA est sur CETTE feuille -> on reserve
  // sa place pour eviter tout chevauchement avec le corps centre.
  if (!d.active) {
    const message = `<div style="text-align:center;font-size:12px;color:${t.texteFaible};line-height:1.6">
        Aucun dirigeant détecté dans le foyer et analyse externe non activée.<br/>
        Activer le module Prévoyance collective pour produire l'audit conformité.
      </div>`;
    const contenu = `
      ${header(t, {
        eyebrow: "Prévoyance",
        titre: "Prévoyance collective",
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      })}
      ${regionCorpsCentree(message, { hauteurZoneHautPx: H_HEADER_PX, reserveBasPx: RESERVE_BAS_PX })}
    `;
    return coquillePage(t, { contenu, signature: ddaNote, pied });
  }

  // ── Pieces partagees (chemins fusion + 2-feuilles) ──
  const enTeteConformite = header(t, {
    eyebrow: "Prévoyance",
    titre: "Prévoyance collective",
    sousTitre: d.sousTitre,
    droiteHaut: d.clientName,
    droiteBas: d.dateStr,
  });

  const kpis = [
    { label: "Score conformité", value: d.scoreGlobal, type: "main" as const },
    { label: "Entreprise", value: d.entrepriseLibelle, type: "normal" as const, valueFontSize: "12px" },
    { label: "Effectif", value: d.effectifLibelle, type: "normal" as const },
    { label: "Convention collective", value: d.ccnLibelle, type: "normal" as const, valueFontSize: "11px" },
  ];

  const conventionBloc = d.champApplicationCCN
    ? `<div style="margin-top:16px">
        ${sousTitreSection(t, "Convention applicable", { style: "serif" })}
        <div class="lt" style="font-size:11px;line-height:1.6;color:${t.texte}">${d.champApplicationCCN}</div>
      </div>`
    : "";

  const matrice = tableauTitresDores(t, {
    cols: [
      { label: "Contrôle", align: "left", width: "40%" },
      { label: "Statut", align: "left", width: "18%" },
      { label: "Référence", align: "left", width: "42%" },
    ],
    rows: d.controles.map((c) => {
      const st = STATUT_LABEL[c.statut];
      return [
        { value: c.libelle, bold: true },
        { value: st.label, color: st.color, bold: true },
        { value: c.reference, color: t.texteFaible },
      ];
    }),
  });

  // Corps audit (sans marge externe : la position verticale est gérée par le
  // conteneur — flux en fusion, region centree en 2-feuilles).
  const corpsAudit = `${sousTitreSection(t, "Audit de conformité")}${matrice}`;

  const sectionObl = d.vueObligations
    ? sectionObligationsFusionnee(t, d.vueObligations)
    : `${sousTitreSection(t, "Obligations de prevoyance de branche")}<div style="font-size:10.5px;color:${t.texteFaible};margin-top:2px">Donnees de branche indisponibles.</div>`;

  // ── Decision de fusion CONSERVATRICE (Lot 1) ──
  const vue = d.vueObligations;
  const nbNotes = vue
    ? (vue.nonPrevues.length > 0 ? 1 : 0) + (vue.lignes.some((l) => l.estReference) ? 1 : 0)
    : 0;
  const counts: CountsFeuilleCollective = {
    modeActif: true,
    nbControles: d.controles.length,
    conventionLongueur: d.champApplicationCCN ? d.champApplicationCCN.length : 0,
    nbLignesObligations: vue ? vue.lignes.length : 0,
    nbNotesObligations: nbNotes,
    syntheseObligations: !!(vue && vue.afficherComparaison && vue.synthese),
  };

  // ── Chemin b) Fusion : 1 feuille PLEINE (pas de centrage), DDA en slot ──
  if (tientSurUneFeuille(counts)) {
    const contenu = `
      ${enTeteConformite}
      ${bandeKPI(t, kpis)}
      ${conventionBloc}
      <div style="margin-top:16px">
        ${corpsAudit}
      </div>
      <div style="margin-top:16px">
        ${sectionObl}
      </div>
    `;
    return coquillePage(t, { contenu, signature: ddaNote, pied });
  }

  // ── Chemin c) 2 feuilles : Conformite (corps audit centre) + Obligations ──
  // Zone haute fixe de la feuille 1 = header + KPI + convention(opt) ; le centrage
  // n'enveloppe QUE le corps audit (jamais le KPI). reserveBas = RESERVE_PIED_PX
  // (30 : la DDA est sur la feuille 2, pas ici). hauteurZoneHautPx calculee depuis
  // les constantes figees (Lot 1), pas de nombre magique.
  const lignesConvention =
    counts.conventionLongueur > 0 ? Math.ceil(counts.conventionLongueur / CHARS_PAR_LIGNE_CONVENTION) : 0;
  const hauteurZoneHautConformite =
    H_HEADER_PX +
    H_BANDE_KPI_PX +
    (counts.conventionLongueur > 0 ? H_SOUSTITRE_SERIF_PX + lignesConvention * H_LIGNE_TEXTE_PX : 0);

  const feuilleConformite = coquillePage(t, {
    contenu: `
      ${enTeteConformite}
      ${bandeKPI(t, kpis)}
      ${conventionBloc}
      ${regionCorpsCentree(corpsAudit, { hauteurZoneHautPx: hauteurZoneHautConformite, reserveBasPx: RESERVE_PIED_PX })}
    `,
    pied,
  });

  const feuilleObligations = coquillePage(t, {
    contenu: `
      ${header(t, {
        eyebrow: "Prévoyance collective",
        titre: "Obligations de branche",
        sousTitre: d.sousTitre,
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      })}
      <div style="margin-top:16px">
        ${sectionObl}
      </div>
    `,
    signature: ddaNote,
    pied,
  });

  // Ordre : Conformite -> Obligations (DDA epinglee en bas de cette derniere).
  return feuilleConformite + feuilleObligations;
}
