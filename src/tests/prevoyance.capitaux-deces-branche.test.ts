// ─── LOT DECES-A — Résolveur capital décès de branche (CCN) ─────────────────
//
// Valeurs Syntec (IDCC 1486) : capital = max(1,70 × salaireRef, minimumPass ×
// PASS), salaireRef plafonné à 8 PASS. minimumPass = 3,40 (cadres) / 1,70
// (non-cadres). PASS 2026 = 48 060. Toute donnée absente → null + indispo.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
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

  it("CCN présente mais capitalDC non documenté (1996 TO_FILL) → null + donneeIndisponible", () => {
    // 3248 (Métallurgie) est désormais documenté → on prend une autre CCN encore
    // TO_FILL (1996 Pharmacie) pour garder le verrou « branche non documentée ».
    const r = resolveCapitalDecesBranche("1996", "cadres", 60000, PASS, referentiels);
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

// ─── LOT BTP-1 — capital décès mode "situationFamiliale" (euros / SR / %) ─────
//
// Capital fonction de la situation conjugale + des enfants à charge. Aucune CCN
// réelle ne porte ce mode (BTP non rempli) → tout est simulé par stub inline.
describe("resolveCapitalDecesBranche — mode situationFamiliale (LOT BTP-1)", () => {
  // Stub : convention "0002" cadres portant un capitalDC arbitraire + plafond
  // optionnel (utile au mode % seulement). Seul prevoyanceCadres est peuplé.
  function stubRefSF(capitalDC: unknown, plafondSalaireRefPass?: unknown): Referentiels {
    const conv: Record<string, unknown> = {
      nom: "Stub SF",
      prevoyanceCadres: { garantiesMinimum: { capitalDC } },
    };
    if (plafondSalaireRefPass !== undefined) conv.plafondSalaireRefPass = plafondSalaireRefPass;
    return { ccn: { conventions: { "0002": conv } } } as unknown as Referentiels;
  }

  // Barème SR type ouvrier : 750 SR célib, 3500 SR conjoint, +250 SR/enfant
  // (rangs 1-2), +500 SR/enfant (rang 3+). Valeur du SR = 100 €.
  const capSR = {
    mode: "situationFamiliale",
    unite: "SR",
    valeurSREuros: 100,
    sansConjoint: 750,
    avecConjoint: 3500,
    majorationParEnfant: [
      { deRang: 1, aRang: 2, valeur: 250 },
      { deRang: 3, valeur: 500 },
    ],
  };

  it("SR — célibataire sans enfant → 750 SR × 100 = 75 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capSR), {});
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(75000, 2);
  });

  it("SR — conjoint sans enfant → 3 500 SR × 100 = 350 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capSR), { conjointPresent: true });
    expect(r.capital).toBeCloseTo(350000, 2);
  });

  it("SR — conjoint + 2 enfants → (3500 + 250 + 250) × 100 = 400 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capSR), { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(400000, 2);
  });

  it("SR — conjoint + 4 enfants → palier rang 3+ sur enfants 3 et 4 : (3500 + 250×2 + 500×2) × 100 = 500 000", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capSR), { conjointPresent: true, nbEnfantsACharge: 4 });
    expect(r.capital).toBeCloseTo(500000, 2);
  });

  it("unité euros — conjoint + 2 enfants (10 000 €/enfant) → 80 000 + 20 000 = 100 000 (indépendant du salaire)", () => {
    const capEuros = {
      mode: "situationFamiliale", unite: "euros",
      sansConjoint: 50000, avecConjoint: 80000,
      majorationParEnfant: [{ deRang: 1, valeur: 10000 }],
    };
    const r = resolveCapitalDecesBranche("0002", "cadres", 999999, PASS, stubRefSF(capEuros), { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(100000, 2);
  });

  it("unité % — conjoint + 2 enfants : (2,50 + 0,40 + 0,40) × salaire 100 000 = 330 000", () => {
    const capPct = {
      mode: "situationFamiliale", unite: "pourcentageSalaireRef",
      sansConjoint: 2.0, avecConjoint: 2.5, minimumPass: 1.0,
      majorationParEnfant: [{ deRang: 1, aRang: 2, valeur: 0.4 }, { deRang: 3, valeur: 0.6 }],
    };
    const r = resolveCapitalDecesBranche("0002", "cadres", 100000, PASS, stubRefSF(capPct, 8), { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(3.3 * 100000, 2);
  });

  it("unité % — plancher minimumPass mord (célibataire, salaire 10 000 → max(2×10000 ; 1×PASS) = PASS)", () => {
    const capPct = {
      mode: "situationFamiliale", unite: "pourcentageSalaireRef",
      sansConjoint: 2.0, avecConjoint: 2.5, minimumPass: 1.0,
    };
    const r = resolveCapitalDecesBranche("0002", "cadres", 10000, PASS, stubRefSF(capPct, 8), {});
    expect(r.capital).toBeCloseTo(1.0 * PASS, 2); // 48 060 > 20 000
  });

  it("unité % — plafondSalaireRefPass mord (célibataire, salaire 500 000 → 2 × 8 PASS)", () => {
    const capPct = {
      mode: "situationFamiliale", unite: "pourcentageSalaireRef",
      sansConjoint: 2.0, avecConjoint: 2.5, minimumPass: 0,
    };
    const r = resolveCapitalDecesBranche("0002", "cadres", 500000, PASS, stubRefSF(capPct, 8), {});
    expect(r.capital).toBeCloseTo(2.0 * 8 * PASS, 2);
  });

  it("concubin — conjointInclutConcubin true → base avecConjoint (3 500 SR)", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capSR, conjointInclutConcubin: true }), { concubinPresent: true });
    expect(r.capital).toBeCloseTo(350000, 2);
  });

  it("concubin — conjointInclutConcubin false/absent → base sansConjoint (750 SR)", () => {
    const rFalse = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capSR, conjointInclutConcubin: false }), { concubinPresent: true });
    expect(rFalse.capital).toBeCloseTo(75000, 2);
    const rAbsent = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF(capSR), { concubinPresent: true });
    expect(rAbsent.capital).toBeCloseTo(75000, 2);
  });

  it("défensif — unité inconnue → indispo (pas de throw)", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capSR, unite: "bitcoin" }), { conjointPresent: true });
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("défensif — unité SR sans valeurSREuros → indispo", () => {
    const r = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({
      mode: "situationFamiliale", unite: "SR", sansConjoint: 750, avecConjoint: 3500,
    }), { conjointPresent: true });
    expect(r.capital).toBeNull();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("défensif — majorationParEnfant mal formé (non-tableau / rang < 1) → indispo", () => {
    const rNotArray = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capSR, majorationParEnfant: "oops" }), { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(rNotArray.capital).toBeNull();
    const rBadRang = resolveCapitalDecesBranche("0002", "cadres", 60000, PASS, stubRefSF({ ...capSR, majorationParEnfant: [{ deRang: 0, valeur: 5 }] }), { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(rBadRang.capital).toBeNull();
  });

  it("ISO — mode pourcentageSalaireRef inchangé, le contexte famille est INERTE", () => {
    const sans = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels);
    const avec = resolveCapitalDecesBranche("1486", "cadres", 120000, PASS, referentiels, { conjointPresent: true, concubinPresent: true, nbEnfantsACharge: 3 });
    expect(sans.capital).toBeCloseTo(204000, 2);
    expect(avec.capital).toBe(sans.capital);
  });
});
