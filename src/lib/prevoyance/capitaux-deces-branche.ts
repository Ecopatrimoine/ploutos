// ─── Résolveur du CAPITAL DÉCÈS de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) ────
//
// Module PUR (LOT DECES-A) : résout, pour UNE personne salariée, le capital
// décès minimum garanti par sa convention collective (idccCCN + catégorie
// cadre/non-cadre). Donnée de RÉFÉRENCE destinée au module succession —
// EXONÉRÉE (contrat de groupe professionnel, art. 998 CGI, hors 990 I).
// N'alimente PAS les 9 séries de projection (comme capitaux-deces.ts).
//
// Aucune valeur en dur : tout vient de ccn-2026.json + du PASS du référentiel.
// Toute donnée absente / null (prévoyanceNonCadres non documentée) /
// "TO_VERIFY" / mode inconnu → capital null + donneeIndisponible. JAMAIS une
// valeur inventée, JAMAIS d'exception.

import type { Referentiels } from "../../data/prevoyance";
import { safeNum } from "./projection";

export type CapitalDecesBranche = {
  capital: number | null;
  donneeIndisponible: boolean;
  source: string;                       // libellé de la CCN (traçabilité)
  categorie: "cadres" | "nonCadres";
};

// Formes attendues dans le référentiel (lecture TYPÉE via cast Record, pas de
// `as any` nu — modèle du cast de getMaintienParams). Données volontairement
// polymorphes tant que les CCN ne sont pas remplies → champs `unknown`.
type GarantieCapitalDC = { mode?: unknown; tauxSalaireRef?: unknown; minimumPass?: unknown };
type BlocPrevoyanceBranche = { garantiesMinimum?: { capitalDC?: unknown } | null } | null;

export function resolveCapitalDecesBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  salaireBrutAnnuel: number,
  pass: number,
  ref: Referentiels
): CapitalDecesBranche {
  const indispo = (src: string): CapitalDecesBranche => ({
    capital: null,
    donneeIndisponible: true,
    source: src,
    categorie,
  });

  if (!idcc) return indispo("");

  const conventions = ref.ccn.conventions as Record<
    string,
    {
      nom?: string;
      prevoyanceCadres?: BlocPrevoyanceBranche;
      prevoyanceNonCadres?: BlocPrevoyanceBranche;
    } | undefined
  >;
  const conv = conventions?.[idcc];
  if (!conv) return indispo("");
  const source = String(conv.nom ?? idcc);

  // null (ex. prévoyanceNonCadres non documentée des autres CCN) → indispo.
  const bloc = categorie === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  const capitalDC = bloc?.garantiesMinimum?.capitalDC;
  // "TO_VERIFY" (string) / absent / non-objet → indispo.
  if (capitalDC == null || typeof capitalDC !== "object") return indispo(source);

  const g = capitalDC as GarantieCapitalDC;
  if (g.mode !== "pourcentageSalaireRef") return indispo(source);

  const taux = safeNum(g.tauxSalaireRef);
  const minPass = safeNum(g.minimumPass);
  const passNum = safeNum(pass);
  const brut = safeNum(salaireBrutAnnuel);
  if (taux === null || minPass === null || passNum === null || brut === null) {
    return indispo(source);
  }

  // Salaire de référence plafonné à 8 PASS ; capital = max(taux × salaireRef,
  // minimumPass × PASS). Le plancher PASS garantit une couverture minimale.
  const salaireRef = Math.min(brut, 8 * passNum);
  const capital = Math.max(taux * salaireRef, minPass * passNum);
  return { capital, donneeIndisponible: false, source, categorie };
}

// ─── Résolveur de la RENTE ÉDUCATION de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) ─
//
// Module PUR (LOT DECES-B-i) : résout, pour UNE personne salariée et UN enfant,
// la rente éducation minimum garantie par sa convention collective. Rente PAR
// ENFANT, évolutive avec l'âge (clause type Syntec, art. 5 accord prévoyance
// 27/03/1997 : 12 % du salaire de référence jusqu'au 18e anniversaire, 15 % de
// 18 à 26 ans, fin à 26 ; plancher en % du PASS selon âge ET statut). CUMULATIVE
// avec le capital. Donnée de RÉFÉRENCE destinée au module succession (versée
// APRÈS décès) — n'alimente PAS les 9 séries de projection.
//
// Même discipline défensive que resolveCapitalDecesBranche : aucune valeur en
// dur, aucun `as any` nu (cast Record + safeNum + typeof object). Toute donnée
// absente / null (« non prévu par la branche ») / "TO_VERIFY" / mode inconnu /
// taux aberrant → donneeIndisponible + phases [] + montantAnnuelCourant null.
// JAMAIS d'exception, JAMAIS de valeur inventée.

// Phase de rente : une tranche d'âge avec son montant annuel résolu.
export type RenteEducationBranchePhase = {
  deAge: number;
  aAge: number;
  tauxSalaireRef: number;
  montantAnnuel: number;
};

export type RenteEducationBranche = {
  phases: RenteEducationBranchePhase[];        // grille complète (indép. de l'âge)
  montantAnnuelCourant: number | null;         // montant à l'âge passé (null si âge inconnu)
  donneeIndisponible: boolean;
  source: string;                              // libellé de la CCN (traçabilité)
  categorie: "cadres" | "nonCadres";
};

// Formes attendues dans le référentiel (cast typé, champs `unknown` tant que les
// CCN ne sont pas toutes remplies). BlocPrevoyanceRente ne déclare QUE le champ
// lu ici → indépendant de BlocPrevoyanceBranche (capital), qu'on ne modifie pas.
type TrancheAge = { deAge?: unknown; aAge?: unknown; tauxSalaireRef?: unknown; minimumPass?: unknown };
type GarantieRenteEducation = { mode?: unknown; tranches?: unknown };
type BlocPrevoyanceRente = { garantiesMinimum?: { renteEducation?: unknown } | null } | null;

export function resolveRenteEducationBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  salaireBrutAnnuel: number,
  pass: number,
  ageEnfant: number | null,
  ref: Referentiels
): RenteEducationBranche {
  const indispo = (src: string): RenteEducationBranche => ({
    phases: [],
    montantAnnuelCourant: null,
    donneeIndisponible: true,
    source: src,
    categorie,
  });

  if (!idcc) return indispo("");

  const conventions = ref.ccn.conventions as Record<
    string,
    {
      nom?: string;
      prevoyanceCadres?: BlocPrevoyanceRente;
      prevoyanceNonCadres?: BlocPrevoyanceRente;
    } | undefined
  >;
  const conv = conventions?.[idcc];
  if (!conv) return indispo("");
  const source = String(conv.nom ?? idcc);

  // null (« non prévu par la branche », ex. renteConjoint Syntec) / "TO_VERIFY"
  // (string) / absent / non-objet → indispo. Le null est traité comme une donnée
  // manquante, JAMAIS comme une erreur.
  const bloc = categorie === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  const renteEducation = bloc?.garantiesMinimum?.renteEducation;
  if (renteEducation == null || typeof renteEducation !== "object") return indispo(source);

  const g = renteEducation as GarantieRenteEducation;
  if (g.mode !== "trancheAge" || !Array.isArray(g.tranches)) return indispo(source);

  const passNum = safeNum(pass);
  const brut = safeNum(salaireBrutAnnuel);
  if (passNum === null || brut === null) return indispo(source);

  // Salaire de référence plafonné à 8 PASS — IDENTIQUE au capital (recalcul
  // local : on NE modifie PAS resolveCapitalDecesBranche).
  const salaireRef = Math.min(brut, 8 * passNum);

  const phases: RenteEducationBranchePhase[] = [];
  for (const t of g.tranches as unknown[]) {
    if (t == null || typeof t !== "object") return indispo(source);
    const tr = t as TrancheAge;
    const deAge = safeNum(tr.deAge);
    const aAge = safeNum(tr.aAge);
    const taux = safeNum(tr.tauxSalaireRef);
    const minPass = safeNum(tr.minimumPass);
    if (deAge === null || aAge === null || taux === null || minPass === null) return indispo(source);
    // Garde de cohérence : taux/plancher en pourcentage (un tauxSalaireRef > 1 =
    // > 100 % du salaire serait incohérent ; minimumPass aberrant rejeté), bornes
    // d'âge ordonnées et non négatives. Tout écart → donneeIndisponible.
    if (taux < 0 || taux > 1 || minPass < 0 || minPass > 8 || deAge < 0 || aAge <= deAge) return indispo(source);
    const montantAnnuel = Math.max(taux * salaireRef, minPass * passNum);
    phases.push({ deAge, aAge, tauxSalaireRef: taux, montantAnnuel });
  }
  if (phases.length === 0) return indispo(source);

  // Montant courant = phase couvrant l'âge (deAge <= âge < aAge). Âge inconnu →
  // null (grille connue, mais pas de montant ponctuel). Âge >= dernière borne
  // (26) → 0 (plus à charge, fin de rente).
  let montantAnnuelCourant: number | null = null;
  if (ageEnfant !== null) {
    const active = phases.find((p) => ageEnfant >= p.deAge && ageEnfant < p.aAge);
    montantAnnuelCourant = active ? active.montantAnnuel : 0;
  }

  return { phases, montantAnnuelCourant, donneeIndisponible: false, source, categorie };
}
