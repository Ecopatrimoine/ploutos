// ─── LOT SURCOUV — contrats indemnitaire/forfaitaire + sur-couverture ──
//
// Couvre SPEC_PREVOYANCE_SURCOUVERTURE §5 :
//   - contrat indemnitaire qui dépasserait 100 % → borné (cumul = revenuRef)
//   - contrat forfaitaire → non borné (cumul = somme réelle, > 100 % possible)
//   - mix : forfaitaires servis en plein d'abord, indemnitaires comblent
//   - constat de sur-couverture (2 formulations) présent / absent
//   - pas de faux positif dû à l'arrondi ×30 (tolérance 1.001)
//   - G4 adapté : strict pour bornés, tolérant pour forfaitaire
//   - rétrocompatibilité : contrat sans `nature` traité en indemnitaire
//   - DDA : la nouvelle règle ne nomme aucun assureur, passe le filet E
//
// Profil de travail : TNS libéral CARMF (caisse TO_VERIFY → IJ et pension
// obligatoires = 0, pas de maintien employeur) → le déjà-perçu est nul, ce
// qui rend l'arithmétique du bornage déterministe sur le seul revenu de
// référence (revenuTNSAnnuel / 12).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { evaluerToutesLesRegles, regleSurCouvertureContrat } from "../lib/prevoyance/regles";
import { referentiels } from "../data/prevoyance";
import {
  trouveAssureurInterdit,
  REGEX_VERBES_PRESCRIPTIFS,
  actionCommenceParVerbeAnalyse,
} from "../lib/prevoyance/__fixtures__/assureurs-interdits";
import type {
  ContexteRegle,
  EntreePerso,
  ProjectionResult,
} from "../lib/prevoyance/types";

// Revenu de référence = 60 000 / 12 = 5000 € (déjà-perçu nul sur CARMF).
const REVENU_REF = 5000;

function entree(over: Partial<EntreePerso> = {}): EntreePerso {
  return {
    age: 45,
    ageRetraite: 64,
    statutPro: "tns_liberal",
    caisse: "CARMF",
    idccCCN: null,
    ancienneteMois: 0,
    salaireBrutAnnuel: 0,
    salaireNetMensuel: 0,
    revenuTNSAnnuel: 60000,
    contratsIndividuels: [],
    couvertureCollective: null,
    ...over,
  };
}

function idxJour(axe: ProjectionResult["axe"], j: number): number {
  return axe.findIndex((p) => p.jour === j);
}

function totalAtIdx(s: ProjectionResult["series"], i: number): number {
  return (
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i]
  );
}

function ctxFromProjection(e: EntreePerso, projection: ProjectionResult): ContexteRegle {
  return {
    entree: e,
    projection,
    dettesImmobilieres: 0,
    conjointACharge: false,
    enfantsMineurs: 0,
    revenuP1Mensuel: 0,
    revenuP2Mensuel: 0,
  };
}

describe("SURCOUV — moteur : bornage indemnitaire / forfaitaire", () => {
  it("contrat IJ indemnitaire visant > 100 % → borné, cumul = revenu de référence exact", () => {
    // 200 €/j × 30 = 6000 € souhaités > 5000 € de référence.
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijComplementaireIndividuelle[j30]).toBeCloseTo(REVENU_REF, 6);
    expect(totalAtIdx(r.series, j30)).toBeCloseTo(REVENU_REF, 6);
    expect(r.surCouvertureIndemnitaireBornee).toBe(true);
    expect(r.surCouvertureForfaitaire).toBe(false);
  });

  it("contrat IJ forfaitaire → non borné, cumul = somme réelle (> 100 %)", () => {
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijComplementaireIndividuelle[j30]).toBeCloseTo(6000, 6);
    expect(totalAtIdx(r.series, j30)).toBeCloseTo(6000, 6);
    expect(r.surCouvertureForfaitaire).toBe(true);
    expect(r.surCouvertureIndemnitaireBornee).toBe(false);
  });

  it("mix : forfaitaire servi en plein d'abord, indemnitaire comble jusqu'à 100 %", () => {
    // Forfaitaire 80 €/j (=2400) + indemnitaire 200 €/j (=6000), réf 5000.
    // Attendu : 2400 (plein) + min(6000, 5000−2400=2600) = 2600 → total 5000.
    // Si l'ordre était inversé (indemnitaire d'abord), le total serait 7500 :
    // ce test garantit donc bien la priorité du forfaitaire.
    const e = entree({
      contratsIndividuels: [
        { id: "forf", type: "ij", nature: "forfaitaire", capitalOuMontant: 80, franchiseJours: 0, plafondJoursIJ: 1095 },
        { id: "indem", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j30 = idxJour(r.axe, 30);
    expect(r.series.ijComplementaireIndividuelle[j30]).toBeCloseTo(REVENU_REF, 6);
    // L'indemnitaire a été réduit (6000 → 2600) ; le forfaitaire (2400) ne
    // dépasse pas à lui seul 100 % → pas de sur-couverture forfaitaire ici.
    expect(r.surCouvertureIndemnitaireBornee).toBe(true);
    expect(r.surCouvertureForfaitaire).toBe(false);
  });

  it("rétrocompatibilité : contrat sans champ `nature` ≡ indemnitaire", () => {
    const sansNature = projeterArretMaladie(
      entree({ contratsIndividuels: [{ id: "ij", type: "ij", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 }] }),
      "cat2",
      referentiels
    );
    const indemnitaire = projeterArretMaladie(
      entree({ contratsIndividuels: [{ id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 }] }),
      "cat2",
      referentiels
    );
    expect(sansNature.series.ijComplementaireIndividuelle).toEqual(
      indemnitaire.series.ijComplementaireIndividuelle
    );
    expect(sansNature.surCouvertureIndemnitaireBornee).toBe(true);
  });
});

describe("SURCOUV — constat de sur-couverture (règle, 2 formulations)", () => {
  it("forfaitaire > 100 % → constat 'sur_couverture_forfaitaire' (attention)", () => {
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const c = regleSurCouvertureContrat(ctxFromProjection(e, r), "p1");
    expect(c?.id).toBe("sur_couverture_forfaitaire_p1");
    expect(c?.severite).toBe("attention");
    expect(c?.detail).toContain("dépasse 100 %");
  });

  it("indemnitaire borné → constat 'sur_couverture_indemnitaire' (info)", () => {
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const c = regleSurCouvertureContrat(ctxFromProjection(e, r), "p1");
    expect(c?.id).toBe("sur_couverture_indemnitaire_p1");
    expect(c?.severite).toBe("info");
    expect(c?.detail).toContain("indemnitaire");
  });

  it("cumul ≤ 100 % → aucun constat de sur-couverture", () => {
    // 50 €/j × 30 = 1500 € < 5000 € → ni borné ni dépassement.
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 50, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.surCouvertureIndemnitaireBornee).toBe(false);
    expect(r.surCouvertureForfaitaire).toBe(false);
    expect(regleSurCouvertureContrat(ctxFromProjection(e, r), "p1")).toBeNull();
    const constats = evaluerToutesLesRegles(ctxFromProjection(e, r), "p1");
    expect(constats.some((c) => c.id.startsWith("sur_couverture_"))).toBe(false);
  });

  it("cas D (Pierre, SSI, Madelin forfaitaire) → constat forfaitaire à 111 %", () => {
    // IJ SSI ≈ 1975 € + Madelin IJ 3600 € (forfaitaire) = 5575 € = 111 %
    // d'un revenu de référence de 5000 € (cf. SPEC §0 / §2.3).
    const pierre = entree({
      statutPro: "gerant_majoritaire",
      caisse: "SSI",
      contratsIndividuels: [
        { id: "madelin_ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 120, franchiseJours: 30, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(pierre, "cat2", referentiels);
    const j30 = idxJour(r.axe, 30);
    expect(totalAtIdx(r.series, j30)).toBeGreaterThan(REVENU_REF * 1.001);
    expect(r.surCouvertureForfaitaire).toBe(true);
    const c = regleSurCouvertureContrat(ctxFromProjection(pierre, r), "p1");
    expect(c?.id).toBe("sur_couverture_forfaitaire_p1");
  });

  it("pas de faux positif dû à l'arrondi ×30 : forfaitaire calé à ~100 % ne déclenche pas", () => {
    // 166,67 €/j × 30 = 5000,1 € ≈ revenu de référence (écart 0,002 %).
    // La tolérance ×1.001 absorbe l'arrondi → pas de sur-couverture.
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 166.67, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    expect(r.surCouvertureForfaitaire).toBe(false);
    expect(regleSurCouvertureContrat(ctxFromProjection(e, r), "p1")).toBeNull();
  });
});

describe("SURCOUV — G4 adapté (anti-sur-indemnisation nuancé)", () => {
  it("G4 strict pour l'indemnitaire : cumul borné ≤ revenu de référence sur tous les paliers AM", () => {
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    for (const p of r.axe) {
      if (p.jour >= r.basculeInvaliditeJour) continue;
      const i = idxJour(r.axe, p.jour);
      // Cumul jamais au-dessus de 100 % (tolérance d'arrondi) → bornage effectif.
      expect(totalAtIdx(r.series, i)).toBeLessThanOrEqual(REVENU_REF * 1.001);
    }
  });

  it("G4 tolérant pour le forfaitaire : cumul > 100 % LÉGITIME, et seulement via forfaitaire", () => {
    // Cumul > 100 % autorisé uniquement parce qu'un contrat forfaitaire
    // verse en plein — réalité juridique du forfaitaire (SURCOUV §2.4).
    const e = entree({
      contratsIndividuels: [
        { id: "ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 },
      ],
    });
    const r = projeterArretMaladie(e, "cat2", referentiels);
    const j30 = idxJour(r.axe, 30);
    expect(totalAtIdx(r.series, j30)).toBeGreaterThan(REVENU_REF * 1.001);
    expect(r.surCouvertureForfaitaire).toBe(true);
    const aForfaitaire = e.contratsIndividuels.some((c) => c.nature === "forfaitaire");
    expect(aForfaitaire).toBe(true);
  });
});

describe("SURCOUV — DDA : la nouvelle règle passe le filet E", () => {
  it("aucun assureur nommé, action non prescriptive et en verbe d'analyse (deux formulations)", () => {
    const eForf = entree({
      contratsIndividuels: [{ id: "ij", type: "ij", nature: "forfaitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 }],
    });
    const eIndem = entree({
      contratsIndividuels: [{ id: "ij", type: "ij", nature: "indemnitaire", capitalOuMontant: 200, franchiseJours: 0, plafondJoursIJ: 1095 }],
    });
    const constats = [
      regleSurCouvertureContrat(ctxFromProjection(eForf, projeterArretMaladie(eForf, "cat2", referentiels)), "p1"),
      regleSurCouvertureContrat(ctxFromProjection(eIndem, projeterArretMaladie(eIndem, "cat2", referentiels)), "p1"),
    ].filter((c): c is NonNullable<typeof c> => c !== null);
    expect(constats).toHaveLength(2);
    for (const c of constats) {
      expect(trouveAssureurInterdit(c.titre)).toBeNull();
      expect(trouveAssureurInterdit(c.detail)).toBeNull();
      expect(trouveAssureurInterdit(c.action)).toBeNull();
      expect(c.action).not.toMatch(REGEX_VERBES_PRESCRIPTIFS);
      expect(actionCommenceParVerbeAnalyse(c.action)).toBe(true);
    }
  });
});
