// ─── TEST DE RÈGLE — Page Capitaux décès : bascule simple / détaillé + indispo ─
//
// Chaîne complète exercée : fixture brute (forme computeSuccession) → adapter
// buildCapitauxDecesData → pageCapitauxDeces. Assertions STRUCTURELLES sur le
// HTML rendu (marqueurs data-*), pas de snapshot aveugle :
//   1. MODE SIMPLE (toutes lignes natureAssiette=primes_avant70) : liste plate
//      + EXACTEMENT 1 note globale + AUCUN tag de nature + AUCUN bloc 990 I.
//   2. MODE DÉTAILLÉ (>=1 ligne natureAssiette=capital) : 2 groupes de nature,
//      le bénéficiaire présent sur les 2 natures apparaît 2 fois, le bloc 990 I
//      n'est présent QUE sur le groupe rachetable, AUCUNE note globale.
//   3. donneeIndisponible / capital:null → « Donnée non disponible », jamais de 0 inventé.

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { pageCapitauxDeces } from "../lib/pdf/v2/pages/pageCapitauxDeces";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";

const t = buildTokens("encreOr");

function compte(html: string, motif: RegExp): number {
  return (html.match(motif) || []).length;
}

// ─── Fixture MODE SIMPLE — toutes les lignes privées en primes_avant70 ──
const successionSimple = {
  capitalDecesLines: {
    caisses: [
      {
        source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [
          { beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" },
        ],
      },
    ],
    prives: [
      { contrat: "Prévoyance Madelin", beneficiary: "Hélène Dubreuil", relation: "conjoint", sharePct: 100, montant: 200000, natureAssiette: "primes_avant70", assiette990I: 8000, before70Taxable: 0, duties: 0 },
      { contrat: "Temporaire décès groupe", beneficiary: "Lucas Dubreuil", relation: "enfant", sharePct: 50, montant: 50000, natureAssiette: "primes_avant70", assiette990I: 2000, before70Taxable: 0, duties: 0 },
    ],
    branche: [],
    renteEducationBranche: [],
    renteConjointBranche: [],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 0,
  capitalDecesPriveCapital: 250000,
  capitalDecesPriveDuties: 0,
  rentesSurvieAnnuelles: [
    { source: "CARMF", type: "conjoint", montantAnnuel: 12000 },
    { source: "Contrat individuel", type: "education", montantAnnuel: 6000 },
  ],
};

// ─── Fixture MODE DÉTAILLÉ — contrat rachetable + bénéficiaire sur 2 natures ──
const successionDetaille = {
  capitalDecesLines: {
    caisses: [
      {
        source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [
          { beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" },
        ],
      },
    ],
    prives: [
      // Contrat « Vie entière patrimoniale » — Marie Martin présente en RACHETABLE…
      { contrat: "Vie entière patrimoniale", beneficiary: "Marie Martin", relation: "enfant", sharePct: 50, montant: 180000, natureAssiette: "capital", assiette990I: 180000, before70Taxable: 27500, duties: 5500 },
      { contrat: "Vie entière patrimoniale", beneficiary: "Paul Martin", relation: "enfant", sharePct: 50, montant: 180000, natureAssiette: "capital", assiette990I: 180000, before70Taxable: 27500, duties: 5500 },
      // …ET en TEMPORAIRE (même contrat) → doit apparaître dans les 2 sous-groupes.
      { contrat: "Vie entière patrimoniale", beneficiary: "Marie Martin", relation: "enfant", sharePct: 100, montant: 20000, natureAssiette: "primes_avant70", assiette990I: 3000, before70Taxable: 0, duties: 0 },
    ],
    branche: [],
    renteEducationBranche: [],
    renteConjointBranche: [],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 0,
  capitalDecesPriveCapital: 380000,
  capitalDecesPriveDuties: 11000,
  rentesSurvieAnnuelles: [
    { source: "CARMF", type: "conjoint", montantAnnuel: 12000 },
  ],
};

// ─── Fixture DONNÉE INDISPONIBLE — 1 caisse valorisée + 1 caisse capital:null ──
const successionIndispo = {
  capitalDecesLines: {
    caisses: [
      {
        source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [
          { beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" },
        ],
      },
      // CIPAV non documentée → capital:null + donneeIndisponible (jamais de 0 inventé).
      { source: "CIPAV", capital: null, nbEnfants: 2, donneeIndisponible: true, exonere: true, repartition: [] },
    ],
    prives: [],
    branche: [],
    renteEducationBranche: [],
    renteConjointBranche: [],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 0,
  capitalDecesPriveCapital: 0,
  capitalDecesPriveDuties: 0,
  rentesSurvieAnnuelles: [],
};

const baseParams = {
  data: { person1FirstName: "Hélène", person1LastName: "Dubreuil", coupleStatus: "married" },
  cabinet: { cabinetName: "EcoPatrimoine Conseil" },
  clientName: "Hélène & Marc Dubreuil",
  dateLettre: "25 mai 2026",
};

describe("Capitaux décès — MODE SIMPLE (toutes primes_avant70)", () => {
  const d = buildCapitauxDecesData({ succession: successionSimple, ...baseParams });
  const html = pageCapitauxDeces(t, d);

  it("1a. l'adapter NE bascule PAS en détaillé (detailMode=false)", () => {
    expect(d.detailMode).toBe(false);
  });

  it("1b. liste plate : les bénéficiaires des contrats sont rendus", () => {
    expect(html).toContain("Hélène Dubreuil");
    expect(html).toContain("Lucas Dubreuil");
    expect(html).toContain("Prévoyance Madelin");
  });

  it("1c. EXACTEMENT 1 note globale", () => {
    expect(compte(html, /data-note-prive-globale/g)).toBe(1);
  });

  it("1d. AUCUN tag de nature, AUCUN bloc 990 I (réservés au mode détaillé)", () => {
    expect(html).not.toContain("data-nature-tag");
    expect(html).not.toContain("data-bloc-990i");
  });
});

describe("Capitaux décès — MODE DÉTAILLÉ (contrat rachetable)", () => {
  const d = buildCapitauxDecesData({ succession: successionDetaille, ...baseParams });
  const html = pageCapitauxDeces(t, d);

  it("2a. l'adapter bascule en détaillé (detailMode=true)", () => {
    expect(d.detailMode).toBe(true);
  });

  it("2b. 2 groupes de nature présents (temporaire + rachetable)", () => {
    expect(html).toContain(`data-nature-tag="temporaire"`);
    expect(html).toContain(`data-nature-tag="rachetable"`);
    expect(html).toContain("Temporaire non rachetable");
    expect(html).toContain("Vie entière rachetable");
  });

  it("2c. le bénéficiaire présent sur 2 natures apparaît 2 fois", () => {
    expect(compte(html, /Marie Martin/g)).toBe(2);
  });

  it("2d. le bloc 990 I est présent UNIQUEMENT sur le groupe rachetable (1 occurrence)", () => {
    // 1 seul sous-groupe rachetable dans la fixture → 1 seul bloc 990 I.
    expect(compte(html, /data-bloc-990i/g)).toBe(1);
    // Le bloc 990 I se situe APRÈS le tag rachetable et JAMAIS sous le tag temporaire.
    const posRachetable = html.indexOf(`data-nature-tag="rachetable"`);
    const pos990 = html.indexOf("data-bloc-990i");
    expect(pos990).toBeGreaterThan(posRachetable);
  });

  it("2e. AUCUNE note globale en mode détaillé", () => {
    expect(html).not.toContain("data-note-prive-globale");
  });
});

describe("Capitaux décès — DONNÉE INDISPONIBLE (capital:null)", () => {
  const d = buildCapitauxDecesData({ succession: successionIndispo, ...baseParams });
  const html = pageCapitauxDeces(t, d);

  it("3a. l'adapter préserve capital:null (jamais 0 inventé)", () => {
    const cipav = d.caisses.find(c => c.source === "CIPAV");
    expect(cipav).toBeTruthy();
    expect(cipav!.capital).toBeNull();
    expect(cipav!.donneeIndisponible).toBe(true);
  });

  it("3b. rendu « Donnée non disponible » pour la caisse indisponible", () => {
    expect(html).toContain("CIPAV");
    expect(html).toContain("Donnée non disponible");
  });

  it("3c. 1 SEUL « · exonéré » (la caisse valorisée), aucune valeur inventée pour l'indisponible", () => {
    // CARMF valorisée → 1 tag exonéré ; CIPAV indisponible → AUCUN tag (pas de capital inventé).
    expect(compte(html, /· exonéré/g)).toBe(1);
  });
});

// ─── Fixture BRANCHE INDISPONIBLE — caisse connue + branche capital:null ──
const successionBrancheIndispo = {
  capitalDecesLines: {
    caisses: [
      {
        source: "CARMF", capital: 79152, nbEnfants: 2, donneeIndisponible: false, exonere: true,
        repartition: [
          { beneficiaire: "Hélène Dubreuil", relation: "conjoint", montant: 79152, origine: "capital_principal", source: "auto" },
        ],
      },
    ],
    prives: [],
    branche: [
      { source: "Syntec — IDCC 1486", capital: null, categorie: "nonCadres", exonere: true, donneeIndisponible: true, beneficiairesAuContrat: true, repartition: [] },
    ],
    renteEducationBranche: [],
    renteConjointBranche: [],
  },
  capitalDecesCaisseExonere: 79152,
  capitalDecesBrancheExonere: 0,   // 0 = artefact de l'absence (branche null), PAS un 0 connu
  capitalDecesPriveCapital: 0,
  capitalDecesPriveDuties: 0,
  rentesSurvieAnnuelles: [],
};

describe("Capitaux décès — BRANCHE INDISPONIBLE (absence != zéro)", () => {
  const d = buildCapitauxDecesData({ succession: successionBrancheIndispo, ...baseParams });
  const html = pageCapitauxDeces(t, d);

  it("4a. l'adapter marque la branche indisponible (caisses connues → non indisponible)", () => {
    expect(d.exonereBrancheIndisponible).toBe(true);
    expect(d.exonereCaissesIndisponible).toBe(false);
  });

  it("4b. KPI « Exonéré · branche » rendu « n.d. » (jamais « 0 € »)", () => {
    const idxBranche = html.indexOf("Exonéré · branche (CCN)");
    const idxCapital = html.indexOf("Capital décès assurance");
    const kpiBranche = html.slice(idxBranche, idxCapital);
    expect(kpiBranche).toContain("n.d.");
    expect(kpiBranche).not.toContain("€");   // aucune valeur euro (donc pas de « 0 € » inventé)
  });

  it("4c. KPI « Exonéré · caisses » reste une vraie valeur (pas n.d. — partiel connu non sur-interprété)", () => {
    const idxCaisses = html.indexOf("Exonéré · caisses");
    const idxBranche = html.indexOf("Exonéré · branche (CCN)");
    const kpiCaisses = html.slice(idxCaisses, idxBranche);
    expect(kpiCaisses).toContain("€");
    expect(kpiCaisses).not.toContain("n.d.");
  });

  it("4d. « Notre lecture » signale la branche non disponible et NE la présente PAS comme source connue", () => {
    expect(html).toContain("n'est pas disponible et reste à compléter");
    // La branche n'est pas listée parmi les sources CONNUES de l'exonéré.
    expect(html).not.toContain("la prévoyance de branche");
  });
});
