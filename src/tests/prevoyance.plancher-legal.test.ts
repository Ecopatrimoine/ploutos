// ─── LOT 1a-iii — Plancher légal sur le maintien employeur ──────────────────
//
// Le maintien réel = max(CCN, légal) JOUR PAR JOUR : la Mensualisation
// (L.1226-1 C. trav.) est d'ordre public social — une CCN peut faire mieux,
// jamais moins ; le salarié bénéficie du plus favorable poste par poste.
//
// Deux preuves :
//   1) ISO-COMPORTEMENT : aucune CCN remplie → max(CCN, légal) == légal, au
//      centime → AUCUN montant ne change en prod.
//   2) MAX() : avec une CCN FICTIVE de test (idcc bidon, référentiel DÉRIVÉ par
//      copie — jamais 1486 ni un fichier de prod), le taux suit bien le max
//      jour par jour, et le maintien ne tombe PAS à 0 tant que le légal court.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie, getMaintienParams } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";

// Référence légale (Mensualisation) reproduite côté test, comme en 1a-i.
const CARENCE_LEGALE = 7;
const TAUX_PLEIN_LEGAL = 0.9;
const TAUX_PARTIEL_LEGAL = 2 / 3;

// Palier légal applicable (ccn-2026.json maintienLegal) : ancienneté → durées
// [plein, partiel] en jours.
function refPalierLegal(ancienneteMois: number): { plein: number; partiel: number } | null {
  if (ancienneteMois >= 372) return { plein: 90, partiel: 90 };
  if (ancienneteMois >= 312) return { plein: 80, partiel: 80 };
  if (ancienneteMois >= 252) return { plein: 70, partiel: 70 };
  if (ancienneteMois >= 192) return { plein: 60, partiel: 60 };
  if (ancienneteMois >= 132) return { plein: 50, partiel: 50 };
  if (ancienneteMois >= 72) return { plein: 40, partiel: 40 };
  if (ancienneteMois >= 12) return { plein: 30, partiel: 30 };
  return null; // moins d'un an → pas de maintien légal
}

function tauxLegalJour(jour: number, pal: { plein: number; partiel: number } | null): number {
  if (!pal || jour < CARENCE_LEGALE) return 0;
  const tEff = jour - CARENCE_LEGALE;
  if (tEff < pal.plein) return TAUX_PLEIN_LEGAL;
  if (tEff < pal.plein + pal.partiel) return TAUX_PARTIEL_LEGAL;
  return 0;
}

function baseEntree(over: Partial<EntreePerso>): EntreePerso {
  return {
    age: 40, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: null, ancienneteMois: 120, salaireBrutAnnuel: 60000,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    ...over,
  };
}

describe("LOT 1a-iii — plancher légal : iso-comportement (aucune CCN remplie)", () => {
  it("maintien avec plancher == maintien légal seul, au centime (anciennetés 0..240)", () => {
    let vuPositif = false;
    for (const ancienneteMois of [0, 6, 12, 60, 120, 240]) {
      const r = projeterArretMaladie(baseEntree({ ancienneteMois }), "cat2", referentiels);
      const pal = refPalierLegal(ancienneteMois);
      for (let i = 0; i < r.axe.length; i++) {
        if (r.axe[i].phase !== "am") continue; // le maintien n'existe qu'en phase AM
        const taux = tauxLegalJour(r.axe[i].jour, pal);
        const attendu = Math.max(0, r.revenuReferenceMensuel * taux - r.series.ijObligatoire[i]);
        expect(r.series.maintienEmployeur[i]).toBeCloseTo(attendu, 2);
        if (r.series.maintienEmployeur[i] > 0) vuPositif = true;
      }
    }
    // Garde-fou : le test n'est pas vacant — au moins un maintien > 0 observé.
    expect(vuPositif).toBe(true);
  });
});

// CCN FICTIVE de test : carence 0, cadres = 20 jours à 100 % SEULEMENT (fenêtre
// courte, taux élevé). Injectée dans un référentiel DÉRIVÉ par copie ; l'objet
// `referentiels` d'origine n'est jamais muté et aucun fichier de prod ne connaît
// cet idcc bidon (cf. pattern cobaye _TEST_TOFILL).
const IDCC_TEST = "_TEST_FLOOR";

function makeRefAvecCcnTest(): typeof referentiels {
  const ccn = referentiels.ccn as any;
  return {
    ...referentiels,
    ccn: {
      ...ccn,
      conventions: {
        ...ccn.conventions,
        [IDCC_TEST]: {
          idcc: IDCC_TEST,
          nom: "CCN fictive de test (plancher 1a-iii)",
          maintienEmployeur: {
            cadres: {
              carenceJours: 0,
              subrogation: false,
              paliers: [{ ancienneteMois: 12, segments: [{ jours: 20, pct: 100 }] }],
            },
            nonCadres: null,
          },
        },
      },
    },
  } as typeof referentiels;
}

describe("LOT 1a-iii — plancher légal : max(CCN, légal) jour par jour (CCN fictive)", () => {
  const refTest = makeRefAvecCcnTest();

  it("max() jour par jour : CCN gagne tôt, le légal relaie ensuite (pas de chute à 0)", () => {
    // Sanity : la CCN fictive est documentée (source "ccn") dans le réf dérivé,
    // et l'original n'est pas pollué (idcc inconnu → "legal").
    expect(getMaintienParams(IDCC_TEST, refTest, "cadres").source).toBe("ccn");
    expect(getMaintienParams(IDCC_TEST, referentiels, "cadres").source).toBe("legal");

    // Salarié CADRE, ancienneté 120 mois → palier légal 72 : carence 7, 40 j à
    // 90 % (j7→47) puis 40 j à 66,66 % (j47→87). CCN cadres : carence 0, 20 j à
    // 100 % (j0→20).
    const eCcn = baseEntree({ statutPro: "salarie_cadre", idccCCN: IDCC_TEST, ancienneteMois: 120 });
    const r = projeterArretMaladie(eCcn, "cat2", refTest);
    // Comparateur LÉGAL SEUL : même salarié, sans idcc.
    const rLegal = projeterArretMaladie(
      baseEntree({ statutPro: "salarie_cadre", ancienneteMois: 120 }),
      "cat2",
      refTest
    );

    const at = (res: typeof r, jour: number) => res.axe.findIndex((p) => p.jour === jour);
    const ref = r.revenuReferenceMensuel;

    // (a) Pendant la CARENCE légale (j3) : la CCN (carence 0, 100 %) couvre déjà,
    // alors que le légal seul est à 0 → le max joue dès le 1er jour.
    const i3 = at(r, 3), i3L = at(rLegal, 3);
    expect(r.series.maintienEmployeur[i3]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[i3]).toBeCloseTo(
      Math.max(0, ref * 1.0 - r.series.ijObligatoire[i3]), 2
    );
    expect(rLegal.series.maintienEmployeur[i3L]).toBe(0);

    // (b) Sur la fenêtre CCN (j14) : taux = max(100 % CCN, 90 % légal) = 100 %,
    // STRICTEMENT supérieur au légal seul.
    const i14 = at(r, 14), i14L = at(rLegal, 14);
    expect(r.series.maintienEmployeur[i14]).toBeCloseTo(
      Math.max(0, ref * 1.0 - r.series.ijObligatoire[i14]), 2
    );
    expect(r.series.maintienEmployeur[i14]).toBeGreaterThan(rLegal.series.maintienEmployeur[i14L]);

    // (c) Hors fenêtre CCN (finie à j20) mais SOUS la durée légale (j30) : le
    // maintien ne tombe PAS à 0 — relais au taux légal 90 % = légal seul.
    const i30 = at(r, 30), i30L = at(rLegal, 30);
    expect(r.series.maintienEmployeur[i30]).toBeGreaterThan(0);
    expect(r.series.maintienEmployeur[i30]).toBeCloseTo(
      Math.max(0, ref * TAUX_PLEIN_LEGAL - r.series.ijObligatoire[i30]), 2
    );
    expect(r.series.maintienEmployeur[i30]).toBeCloseTo(rLegal.series.maintienEmployeur[i30L], 2);

    // (d) Toujours sous la durée légale (j60, segment 66,66 %) : relais confirmé.
    const i60 = at(r, 60);
    expect(r.series.maintienEmployeur[i60]).toBeCloseTo(
      Math.max(0, ref * TAUX_PARTIEL_LEGAL - r.series.ijObligatoire[i60]), 2
    );
  });
});
