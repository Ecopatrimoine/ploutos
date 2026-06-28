// ─── Lot Dossier client — Page Famille v2 (Situation familiale) ──────
//
// Présente la composition du foyer : personnes (identité, profession), statut
// matrimonial, régime matrimonial, parts fiscales, enfants à charge.
//
// Pas de bandeau KPI (informationnel) — 2 cards personnes + 1 card situation
// + tableau enfants (si non vide).

import {
  header,
  sousTitreSection,
  encartNotreLecture,
  construireTableEcoulable,
  type Col,
  type Cell,
} from "../primitives";
import { compilerPageContrat, type Bloc } from "../engine/contrat";
import type { Tokens } from "../tokens";

export type PersonneFamille = {
  prenom: string;
  nom: string;
  dateNaissance?: string;     // déjà formaté "01/01/1970"
  age?: number;
  profession?: string;
  handicap?: boolean;
};

export type EnfantLigne = {
  prenom: string;
  dateNaissance?: string;
  lien: string;               // ex: "Commun" / "Personne 1 uniquement" / "Personne 2 uniquement"
  garde: string;              // "Pleine" / "Partagée" / "—"
  rattache: boolean;
  handicap: boolean;
};

export type FamillePageData = {
  clientName: string;
  dateStr: string;
  personne1: PersonneFamille;
  personne2?: PersonneFamille;   // undefined si solo
  statutCouple: string;          // "Marié(e) · communauté légale" / "Célibataire" / etc.
  parts: number;                 // ex: 3 (2 + 0.5 + 0.5)
  nbEnfants: number;
  enfants: EnfantLigne[];        // peut être vide
  notreLecture?: string;
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageFamille(t: Tokens, d: FamillePageData): string {
  const renderInfoRow = (label: string, valeur: string) => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid ${t.bordureClaire}">
      <span style="font-size:10.5px;color:${t.texteFaible}">${label}</span>
      <span style="font-size:10.5px;color:${t.texte};font-weight:500;text-align:right">${valeur}</span>
    </div>`;

  const renderPersonne = (p: PersonneFamille, titre: string) => `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
      ${sousTitreSection(t, titre)}
      <div style="margin-top:6px">
        ${renderInfoRow("Identité", `${p.prenom} ${p.nom}`.trim() || "—")}
        ${p.dateNaissance ? renderInfoRow("Naissance", `${p.dateNaissance}${p.age != null ? ` (${p.age} ans)` : ""}`) : ""}
        ${p.profession ? renderInfoRow("Profession", p.profession) : ""}
        ${p.handicap ? renderInfoRow("Situation", "Personne en situation de handicap") : ""}
      </div>
    </div>`;

  const cardSituation = `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
      ${sousTitreSection(t, "Situation familiale")}
      <div style="margin-top:6px">
        ${renderInfoRow("Statut du couple", d.statutCouple)}
        ${renderInfoRow("Parts fiscales", String(d.parts))}
        ${renderInfoRow("Enfants déclarés", String(d.nbEnfants))}
      </div>
    </div>`;

  const cols: Col[] = [
    { label: "Prénom",    align: "left",   width: "22%" },
    { label: "Naissance", align: "left",   width: "18%" },
    { label: "Lien",      align: "left",   width: "22%" },
    { label: "Garde",     align: "left",   width: "14%" },
    { label: "Rattaché",  align: "center", width: "12%" },
    { label: "Handicap",  align: "center", width: "12%" },
  ];
  const rows: Cell[][] = d.enfants.map(e => ([
    { value: e.prenom || "—" },
    { value: e.dateNaissance || "—", color: t.texteFaible },
    { value: e.lien },
    { value: e.garde },
    { value: e.rattache ? "✓" : "—", align: "center", color: e.rattache ? t.succes : t.texteFaibleClair },
    { value: e.handicap ? "✓" : "—", align: "center", color: e.handicap ? t.thOr : t.texteFaibleClair },
  ]));

  // ─── Déclaration des blocs (contrat de page, engine/contrat.ts) ───────
  // Bascule de mécanisme (coquillePage + regionCorpsCentree → compilerPageContrat) :
  // plus de boîte A4 ni de centrage manuel — le flux gère le placement (corps en
  // haut sous le header). Le pied est géré par les margin-boxes @page du feeder.
  // Ordre visuel, libellés, styles et couleurs INCHANGÉS.
  const blocs: Bloc[] = [];

  // Header de page (insécable).
  blocs.push({
    kind: "insecable",
    html: header(t, {
      eyebrow: "Composition du foyer",
      titre: "Situation familiale",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    }),
  });

  // Cartes personnes (grille 2 colonnes) — un seul bloc. En foyer solo, la 2e
  // cellule porte la carte « Situation familiale ».
  blocs.push({
    kind: "insecable",
    html: `<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${renderPersonne(d.personne1, "Personne 1")}
      ${d.personne2 ? renderPersonne(d.personne2, "Personne 2") : cardSituation}
    </div>`,
  });

  // En couple, la carte « Situation familiale » est sur sa propre ligne — bloc séparé.
  if (d.personne2) {
    blocs.push({ kind: "insecable", html: `<div style="margin-top:16px">${cardSituation}</div>` });
  }

  // Section « Enfants » : sous-titre solidaire de sa table, puis la table en
  // ListeEcoulable (coupable ENTRE lignes ; thead répété + « (suite) » par le
  // handler) → s'écoule sur N feuilles si beaucoup d'enfants, au lieu de clipper.
  if (d.enfants.length > 0) {
    const { enteteHtml, lignesHtml } = construireTableEcoulable(t, { cols, rows });
    blocs.push({
      kind: "insecable",
      solidaireAvecSuivant: true,
      html: `<div style="margin-top:18px">${sousTitreSection(t, `Enfants — ${d.enfants.length} enregistré${d.enfants.length > 1 ? "s" : ""}`)}</div>`,
    });
    blocs.push({
      kind: "liste",
      enteteHtml,
      lignesHtml,
      styleTable: `width:100%;border-collapse:collapse;table-layout:fixed;border:0.5px solid ${t.bordureClaire};margin-top:12px`,
    });
  }

  // Encart « Notre lecture » — queue épinglée en fin de flux (si présent).
  if (d.notreLecture) {
    blocs.push({ kind: "queue", html: encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) });
  }

  return compilerPageContrat(blocs);
}
