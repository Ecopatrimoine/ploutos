// ─── Tests helpers purs Madelin prévoyance (Lot B1) ──────────────────────────
//
// C'est du FISCAL : le plafond et l'agrégation pilotent une future déduction IR.
// On teste l'agrégation (périmètre de types, flag, cloisonnement personne), le
// plafond (socle / courant / cap / négatif), l'enveloppe, l'éligibilité TNS, et
// le garde-fou « pas de PASS en dur ».

import { describe, it, expect } from "vitest";
import {
  sommeCotisationsMadelin,
  detailCotisationsMadelin,
  plafondMadelinPrevoyance,
  enveloppeMadelinPrevoyance,
  estEligibleMadelin,
} from "../lib/prevoyance/madelin";
import type { PatrimonialData } from "../types/patrimoine";

const PASS = 48060;

// Fabriques minimales (cast : on pose librement les champs Madelin).
function ci(id: string, type: string, over: Record<string, unknown> = {}): any {
  return { id, type, capitalOuMontant: 0, ...over };
}
function ctd(id: string, over: Record<string, unknown> = {}): any {
  return { id, libelle: "C", natureAssiette: "capital", capitalTransmis: 0, beneficiaires: [], ...over };
}
function perso(over: Record<string, unknown> = {}): any {
  return { contratsIndividuels: [], contratsTransmissionDeces: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2", ...over };
}
function makeData(over: Partial<PatrimonialData>): PatrimonialData {
  return { ...over } as unknown as PatrimonialData;
}

describe("sommeCotisationsMadelin", () => {
  it("agrège ij + invalidite + transmission marqués + autre cotisation racine", () => {
    const data = makeData({
      prevoyance: {
        version: 1,
        p1: perso({
          contratsIndividuels: [
            ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 }),
            ci("b", "invalidite", { deductibleMadelin: true, cotisationMadelinAnnuelle: 500 }),
          ],
          contratsTransmissionDeces: [
            ctd("t", { deductibleMadelin: true, cotisationMadelinAnnuelle: 300 }),
          ],
        }),
        p2: null,
      },
      madelinAutreCotisation1: 200,
    } as any);
    expect(sommeCotisationsMadelin(data, 1)).toBe(1000 + 500 + 300 + 200); // 2000
  });

  it("IGNORE un contrat non marqué (flag absent ou false)", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [
          ci("a", "ij", { cotisationMadelinAnnuelle: 1000 }),                        // pas de flag
          ci("b", "ij", { deductibleMadelin: false, cotisationMadelinAnnuelle: 999 }), // false
          ci("c", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 400 }),  // compté
        ],
      }), p2: null },
    } as any);
    expect(sommeCotisationsMadelin(data, 1)).toBe(400);
  });

  it("IGNORE les types hors périmètre même marqués (deces_rente_conj, ptia, gav)", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [
          ci("a", "deces_rente_conj", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 }),
          ci("b", "ptia", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 }),
          ci("c", "gav", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 }),
          ci("d", "invalidite", { deductibleMadelin: true, cotisationMadelinAnnuelle: 50 }), // seul compté
        ],
      }), p2: null },
    } as any);
    expect(sommeCotisationsMadelin(data, 1)).toBe(50);
  });

  it("valeurs absentes / non-finite -> 0", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [
          ci("a", "ij", { deductibleMadelin: true }),                                // cotisation absente
          ci("b", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: NaN }), // NaN
        ],
      }), p2: null },
    } as any);
    expect(sommeCotisationsMadelin(data, 1)).toBe(0);
  });

  it("cloisonnement par personne (p1 != p2)", () => {
    const data = makeData({
      prevoyance: { version: 1,
        p1: perso({ contratsIndividuels: [ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 })] }),
        p2: perso({ contratsIndividuels: [ci("b", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 7 })] }),
      },
      madelinAutreCotisation1: 10,
      madelinAutreCotisation2: 3,
    } as any);
    expect(sommeCotisationsMadelin(data, 1)).toBe(1010);
    expect(sommeCotisationsMadelin(data, 2)).toBe(10);
  });

  it("dossier sans prévoyance -> 0 (rétro-compat)", () => {
    expect(sommeCotisationsMadelin(makeData({}), 1)).toBe(0);
  });
});

describe("plafondMadelinPrevoyance", () => {
  it("socle seul (bénéfice 0) -> 7% PASS", () => {
    expect(plafondMadelinPrevoyance(0, PASS)).toBeCloseTo(3364.2, 4); // 0.07 * 48060
  });

  it("cas courant (bénéfice 80 000) -> 7% PASS + 3,75% bénéfice", () => {
    expect(plafondMadelinPrevoyance(80000, PASS)).toBeCloseTo(6364.2, 4); // 3364.2 + 3000
  });

  it("cap atteint (bénéfice très élevé) -> 3% de 8 PASS", () => {
    expect(plafondMadelinPrevoyance(1_000_000, PASS)).toBeCloseTo(11534.4, 4); // 0.03 * 8 * 48060
  });

  it("bénéfice négatif -> clampé à 0 (socle seul)", () => {
    expect(plafondMadelinPrevoyance(-50000, PASS)).toBeCloseTo(3364.2, 4);
  });
});

describe("enveloppeMadelinPrevoyance", () => {
  it("sous le plafond : tout déductible, pas de dépassement", () => {
    const e = enveloppeMadelinPrevoyance(4000, 6364.2);
    expect(e.deductible).toBe(4000);
    expect(e.depassement).toBe(0);
    expect(e.depasse).toBe(false);
  });

  it("au-dessus du plafond : déductible = plafond, dépassement > 0", () => {
    const e = enveloppeMadelinPrevoyance(8000, 6364.2);
    expect(e.deductible).toBeCloseTo(6364.2, 4);
    expect(e.depassement).toBeCloseTo(8000 - 6364.2, 4);
    expect(e.depasse).toBe(true);
  });

  it("égalité : pas de dépassement", () => {
    const e = enveloppeMadelinPrevoyance(6364.2, 6364.2);
    expect(e.deductible).toBeCloseTo(6364.2, 4);
    expect(e.depassement).toBe(0);
    expect(e.depasse).toBe(false);
  });
});

describe("estEligibleMadelin", () => {
  function withStatut(p1Statut: string, p2Statut?: string): PatrimonialData {
    return makeData({
      travail: {
        p1: { statutPro: p1Statut } as any,
        p2: p2Statut !== undefined ? ({ statutPro: p2Statut } as any) : null,
      } as any,
    } as any);
  }

  it("statut TNS -> true", () => {
    expect(estEligibleMadelin(withStatut("tns_liberal"), 1)).toBe(true);
    expect(estEligibleMadelin(withStatut("tns_commercant"), 1)).toBe(true);
    expect(estEligibleMadelin(withStatut("gerant_majoritaire"), 1)).toBe(true);
  });

  it("salarié / président SAS -> false", () => {
    expect(estEligibleMadelin(withStatut("salarie_cadre"), 1)).toBe(false);
    expect(estEligibleMadelin(withStatut("president_sas"), 1)).toBe(false);
  });

  it("statut vide ou travail absent -> false", () => {
    expect(estEligibleMadelin(withStatut(""), 1)).toBe(false);
    expect(estEligibleMadelin(makeData({}), 1)).toBe(false);
  });

  it("cloisonnement par personne", () => {
    const d = withStatut("salarie_cadre", "tns_artisan");
    expect(estEligibleMadelin(d, 1)).toBe(false);
    expect(estEligibleMadelin(d, 2)).toBe(true);
  });
});

describe("garde-fou : aucun PASS en dur", () => {
  it("le plafond change si on passe un autre PASS", () => {
    const avec48060 = plafondMadelinPrevoyance(0, 48060); // 3364.2
    const avec50000 = plafondMadelinPrevoyance(0, 50000); // 3500
    expect(avec50000).not.toBeCloseTo(avec48060, 1);
    expect(avec50000).toBeCloseTo(3500, 4); // 0.07 * 50000
  });
});

describe("detailCotisationsMadelin", () => {
  it("détaille ij + invalidite + transmission marqués (libellés + montants), ignore le reste", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [
          ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 }),
          ci("b", "invalidite", { deductibleMadelin: true, cotisationMadelinAnnuelle: 500 }),
          ci("c", "gav", { deductibleMadelin: true, cotisationMadelinAnnuelle: 999 }), // hors périmètre -> ignoré
          ci("d", "ij", { cotisationMadelinAnnuelle: 999 }),                            // non marqué -> ignoré
        ],
        contratsTransmissionDeces: [ctd("t", { libelle: "Temporaire décès", deductibleMadelin: true, cotisationMadelinAnnuelle: 300 })],
      }), p2: null },
    } as any);
    const detail = detailCotisationsMadelin(data, 1);
    expect(detail.map((l) => l.montant)).toEqual([1000, 500, 300]);
    expect(detail[0].libelle).toMatch(/IJ|journalières/i);
    expect(detail[2].libelle).toBe("Temporaire décès");
  });

  it("vide si aucune cotisation marquée / pas de prévoyance", () => {
    expect(detailCotisationsMadelin(makeData({}), 1)).toEqual([]);
  });

  it("COHÉRENCE : somme === Σ(détail) + autre cotisation", () => {
    const data = makeData({
      prevoyance: { version: 1, p1: perso({
        contratsIndividuels: [ci("a", "ij", { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 })],
        contratsTransmissionDeces: [ctd("t", { deductibleMadelin: true, cotisationMadelinAnnuelle: 300 })],
      }), p2: null },
      madelinAutreCotisation1: 200,
    } as any);
    const detailTotal = detailCotisationsMadelin(data, 1).reduce((s, l) => s + l.montant, 0);
    expect(sommeCotisationsMadelin(data, 1)).toBe(detailTotal + 200);
    expect(sommeCotisationsMadelin(data, 1)).toBe(1500);
  });
});
