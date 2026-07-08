// ─── Page Prévoyance collective v2 — flux unique (contrat de page paged.js) ────
//
// Bascule de MÉCANISME (Phase 3) : les 3 chemins manuels de coquillePage
// (décision de fusion `tientSurUneFeuille`, scission 2-feuilles, centrage
// `regionCorpsCentree`) sont SUPPRIMÉS au profit d'un flux déclaratif unique
// (compilerPageContrat) — paged.js gère seul la pagination (1, 2, … feuilles).
//
// Structure du flux (actif) : header · bande KPI · convention(opt) · AUDIT
// (sous-titre + matrice → ListeEcoulable) · OBLIGATIONS (head + tableau →
// ListeEcoulable + notes) · DDA en QueueEpinglee.
//
// CONFORMITÉ : la mention DDA (devoir de conseil / L.521-4 C. ass.), jadis dans
// le slot absolu bottom:42px de coquillePage — MASQUÉ par le pont feeder, donc
// absent du rendu paged.js — est restaurée dans le FLUX en QueueEpinglee
// (kind:"queue", jamais position:absolute). Même primitive noteIconee, texte
// mentionDDAPrevoyance INCHANGÉ. Le pied est géré par les margin-boxes @page.

import {
  header,
  bandeKPI,
  sousTitreSection,
  construireTableEcoulable,
  noteIconee,
  icones,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import { plur } from "../../../calculs/utils";
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
  // null en etat inactif / indisponible.
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

// ─── Helpers section obligations fusionnees ───────────────────────────────────

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

function compteurHTML(n: number, singulier: string, pluriel: string, color: string, bg: string): string {
  return `<span style="display:inline-block;border:1px solid ${color};border-radius:8px;padding:3px 10px;font-size:10px;font-weight:700;color:${color};background:${bg}">${plur(n, singulier, pluriel)}</span>`;
}

// Section obligations fusionnees -> Bloc[] (head insécable + tableau ListeEcoulable
// + notes). Miroir de l'ecran (Lot 5). Ne rend QUE des chaines de la vue (source
// unique) -> rien a verifier cote DDA. Le tableau jadis monolithique (tableauTitresDores)
// devient une ListeEcoulable (coupable entre lignes, thead repete + « (suite) »).
function blocsObligations(t: Tokens, d: PrevoyanceCollPageData): Bloc[] {
  const titreHtml = sousTitreSection(t, "Obligations de prévoyance de branche");

  // Vue indisponible : sous-titre + message (1 bloc insécable).
  if (!d.vueObligations) {
    return [{
      kind: "insecable",
      html: `<div style="margin-top:16px">${titreHtml}<div style="font-size:10.5px;color:${t.texteFaible};margin-top:2px">Données de branche indisponibles.</div></div>`,
    }];
  }

  const vue = d.vueObligations;
  const statut = `<div style="font-size:10.5px;color:${t.texteFaible};margin-top:2px;margin-bottom:4px">${vue.statutLabel}</div>`;
  const avertissement = vue.afficherAvertissementIncomplet
    ? `<div style="break-inside:avoid;border:1px solid ${COULEUR_SEVERITE.attention.border};border-radius:8px;background:${COULEUR_SEVERITE.attention.bg};padding:8px 12px;margin-top:6px;font-size:10px;color:${COULEUR_SEVERITE.attention.texte}">Données de branche partiellement documentées : vérification manuelle conseillée.</div>`
    : "";

  // Etat vide propre : aucune ligne -> statutLabel seul, pas de tableau (1 bloc).
  if (vue.lignes.length === 0) {
    return [{
      kind: "insecable",
      html: `<div style="margin-top:16px">${titreHtml}${statut}${avertissement}</div>`,
    }];
  }

  // Synthese chiffree (uniquement si comparaison realisee).
  const synthese =
    vue.afficherComparaison && vue.synthese
      ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;margin-bottom:2px">` +
        compteurHTML(vue.synthese.conformes, "conforme", "conformes", "#2F7D5B", "rgba(47,125,91,0.08)") +
        compteurHTML(vue.synthese.insuffisants, "insuffisante", "insuffisantes", "#DC2626", "rgba(220,38,38,0.08)") +
        compteurHTML(vue.synthese.aEtudier, "à étudier", "à étudier", "#B07A1E", "rgba(176,122,30,0.10)") +
        `</div>`
      : "";

  // Bandeau "comparaison non realisee" si aucun souscrit (chaine miroir de l'ecran).
  const bandeau = !vue.afficherComparaison
    ? `<div style="break-inside:avoid;border:1px solid ${t.bordureClaire};border-radius:8px;background:${t.fondTableauAlt};padding:8px 12px;margin-top:6px;font-size:10px;color:${t.texteFaible}">Aucune garantie souscrite renseignée — comparaison non réalisée.</div>`
    : "";

  // Tableau unique -> ListeEcoulable. Colonnes selon afficherComparaison.
  const { enteteHtml, lignesHtml } = vue.afficherComparaison
    ? construireTableEcoulable(t, {
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
                { value: `<span style="font-style:italic;color:${t.texteFaible}">référence</span>` },
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
    : construireTableEcoulable(t, {
        cols: [
          { label: "Garantie", align: "left", width: "30%" },
          { label: "Obligation de branche", align: "left", width: "70%" },
        ],
        rows: vue.lignes.map((l) => [
          { value: l.garantieLabel, bold: true },
          { value: valeurHTML(t, l.obligation), color: t.texte },
        ]),
      });

  // Notes de bas de section.
  const notes: string[] = [];
  if (vue.nonPrevues.length > 0) {
    notes.push(`Non prévue par la branche : ${vue.nonPrevues.map((n) => n.garantieLabel).join(", ")}.`);
  }
  // Decision David : la note maintien s'affiche des qu'une ligne estReference existe.
  if (vue.lignes.some((l) => l.estReference)) {
    notes.push("Le maintien employeur est déjà intégré à la projection (Prévoyance personnelle).");
  }
  const notesHTML =
    notes.length > 0
      ? `<div style="margin-top:8px;font-size:9.5px;color:${t.texteFaible};line-height:1.5">${notes.map((n) => `<div>${n}</div>`).join("")}</div>`
      : "";

  const blocs: Bloc[] = [];
  // Head (titre + statut + avertissement + synthese + bandeau) : solidaire de sa table
  // (le titre ne part jamais orphelin en bas de feuille).
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:16px">${titreHtml}${statut}${avertissement}${synthese}${bandeau}</div>`,
  });
  // Tableau ecoulable (coupable entre lignes ; thead repete + « (suite) »).
  blocs.push({
    kind: "liste",
    enteteHtml,
    lignesHtml,
    styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
  });
  // Notes (apres la table), si presentes.
  if (notesHTML) {
    blocs.push({ kind: "insecable", html: notesHTML });
  }
  return blocs;
}

// ─── Page (flux unique : compilerPageContrat) ─────────────────────────────────

export function pagePrevoyanceColl(t: Tokens, d: PrevoyanceCollPageData): string {
  // Mention DDA (conformite — devoir de conseil DDA / L.521-4 C. ass.) : restauree
  // dans le FLUX en QueueEpinglee (jamais en position:absolute bottom:42px, que le pont
  // feeder masque -> la DDA disparaissait au rendu paged.js). Texte mentionDDAPrevoyance
  // INCHANGE. solidaireAvecPrecedent : soudee au bloc precedent (anti-orphelin), la DDA
  // ne part plus SEULE en haut de la feuille suivante sur un leger debordement.
  const ddaBloc: Bloc = {
    kind: "queue",
    solidaireAvecPrecedent: true,
    html: noteIconee(t, {
      iconeSvg: icones.infoCircle(t.eyebrowOr, 14),
      texteHtml: d.mentionDDA,
      style: "discrete",
    }),
  };

  const blocs: Bloc[] = [];

  // ── Chemin a) Module inactif : header + message + DDA (flux unique) ──
  if (!d.active) {
    blocs.push({
      kind: "insecable",
      html: header(t, {
        eyebrow: "Prévoyance",
        titre: "Prévoyance collective",
        droiteHaut: d.clientName,
        droiteBas: d.dateStr,
      }),
    });
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:40px;text-align:center;font-size:12px;color:${t.texteFaible};line-height:1.6">
        Aucun dirigeant détecté dans le foyer et analyse externe non activée.<br/>
        Activer le module Prévoyance collective pour produire l'audit conformité.
      </div>`,
    });
    blocs.push(ddaBloc);
    return compilerPageContrat(blocs);
  }

  // ── Chemin actif : header + KPI + convention(opt) + audit + obligations + DDA ──
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Prévoyance",
      titre: "Prévoyance collective",
      sousTitre: d.sousTitre,
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  const kpis = [
    { label: "Score conformité", value: d.scoreGlobal, type: "main" as const },
    { label: "Entreprise", value: d.entrepriseLibelle, type: "normal" as const, valueFontSize: "12px" },
    { label: "Effectif", value: d.effectifLibelle, type: "normal" as const },
    { label: "Convention collective", value: d.ccnLibelle, type: "normal" as const, valueFontSize: "11px" },
  ];
  blocs.push({ kind: "insecable", html: bandeKPI(t, kpis) });

  // Convention applicable (optionnelle).
  if (d.champApplicationCCN) {
    blocs.push({
      kind: "insecable",
      html: `<div style="margin-top:16px">
        ${sousTitreSection(t, "Convention applicable", { style: "serif" })}
        <div class="lt" style="font-size:11px;line-height:1.6;color:${t.texte}">${d.champApplicationCCN}</div>
      </div>`,
    });
  }

  // ── Audit de conformite : sous-titre (solidaire de sa table) + matrice ecoulable ──
  blocs.push({
    kind: "insecable",
    solidaireAvecSuivant: true,
    html: `<div style="margin-top:16px">${sousTitreSection(t, "Audit de conformité")}</div>`,
  });
  const auditTable = construireTableEcoulable(t, {
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
  blocs.push({
    kind: "liste",
    enteteHtml: auditTable.enteteHtml,
    lignesHtml: auditTable.lignesHtml,
    styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
  });

  // ── Obligations de prevoyance de branche (head + table ecoulable + notes) ──
  blocs.push(...blocsObligations(t, d));

  // ── DDA en QueueEpinglee (flux, jamais en slot absolu) ──
  blocs.push(ddaBloc);

  return compilerPageContrat(blocs);
}
