// ─── LOT IJ-INV-i — Résolveur IJ + invalidité de branche (CCN) ──────────────
//
// Syntec (IDCC 1486) : IJ = complément à 80 % du salaire, franchise 90 j (relais
// après maintien employeur), plafond 1005 j (hypothèse), base brut_total (art. 6).
// Invalidité : cat1 40 %, cat2/cat3 80 % (art. 7), identique cadres/non-cadres.
// L'objet produit est au FORMAT CouvertureCollective (ij/invalidite uniquement),
// directement consommable par le moteur de projection SANS adaptation.

import { describe, it, expect } from "vitest";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeIJCollective, projeterArretMaladie } from "../lib/prevoyance/projection";
import type { Referentiels } from "../data/prevoyance";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective, EntreePerso } from "../lib/prevoyance/types";

describe("resolveCouvertureBranche — Syntec (1486)", () => {
  it("cadre → IJ complément 80 % (franchise 90, plafond 1005, brut_total)", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.categorie).toBe("cadres");
    expect(r.ij).toEqual({ pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" });
  });

  it("cadre → invalidité cat1 40 %, cat2/cat3 80 %", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    expect(r.invalidite).toEqual({
      cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 }, cat3: { pctSalaire: 0.80 },
    });
  });

  it("non-cadre → IJ et invalidité IDENTIQUES au cadre (taux non différenciés)", () => {
    const cadre = resolveCouvertureBranche("1486", "cadres", referentiels);
    const nonCadre = resolveCouvertureBranche("1486", "nonCadres", referentiels);
    expect(nonCadre.donneeIndisponible).toBe(false);
    expect(nonCadre.ij).toEqual(cadre.ij);
    expect(nonCadre.invalidite).toEqual(cadre.invalidite);
  });

  it("forme CouvertureCollective compatible (assignable sans adaptation)", () => {
    const r = resolveCouvertureBranche("1486", "cadres", referentiels);
    // Compile uniquement si r.ij / r.invalidite ont exactement la forme du type.
    const cov: CouvertureCollective = { ij: r.ij, invalidite: r.invalidite };
    expect(cov.ij?.baseCalcul).toBe("brut_total");
    expect(cov.ij?.pctSalaire).toBe(0.80);
    expect(cov.invalidite?.cat2.pctSalaire).toBe(0.80);
    expect(cov.invalidite?.cat1.pctSalaire).toBe(0.40);
  });
});

describe("resolveCouvertureBranche — cas indisponibles (jamais d'exception)", () => {
  it("idcc inconnu → donneeIndisponible, ni ij ni invalidite", () => {
    const r = resolveCouvertureBranche("9999", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });

  it("idcc null → donneeIndisponible", () => {
    const r = resolveCouvertureBranche(null, "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
  });

  it("CCN sans garanties IJ/invalidité documentées (1996 TO_FILL) → donneeIndisponible", () => {
    // 3248 (Métallurgie) porte désormais capital/rente éducation (mais ni IJ ni
    // invalidité) → on prend 1996 (Pharmacie, entièrement TO_FILL) comme exemple
    // non ambigu de branche sans aucune garantie documentée.
    const r = resolveCouvertureBranche("1996", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });
});

describe("resolveCouvertureBranche — lecture défensive (stubs)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }

  it("ij \"TO_VERIFY\" (string) → ij omis", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: "TO_VERIFY", invalidite: "TO_VERIFY" } }));
    expect(r.donneeIndisponible).toBe(true);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeUndefined();
  });

  it("ij mode inconnu → ij omis ; invalidité valide seule → exploitée", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "forfaitaire", pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" },
      invalidite: { cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 }, cat3: { pctSalaire: 0.80 } },
    } }));
    expect(r.donneeIndisponible).toBe(false);
    expect(r.ij).toBeUndefined();
    expect(r.invalidite).toBeDefined();
  });

  it("ij pctSalaire > 1 → ij omis (garde de cohérence)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "complementSecu", pctSalaire: 1.5, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" },
    } }));
    expect(r.ij).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("invalidité avec une catégorie manquante → invalidité omise", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { cat1: { pctSalaire: 0.40 }, cat2: { pctSalaire: 0.80 } },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── LOT BTP-2 — invalidité mode "additif" / base (passthrough + défensif) ────
describe("resolveCouvertureBranche — invalidité mode additif (LOT BTP-2)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }
  const cats = { cat1: { pctSalaire: 0.10 }, cat2: { pctSalaire: 0.10 }, cat3: { pctSalaire: 0.10 } };

  it("mode additif + base brut → mode/base portés tels quels", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "additif", base: "brut", ...cats },
    } }));
    expect(r.donneeIndisponible).toBe(false);
    expect(r.invalidite?.mode).toBe("additif");
    expect(r.invalidite?.base).toBe("brut");
  });

  it("mode/base absents → clés OMISES du résultat (forme historique inchangée)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { ...cats },
    } }));
    expect(r.invalidite).toEqual(cats); // ni mode ni base
  });

  it("mode inconnu → invalidité indisponible (pas de fallback silencieux sur la cible)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "forfaitaire", ...cats },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("base inconnue → invalidité indisponible", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: { mode: "additif", base: "net", ...cats },
    } }));
    expect(r.invalidite).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });
});

// ─── LOT BTP-3 — majoration par enfant (passthrough + défensif côté résolveur) ─
describe("resolveCouvertureBranche — majoration par enfant (LOT BTP-3)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }

  it("ij : majorationParEnfantPct valide (>= 0) → portée", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "complementSecu", pctSalaire: 0.70, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total", majorationParEnfantPct: 0.0333 },
    } }));
    expect(r.ij?.majorationParEnfantPct).toBeCloseTo(0.0333, 4);
  });

  it("ij : majoration négative → IGNORÉE, garantie IJ principale intacte", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      ij: { mode: "complementSecu", pctSalaire: 0.70, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total", majorationParEnfantPct: -0.05 },
    } }));
    expect(r.ij).toBeDefined();
    expect(r.ij?.pctSalaire).toBe(0.70);
    expect(r.ij?.majorationParEnfantPct).toBeUndefined();
  });

  it("invalidité : majoration par catégorie (cat2 portée, cat3 absente → omise)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: {
        cat1: { pctSalaire: 0.40 },
        cat2: { pctSalaire: 0.65, majorationParEnfantPct: 0.05 },
        cat3: { pctSalaire: 0.75 },
      },
    } }));
    expect(r.invalidite?.cat2.majorationParEnfantPct).toBeCloseTo(0.05, 4);
    expect(r.invalidite?.cat3.majorationParEnfantPct).toBeUndefined();
  });

  it("invalidité : majoration non numérique → IGNORÉE, catégorie principale intacte", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: {
      invalidite: {
        cat1: { pctSalaire: 0.40 },
        cat2: { pctSalaire: 0.65, majorationParEnfantPct: "TO_VERIFY" },
        cat3: { pctSalaire: 0.75 },
      },
    } }));
    expect(r.invalidite).toBeDefined();
    expect(r.invalidite?.cat2.pctSalaire).toBe(0.65);
    expect(r.invalidite?.cat2.majorationParEnfantPct).toBeUndefined();
  });
});

// ─── LOT ASSUR-0 — IJ à PALIERS temporels (resolver) ──────────────────────────
describe("resolveCouvertureBranche — IJ paliers temporels (LOT ASSUR-0)", () => {
  function stub(prevoyanceCadres: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", prevoyanceCadres } } } } as unknown as Referentiels;
  }
  // RPP assurance (1672) : 85 % du 4e au 12e mois, 70 % du 13e au 36e — segments
  // contigus sur l'axe « jours depuis le début de l'arrêt » (franchise 90).
  const ijPaliers = {
    mode: "complementSecu", franchise: 90, baseCalcul: "brut_total",
    paliers: [
      { deJour: 90, aJour: 360, pctSalaire: 0.85 },
      { deJour: 360, aJour: 1080, pctSalaire: 0.70 },
    ],
  };

  it("paliers valides → portés tels quels ; pctSalaire/plafondJours dérivés cohérents", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: ijPaliers } }));
    expect(r.donneeIndisponible).toBe(false);
    expect(r.ij?.paliers).toEqual([
      { deJour: 90, aJour: 360, pctSalaire: 0.85 },
      { deJour: 360, aJour: 1080, pctSalaire: 0.70 },
    ]);
    expect(r.ij?.franchise).toBe(90);
    expect(r.ij?.baseCalcul).toBe("brut_total");
    // pctSalaire dérivé = 1er segment ; plafondJours dérivé = dernier aJour − franchise.
    expect(r.ij?.pctSalaire).toBe(0.85);
    expect(r.ij?.plafondJours).toBe(1080 - 90);
  });

  it("paliers NON contigus (trou 360→400) → IJ omise (échec explicite, donneeIndisponible)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: {
      ...ijPaliers, paliers: [
        { deJour: 90, aJour: 360, pctSalaire: 0.85 },
        { deJour: 400, aJour: 1080, pctSalaire: 0.70 },
      ],
    } } }));
    expect(r.ij).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("pctSalaire en ENTIER (85 au lieu de 0.85) → IJ omise (garde fraction ]0,1])", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: {
      ...ijPaliers, paliers: [{ deJour: 90, aJour: 360, pctSalaire: 85 }],
    } } }));
    expect(r.ij).toBeUndefined();
    expect(r.donneeIndisponible).toBe(true);
  });

  it("paliers vide → IJ omise", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: { ...ijPaliers, paliers: [] } } }));
    expect(r.ij).toBeUndefined();
  });

  it("segment mal ordonné (aJour <= deJour) → IJ omise", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: {
      ...ijPaliers, paliers: [{ deJour: 360, aJour: 360, pctSalaire: 0.85 }],
    } } }));
    expect(r.ij).toBeUndefined();
  });

  it("rétro-compat : `paliers` ABSENT → mode mono-taux strictement inchangé (aucune clé paliers)", () => {
    const r = resolveCouvertureBranche("0001", "cadres", stub({ garantiesMinimum: { ij: {
      mode: "complementSecu", pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total",
    } } }));
    expect(r.ij).toEqual({ pctSalaire: 0.80, franchise: 90, plafondJours: 1005, baseCalcul: "brut_total" });
    expect(r.ij?.paliers).toBeUndefined();
  });
});

// ─── LOT ASSUR-0 — consommation du taux par palier (computeIJCollective) ───────
describe("computeIJCollective — taux par palier temporel (LOT ASSUR-0)", () => {
  // 2 paliers contigus : 0.85 sur [90,365), 0.70 sur [365,730) ; extinction à 730.
  const cov: CouvertureCollective = {
    ij: {
      pctSalaire: 0.85, franchise: 90, plafondJours: 640, baseCalcul: "brut_total",
      paliers: [
        { deJour: 90, aJour: 365, pctSalaire: 0.85 },
        { deJour: 365, aJour: 730, pctSalaire: 0.70 },
      ],
    },
  };
  // Sans déjà-perçu, le complément = assiette × taux (assiette 1000 → € directs).
  const ij = (t: number, deja = 0) => computeIJCollective(t, cov, 1000, deja);

  it("palier 1 (0.85) : début, milieu, dernier jour (aJour−1) → 850", () => {
    expect(ij(90)).toBeCloseTo(850);   // début (= franchise)
    expect(ij(200)).toBeCloseTo(850);  // milieu
    expect(ij(364)).toBeCloseTo(850);  // dernier jour inclus (aJour − 1)
  });

  it("frontière half-open : jour aJour de p1 (365) bascule sur p2 (0.70), pas 0.85", () => {
    expect(ij(365)).toBeCloseTo(700);  // premier jour EXCLU de p1 → p2
  });

  it("palier 2 (0.70) : milieu et dernier jour → 700", () => {
    expect(ij(547)).toBeCloseTo(700);
    expect(ij(729)).toBeCloseTo(700);  // dernier jour inclus (aJour − 1)
  });

  it("extinction : dès le dernier aJour (730) et au-delà → 0 complément", () => {
    expect(ij(730)).toBe(0);
    expect(ij(5000)).toBe(0);
  });

  it("avant la franchise (t < 90) → 0 (franchise commune appliquée)", () => {
    expect(ij(89)).toBe(0);
  });

  it("complément = cible − déjà-perçu, dans chaque palier", () => {
    // assiette 2000, déjà perçu 1000 (maintien + IJSS).
    expect(computeIJCollective(200, cov, 2000, 1000)).toBeCloseTo(700); // 2000×0.85 − 1000
    expect(computeIJCollective(547, cov, 2000, 1000)).toBeCloseTo(400); // 2000×0.70 − 1000
    expect(computeIJCollective(730, cov, 2000, 1000)).toBe(0);          // éteint
  });
});

// ─── LOT ASSUR-0 — intégration projection (9 séries) ──────────────────────────
describe("projeterArretMaladie — IJ branche à 2 paliers (0.85 puis 0.70)", () => {
  function entreePaliers(): EntreePerso {
    return {
      age: 40, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 60000,
      salaireNetMensuel: 0, contratsIndividuels: [],
      couvertureCollective: {
        ij: {
          pctSalaire: 0.85, franchise: 90, plafondJours: 640, baseCalcul: "brut_total",
          paliers: [
            { deJour: 90, aJour: 365, pctSalaire: 0.85 },
            { deJour: 365, aJour: 730, pctSalaire: 0.70 },
          ],
        },
      },
    };
  }

  it("total porté à 85 % du réf en palier 1, 70 % en palier 2, complément éteint après le dernier aJour", () => {
    const r = projeterArretMaladie(entreePaliers(), "cat2", referentiels);
    const ref = r.revenuReferenceMensuel;
    let p1 = false, p2 = false, eteint = false;
    for (let i = 0; i < r.axe.length; i++) {
      if (r.axe[i].phase !== "am") continue;
      const j = r.axe[i].jour;
      const total =
        r.series.maintienEmployeur[i] + r.series.ijObligatoire[i] + r.series.ijComplementaireCollective[i];
      if (j === 120 || j === 180) {
        expect(total).toBeCloseTo(0.85 * ref, 0); // palier 1
        p1 = true;
      } else if (j === 365 || j === 547) {
        expect(total).toBeCloseTo(0.70 * ref, 0); // palier 2
        p2 = true;
      } else if (j === 730 || j === 912) {
        expect(r.series.ijComplementaireCollective[i]).toBe(0); // au-delà du dernier aJour
        eteint = true;
      }
    }
    expect(p1 && p2 && eteint).toBe(true);
  });
});
