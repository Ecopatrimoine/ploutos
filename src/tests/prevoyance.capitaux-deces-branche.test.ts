// ─── LOT DECES-A — Résolveur capital décès de branche (CCN) ─────────────────
//
// Valeurs Syntec (IDCC 1486) : capital = max(1,70 × salaireRef, minimumPass ×
// PASS), salaireRef plafonné à 8 PASS. minimumPass = 3,40 (cadres) / 1,70
// (non-cadres). PASS 2026 = 48 060. Toute donnée absente → null + indispo.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { referentiels } from "../data/prevoyance";
import type { Referentiels } from "../data/prevoyance";

const PASS = 48060;

describe("resolveCapitalDecesBranche — Syntec (1486)", () => {
  it("cadre, salaire 60 000 → plancher 3,40 PASS = 163 404", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.categorie).toBe("cadres");
    // max(1,70×60000=102000 ; 3,40×48060=163404) = 163404
    expect(r.capital).toBeCloseTo(163404, 2);
  });

  it("cadre, salaire 120 000 → 1,70 × salaire = 204 000 (plafond 8 PASS non atteint)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(204000, 2);
  });

  it("plafond 8 PASS : salaire 500 000 → salaireRef plafonné = 8 × PASS", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 500000, PASS, referentiels);
    // 1,70 × (8 × 48060) = 1,70 × 384480 = 653 616
    expect(r.capital).toBeCloseTo(1.7 * 8 * PASS, 2);
  });

  it("non-cadre, salaire 30 000 → plancher 1,70 PASS = 81 702", () => {
    const r = resolveCapitalDecesBranche("1486", "nonCadres", 30000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    // max(1,70×30000=51000 ; 1,70×48060=81702) = 81702
    expect(r.capital).toBeCloseTo(81702, 2);
  });

  it("non-cadre, salaire 60 000 → 1,70 × salaire = 102 000 (au-dessus du plancher)", () => {
    const r = resolveCapitalDecesBranche("1486", "nonCadres", 60000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(102000, 2);
  });

  it("idcc inconnu → null + donneeIndisponible", () => {
    const r = resolveCapitalDecesBranche("9999", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("idcc null → null + donneeIndisponible", () => {
    const r = resolveCapitalDecesBranche(null, "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("CCN présente mais capitalDC non documenté (témoin 9999) → null + donneeIndisponible", () => {
    // Témoin de test 9999 (branche fictive sans garantie) pour le verrou « branche
    // non documentée » (1996 Pharmacie est désormais rempli avec le régime APGIS).
    const r = resolveCapitalDecesBranche("9999", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── LOT PASS-CAP — plafond du salaire de référence configurable par branche ──
//
// Le plafond (multiplicateur de PASS) est lu au niveau branche de ccn-2026.json
// (clé `plafondSalaireRefPass`, défaut 8). Syntec (1486) porte 8 → iso-comportement.
// HCR posera 1 plus tard ; on le simule ici par une config inline (stub).

// Stub référentiels : convention "0001" avec garanties valides (capital + rente
// éducation, planchers PASS à 0 pour isoler l'effet du plafond) et un
// `plafondSalaireRefPass` optionnel (absent → doit déclencher le repli sur 8).
function stubRef(plafondSalaireRefPass?: unknown): Referentiels {
  const conv: Record<string, unknown> = {
    nom: "Stub",
    prevoyanceCadres: {
      garantiesMinimum: {
        capitalDC: { mode: "pourcentageSalaireRef", tauxSalaireRef: 1.70, minimumPass: 0 },
        renteEducation: { mode: "trancheAge", tranches: [
          { deAge: 0, aAge: 18, tauxSalaireRef: 0.12, minimumPass: 0 },
          { deAge: 18, aAge: 26, tauxSalaireRef: 0.15, minimumPass: 0 },
        ] },
      },
    },
  };
  if (plafondSalaireRefPass !== undefined) conv.plafondSalaireRefPass = plafondSalaireRefPass;
  return { ccn: { conventions: { "0001": conv } } } as unknown as Referentiels;
}

describe("resolveCapitalDecesBranche — plafond salaire de référence (PASS-CAP)", () => {
  it("ISO Syntec : brut < 8 PASS → plafond ne mord pas (cadre 120 000 = 204 000)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels);
    // salaireRef = min(120000 ; 8×48060=384480) = 120000 → 1,70×120000 = 204000
    expect(r.capital).toBeCloseTo(204000, 2);
  });

  it("ISO Syntec : brut > 8 PASS → plafond mord toujours à 8 (cadre 500 000 = 1,70×8×PASS)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 500000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(1.7 * 8 * PASS, 2); // 653 616
  });

  it("plafond configurable = 1 PASS (futur HCR, config inline) : cadre 500 000 = 1,70×1×PASS", () => {
    const r = resolveCapitalDecesBranche("0001", "cadres", 500000, PASS, stubRef(1));
    // salaireRef = min(500000 ; 1×48060) = 48060 → 1,70×48060 = 81 702
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(1.7 * 1 * PASS, 2); // 81 702
  });

  it("REPLI : clé plafondSalaireRefPass absente → plafond 8 (cadre 500 000 = 1,70×8×PASS)", () => {
    const r = resolveCapitalDecesBranche("0001", "cadres", 500000, PASS, stubRef());
    expect(r.capital).toBeCloseTo(1.7 * 8 * PASS, 2); // 653 616
  });

  it("REPLI : plafondSalaireRefPass <= 0 ou non numérique → plafond 8", () => {
    expect(resolveCapitalDecesBranche("0001", "cadres", 500000, PASS, stubRef(0)).capital)
      .toBeCloseTo(1.7 * 8 * PASS, 2);
    expect(resolveCapitalDecesBranche("0001", "cadres", 500000, PASS, stubRef("TO_FILL")).capital)
      .toBeCloseTo(1.7 * 8 * PASS, 2);
  });
});

describe("resolveRenteEducationBranche — plafond salaire de référence (PASS-CAP)", () => {
  it("plafond 1 PASS (config inline) : brut 500 000, enfant 10 ans → 0,12×1×PASS", () => {
    const r = resolveRenteEducationBranche("0001", "cadres", 500000, PASS, 10, stubRef(1));
    expect(r.donneeIndisponible).toBe(false);
    // salaireRef = min(500000 ; 1×48060) = 48060 → max(0,12×48060 ; 0) = 5 767,20
    expect(r.montantAnnuelCourant).toBeCloseTo(0.12 * 1 * PASS, 2);
  });

  it("REPLI plafond 8 (clé absente) : brut 500 000, enfant 10 ans → 0,12×8×PASS", () => {
    const r = resolveRenteEducationBranche("0001", "cadres", 500000, PASS, 10, stubRef());
    // salaireRef = min(500000 ; 8×48060=384480) → max(0,12×384480 ; 0) = 46 137,60
    expect(r.montantAnnuelCourant).toBeCloseTo(0.12 * 8 * PASS, 2);
  });

  it("ISO Syntec (1486) : brut > 8 PASS, enfant 20 ans → taux 0,15 × (8 PASS)", () => {
    const r = resolveRenteEducationBranche("1486", "cadres", 500000, PASS, 20, referentiels);
    // salaireRef = 8×48060=384480 → max(0,15×384480=57672 ; 0,30×48060=14418) = 57 672
    expect(r.montantAnnuelCourant).toBeCloseTo(0.15 * 8 * PASS, 2);
  });
});

// ─── LOT BTP-1bis — capital décès "situationFamiliale" par BLOCS de situation ─
//
// Schéma imbriqué : chaque situation (sansConjoint / avecConjoint) porte sa propre
// unité et ses propres majorations ; conversions euros / pourcentageSalaireRef / sr
// par montant ; plancher minimumPass sur la BASE avant majorations. Aucune CCN
// réelle ne porte ce mode → tout est simulé par stub inline.
describe("resolveCapitalDecesBranche — mode situationFamiliale par blocs (LOT BTP-1bis)", () => {
  function stubRefSF(capitalDC: unknown, plafondSalaireRefPass?: unknown): Referentiels {
    const conv: Record<string, unknown> = {
      nom: "Stub SF",
      prevoyanceCadres: { garantiesMinimum: { capitalDC } },
    };
    if (plafondSalaireRefPass !== undefined) conv.plafondSalaireRefPass = plafondSalaireRefPass;
    return { ccn: { conventions: { "0002": conv } } } as unknown as Referentiels;
  }

  // Ouvriers (RNPO) — unité SR, majorations identiques dans les DEUX blocs :
  // base 750/3500 SR ; +1000 SR (rangs 1-2) / +2000 SR (rang 3+). SR = 100 €.
  const majoOuvrier = [
    { deRang: 1, aRang: 2, valeur: 1000, unite: "sr" },
    { deRang: 3, valeur: 2000, unite: "sr" },
  ];
  const capOuvrierSR = {
    mode: "situationFamiliale",
    valeurSREuros: 100,
    sansConjoint: { valeur: 750, unite: "sr", majorationParEnfant: majoOuvrier },
    avecConjoint: { valeur: 3500, unite: "sr", majorationParEnfant: majoOuvrier },
  };

  it("SR — célibataire sans enfant → 750 SR × 100 = 75 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capOuvrierSR), {});
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(75000, 2);
  });

  it("SR — conjoint sans enfant → 3 500 SR × 100 = 350 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capOuvrierSR), { conjointPresent: true });
    expect(r.capital).toBeCloseTo(350000, 2);
  });

  it("SR — conjoint + 2 enfants → (3500 + 1000 + 1000) × 100 = 550 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capOuvrierSR), { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(550000, 2);
  });

  it("SR — conjoint + 4 enfants → palier rang 3+ sur enfants 3 et 4 : (3500 + 1000×2 + 2000×2) × 100 = 950 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capOuvrierSR), { conjointPresent: true, nbEnfantsACharge: 4 });
    expect(r.capital).toBeCloseTo(950000, 2);
  });

  // ETAM (RNPE) — unités DIFFÉRENTES par situation + croisement euros/% dans le
  // même bloc : célib 6000 € + 100 % SB/enfant ; conjoint 200 % SB + 50 %/enfant.
  const capETAM = {
    mode: "situationFamiliale",
    sansConjoint: { valeur: 6000, unite: "euros", majorationParEnfant: [{ deRang: 1, valeur: 100, unite: "pourcentageSalaireRef" }] },
    avecConjoint: { valeur: 200, unite: "pourcentageSalaireRef", majorationParEnfant: [{ deRang: 1, valeur: 50, unite: "pourcentageSalaireRef" }] },
  };

  it("ETAM — célibataire + 2 enfants : 6000 € + 2 × (100 % × 30 000) = 66 000 (base euros, majo %)", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(capETAM, 8), { nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(6000 + 2 * 30000, 2); // 66 000
  });

  it("ETAM — conjoint + 2 enfants : 200 % × 30 000 + 2 × (50 % × 30 000) = 90 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(capETAM, 8), { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(60000 + 2 * 15000, 2); // 90 000
  });

  // Plancher minimumPass sur la BASE (1,3 PMSS = 1,3/12 PASS ≈ 0,108333 PASS).
  const capPlancher = {
    mode: "situationFamiliale",
    minimumPass: 0.108333,
    sansConjoint: { valeur: 200, unite: "pourcentageSalaireRef" },
    avecConjoint: { valeur: 200, unite: "pourcentageSalaireRef", majorationParEnfant: [{ deRang: 1, valeur: 50, unite: "pourcentageSalaireRef" }] },
  };

  it("plancher — petit salaire : base 200 % < 1,3 PMSS → plancher, PUIS majoration ajoutée APRÈS", () => {
    // brut 2000 → salaireRef 2000 ; base 200 % = 4000 < plancher (0,108333 × PASS ≈ 5206)
    // → base relevée au plancher ; + majo 50 % × 2000 = 1000 AJOUTÉE APRÈS le plancher.
    const r = resolveCapitalDecesBranche("0002", "cadres", 2000, PASS, stubRefSF(capPlancher, 8), { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(r.capital).toBeCloseTo(0.108333 * PASS + 0.50 * 2000, 1);
  });

  it("plancher — salaire suffisant : base 200 % > plancher → plancher inerte (60 000 + 15 000)", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(capPlancher, 8), { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(r.capital).toBeCloseTo(75000, 2);
  });

  it("concubin — conjointInclutConcubin true → bloc avecConjoint (3 500 SR)", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capOuvrierSR, conjointInclutConcubin: true }), { concubinPresent: true });
    expect(r.capital).toBeCloseTo(350000, 2);
  });

  it("concubin — conjointInclutConcubin false/absent → bloc sansConjoint (750 SR)", () => {
    const rFalse = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capOuvrierSR, conjointInclutConcubin: false }), { concubinPresent: true });
    expect(rFalse.capital).toBeCloseTo(75000, 2);
    const rAbsent = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capOuvrierSR), { concubinPresent: true });
    expect(rAbsent.capital).toBeCloseTo(75000, 2);
  });

  it("défensif — unité de bloc inconnue → indispo (pas de throw)", () => {
    const cap = { mode: "situationFamiliale", sansConjoint: { valeur: 1000, unite: "bitcoin" }, avecConjoint: { valeur: 1000, unite: "euros" } };
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(cap), {});
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("défensif — bloc de la situation du défunt manquant → indispo", () => {
    // Seul avecConjoint fourni ; défunt célibataire → sansConjoint absent → indispo.
    const cap = { mode: "situationFamiliale", avecConjoint: { valeur: 200, unite: "pourcentageSalaireRef" } };
    const r = resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(cap, 8), {});
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("défensif — unité sr sans valeurSREuros → indispo", () => {
    const cap = { mode: "situationFamiliale", sansConjoint: { valeur: 750, unite: "sr" }, avecConjoint: { valeur: 3500, unite: "sr" } };
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(cap), {});
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("défensif — majoration : unité inconnue / valeur négative / mal formé → indispo", () => {
    const majoUniteInconnue = { mode: "situationFamiliale", sansConjoint: { valeur: 6000, unite: "euros", majorationParEnfant: [{ deRang: 1, valeur: 100, unite: "bitcoin" }] }, avecConjoint: { valeur: 6000, unite: "euros" } };
    expect(resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(majoUniteInconnue, 8), { nbEnfantsACharge: 1 }).capital).toBeNull();
    const valeurNegative = { mode: "situationFamiliale", sansConjoint: { valeur: -100, unite: "euros" }, avecConjoint: { valeur: 6000, unite: "euros" } };
    expect(resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(valeurNegative, 8), {}).capital).toBeNull();
    const malForme = { mode: "situationFamiliale", sansConjoint: { valeur: 6000, unite: "euros", majorationParEnfant: "oops" }, avecConjoint: { valeur: 6000, unite: "euros" } };
    expect(resolveCapitalDecesBranche("0002", "cadres", 30000, PASS, stubRefSF(malForme, 8), { nbEnfantsACharge: 1 }).capital).toBeNull();
  });

  it("ISO — mode pourcentageSalaireRef inchangé, le contexte famille est INERTE", () => {
    const sans = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels);
    const avec = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels, { conjointPresent: true, concubinPresent: true, nbEnfantsACharge: 3 });
    expect(sans.capital).toBeCloseTo(204000, 2);
    expect(avec.capital).toBe(sans.capital);
  });
});

// ─── LOT BTP-4 — rente conjoint mode "cibleCumulable" (résolveur) ─────────────
describe("resolveRenteConjointSubstitutiveBranche — mode cibleCumulable (LOT BTP-4)", () => {
  function stubRefRC(renteConjoint: unknown, plafondSalaireRefPass?: unknown): Referentiels {
    const conv: Record<string, unknown> = {
      nom: "Stub RC",
      prevoyanceCadres: { garantiesMinimum: { renteConjoint } },
    };
    if (plafondSalaireRefPass !== undefined) conv.plafondSalaireRefPass = plafondSalaireRefPass;
    return { ccn: { conventions: { "0003": conv } } } as unknown as Referentiels;
  }
  const benef = ["conjoint", "pacs", "concubin"];
  const cible = { mode: "cibleCumulable", tauxSalaireRef: 0.12, finAgeDefunt: 64, beneficiaires: benef };

  it("nominal : 12 % × assiette ; durée = finAge − âge (défunt 40 → 24 ans) ; cumulable", () => {
    const r = resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(cible, 8), 40);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuel).toBeCloseTo(0.12 * 60000, 2); // 7200 (salaireRef = 60000 < 8 PASS)
    expect(r.dureeMaxAnnees).toBe(24);                     // 64 − 40
    expect(r.cumulableAvecRenteEducation).toBe(true);
    expect(r.beneficiairesQualites).toEqual(["conjoint", "pacs", "concubin"]);
  });

  it("plancher d'assiette : salaire faible → assiette relevée à assietteMinimumEuros", () => {
    const r = resolveRenteConjointSubstitutiveBranche(
      "0003", "cadres", 20000, PASS, stubRefRC({ ...cible, assietteMinimumEuros: 50000 }, 8), 40
    );
    // assiette = max(salaireRef 20000 ; plancher 50000) = 50000 → 0,12 × 50000 = 6000.
    expect(r.montantAnnuel).toBeCloseTo(0.12 * 50000, 2);
  });

  it("âge >= finAgeDefunt → indisponible (durée nulle)", () => {
    expect(resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(cible, 8), 64).donneeIndisponible).toBe(true);
    expect(resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(cible, 8), 70).donneeIndisponible).toBe(true);
  });

  it("âge du défunt inconnu (null) → indisponible", () => {
    expect(resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(cible, 8), null).donneeIndisponible).toBe(true);
  });

  it("défensif : mode inconnu / finAge aberrant / taux invalide / plancher négatif → indispo", () => {
    const bad = (rc: unknown, age: number | null = 40) =>
      resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(rc, 8), age).donneeIndisponible;
    expect(bad({ mode: "viagere", tauxSalaireRef: 0.12, finAgeDefunt: 64, beneficiaires: benef })).toBe(true); // mode inconnu
    expect(bad({ ...cible, finAgeDefunt: 40 })).toBe(true);            // < 55
    expect(bad({ ...cible, finAgeDefunt: 80 })).toBe(true);            // > 75
    expect(bad({ ...cible, finAgeDefunt: undefined })).toBe(true);     // absent
    expect(bad({ ...cible, tauxSalaireRef: 1.5 })).toBe(true);         // taux > 1
    expect(bad({ ...cible, tauxSalaireRef: "x" })).toBe(true);         // taux non numérique
    expect(bad({ ...cible, assietteMinimumEuros: -1000 })).toBe(true); // plancher négatif
  });

  it("substitutive : cumulableAvecRenteEducation = false (flag iso)", () => {
    const sub = { mode: "substitutive", tauxSalaireRef: 0.05, dureeMaxAnnees: 5, beneficiaires: benef };
    const r = resolveRenteConjointSubstitutiveBranche("0003", "cadres", 60000, PASS, stubRefRC(sub, 8), 40);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.cumulableAvecRenteEducation).toBe(false);
    expect(r.dureeMaxAnnees).toBe(5);
  });
});
