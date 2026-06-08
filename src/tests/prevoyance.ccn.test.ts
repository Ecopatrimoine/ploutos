// ─── T5 / Famille G3 — Conventions collectives Tranche 1 (PLAN_TESTS §G3) ─
//
// STRUCTURE PRÊTE À ACTIVER. Les paliers de maintien employeur et les
// minima de prévoyance des CCN sont aujourd'hui TO_VERIFY / TO_FILL dans
// ccn-2026.json. Ces tests restent en describe.skip et s'activeront CCN
// par CCN, au fil du remplissage depuis Légifrance / base KALI.
//
// Pour chaque CCN remplie, on vérifie :
//   - carence employeur (0 pour Syntec subrogation, 7 j légal sinon)
//   - paliers de maintien selon ancienneté (jours à 100/90 %, 66 %)
//   - taux T1 prévoyance cadres >= 1,50 %
//   - cohérence avec le maintien légal Mensualisation (CCN >= légal)

import { describe, it, expect } from "vitest";
import { referentiels } from "../data/prevoyance";
import {
  projeterArretMaladie,
  categorieMaintien,
  getMaintienParams,
} from "../lib/prevoyance/projection";
import type { EntreePerso } from "../lib/prevoyance/types";

const ccn = referentiels.ccn as any;
const conventions = ccn.conventions;

// Le maintien légal Mensualisation est, lui, FERME (valeurs publiques).
describe("G3 — Maintien légal Mensualisation (ferme, actif)", () => {
  it("carence légale 7 jours", () => {
    expect(ccn.maintienLegal.carenceJours).toBe(7);
  });
  it("7 paliers croissants (12 → 372 mois)", () => {
    const p = ccn.maintienLegal.paliers;
    expect(p).toHaveLength(7);
    expect(p[0].ancienneteMois).toBe(12);
    expect(p[6].ancienneteMois).toBe(372);
  });
  it("palier 1 an : 30 j à 90 % puis 30 j à 66,66 % (segments)", () => {
    const segments = ccn.maintienLegal.paliers[0].segments;
    expect(segments).toHaveLength(2);
    // 1er segment : 30 jours à taux plein 90 % (90/100 = 0,9 exact).
    expect(segments[0].jours).toBe(30);
    expect(segments[0].pct).toBe(90);
    // 2e segment : 30 jours à 66,66 % — pct/100 reproduit 2/3 au centime.
    expect(segments[1].jours).toBe(30);
    expect(segments[1].pct / 100).toBeCloseTo(2 / 3, 10);
  });
});

// ── Non-régression LOT 1a-i : la migration des paliers légaux vers des
//    segments à taux libre ne change AUCUN montant de maintien (au centime).
//    On compare la série produite par le moteur à un calcul de référence
//    utilisant les taux d'AVANT migration : plein 90 % et partiel 2/3.
describe("Non-régression maintien légal (segments) — montants au centime", () => {
  const CARENCE_LEGALE = 7;
  const TAUX_PLEIN_LEGAL = 0.9;
  const TAUX_PARTIEL_LEGAL = 2 / 3;

  // Paliers légaux de référence (ccn-2026.json maintienLegal, Mensualisation) :
  // ancienneté (mois) → [jours plein, jours partiel].
  function refPalier(ancienneteMois: number): { plein: number; partiel: number } | null {
    if (ancienneteMois >= 372) return { plein: 90, partiel: 90 };
    if (ancienneteMois >= 312) return { plein: 80, partiel: 80 };
    if (ancienneteMois >= 252) return { plein: 70, partiel: 70 };
    if (ancienneteMois >= 192) return { plein: 60, partiel: 60 };
    if (ancienneteMois >= 132) return { plein: 50, partiel: 50 };
    if (ancienneteMois >= 72) return { plein: 40, partiel: 40 };
    if (ancienneteMois >= 12) return { plein: 30, partiel: 30 };
    return null; // moins d'un an d'ancienneté → pas de maintien légal
  }

  // Reproduit le calcul d'AVANT migration : cible = revenu × taux, puis
  // complément des IJ obligatoires (Math.max(0, cible − IJ)).
  function maintienAttendu(
    jour: number,
    pal: { plein: number; partiel: number } | null,
    revenuRef: number,
    ijOblMensuel: number
  ): number {
    if (!pal || jour < CARENCE_LEGALE) return 0;
    const tEff = jour - CARENCE_LEGALE;
    let cible: number;
    if (tEff < pal.plein) cible = revenuRef * TAUX_PLEIN_LEGAL;
    else if (tEff < pal.plein + pal.partiel) cible = revenuRef * TAUX_PARTIEL_LEGAL;
    else return 0;
    return Math.max(0, cible - ijOblMensuel);
  }

  it("LOT 1a-i — montants de maintien légal inchangés au centime (anciennetés 0..120 mois)", () => {
    let vuPositif = false;
    for (const ancienneteMois of [0, 6, 12, 60, 120]) {
      const e: EntreePerso = {
        age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
        idccCCN: null, ancienneteMois, salaireBrutAnnuel: 60000,
        salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
      };
      const r = projeterArretMaladie(e, "cat2", referentiels);
      const pal = refPalier(ancienneteMois);
      for (let i = 0; i < r.axe.length; i++) {
        if (r.axe[i].phase !== "am") continue; // le maintien n'existe qu'en phase AM
        const attendu = maintienAttendu(
          r.axe[i].jour,
          pal,
          r.revenuReferenceMensuel,
          r.series.ijObligatoire[i]
        );
        expect(r.series.maintienEmployeur[i]).toBeCloseTo(attendu, 2);
        if (r.series.maintienEmployeur[i] > 0) vuPositif = true;
      }
    }
    // Garde-fou : le test n'est pas vacant — au moins un maintien > 0 observé.
    expect(vuPositif).toBe(true);
  });
});

// ── LOT 1a-ii : maintien employeur différencié par catégorie cadre/non-cadre.
//    Aucune CCN n'est remplie (tous les sous-blocs maintienEmployeur.{cadres,
//    nonCadres} = null) → tout le monde retombe sur le maintien légal.
describe("LOT 1a-ii — catégorie de maintien (cadres / non-cadres)", () => {
  it("categorieMaintien aiguille les statuts (total, sans throw)", () => {
    expect(categorieMaintien("salarie_cadre")).toBe("cadres");
    expect(categorieMaintien("salarie_non_cadre")).toBe("nonCadres");
    // Assimilés salariés → "cadres" par défaut (choix d'aiguillage 1a-ii).
    expect(categorieMaintien("president_sas")).toBe("cadres");
    expect(categorieMaintien("eurl_unique")).toBe("cadres");
    // Statut non salarié et statut vide → défaut "nonCadres", jamais d'exception.
    expect(categorieMaintien("tns_liberal")).toBe("nonCadres");
    expect(categorieMaintien("fonctionnaire")).toBe("nonCadres");
    expect(categorieMaintien("")).toBe("nonCadres");
  });

  it("CCN non remplie (cadres/nonCadres = null) → source 'legal' pour les deux catégories", () => {
    // État actuel de TOUTES les CCN du référentiel : maintienEmployeur.cadres
    // et .nonCadres valent null → preuve d'iso-comportement (fallback légal).
    for (const idcc of ["1486", "3248", "1979"]) {
      expect(getMaintienParams(idcc, referentiels, "cadres").source).toBe("legal");
      expect(getMaintienParams(idcc, referentiels, "nonCadres").source).toBe("legal");
    }
  });
});

// ── Syntec (1486) — référence T1, subrogation ──
describe.skip("G3 — Syntec (IDCC 1486) (à activer après remplissage paliers)", () => {
  const syntec = conventions["1486"];
  it("taux T1 prévoyance cadres >= 1,50 %", () => {
    expect(syntec.prevoyanceCadres.tauxT1Minimum).toBeGreaterThanOrEqual(1.5);
  });
  it("carence employeur 0 (subrogation)", () => {
    expect(syntec.maintienEmployeur.carenceJours).toBe(0);
    expect(syntec.maintienEmployeur.subrogation).toBe(true);
  });
  it("maintien Syntec >= maintien légal Mensualisation (à ancienneté égale)", () => {
    // Comparaison palier à palier à activer quand les paliers Syntec
    // seront renseignés (jours à 100 % et 66 %).
    expect(Array.isArray(syntec.maintienEmployeur.paliers)).toBe(true);
  });
});

// ── Métallurgie (3248) ──
describe.skip("G3 — Métallurgie (IDCC 3248) (à activer après remplissage)", () => {
  const metal = conventions["3248"];
  it("maintien employeur renseigné (barèmes par classes A-I)", () => {
    expect(metal.maintienEmployeur.paliers).toBeDefined();
  });
});

// ── HCR (1979) ──
describe.skip("G3 — HCR (IDCC 1979) (à activer après remplissage)", () => {
  const hcr = conventions["1979"];
  it("maintien employeur non-cadres renseigné", () => {
    expect(hcr.prevoyanceNonCadres).toBeDefined();
  });
});

// ── Bâtiment (1597/1596/2609/2420), Pharmacie (1996), Commerce alim
//    (2216), Transports (16) : même structure à dupliquer au remplissage.
describe.skip("G3 — Autres CCN Tranche 1 (à activer au fil du remplissage)", () => {
  const idccTranche1 = ["1597", "1596", "2609", "2420", "1996", "2216", "16"];
  it("chaque CCN Tranche 1 a un maintien employeur >= légal une fois renseignée", () => {
    for (const idcc of idccTranche1) {
      expect(conventions[idcc]).toBeDefined();
    }
  });
});
