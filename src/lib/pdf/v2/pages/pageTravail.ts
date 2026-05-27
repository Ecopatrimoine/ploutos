// ─── Lot Dossier client — Page Travail v2 (Vie professionnelle) ──────
//
// Détail des revenus professionnels par personne + déductions.
// Bandeau KPI 3 colonnes (rev. bruts, rev. net imposable, IR estimé) +
// 2 cards personnes (profession, salaires/CA/pensions) + card déductions.

import {
  header,
  bandeKPI,
  sousTitreSection,
  piedPage,
  coquillePage,
  euro,
} from "../primitives";
import type { Tokens } from "../tokens";

export type LigneRevenu = {
  label: string;        // "Salaires" / "BIC / BNC" / "Pensions"
  valeur: number;
};

export type PersonneTravail = {
  prenom: string;
  profession?: string;
  revenus: LigneRevenu[];   // peut être vide si pas de revenus saisis
};

export type LigneDeduction = {
  label: string;        // "Frais réels" / "PER" / "Charges déductibles"
  valeur: number;
};

export type TravailPageData = {
  clientName: string;
  dateStr: string;
  // KPI
  revenusBruts: number;
  revenuNetImposable: number;
  irEstime: number;
  noteKpi: string;
  // Personnes
  personne1: PersonneTravail;
  personne2?: PersonneTravail;
  // Déductions
  deductions: LigneDeduction[];   // peut être vide
  pagePosition: string;
  cabinetLibellePied: string;
};

export function pageTravail(t: Tokens, d: TravailPageData): string {
  const kpis = [
    { label: "Revenus bruts annuels", value: euro(d.revenusBruts),       type: "main"   as const },
    { label: "Revenu net imposable",  value: euro(d.revenuNetImposable), type: "normal" as const },
    { label: "IR estimé",             value: euro(d.irEstime),           type: "normal" as const },
  ];

  const renderInfoRow = (label: string, valeur: string) => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid ${t.bordureClaire}">
      <span style="font-size:10.5px;color:${t.texteFaible}">${label}</span>
      <span style="font-size:10.5px;color:${t.texte};font-weight:500;text-align:right">${valeur}</span>
    </div>`;

  const renderPersonne = (p: PersonneTravail, titre: string) => {
    // Sous-titre = "Personne 1 — Jean" si prénom dispo, sinon "Personne 1" (évite la
    // ligne "Prénom : Jean" redondante avec le titre — audit comparatif #13).
    const titreAvecPrenom = p.prenom ? `${titre} — ${p.prenom}` : titre;
    return `
    <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
      ${sousTitreSection(t, titreAvecPrenom)}
      <div style="margin-top:6px">
        ${p.profession ? renderInfoRow("Profession", p.profession) : ""}
        ${p.revenus.length > 0
          ? p.revenus.map(r => renderInfoRow(r.label, euro(r.valeur))).join("")
          : `<div style="font-size:10.5px;color:${t.texteFaibleClair};font-style:italic;padding:6px 0">Aucun revenu saisi.</div>`
        }
      </div>
    </div>`;
  };

  const cardDeductions = d.deductions.length > 0 ? `
    <div style="margin-top:16px">
      <div style="background:${t.fondEncart};border:0.5px solid ${t.bordureClaire};border-radius:10px;padding:14px 16px">
        ${sousTitreSection(t, "Déductions appliquées")}
        <div style="margin-top:6px">
          ${d.deductions.map(l => renderInfoRow(l.label, euro(l.valeur))).join("")}
        </div>
      </div>
    </div>` : "";

  const contenu = `
    ${header(t, {
      eyebrow: "Vie professionnelle",
      titre: "Revenus & fiscalité du foyer",
      droiteHaut: d.clientName,
      droiteBas: d.dateStr,
    })}

    ${bandeKPI(t, kpis)}
    <div class="foot">${d.noteKpi}</div>

    <div style="margin-top:18px;display:grid;grid-template-columns:${d.personne2 ? "1fr 1fr" : "1fr"};gap:16px">
      ${renderPersonne(d.personne1, "Personne 1")}
      ${d.personne2 ? renderPersonne(d.personne2, "Personne 2") : ""}
    </div>

    ${cardDeductions}
  `;

  const pied = piedPage(t, {
    gauche: d.cabinetLibellePied,
    droite: d.pagePosition,
  });

  return coquillePage(t, { contenu, pied });
}
