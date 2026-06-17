// ─── Tests vue partagee obligations + gap (LOT 1) ─────────────────────────────
// Contre-epreuves de resolveComparaisonBranche / mapBrancheEnVue. Independantes de
// l'interne des comparateurs : on PEUT lire la sortie de resolveObligationsBranche
// pour piloter les entrees souscrites, JAMAIS l'interne de compare.

import { describe, it, expect } from "vitest";
import {
  resolveComparaisonBranche,
  mapBrancheEnVue,
  type CollegeVue,
} from "../lib/prevoyance/comparaison-branche-vue";
import type { ObligationsBranche, ObligationItem } from "../lib/prevoyance/obligations-branche";
import type { ComparaisonBranche } from "../lib/prevoyance/compare-obligations";
import { referentiels } from "../data/prevoyance";
import type { EntrepriseAudit } from "../types/patrimoine";

const REGEX_ASSUREURS = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut/i;

function ent(partial: Partial<EntrepriseAudit>): EntrepriseAudit {
  return {
    siret: null,
    nom: null,
    formeJuridique: null,
    effectif: null,
    idccCCN: null,
    nomCCN: null,
    codeNAF: null,
    santeCollectiveEnPlace: false,
    participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false,
    tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false,
    categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
    ...partial,
  };
}

function college(vue: ReturnType<typeof mapBrancheEnVue>, libelle: "Cadres" | "Non-cadres"): CollegeVue | undefined {
  return vue.colleges.find((c) => c.libelle === libelle);
}
function ligne(col: CollegeVue | undefined, garantie: string) {
  return col?.lignes.find((l) => l.garantie === garantie);
}

// ─── 1. Syntec, souscrit absent -> indetermine partout, vue rendue par college ──

describe("resolveComparaisonBranche + mapBrancheEnVue — Syntec 1486", () => {
  it("souscrit undefined -> garanties comparables indetermine (motif souscrit absent)", () => {
    const vue = mapBrancheEnVue(resolveComparaisonBranche(ent({ idccCCN: "1486" }), referentiels));
    const cadres = college(vue, "Cadres");
    expect(cadres).toBeDefined();
    expect(cadres!.lignes.length).toBeGreaterThan(0);
    for (const g of ["capitalDC", "ij", "invalidite"]) {
      const l = ligne(cadres, g);
      expect(l?.verdict).toBe("indetermine");
      expect(l?.motif).toMatch(/non renseignees|souscrites/i);
    }
    // maintien employeur : jamais compare -> non_applicable (left-join sans match)
    expect(ligne(cadres, "maintienEmployeur")?.verdict).toBe("non_applicable");
  });

  // ─── 2. Capital DC pilote depuis l'obligation reelle -> insuffisant / conforme ─

  it("capitalDC souscrit < obligation -> insuffisant ; egal/superieur -> conforme", () => {
    const { obligations } = resolveComparaisonBranche(ent({ idccCCN: "1486" }), referentiels);
    const oblig = obligations.cadres.find((i) => i.garantie === "capitalDC");
    expect(oblig?.comparable?.mode).toBe("capitalDC_pct");
    const seuil = oblig?.comparable?.mode === "capitalDC_pct" ? oblig.comparable.tauxSalaireRef : NaN;
    expect(Number.isFinite(seuil)).toBe(true);

    const verdictPour = (taux: number) => {
      const vue = mapBrancheEnVue(
        resolveComparaisonBranche(
          ent({ idccCCN: "1486", garantiesSouscrites: { cadres: { capitalDC: { tauxSalaireRef: taux } } } }),
          referentiels
        )
      );
      return ligne(college(vue, "Cadres"), "capitalDC")?.verdict;
    };

    expect(verdictPour(seuil - 0.5)).toBe("insuffisant");
    expect(verdictPour(seuil)).toBe("conforme");
    expect(verdictPour(seuil + 0.5)).toBe("conforme");
  });
});

// ─── 3. BTP 1596 capital DC situation familiale -> indetermine (manuelle) ───────

describe("barème complexe — BTP 1596 capital DC situation familiale", () => {
  it("souscrit renseigne mais bareme complexe -> indetermine + motif comparaison manuelle", () => {
    const vue = mapBrancheEnVue(
      resolveComparaisonBranche(
        ent({ idccCCN: "1596", garantiesSouscrites: { nonCadres: { capitalDC: { tauxSalaireRef: 2.5 } } } }),
        referentiels
      )
    );
    const l = ligne(college(vue, "Non-cadres"), "capitalDC");
    expect(l?.verdict).toBe("indetermine");
    expect(l?.motif).toMatch(/manuelle|paliers|situations/i);
  });
});

// ─── 4. idcc absent -> etat propre, pas de crash ────────────────────────────────

describe("idcc absent", () => {
  it("idccCCN null -> statut idcc_absent, colleges vides, tauxT1/sante null", () => {
    const vue = mapBrancheEnVue(resolveComparaisonBranche(ent({ idccCCN: null }), referentiels));
    expect(vue.statut).toBe("idcc_absent");
    expect(vue.statutLabel).toBe("Aucune convention de branche renseignee");
    expect(vue.colleges).toEqual([]);
    expect(vue.tauxT1).toBeNull();
    expect(vue.sante).toBeNull();
  });
});

// ─── 5. mapBrancheEnVue pur : omission college vide + avertissement incomplet ───

describe("mapBrancheEnVue — presentation", () => {
  function res(statut: ObligationsBranche["statut"]): { obligations: ObligationsBranche; comparaison: ComparaisonBranche } {
    const item: ObligationItem = {
      garantie: "capitalDC",
      presente: true,
      resume: "Capital deces : 1,5x salaire de reference",
      source: "ccn",
      donneeIndisponible: false,
    };
    return {
      obligations: {
        statut,
        idcc: "TEST",
        nomCCN: "Convention synthetique",
        cadres: [], // <- liste vide : doit etre OMISE
        nonCadres: [item],
        tauxT1Minimum: { taux: 1.5, source: "ccn", donneeIndisponible: false },
        santeMinimum: {
          presente: false,
          regimeBranche: null,
          panier: null,
          donneeIndisponible: false,
          resume: "Aucun regime sante de branche documente",
        },
      },
      comparaison: {
        idcc: "TEST",
        cadres: { verdictGlobal: "non_applicable", items: [] },
        nonCadres: {
          verdictGlobal: "indetermine",
          items: [{ garantie: "capitalDC", verdict: "indetermine", motif: "Garanties souscrites non renseignees." }],
        },
      },
    };
  }

  it("un college a liste vide est OMIS ; donnees_incompletes -> avertissement + verdictGlobalLabel", () => {
    const vue = mapBrancheEnVue(res("donnees_incompletes"));
    expect(vue.colleges.map((c) => c.libelle)).toEqual(["Non-cadres"]); // Cadres omis
    expect(vue.afficherAvertissementIncomplet).toBe(true);
    const nc = college(vue, "Non-cadres");
    expect(nc?.verdictGlobal).toBe("indetermine");
    expect(nc?.verdictGlobalLabel).toBe("A etudier"); // relabel LOT 4 (indetermine -> "A etudier")
  });

  it("branche_documentee -> pas d'avertissement incomplet", () => {
    const vue = mapBrancheEnVue(res("branche_documentee"));
    expect(vue.afficherAvertissementIncomplet).toBe(false);
  });
});

// ─── 6. Conformite DDA : aucun libelle/motif ne nomme un assureur ───────────────

describe("conformite DDA", () => {
  it("aucun libelle/motif de la vue ne matche un nom d'assureur", () => {
    const vue = mapBrancheEnVue(
      resolveComparaisonBranche(
        ent({
          idccCCN: "1486",
          garantiesSouscrites: { cadres: { capitalDC: { tauxSalaireRef: 1.0 }, ij: { pctSalaire: 0.5, franchiseJours: 120 } } },
        }),
        referentiels
      )
    );
    const textes: string[] = [vue.statutLabel, vue.tauxT1?.label ?? "", vue.sante?.label ?? ""];
    for (const col of vue.colleges) {
      textes.push(col.verdictGlobalLabel);
      for (const l of col.lignes) {
        textes.push(l.garantieLabel, l.obligationResume, l.verdictLabel, l.motif);
      }
    }
    for (const t of textes) {
      expect(t).not.toMatch(REGEX_ASSUREURS);
    }
  });
});
