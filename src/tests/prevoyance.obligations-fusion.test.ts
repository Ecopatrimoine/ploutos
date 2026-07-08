// ─── Tests vue fusionnee obligations (LOT 4) ──────────────────────────────────
// Fusion cadres/nonCadres par garantie + relabel "A etudier" + etat vide +
// synthese. Independants de l'interne des comparateurs : on lit la sortie de la
// vue, jamais l'interne de compare. Les tests des Lots 1-3 restent verts.

import { describe, it, expect } from "vitest";
import {
  buildVueObligationsFusionnee,
  fusionnerColleges,
  type ComparaisonBrancheVue,
  type LigneGarantieVue,
  type ValeurFusionnee,
} from "../lib/prevoyance/comparaison-branche-vue";
import { referentiels } from "../data/prevoyance";
import type { EntrepriseAudit } from "../types/patrimoine";

const REGEX_ASSUREURS = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut/i;

function ent(partial: Partial<EntrepriseAudit>): EntrepriseAudit {
  return {
    siret: null, nom: null, formeJuridique: null, effectif: null,
    idccCCN: null, nomCCN: null, codeNAF: null,
    santeCollectiveEnPlace: false, participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false, tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false, categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
    ...partial,
  };
}

// Aplati une ValeurFusionnee (ou null) en chaines, pour les assertions DDA.
function chaines(v: ValeurFusionnee | null): string[] {
  if (!v) return [];
  return "commun" in v ? [v.commun] : [v.cadres, v.nonCadres];
}

// ─── 1. Fusion par garantie : parCollege vs commun, reference, non prevue ──────

describe("fusionnerColleges — Syntec 1486", () => {
  it("1. capitalDC differe par college -> parCollege ; rente educ/IJ/inval communs ; maintien=reference ; renteConjoint non prevue", () => {
    const vue = buildVueObligationsFusionnee(ent({ idccCCN: "1486" }), referentiels);
    const byG = (g: string) => vue.lignes.find((l) => l.garantie === g);

    const cap = byG("capitalDC");
    expect(cap).toBeDefined();
    // min PASS cadres (3,4) != non-cadres (1,7) -> obligation eclatee
    expect("cadres" in cap!.obligation && "nonCadres" in cap!.obligation).toBe(true);

    for (const g of ["renteEducation", "ij", "invalidite"]) {
      expect("commun" in byG(g)!.obligation).toBe(true);
    }

    const maintien = byG("maintienEmployeur");
    expect(maintien?.estReference).toBe(true);
    expect(maintien?.verdict).toBeNull();
    expect(maintien?.verdictLabel).toBeNull();

    // renteConjoint non prevue par Syntec -> absente des lignes, dans nonPrevues
    expect(byG("renteConjoint")).toBeUndefined();
    expect(vue.nonPrevues.some((n) => n.garantie === "renteConjoint")).toBe(true);
  });

  // ─── 2. Relabel "A etudier" ──────────────────────────────────────────────────

  it("2. relabel : un verdict indetermine rend 'A etudier', jamais 'Indetermine'", () => {
    const vue = buildVueObligationsFusionnee(ent({ idccCCN: "1486" }), referentiels);
    const labels = vue.lignes.flatMap((l) => chaines(l.verdictLabel));
    expect(labels).toContain("À étudier");
    expect(labels).not.toContain("Indetermine");
  });

  // ─── 3. Souscrit absent : pas de comparaison, mais obligations presentes ──────

  it("3. souscrit absent -> souscritRenseigne/afficherComparaison false, synthese null, lignes presentes", () => {
    const vue = buildVueObligationsFusionnee(ent({ idccCCN: "1486" }), referentiels);
    expect(vue.souscritRenseigne).toBe(false);
    expect(vue.afficherComparaison).toBe(false);
    expect(vue.synthese).toBeNull();
    expect(vue.lignes.length).toBeGreaterThan(0); // la branche, elle, est documentee
  });
});

// ─── 4. Synthese : pire verdict du croisement cadres/nonCadres ─────────────────

describe("fusionnerColleges — synthese", () => {
  function ligneVue(
    garantie: LigneGarantieVue["garantie"],
    verdict: LigneGarantieVue["verdict"],
    verdictLabel: string
  ): LigneGarantieVue {
    return {
      garantie,
      garantieLabel: garantie,
      obligationResume: `obligation ${garantie}`,
      presente: true,
      donneeIndisponible: false,
      verdict,
      verdictLabel,
      motif: "",
    };
  }

  it("4. une garantie insuffisante, une conforme, une A etudier -> {1,1,1} (pire verdict si split)", () => {
    const vue: ComparaisonBrancheVue = {
      statut: "branche_documentee",
      statutLabel: "x",
      afficherAvertissementIncomplet: false,
      souscritRenseigne: true,
      idcc: "T",
      nomCCN: "T",
      colleges: [
        {
          libelle: "Cadres",
          verdictGlobal: "insuffisant",
          verdictGlobalLabel: "Insuffisant",
          lignes: [
            ligneVue("capitalDC", "conforme", "Conforme"),
            ligneVue("ij", "insuffisant", "Insuffisant"), // split : non-cadres conforme
            ligneVue("invalidite", "indetermine", "A etudier"),
          ],
        },
        {
          libelle: "Non-cadres",
          verdictGlobal: "conforme",
          verdictGlobalLabel: "Conforme",
          lignes: [
            ligneVue("capitalDC", "conforme", "Conforme"),
            ligneVue("ij", "conforme", "Conforme"),
            ligneVue("invalidite", "indetermine", "A etudier"),
          ],
        },
      ],
      tauxT1: null,
      sante: null,
    };
    const f = fusionnerColleges(vue);
    expect(f.afficherComparaison).toBe(true);
    expect(f.synthese).toEqual({ conformes: 1, insuffisants: 1, aEtudier: 1 });
    // ij split -> pire verdict insuffisant retenu
    const ij = f.lignes.find((l) => l.garantie === "ij");
    expect(ij?.verdict).toEqual({ cadres: "insuffisant", nonCadres: "conforme" });
  });
});

// ─── 5. Etat vide (idcc absent) ────────────────────────────────────────────────

describe("fusionnerColleges — etats vides", () => {
  it("5. idcc_absent -> lignes [], nonPrevues [], synthese null, afficherComparaison false, pas de crash", () => {
    const vue = buildVueObligationsFusionnee(ent({ idccCCN: null }), referentiels);
    expect(vue.statut).toBe("idcc_absent");
    expect(vue.lignes).toEqual([]);
    expect(vue.nonPrevues).toEqual([]);
    expect(vue.synthese).toBeNull();
    expect(vue.afficherComparaison).toBe(false);
  });
});

// ─── 6. Conformite DDA ─────────────────────────────────────────────────────────

describe("fusionnerColleges — conformite DDA", () => {
  it("6. aucune chaine produite ne nomme un assureur", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: { cadres: { capitalDC: { tauxSalaireRef: 1.0 }, ij: { pctSalaire: 0.5, franchiseJours: 120 } } },
      }),
      referentiels
    );
    const textes: string[] = [vue.statutLabel];
    for (const n of vue.nonPrevues) textes.push(n.garantieLabel);
    for (const l of vue.lignes) {
      textes.push(l.garantieLabel);
      textes.push(...chaines(l.obligation), ...chaines(l.verdictLabel), ...chaines(l.motif), ...chaines(l.souscrit));
    }
    for (const t of textes) {
      expect(t).not.toMatch(REGEX_ASSUREURS);
    }
  });
});

// ─── Colonne "Souscrit" chiffree (LOT 4bis) ────────────────────────────────────

describe("colonne souscrit — formatSouscritResume via la fusion", () => {
  const byG = (vue: ReturnType<typeof buildVueObligationsFusionnee>, g: string) =>
    vue.lignes.find((l) => l.garantie === g);

  it("1. capitalDC souscrit < obligation -> souscrit en multiple miroir, verdict insuffisant", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { capitalDC: { tauxSalaireRef: 1.2 } },
          nonCadres: { capitalDC: { tauxSalaireRef: 1.2 } },
        },
      }),
      referentiels
    );
    const cap = byG(vue, "capitalDC");
    // unite affichee = multiple du salaire de reference (comme l'obligation)
    expect(cap?.souscrit).toEqual({ commun: "1,2x salaire de reference" });
    expect(cap?.verdict).toEqual({ commun: "insuffisant" }); // 1,2 < 1,7
  });

  it("2. ij souscrit = obligation -> souscrit '80 % (franchise 90 j)', verdict conforme", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { ij: { pctSalaire: 0.8, franchiseJours: 90 } },
          nonCadres: { ij: { pctSalaire: 0.8, franchiseJours: 90 } },
        },
      }),
      referentiels
    );
    const ij = byG(vue, "ij");
    expect(ij?.souscrit).toEqual({ commun: "80 % (franchise 90 j)" });
    expect(ij?.verdict).toEqual({ commun: "conforme" });
  });

  it("3. invalidite cat souscrites -> souscrit miroir 'cat1 .. cat2 .. cat3 ..'", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { invalidite: { cat1: 0.4, cat2: 0.8, cat3: 0.8 } },
          nonCadres: { invalidite: { cat1: 0.4, cat2: 0.8, cat3: 0.8 } },
        },
      }),
      referentiels
    );
    const inv = byG(vue, "invalidite");
    expect(inv?.souscrit).toEqual({ commun: "cat1 40 %, cat2 80 %, cat3 80 %" });
    expect(inv?.verdict).toEqual({ commun: "conforme" });
  });

  it("4. renteEducation souscrite renseignee -> souscrit reste null (complexe, non comparee)", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { renteEducation: { tauxSalaireRefParEnfant: 0.15 } },
          nonCadres: { renteEducation: { tauxSalaireRefParEnfant: 0.15 } },
        },
      }),
      referentiels
    );
    const re = byG(vue, "renteEducation");
    expect(re).toBeDefined();
    expect(re?.souscrit).toBeNull();
  });

  it("5. souscrit different entre colleges -> souscrit { cadres, nonCadres }", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { capitalDC: { tauxSalaireRef: 1.0 } },
          nonCadres: { capitalDC: { tauxSalaireRef: 1.5 } },
        },
      }),
      referentiels
    );
    const cap = byG(vue, "capitalDC");
    expect(cap?.souscrit).toEqual({ cadres: "1x salaire de reference", nonCadres: "1,5x salaire de reference" });
  });

  it("6. garantiesSouscrites undefined -> souscrit null partout, afficherComparaison false (inchange Lot 4)", () => {
    const vue = buildVueObligationsFusionnee(ent({ idccCCN: "1486" }), referentiels);
    expect(vue.afficherComparaison).toBe(false);
    for (const l of vue.lignes) {
      expect(l.souscrit).toBeNull();
    }
  });

  it("7. DDA : aucune chaine souscrit/obligation/verdict ne nomme un assureur", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: {
            capitalDC: { tauxSalaireRef: 1.0 },
            ij: { pctSalaire: 0.5, franchiseJours: 120 },
            invalidite: { cat1: 0.3, cat2: 0.5, cat3: 0.5 },
          },
        },
      }),
      referentiels
    );
    const textes: string[] = [];
    for (const l of vue.lignes) {
      textes.push(...chaines(l.obligation), ...chaines(l.souscrit), ...chaines(l.verdictLabel), ...chaines(l.motif));
    }
    for (const t of textes) {
      expect(t).not.toMatch(REGEX_ASSUREURS);
    }
  });

  // ─── LOT 9 — correctifs de rendu ──────────────────────────────────────────

  it("CORRECTIF 1 : souscrit renseigne d'un seul cote -> split avec 'non renseigne'", () => {
    // capitalDC souscrit cadres uniquement (1.5) ; nonCadres absent.
    // Obligation Syntec 2,00 sur les 2 colleges -> cadres insuffisant (1,5 < 2,00),
    // nonCadres indetermine (souscrit absent) -> verdict split -> souscrit DOIT etre split.
    const vue = buildVueObligationsFusionnee(
      ent({ idccCCN: "1486", garantiesSouscrites: { cadres: { capitalDC: { tauxSalaireRef: 1.5 } } } }),
      referentiels
    );
    const cap = vue.lignes.find((l) => l.garantie === "capitalDC");
    expect(cap?.souscrit).toEqual({ cadres: "1,5x salaire de reference", nonCadres: "non renseigne" });
    expect(cap?.verdict).toEqual({ cadres: "insuffisant", nonCadres: "indetermine" }); // coherence
  });

  it("CORRECTIF 1 : souscrit identique des deux cotes -> reste { commun } (pas de regression)", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { capitalDC: { tauxSalaireRef: 1.2 } },
          nonCadres: { capitalDC: { tauxSalaireRef: 1.2 } },
        },
      }),
      referentiels
    );
    const cap = vue.lignes.find((l) => l.garantie === "capitalDC");
    expect(cap?.souscrit).toEqual({ commun: "1,2x salaire de reference" });
  });

  it("CORRECTIF 2 : invalidite cat3 souscrite 1.10 -> 'cat3 110 %' (pas '110,00 %')", () => {
    const vue = buildVueObligationsFusionnee(
      ent({
        idccCCN: "1486",
        garantiesSouscrites: {
          cadres: { invalidite: { cat1: 0.4, cat2: 0.8, cat3: 1.1 } },
          nonCadres: { invalidite: { cat1: 0.4, cat2: 0.8, cat3: 1.1 } },
        },
      }),
      referentiels
    );
    const inv = vue.lignes.find((l) => l.garantie === "invalidite");
    expect(inv?.souscrit).toEqual({ commun: "cat1 40 %, cat2 80 %, cat3 110 %" });
  });
});
