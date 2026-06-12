// ─── Tests du résolveur des capitaux décès obligatoires (Lot 1) ──────────
//
// Valeurs attendues LUES DU VRAI référentiel importé (pas de mock de
// données) : on dérive chaque attendu des constantes du référentiel, jamais
// d'un nombre magique recopié à la main.

import { describe, it, expect } from "vitest";
import { resolveCapitauxDeces } from "./capitaux-deces";
import type { EntreePerso } from "./types";
import { referentiels } from "../../data/prevoyance";

const caisses = (referentiels.caisses as any).caisses;
const cipavRef = referentiels.cipav as any;

// Fabrique une EntreePerso minimale valide ; surcharge ce qui compte au test.
function makeEntree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 67,
    statutPro: "",
    caisse: null,
    idccCCN: null,
    ancienneteMois: 0,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

describe("resolveCapitauxDeces — format `type` (caisses sans moteur forfaitaire)", () => {
  it("CPAM : capital forfaitaire unique", () => {
    const r = resolveCapitauxDeces(caisses.CPAM, makeEntree());
    expect(r.capital).toBe(caisses.CPAM.capitalDeces.montant); // 4009
    expect(r.capital).toBe(4009);
    expect(r.donneeIndisponible).toBe(false);
  });

  it("SSI actif/invalide : capital actif + capital orphelin par enfant", () => {
    const r = resolveCapitauxDeces(caisses.SSI, makeEntree({ statutPro: "tns_commercant" }));
    expect(r.capital).toBe(caisses.SSI.capitalDeces.montantActifOuInvalide); // 9612
    expect(r.capital).toBe(9612);
    expect(r.capitalParEnfant).toBe(2403);
    expect(r.situationRetenue).toBe("actif_ou_invalide");
    expect(r.donneeIndisponible).toBe(false);
  });

  it("SSI retraité : capital réduit", () => {
    const r = resolveCapitauxDeces(caisses.SSI, makeEntree({ statutPro: "retraite" }));
    expect(r.capital).toBe(caisses.SSI.capitalDeces.montantRetraite); // 3844.80
    expect(r.capital).toBe(3844.8);
    expect(r.situationRetenue).toBe("retraite");
  });

  it("CARMF actif → capital forfaitaire 71500 ; retraité → 0 (exclusion, parité SSI)", () => {
    // Source carmf.fr (Formalités au décès), consultée 12/06/2026, millésime 2026.
    const actif = resolveCapitauxDeces(caisses.CARMF, makeEntree({ statutPro: "tns_liberal" }));
    expect(actif.capital).toBe(caisses.CARMF.capitalDeces.montantActifOuInvalide); // 71500
    expect(actif.capital).toBe(71500);
    expect(actif.situationRetenue).toBe("actif_ou_invalide");
    expect(actif.donneeIndisponible).toBe(false);
    const retraite = resolveCapitauxDeces(caisses.CARMF, makeEntree({ statutPro: "retraite" }));
    expect(retraite.capital).toBe(0); // retraité CARMF : aucun capital (parité mécanisme SSI)
    expect(retraite.situationRetenue).toBe("retraite");
  });

  it("CARPIMKO : capital par situation familiale (54432 / 36288 / 18144)", () => {
    // Source carpimko.com, consultée 12/06/2026 ; structure 18144 x3 / x2 / x1.
    const cd = caisses.CARPIMKO.capitalDeces;
    const avec = resolveCapitauxDeces(caisses.CARPIMKO, makeEntree({ marie: true, nbEnfantsACharge: 1 }));
    expect(avec.capital).toBe(cd.montantConjointAvecDescendant); // 54432
    expect(avec.capital).toBe(54432);
    const sans = resolveCapitauxDeces(caisses.CARPIMKO, makeEntree({ marie: true, nbEnfantsACharge: 0 }));
    expect(sans.capital).toBe(cd.montantConjointSansDescendant); // 36288
    expect(sans.capital).toBe(36288);
    const seul = resolveCapitauxDeces(caisses.CARPIMKO, makeEntree({ marie: false, nbEnfantsACharge: 0 }));
    expect(seul.capital).toBe(cd.montantSansAyantDroit); // 18144
    expect(seul.capital).toBe(18144);
  });
});

describe("resolveCapitauxDeces — moteur forfaitaire (format `mode`)", () => {
  it("CNBF : capital uniforme", () => {
    const r = resolveCapitauxDeces(caisses.CNBF, makeEntree());
    expect(r.capital).toBe(caisses.CNBF.capitalDeces.valeur); // 50000
    expect(r.capital).toBe(50000);
    expect(r.donneeIndisponible).toBe(false);
  });

  it("CRN : capital uniforme + rente survie/orphelin uniforme", () => {
    const r = resolveCapitauxDeces(caisses.CRN, makeEntree());
    expect(r.capital).toBe(110000);
    expect(r.renteSurvieOrphelinAnnuelle).toBe(caisses.CRN.renteSurvieOrphelin.valeur); // 19800
    expect(r.renteSurvieOrphelinAnnuelle).toBe(19800);
  });

  it("CARPV classe par défaut (maximum) : capital + rentes conjoint & éducation", () => {
    const r = resolveCapitauxDeces(caisses.CARPV, makeEntree());
    expect(r.capital).toBe(caisses.CARPV.capitalDeces.valeurs.maximum); // 113955
    expect(r.capital).toBe(113955);
    expect(r.renteConjointAnnuelle).toBe(14445);
    expect(r.renteEducationAnnuelle).toBe(12840);
  });

  it("CAVOM classe par défaut (C) : capital + rente survie/orphelin", () => {
    const r = resolveCapitauxDeces(caisses.CAVOM, makeEntree());
    expect(r.capital).toBe(caisses.CAVOM.capitalDeces.valeurs.C); // 70965
    expect(r.capital).toBe(70965);
    expect(r.renteSurvieOrphelinAnnuelle).toBe(21259);
  });

  it("CAVAMAC marié, commissions ≥ plafond : capital = taux majoré famille × plafond", () => {
    const cap = caisses.CAVAMAC.capitalDeces;
    const e = makeEntree({
      marie: true,
      forfait: { tauxInvalidite: 0, commissionsBrutes: cap.plafond + 50000 },
    });
    const r = resolveCapitauxDeces(caisses.CAVAMAC, e);
    expect(r.capital).toBe(cap.tauxMajoreFamille * cap.plafond); // 0.5 * 625777 = 312888.5
    expect(r.capital).toBe(312888.5);
  });

  it("CAVAMAC seul (non marié, 0 enfant), commissions faibles : plancher", () => {
    const cap = caisses.CAVAMAC.capitalDeces;
    const e = makeEntree({
      marie: false,
      nbEnfantsACharge: 0,
      forfait: { tauxInvalidite: 0, commissionsBrutes: 10000 },
    });
    const r = resolveCapitauxDeces(caisses.CAVAMAC, e);
    // 0.25 × 10000 = 2500 < plancher 24738 → plancher retenu (assiette > 0).
    expect(r.capital).toBe(cap.plancher); // 24738
    expect(r.capital).toBe(24738);
  });
});

describe("resolveCapitauxDeces — routage par discriminant de classe", () => {
  it("CARPV : classe forcée via forfait.classeOption (minimum) écrase le défaut", () => {
    const e = makeEntree({ forfait: { tauxInvalidite: 0, classeOption: "minimum" } });
    const r = resolveCapitauxDeces(caisses.CARPV, e);
    expect(r.capital).toBe(caisses.CARPV.capitalDeces.valeurs.minimum); // 37985
    expect(r.renteConjointAnnuelle).toBe(caisses.CARPV.renteSurvieConjoint.valeurs.minimum); // 4815
    expect(r.renteEducationAnnuelle).toBe(caisses.CARPV.renteEducationOrphelin.valeurs.minimum); // 4280
  });

  it("CAVOM : classe forcée via forfait.classeOption (A) écrase le défaut C", () => {
    const e = makeEntree({ forfait: { tauxInvalidite: 0, classeOption: "A" } });
    const r = resolveCapitauxDeces(caisses.CAVOM, e);
    expect(r.capital).toBe(caisses.CAVOM.capitalDeces.valeurs.A); // 17716
    expect(r.renteSurvieOrphelinAnnuelle).toBe(caisses.CAVOM.renteSurvieOrphelin.valeurs.A); // 5315
  });
});

describe("resolveCapitauxDeces — CIPAV (capital par points)", () => {
  it("capital par points dérivé du référentiel CIPAV", () => {
    const revenu = 60000;
    const e = makeEntree({
      caisse: "CIPAV",
      cipav: {
        revenuBNC_N2: revenu,
        ancienneteAffiliationMois: 60,
        cumulEmploiRetraite: false,
        tauxInvalidite: 100,
        marie: false,
        nbEnfants: 0,
        decesAccidentel: false,
      },
    });
    const r = resolveCapitauxDeces(caisses.CIPAV, e, cipavRef);

    // Dérivation indépendante depuis les constantes du référentiel CIPAV :
    //   points = revenu × cotisationInvDecesTaux / valeurAchatPoint
    //   capital = forfait + points × valeurServicePoint  (décès non accidentel)
    const p = cipavRef.pointsPrevoyance;
    const points = (revenu * p.cotisationInvDecesTaux) / p.valeurAchatPoint;
    const attendu = cipavRef.capitalDeces.forfait + points * p.valeurServicePoint;

    expect(r.capital).toBeCloseTo(attendu, 6);
    expect(r.donneeIndisponible).toBe(false);
  });

  it("CAS D'OR caisse : revenu N-1 20000 → forfait 7209 + proportionnel ≈ 30362.82", () => {
    // Exemple officiel lacipav.fr (capital-deces), consulté 12/06/2026 : 30 362,82 EUR.
    // Le moteur n'arrondit PAS les points (7692,307...) → 30 362,85 ; la caisse arrondit
    // les points à 1 décimale (7692,3) → 30 362,82. Écart ~0,03 EUR (tolérance documentée).
    const e = makeEntree({
      caisse: "CIPAV",
      cipav: {
        revenuBNC_N2: 20000,
        ancienneteAffiliationMois: 60,
        cumulEmploiRetraite: false,
        tauxInvalidite: 100,
        marie: false,
        nbEnfants: 0,
        decesAccidentel: false,
      },
    });
    const r = resolveCapitauxDeces(caisses.CIPAV, e, cipavRef);
    expect(r.capital).toBeCloseTo(30362.82, 1);
    expect(r.donneeIndisponible).toBe(false);
  });

  it("CIPAV sans cipavRef fourni : capital null + donnée indisponible (sans planter)", () => {
    const e = makeEntree({
      caisse: "CIPAV",
      cipav: {
        revenuBNC_N2: 60000,
        ancienneteAffiliationMois: 60,
        cumulEmploiRetraite: false,
        tauxInvalidite: 100,
        marie: false,
        nbEnfants: 0,
        decesAccidentel: false,
      },
    });
    const r = resolveCapitauxDeces(caisses.CIPAV, e);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── Schéma : capital par SITUATION FAMILIALE (LOT CAISSES-DC, type CARPIMKO) ──
// Test du handler sur un caisseRef SYNTHÉTIQUE (indépendant des vraies données) :
// sélection du cas par entree.marie + entree.nbEnfantsACharge, "TO_VERIFY" → null.
describe("resolveCapitauxDeces — forfaitaire_par_situation_familiale (schéma)", () => {
  const caisseRef = {
    nom: "CAISSE TEST",
    capitalDeces: {
      type: "forfaitaire_par_situation_familiale",
      montantConjointAvecDescendant: 54432,
      montantConjointSansDescendant: 36288,
      montantSansAyantDroit: 18144,
    },
  };

  it("conjoint/PACS AVEC descendant à charge → montant le plus élevé", () => {
    const r = resolveCapitauxDeces(caisseRef, makeEntree({ marie: true, nbEnfantsACharge: 2 }));
    expect(r.capital).toBe(54432);
    expect(r.donneeIndisponible).toBe(false);
  });

  it("conjoint/PACS SANS descendant → montant intermédiaire", () => {
    const r = resolveCapitauxDeces(caisseRef, makeEntree({ marie: true, nbEnfantsACharge: 0 }));
    expect(r.capital).toBe(36288);
  });

  it("aucun conjoint/PACS → montant « sans ayant droit »", () => {
    const r = resolveCapitauxDeces(caisseRef, makeEntree({ marie: false, nbEnfantsACharge: 0 }));
    expect(r.capital).toBe(18144);
  });

  it("montants TO_VERIFY → capital null + donnée indisponible (sans planter)", () => {
    const ref = {
      nom: "X",
      capitalDeces: {
        type: "forfaitaire_par_situation_familiale",
        montantConjointAvecDescendant: "TO_VERIFY",
        montantConjointSansDescendant: "TO_VERIFY",
        montantSansAyantDroit: "TO_VERIFY",
      },
    };
    const r = resolveCapitauxDeces(ref, makeEntree({ marie: true, nbEnfantsACharge: 1 }));
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });
});
