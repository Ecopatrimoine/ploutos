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
type GarantieCapitalDC = {
  mode?: unknown;
  // Mode historique "pourcentageSalaireRef" :
  tauxSalaireRef?: unknown;
  minimumPass?: unknown;            // historique : plancher FINAL ; situationFamiliale : plancher de la BASE
  // Mode "situationFamiliale" (LOT BTP-1bis) — blocs PAR situation, chacun avec sa
  // PROPRE unité et ses PROPRES majorations ; valeurSREuros partagé (requis si une
  // unité "sr" est utilisée), conjointInclutConcubin inchangé.
  valeurSREuros?: unknown;
  conjointInclutConcubin?: unknown; // bool — concubin assimilé au conjoint (RNPO art 8.1)
  sansConjoint?: unknown;           // bloc SituationCapital (célibataire / veuf / divorcé)
  avecConjoint?: unknown;           // bloc SituationCapital (avec conjoint)
};
// Un bloc de situation : valeur + unité + majorations par rang d'enfant.
type SituationCapital = { valeur?: unknown; unite?: unknown; majorationParEnfant?: unknown };
// Une majoration par rang : unité OPTIONNELLE (défaut = unité du bloc parent).
type MajorationRang = { deRang?: unknown; aRang?: unknown; valeur?: unknown; unite?: unknown };
type BlocPrevoyanceBranche = { garantiesMinimum?: { capitalDC?: unknown } | null } | null;

// Contexte famille du défunt, requis par le mode "situationFamiliale". Tous les
// champs sont optionnels (défaut prudent : pas de conjoint, 0 enfant) → un appel
// SANS contexte (mode "pourcentageSalaireRef") reste valide et inchangé.
export type FamilleCapitalDeces = {
  conjointPresent?: boolean;   // marié ou PACS
  concubinPresent?: boolean;   // concubinage notoire (assimilé selon la convention)
  nbEnfantsACharge?: number;   // enfants à charge du défunt (rang 1..n)
};

// LOT PASS-CAP — plafond du salaire de référence (multiplicateur de PASS), lu au
// NIVEAU BRANCHE de ccn-2026.json (clé `plafondSalaireRefPass`). Commun au capital
// décès ET à la rente éducation. Lecture défensive (cast Record + safeNum + garde) :
// clé absente / non numérique / <= 0 → REPLI sur 8 (= comportement Syntec actuel).
// JAMAIS d'exception. Le PASS lui-même reste lu du référentiel par l'appelant.
const PLAFOND_SALAIRE_REF_PASS_DEFAUT = 8;
function resolvePlafondSalaireRefPass(idcc: string | null, ref: Referentiels): number {
  if (!idcc) return PLAFOND_SALAIRE_REF_PASS_DEFAUT;
  const conventions = ref.ccn.conventions as Record<
    string,
    { plafondSalaireRefPass?: unknown } | undefined
  >;
  const v = safeNum(conventions?.[idcc]?.plafondSalaireRefPass);
  if (v === null || v <= 0) return PLAFOND_SALAIRE_REF_PASS_DEFAUT;
  return v;
}

export function resolveCapitalDecesBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  salaireBrutAnnuel: number,
  pass: number,
  ref: Referentiels,
  famille?: FamilleCapitalDeces
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

  // Mode HISTORIQUE — % du salaire de référence. STRICTEMENT INCHANGÉ
  // (Syntec/HCR/Métallurgie) : aucune dépendance au contexte famille.
  if (g.mode === "pourcentageSalaireRef") {
    const taux = safeNum(g.tauxSalaireRef);
    const minPass = safeNum(g.minimumPass);
    const passNum = safeNum(pass);
    const brut = safeNum(salaireBrutAnnuel);
    if (taux === null || minPass === null || passNum === null || brut === null) {
      return indispo(source);
    }

    // Salaire de référence plafonné à `plafondPass` PASS (configurable par branche,
    // défaut 8 = Syntec) ; capital = max(taux × salaireRef, minimumPass × PASS). Le
    // plancher PASS garantit une couverture minimale.
    const plafondPass = resolvePlafondSalaireRefPass(idcc, ref);
    const salaireRef = Math.min(brut, plafondPass * passNum);
    const capital = Math.max(taux * salaireRef, minPass * passNum);
    return { capital, donneeIndisponible: false, source, categorie };
  }

  // Mode BTP (LOT BTP-1) — capital fonction de la situation familiale + enfants.
  if (g.mode === "situationFamiliale") {
    const capital = computeCapitalSituationFamiliale(g, salaireBrutAnnuel, pass, idcc, ref, famille);
    if (capital === null) return indispo(source);
    return { capital, donneeIndisponible: false, source, categorie };
  }

  // Mode inconnu → indispo (JAMAIS de valeur inventée).
  return indispo(source);
}

// ─── Mode "situationFamiliale" (LOT BTP-1bis) — blocs PAR situation ──────────
//
// La situation retenue (avecConjoint si conjoint présent — concubin assimilé si
// conjointInclutConcubin —, sinon sansConjoint) fournit UN bloc
// { valeur, unite, majorationParEnfant }. Chaque montant (base ET chaque
// majoration) est converti en euros selon SON unité :
//   "euros"                 → valeur (montant direct)
//   "pourcentageSalaireRef" → valeur/100 × salaireRef (plafonné PASS)
//   "sr"                    → valeur × valeurSREuros (partagé au niveau capitalDC)
// L'unité d'une majoration défaut sur celle du bloc. Le plancher minimumPass
// (fraction de PASS) s'applique à la BASE convertie, AVANT les majorations :
//   capital = max(baseConvertie, minimumPass × PASS) + Σ majorations
// Lecture défensive : unité inconnue, valeur négative, bloc de la situation
// manquant, "sr" sans valeurSREuros, paliers mal formés → null (= indispo),
// JAMAIS d'exception, JAMAIS de valeur inventée.
function computeCapitalSituationFamiliale(
  g: GarantieCapitalDC,
  salaireBrutAnnuel: number,
  pass: number,
  idcc: string,
  ref: Referentiels,
  famille: FamilleCapitalDeces | undefined
): number | null {
  const passNum = safeNum(pass);
  const brut = safeNum(salaireBrutAnnuel);
  if (passNum === null || brut === null) return null;

  // Conjoint effectif : conjoint (marié/PACS), OU concubin SI la convention
  // l'assimile (conjointInclutConcubin === true ; défaut false).
  const conjointInclutConcubin = g.conjointInclutConcubin === true;
  const conjointPresent = famille?.conjointPresent === true;
  const concubinPresent = famille?.concubinPresent === true;
  const conjointEffectif = conjointPresent || (concubinPresent && conjointInclutConcubin);

  // Bloc de la situation retenue. Manquant / non-objet → indispo.
  const blocRaw = conjointEffectif ? g.avecConjoint : g.sansConjoint;
  if (blocRaw == null || typeof blocRaw !== "object") return null;
  const bloc = blocRaw as SituationCapital;

  // Assiette des conversions en pourcentage (plafonnée comme l'historique).
  const salaireRef = Math.min(brut, resolvePlafondSalaireRefPass(idcc, ref) * passNum);
  const valeurSR = safeNum(g.valeurSREuros); // null si la branche n'utilise pas "sr"

  // Conversion (valeur, unité) → euros. null si unité inconnue, valeur négative,
  // ou "sr" sans valeurSREuros exploitable.
  const enEuros = (valeurRaw: unknown, unite: unknown): number | null => {
    const v = safeNum(valeurRaw);
    if (v === null || v < 0) return null;
    if (unite === "euros") return v;
    if (unite === "pourcentageSalaireRef") return (v / 100) * salaireRef;
    if (unite === "sr") {
      if (valeurSR === null || valeurSR <= 0) return null;
      return v * valeurSR;
    }
    return null; // unité inconnue
  };

  // Base de la situation, convertie en euros.
  const baseEuros = enEuros(bloc.valeur, bloc.unite);
  if (baseEuros === null) return null;

  // Plancher minimumPass sur la BASE (après conversion, AVANT majorations).
  // Absent → pas de plancher ; présent mais invalide / négatif → indispo.
  let base = baseEuros;
  if (g.minimumPass != null) {
    const minPass = safeNum(g.minimumPass);
    if (minPass === null || minPass < 0) return null;
    base = Math.max(base, minPass * passNum);
  }

  // Majorations par enfant : paliers par RANG (deRang..aRang ; aRang absent =
  // illimité), unité héritée du bloc si absente. Somme des majorations applicables
  // au rang de chaque enfant 1..nbEnfants. AJOUTÉES APRÈS le plancher de base.
  const nbEnfants = Math.max(0, Math.floor(safeNum(famille?.nbEnfantsACharge) ?? 0));
  let majorationTotale = 0;
  if (bloc.majorationParEnfant != null) {
    if (!Array.isArray(bloc.majorationParEnfant)) return null; // mal formé → indispo
    const paliers: { deRang: number; aRang: number | null; valeurEuros: number }[] = [];
    for (const raw of bloc.majorationParEnfant as unknown[]) {
      if (raw == null || typeof raw !== "object") return null;
      const p = raw as MajorationRang;
      const deRang = safeNum(p.deRang);
      const aRang = safeNum(p.aRang); // null si absent → illimité
      if (deRang === null || deRang < 1) return null;
      if (aRang !== null && aRang < deRang) return null;
      const valeurEuros = enEuros(p.valeur, p.unite ?? bloc.unite); // unité héritée si absente
      if (valeurEuros === null) return null;
      paliers.push({ deRang, aRang, valeurEuros });
    }
    for (let rang = 1; rang <= nbEnfants; rang++) {
      const palier = paliers.find((pp) => rang >= pp.deRang && (pp.aRang === null || rang <= pp.aRang));
      if (palier) majorationTotale += palier.valeurEuros;
    }
  }

  return base + majorationTotale;
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

  // Salaire de référence plafonné à `plafondPass` PASS (configurable par branche,
  // défaut 8 = Syntec) — IDENTIQUE au capital (recalcul local : on NE modifie PAS
  // resolveCapitalDecesBranche).
  const plafondPass = resolvePlafondSalaireRefPass(idcc, ref);
  const salaireRef = Math.min(brut, plafondPass * passNum);

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

// ─── Résolveur de la RENTE CONJOINT SUBSTITUTIVE de branche (CCN) ────────────
//
// LOT HCR-3.5 : nouveau mode renteConjoint "substitutive" (HCR art 18.2.4bis) :
// un pourcentage du salaire de référence (plafonné par plafondSalaireRefPass,
// comme le capital et la rente éducation), versé au partenaire survivant
// UNIQUEMENT en l'absence d'enfant ouvrant droit à la rente éducation (condition
// portée par l'appelant, cf. succession.ts), plafonné à dureeMaxAnnees. Donnée de
// RÉFÉRENCE destinée au module succession — n'alimente PAS les 9 séries.
//
// Même discipline défensive : null / absent (« non prévu », ex. Syntec) /
// "TO_VERIFY" / mode != "substitutive" / valeur aberrante → donneeIndisponible.
// JAMAIS d'exception, JAMAIS de valeur inventée. C'est la liste `beneficiaires` du
// JSON qui décide des qualités admises (le concubin PEUT y figurer — distinct de
// la dévolution du capital, où il est exclu).
export type RenteConjointSubstitutiveBranche = {
  montantAnnuel: number | null;                            // €/an (null si non prévu)
  dureeMaxAnnees: number | null;                           // durée de versement (années)
  beneficiairesQualites: ("conjoint" | "pacs" | "concubin")[];
  // LOT BTP-4 : false = mode "substitutive" (HCR, EXCLUSIF de la rente éducation) ;
  // true = mode "cibleCumulable" (BTP, CUMULABLE avec la rente éducation). C'est
  // l'appelant (succession) qui applique, ou non, la condition d'exclusivité.
  cumulableAvecRenteEducation: boolean;
  // LOT UI-LABEL : âge légal du défunt (mode cibleCumulable) pour le sous-titre UI ;
  // null pour substitutive / indispo.
  finAgeDefunt: number | null;
  source: string;                                          // libellé de la CCN (traçabilité)
  donneeIndisponible: boolean;
};

type GarantieRenteConjoint = {
  mode?: unknown; tauxSalaireRef?: unknown; dureeMaxAnnees?: unknown; beneficiaires?: unknown;
  // Mode "cibleCumulable" (LOT BTP-4) :
  finAgeDefunt?: unknown;          // âge légal du défunt jusqu'auquel la rente est versée
  assietteMinimumEuros?: unknown;  // plancher d'ASSIETTE optionnel (= 4000 × SR, calculé au remplissage)
};
type BlocPrevoyanceRenteConjoint = { garantiesMinimum?: { renteConjoint?: unknown } | null } | null;

const QUALITES_BENEF_CONNUES = ["conjoint", "pacs", "concubin"] as const;

// Deux modes : "substitutive" (HCR, durée fixe, exclusif de la rente éducation —
// inchangé) et "cibleCumulable" (BTP/RNPO art 18 : cible reversion Arrco comprise,
// versée jusqu'à l'âge légal du défunt, CUMULABLE avec la rente éducation, plancher
// d'assiette optionnel). `ageDefunt` (âge au décès) n'est requis que pour le mode
// cibleCumulable (durée = âge légal − âge). Lecture défensive identique : tout
// champ requis absent / aberrant / mode inconnu → donneeIndisponible, jamais de throw.
export function resolveRenteConjointSubstitutiveBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  salaireBrutAnnuel: number,
  pass: number,
  ref: Referentiels,
  ageDefunt: number | null = null
): RenteConjointSubstitutiveBranche {
  const indispo = (src: string): RenteConjointSubstitutiveBranche => ({
    montantAnnuel: null,
    dureeMaxAnnees: null,
    beneficiairesQualites: [],
    cumulableAvecRenteEducation: false,
    finAgeDefunt: null,
    source: src,
    donneeIndisponible: true,
  });

  if (!idcc) return indispo("");

  const conventions = ref.ccn.conventions as Record<
    string,
    {
      nom?: string;
      prevoyanceCadres?: BlocPrevoyanceRenteConjoint;
      prevoyanceNonCadres?: BlocPrevoyanceRenteConjoint;
    } | undefined
  >;
  const conv = conventions?.[idcc];
  if (!conv) return indispo("");
  const source = String(conv.nom ?? idcc);

  // null (« non prévu par la branche », ex. Syntec) / "TO_VERIFY" / absent /
  // non-objet → indispo. Le null est une donnée manquante, JAMAIS une erreur.
  const bloc = categorie === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  const renteConjoint = bloc?.garantiesMinimum?.renteConjoint;
  if (renteConjoint == null || typeof renteConjoint !== "object") return indispo(source);

  const g = renteConjoint as GarantieRenteConjoint;

  // Communs aux deux modes : taux [0,1], bénéficiaires, salaire de référence
  // plafonné (MÊME plafond que capital / rente éducation).
  const passNum = safeNum(pass);
  const brut = safeNum(salaireBrutAnnuel);
  const taux = safeNum(g.tauxSalaireRef);
  if (passNum === null || brut === null || taux === null) return indispo(source);
  if (taux < 0 || taux > 1) return indispo(source);

  const beneficiairesQualites = (Array.isArray(g.beneficiaires) ? g.beneficiaires : []).filter(
    (q): q is "conjoint" | "pacs" | "concubin" =>
      typeof q === "string" && (QUALITES_BENEF_CONNUES as readonly string[]).includes(q)
  );
  if (beneficiairesQualites.length === 0) return indispo(source);

  const salaireRef = Math.min(brut, resolvePlafondSalaireRefPass(idcc, ref) * passNum);

  // Mode "substitutive" (HCR) — STRICTEMENT INCHANGÉ : % du salaire de référence,
  // durée fixe dureeMaxAnnees > 0, EXCLUSIF de la rente éducation (cumulable=false).
  if (g.mode === "substitutive") {
    const duree = safeNum(g.dureeMaxAnnees);
    if (duree === null || duree <= 0) return indispo(source);
    const montantAnnuel = taux * salaireRef;
    return { montantAnnuel, dureeMaxAnnees: duree, beneficiairesQualites, cumulableAvecRenteEducation: false, finAgeDefunt: null, source, donneeIndisponible: false };
  }

  // Mode "cibleCumulable" (BTP, RNPO art 18) — CIBLE (reversion Arrco comprise),
  // CUMULABLE avec la rente éducation, versée jusqu'à l'âge légal du défunt.
  if (g.mode === "cibleCumulable") {
    // Âge légal (finAgeDefunt) obligatoire et borné [55,75] (garde de cohérence).
    const finAge = safeNum(g.finAgeDefunt);
    if (finAge === null || finAge < 55 || finAge > 75) return indispo(source);
    // Plancher d'ASSIETTE optionnel : absent → pas de plancher ; présent et >= 0 →
    // assiette = max(salaireRef, plancher) ; présent mais négatif/invalide → indispo.
    let assiette = salaireRef;
    if (g.assietteMinimumEuros !== undefined && g.assietteMinimumEuros !== null) {
      const minAssiette = safeNum(g.assietteMinimumEuros);
      if (minAssiette === null || minAssiette < 0) return indispo(source);
      assiette = Math.max(salaireRef, minAssiette);
    }
    // Durée = âge légal − âge du défunt au décès (années entières). Âge inconnu, ou
    // défunt déjà au-delà de l'âge légal → aucune rente (donneeIndisponible).
    const age = safeNum(ageDefunt);
    if (age === null) return indispo(source);
    const dureeAnnees = Math.max(0, Math.floor(finAge - age));
    if (dureeAnnees <= 0) return indispo(source);
    const montantAnnuel = taux * assiette;
    return { montantAnnuel, dureeMaxAnnees: dureeAnnees, beneficiairesQualites, cumulableAvecRenteEducation: true, finAgeDefunt: finAge, source, donneeIndisponible: false };
  }

  // Mode inconnu → indispo (JAMAIS de valeur inventée).
  return indispo(source);
}
