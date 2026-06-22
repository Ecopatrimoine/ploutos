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
  tableauTitresDores,
  encartNotreLecture,
  piedPage,
  coquillePage,
  regionCorpsCentree,
  H_HEADER_PX,
  RESERVE_PIED_PX,
  type Col,
  type Cell,
} from "../primitives";
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

  // ZONE HAUTE : header seul (pas d'intro/legende sur cette page) -> reste en haut.
  const zoneHaute = header(t, {
    eyebrow: "Composition du foyer",
    titre: "Situation familiale",
    droiteHaut: d.clientName,
    droiteBas: d.dateStr,
  });

  // CORPS : la composition du foyer (cards personnes/situation + table enfants +
  // notre lecture). C'est lui qu'on centre verticalement sur un foyer court.
  const corps = `
    <div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${renderPersonne(d.personne1, "Personne 1")}
      ${d.personne2 ? renderPersonne(d.personne2, "Personne 2") : cardSituation}
    </div>

    ${d.personne2 ? `<div style="margin-top:16px">${cardSituation}</div>` : ""}

    ${d.enfants.length > 0 ? `
      <div style="margin-top:18px">
        ${sousTitreSection(t, `Enfants — ${d.enfants.length} enregistré${d.enfants.length > 1 ? "s" : ""}`)}
        ${tableauTitresDores(t, { cols, rows })}
      </div>
    ` : ""}

    ${d.notreLecture ? encartNotreLecture(t, { titre: "Notre lecture", texte: d.notreLecture }) : ""}
  `;

  // Centrage (pilote generalisation, regionCorpsCentree du Lot 1) : header en haut,
  // corps centre dans la zone restante. hauteurZoneHaut = H_HEADER_PX (header seul),
  // reserveBas = RESERVE_PIED_PX (pied simple, aucune signature/DDA epinglee ici).
  // Constantes FIGEES Lot 1 -> aucun nombre magique nouveau. Pied inchange (coquille).
  const contenu = `
    ${zoneHaute}
    ${regionCorpsCentree(corps, { hauteurZoneHautPx: H_HEADER_PX, reserveBasPx: RESERVE_PIED_PX })}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
