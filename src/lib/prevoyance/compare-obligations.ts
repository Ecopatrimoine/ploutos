// ─── Gap-analysis : obligation de branche (CCN) vs garanties souscrites ───────
//
// Module PUR (LOT COMPARE). Compare, par college et par garantie ASSUREE, ce que
// la branche IMPOSE (ObligationsBranche, cf. obligations-branche.ts) a ce que le
// client a SOUSCRIT (GarantiesSouscrites). MEMES UNITES partout (fractions) :
// AUCUNE conversion ici. Verdicts factuels, SANS nom d'assureur ni produit (DDA).
//
// Ordre de priorite des regles (par garantie) :
//  1. obligation absente (presente=false)            -> non_applicable
//  2. obligation presente mais donneeIndisponible    -> indetermine
//  3. souscrit non renseigne (undefined)             -> indetermine (jamais "insuffisant a 0")
//  4. obligation a mode COMPLEXE (paliers/situations/
//     tranches, renteEducation/renteConjoint)        -> indetermine (comparaison manuelle)
//  5. cas univoques (capitalDC %, ij simple, invalidite cat/cat) -> conforme / insuffisant
//
// Verdict global par college (regle 6) : insuffisant si >=1 insuffisant, sinon
// indetermine si >=1 indetermine, sinon conforme si >=1 conforme, sinon
// non_applicable (jamais "conforme" par absence d'information).

import type { ObligationsBranche, ObligationItem, ObligationGarantie } from "./obligations-branche";
import type { GarantiesSouscrites, GarantiesSouscritesCollege } from "../../types/patrimoine";

export type VerdictGarantie = "conforme" | "insuffisant" | "indetermine" | "non_applicable";

export type ComparaisonItem = {
  garantie: ObligationGarantie;
  verdict: VerdictGarantie;
  motif: string; // factuel, sans assureur ni produit
};

export type ComparaisonCollege = {
  verdictGlobal: VerdictGarantie;
  items: ComparaisonItem[];
};

export type ComparaisonBranche = {
  idcc: string | null;
  cadres: ComparaisonCollege;
  nonCadres: ComparaisonCollege;
};

// Garanties assurees comparees (le maintien employeur n'en est pas une).
const GARANTIES_ASSUREES: ObligationGarantie[] = [
  "capitalDC",
  "renteEducation",
  "renteConjoint",
  "ij",
  "invalidite",
];

const MOTIF_INDISPO = "Obligation de branche non chiffree (donnee manquante).";
const MOTIF_SOUSCRIT_ABSENT = "Garanties souscrites non renseignees.";
const MOTIF_COMPLEXE = "Bareme conventionnel a paliers/situations : comparaison manuelle requise.";
const MOTIF_NON_APPLICABLE = "Aucune obligation de branche sur cette garantie.";

// Nombre francise (virgule), sans conversion.
function n(x: number): string {
  return String(x).replace(".", ",");
}

function v(garantie: ObligationGarantie, verdict: VerdictGarantie, motif: string): ComparaisonItem {
  return { garantie, verdict, motif };
}

function verdictGarantie(item: ObligationItem, souscritCol: GarantiesSouscritesCollege | undefined): ComparaisonItem {
  const g = item.garantie;

  // 1. obligation absente.
  if (!item.presente) return v(g, "non_applicable", MOTIF_NON_APPLICABLE);
  // 2. obligation presente mais non chiffree.
  if (item.donneeIndisponible) return v(g, "indetermine", MOTIF_INDISPO);

  const souscritGarantie = souscritCol ? (souscritCol as Record<string, unknown>)[g] : undefined;
  const comparable = item.comparable;

  // 4 (sous condition de 3) : mode complexe / non comparable.
  if (!comparable || comparable.mode === "complexe") {
    // 3. souscrit non renseigne -> indetermine (prioritaire sur 4).
    if (souscritCol === undefined || souscritGarantie === undefined) {
      return v(g, "indetermine", MOTIF_SOUSCRIT_ABSENT);
    }
    return v(g, "indetermine", MOTIF_COMPLEXE);
  }

  // 5. cas univoques.
  switch (comparable.mode) {
    case "capitalDC_pct": {
      const sv = (souscritGarantie as { tauxSalaireRef?: number } | undefined)?.tauxSalaireRef;
      if (sv === undefined) return v(g, "indetermine", MOTIF_SOUSCRIT_ABSENT);
      return sv >= comparable.tauxSalaireRef
        ? v(g, "conforme", `Capital souscrit ${n(sv)} >= obligation ${n(comparable.tauxSalaireRef)} (fraction du salaire de reference).`)
        : v(g, "insuffisant", `Capital souscrit ${n(sv)} < obligation ${n(comparable.tauxSalaireRef)} (fraction du salaire de reference).`);
    }
    case "ij_simple": {
      const s = souscritGarantie as { pctSalaire?: number; franchiseJours?: number } | undefined;
      const pct = s?.pctSalaire;
      const fr = s?.franchiseJours;
      if (pct === undefined && fr === undefined) return v(g, "indetermine", MOTIF_SOUSCRIT_ABSENT);
      // une seule des deux valeurs renseignee -> comparaison incomplete.
      if (pct === undefined || fr === undefined) {
        return v(g, "indetermine", "IJ : taux OU franchise souscrit manquant — comparaison incomplete.");
      }
      const ok = pct >= comparable.pctSalaire && fr <= comparable.franchiseJours;
      return ok
        ? v(g, "conforme", `IJ souscrites (taux ${n(pct)}, franchise ${fr} j) couvrent l'obligation (taux ${n(comparable.pctSalaire)}, franchise ${comparable.franchiseJours} j).`)
        : v(g, "insuffisant", `IJ souscrites en deca (taux ${n(pct)} vs ${n(comparable.pctSalaire)} ; franchise ${fr} j vs ${comparable.franchiseJours} j).`);
    }
    case "invalidite": {
      const s = souscritGarantie as { cat1?: number; cat2?: number; cat3?: number } | undefined;
      const cats: [keyof typeof comparable & ("cat1" | "cat2" | "cat3"), number][] = [
        ["cat1", comparable.cat1],
        ["cat2", comparable.cat2],
        ["cat3", comparable.cat3],
      ];
      let renseignee = false;
      let insuffisant = false;
      for (const [k, oblig] of cats) {
        const sv = s?.[k];
        if (sv === undefined) continue; // cat manquante -> indetermine pour cette cat (ignoree au verdict garantie)
        renseignee = true;
        if (sv < oblig) insuffisant = true;
      }
      if (!renseignee) return v(g, "indetermine", MOTIF_SOUSCRIT_ABSENT);
      // verdict garantie = pire des cats renseignees.
      return insuffisant
        ? v(g, "insuffisant", "Invalidite : au moins une categorie souscrite est inferieure a l'obligation.")
        : v(g, "conforme", "Invalidite : les categories renseignees couvrent l'obligation.");
    }
  }
}

function verdictGlobal(items: ComparaisonItem[]): VerdictGarantie {
  if (items.some((i) => i.verdict === "insuffisant")) return "insuffisant";
  if (items.some((i) => i.verdict === "indetermine")) return "indetermine";
  if (items.some((i) => i.verdict === "conforme")) return "conforme";
  return "non_applicable"; // tout non_applicable -> aucune obligation a comparer
}

function compareCollege(items: ObligationItem[], souscritCol: GarantiesSouscritesCollege | undefined): ComparaisonCollege {
  const out: ComparaisonItem[] = [];
  for (const g of GARANTIES_ASSUREES) {
    const item = items.find((i) => i.garantie === g);
    if (!item) continue;
    out.push(verdictGarantie(item, souscritCol));
  }
  return { verdictGlobal: verdictGlobal(out), items: out };
}

export function compareObligationsSouscrit(
  obligations: ObligationsBranche,
  souscrit: GarantiesSouscrites | undefined
): ComparaisonBranche {
  return {
    idcc: obligations.idcc,
    cadres: compareCollege(obligations.cadres, souscrit?.cadres),
    nonCadres: compareCollege(obligations.nonCadres, souscrit?.nonCadres),
  };
}
