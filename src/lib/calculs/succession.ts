// Calcul succession — droits, AV/PER, legs, démembrement
import type { PatrimonialData, SuccessionData, TaxBracket, FilledBracket,
  Heir, SuccessionPropertyLine, SuccessionPlacementLine, SuccessionAvLine,
  SuccessionResult, PieDatum, ContratTransmissionDeces,
  CapitalDecesCaisseRelation, CapitalDecesCaisseSurcharge } from '../../types/patrimoine';
import { n, getDemembrementPercentages, computeTaxFromBrackets, isAV, isPERType,
  childMatchesDeceased, getAgeFromBirthDate, isSpouseHeirEligible, getAvailableSpouseOptions,
  getQuotiteDisponible, buildCollectedHeirs, euro } from './utils';
import { resolveLoanValuesMulti } from './credit';
import { buildEntreePerso } from '../prevoyance/mapping';
import { resolveCapitauxDeces } from '../prevoyance/capitaux-deces';
import { resolveCapitalDecesBranche, resolveRenteEducationBranche, resolveRenteConjointSubstitutiveBranche } from '../prevoyance/capitaux-deces-branche';
import { categorieBranche } from '../prevoyance/categorie-branche';
import { getContratsTransmissionDecesAvecLegacy, getPrevoyancePerso } from '../prevoyance/utils';
import { referentiels, type Referentiels } from '../../data/prevoyance';

// ─── Capitaux décès HORS actif successoral (module « Capitaux décès dans la
//     succession », Lot 3) — types des lignes parallèles à avLines ──────────

// Capital décès d'un régime obligatoire (caisse) du défunt. EXONÉRÉ, hors
// succession : aucun calcul fiscal. Les montants de RENTE sont ANNUELS (€/an)
// et ne sont JAMAIS sommés avec des capitaux.
export type CapitalDecesCaisseLine = {
  source: string;
  capital: number | null;            // capital décès (€), null si TO_VERIFY
  capitalParEnfant?: number;         // capital orphelin par enfant (SSI)
  nbEnfants: number;                 // enfants à charge retenus (contexte)
  capitalOrphelinTotal?: number;     // capitalParEnfant × nbEnfants (affichage)
  renteConjointAnnuelle?: number;    // €/an
  renteEducationAnnuelle?: number;   // €/an
  renteSurvieOrphelinAnnuelle?: number; // €/an
  situationRetenue?: "actif_ou_invalide" | "retraite";
  donneeIndisponible: boolean;
  exonere: true;
  // Dévolution du capital (P3) : QUI perçoit, en cascade légale auto OU surcharge
  // manuelle. EXONÉRÉ — aucune fiscalité. Vide = aucun bénéficiaire déterminé.
  repartition: CapitalDecesRepartitionLigne[];
};

// Une part de capital décès caisse attribuée à un bénéficiaire (exonérée).
export type CapitalDecesRepartitionLigne = {
  beneficiaire: string;
  relation: CapitalDecesCaisseRelation;
  montant: number;
  // capital_principal : soumis à la cascade exclusive (L361-4 CSS).
  // capital_orphelin  : s'ajoute, par enfant à charge, HORS cascade.
  origine: "capital_principal" | "capital_orphelin";
  source: "auto" | "manuel";
};

// Contexte de dévolution (données du foyer, déjà extraites par l'appelant).
export type CapitalDecesDevolutionContexte = {
  conjointPresent: boolean;          // marié OU PACS (concubin EXCLU)
  conjointNom?: string;
  conjointRelation?: "conjoint" | "pacs_partner";
  enfantsACharge: string[];          // noms des enfants à charge du défunt
  ascendants?: string[];             // noms (souvent absents du dossier)
  surcharge?: CapitalDecesCaisseSurcharge | null;
};

// Dévolution PURE du capital décès d'une caisse (art. L361-4 CSS).
//
// ⚠️ CASCADE EXCLUSIVE — PAS la succession civile : le 1er rang présent prend
// TOUT le capital PRINCIPAL, aucun partage entre rangs :
//   conjoint/PACS  →  à défaut enfants à charge (parts égales)  →  à défaut ascendants.
// Le CONCUBIN n'est jamais bénéficiaire automatique (surcharge manuelle requise).
// Le CAPITAL ORPHELIN (ex. SSI 2 403 €/enfant) s'AJOUTE, par enfant à charge,
// HORS cascade (même en présence d'un conjoint). Tout est EXONÉRÉ : on répartit,
// on ne taxe rien. Une surcharge manuelle REMPLACE toute la dévolution auto.
export function devolutionCapitalDecesCaisse(
  capital: number | null,
  capitalParEnfant: number | undefined,
  ctx: CapitalDecesDevolutionContexte
): CapitalDecesRepartitionLigne[] {
  // Surcharge manuelle → prime sur la cascade auto (le CGP connaît le cas).
  if (ctx.surcharge && ctx.surcharge.beneficiaires.length > 0) {
    return ctx.surcharge.beneficiaires.map((b) => ({
      beneficiaire: b.name || "Bénéficiaire",
      relation: b.relation,
      montant: Math.max(0, n(b.montant)),
      origine: "capital_principal" as const,
      source: "manuel" as const,
    }));
  }

  const lignes: CapitalDecesRepartitionLigne[] = [];
  const cap = capital ?? 0;

  // Capital PRINCIPAL — cascade exclusive.
  if (cap > 0) {
    if (ctx.conjointPresent && ctx.conjointNom) {
      lignes.push({ beneficiaire: ctx.conjointNom, relation: ctx.conjointRelation ?? "conjoint", montant: cap, origine: "capital_principal", source: "auto" });
    } else if (ctx.enfantsACharge.length > 0) {
      const part = cap / ctx.enfantsACharge.length;
      for (const e of ctx.enfantsACharge) lignes.push({ beneficiaire: e, relation: "enfant", montant: part, origine: "capital_principal", source: "auto" });
    } else if (ctx.ascendants && ctx.ascendants.length > 0) {
      const part = cap / ctx.ascendants.length;
      for (const a of ctx.ascendants) lignes.push({ beneficiaire: a, relation: "ascendant", montant: part, origine: "capital_principal", source: "auto" });
    }
    // sinon : aucun bénéficiaire automatique (concubin seul, ou rien) → l'UI
    // affichera « bénéficiaire à déterminer » et invitera à la surcharge.
  }

  // Capital ORPHELIN — par enfant à charge, en plus, hors cascade.
  if (capitalParEnfant != null && capitalParEnfant > 0 && ctx.enfantsACharge.length > 0) {
    for (const e of ctx.enfantsACharge) lignes.push({ beneficiaire: e, relation: "enfant", montant: capitalParEnfant, origine: "capital_orphelin", source: "auto" });
  }

  return lignes;
}

// Rente de survie / éducation versée par une caisse (montant ANNUEL exonéré).
export type RenteSurvieAnnuelle = {
  source: string;
  type: "conjoint" | "education" | "survie_orphelin";
  montantAnnuel: number;
};

// Capital d'un contrat de prévoyance décès PRIVÉ, par bénéficiaire. HORS actif,
// fiscalité 990 I via computeAvTax. `duties` = taxe MARGINALE (abattement
// 152 500 € consommé AV-first — cf. note recon #3 dans computeSuccession).
export type CapitalDecesPriveLine = {
  contrat: string;
  beneficiary: string;
  relation: string;
  sharePct: number;
  montant: number;                   // capital reçu par le bénéficiaire (€)
  natureAssiette: ContratTransmissionDeces["natureAssiette"];
  assiette990I: number;              // assiette du prélèvement 990 I (€)
  before70Taxable: number;           // base taxable après abattement résiduel
  duties: number;                    // droits 990 I marginaux (€)
  // Option A (R2) : contrat SANS bénéficiaire désigné → capital VISIBLE mais
  // NON taxé (pas de relation → pas de computeAvTax), à compléter par le CGP.
  beneficiairesARenseigner?: boolean;
};

// Capital décès de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) du défunt (LOT DECES-A).
// EXONÉRÉ (contrat de groupe professionnel, art. 998 CGI, hors 990 I) → même
// chemin que les caisses : AUCUN computeAvTax, HORS actif et HORS droits. Versé
// aux bénéficiaires désignés au contrat (pas de dévolution nominative ce lot).
export type CapitalDecesBrancheLine = {
  source: string;
  capital: number | null;            // capital décès (€), null si non documenté
  categorie: "cadres" | "nonCadres";
  exonere: true;
  donneeIndisponible: boolean;
  beneficiairesAuContrat: true;
  // Dévolution (LOT DECES-A bis) : QUI perçoit, clause type Syntec (cascade
  // EXCLUSIVE) OU surcharge manuelle. EXONÉRÉ — informatif, aucun droit calculé.
  // Vide = aucun bénéficiaire déterminé (désignation manuelle invitée).
  repartition: CapitalDecesRepartitionLigne[];
};

// Rente éducation de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN), PAR ENFANT à charge
// (LOT DECES-B-ii). EXONÉRÉE, hors actif/droits, CUMULATIVE avec le capital —
// JAMAIS additionnée à lui (poste séparé). Évolutive : `phases` porte la grille
// (12 %/15 % du salaire de référence), `montantAnnuelCourant` le montant à l'âge
// actuel de l'enfant. donneeIndisponible si la CCN ne documente pas la rente OU
// si la date de naissance manque (âge inconnu).
export type RenteEducationBrancheLine = {
  enfantPrenom: string;
  ageActuel: number | null;
  montantAnnuelCourant: number | null;     // €/an à l'âge actuel (null si âge inconnu)
  phases: { deAge: number; aAge: number; montantAnnuel: number }[];
  donneeIndisponible: boolean;
  exonere: true;
  // LOT LABEL-CCN — nom de la CCN (conv.nom ?? idcc), pour un libellé dynamique.
  source: string;
};

// Rente conjoint SUBSTITUTIVE de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) — LOT
// HCR-3.5. EXONÉRÉE, hors actif/droits, additive. Versée au partenaire survivant
// (conjoint/PACS/concubin selon la liste de la branche) UNIQUEMENT si AUCUN enfant
// n'ouvre droit à la rente éducation, plafonnée à dureeMaxAnnees. DISTINCTE du
// canal caisse rentesSurvieAnnuelles (ligne et rendu propres). La borne « retraite
// taux plein du bénéficiaire » n'est PAS modélisée (TO_VERIFY, cf. note JSON).
export type RenteConjointBrancheLine = {
  montantAnnuel: number;
  dureeMaxAnnees: number;
  beneficiaireNom: string;
  source: string;
  exonere: true;
  donneeIndisponible: boolean;
  // LOT UI-LABEL : mode de branche + âge légal du défunt, pour un libellé UI
  // mode-conscient (substitutive HCR vs cibleCumulable BTP). Optionnels (lecture
  // défensive côté composant : absent → titre générique, pas de sous-titre).
  mode?: "substitutive" | "cibleCumulable";
  finAgeDefunt?: number;
};

// Contexte de dévolution du capital décès de BRANCHE (clause type Syntec,
// art. 3.3 accord prévoyance 27/03/1997). DISTINCT du contexte CAISSE (ordre
// L361-4 CSS) sur deux points : le 1er rang admet AUSSI le concubin notoire, et
// un 4e rang « héritiers » clôt la cascade. EXCLUSIVE : le 1er rang non vide
// prend 100 % (le conjoint EXCLUT les enfants).
export type CapitalDecesBrancheDevolutionContexte = {
  // Rang 1 — conjoint non séparé de corps ; à défaut partenaire de PACS ou
  // concubin notoire. L'appelant place ici le survivant selon coupleStatus
  // (marié → "conjoint", PACS → "pacs_partner", concubin → "autre").
  partenaireNom?: string;
  partenaireRelation?: CapitalDecesCaisseRelation;
  // Qualité (DEVOL-1) du partenaire, servant à tester son admission par un rang :
  // "conjoint" | "pacs" | "concubin". L'adaptateur la pose explicitement ;
  // absente (appels directs « legacy »), la cascade la dérive du LABEL de relation.
  partenaireQualite?: DevolutionQualite;
  // Rang 2 — enfants (parts égales). Clause bénéficiaire : TOUS les enfants du
  // défunt (pas le filtre fiscal « à charge » propre au capital caisse).
  enfants: string[];
  // Rang 3 — ascendants (parts égales). Souvent absent du modèle → rang sauté.
  ascendants?: string[];
  // Rang 4 — héritiers selon dévolution successorale. Souvent indéterminé → sauté.
  heritiers?: string[];
  surcharge?: CapitalDecesCaisseSurcharge | null;
};

// ─── LOT DEVOL-1 — Dévolution du capital décès de branche, DATA-DRIVEN ──────
//
// L'ordre de dévolution est désormais piloté par ccn-2026.json (clé
// `devolutionCapitalDeces` au niveau branche). Pour Syntec (1486) la config
// reproduit À L'IDENTIQUE l'ancienne chaîne de `if` (iso-comportement v1.12.0) ;
// le SEUL axe de variation par branche est l'ensemble des qualités admises au
// 1er rang (Syntec admet le concubin notoire, HCR — étape 3 — ne l'admettra pas).

// Qualités de bénéficiaire reconnues par un rang. Toute autre chaîne lue dans le
// JSON est ignorée (filtrée à la lecture).
export type DevolutionQualite =
  | "conjoint" | "pacs" | "concubin" | "enfants" | "ascendants" | "devolutionSuccessorale";

// Un rang de la cascade : les qualités admises (collectées ensemble, réparties en
// parts égales si le rang est non vide). `representation` est PORTÉE depuis le
// JSON mais reste INERTE — le modèle de données ne contient aucun petit-enfant,
// donc aucune représentation n'est simulée (à activer dans un lot ultérieur).
export type DevolutionRang = {
  qualites: DevolutionQualite[];
  representation?: boolean;
};

// Configuration data-driven lue au niveau branche. Seul `mode: "cascadeExclusive"`
// est supporté ; toute config absente / malformée / de mode inconnu → repli sur
// l'ordre par défaut (DEFAULT_DEVOLUTION_RANGS).
export type DevolutionConfig = {
  mode: "cascadeExclusive";
  rangs: DevolutionRang[];
};

// Ordre PAR DÉFAUT = clause type Syntec (v1.12.0). FILET DE SÉCURITÉ appliqué dès
// que la config CCN est absente, malformée ou de mode inconnu : {conjoint, pacs,
// concubin} → enfants → ascendants → dévolution successorale. Reproduit À
// L'IDENTIQUE l'ancienne chaîne de `if` codée en dur.
const DEFAULT_DEVOLUTION_RANGS: DevolutionRang[] = [
  { qualites: ["conjoint", "pacs", "concubin"] },
  { qualites: ["enfants"], representation: true },
  { qualites: ["ascendants"] },
  { qualites: ["devolutionSuccessorale"] },
];

const DEVOLUTION_QUALITES_VALIDES: ReadonlySet<string> = new Set([
  "conjoint", "pacs", "concubin", "enfants", "ascendants", "devolutionSuccessorale",
]);

// Lecteur DÉFENSIF de la config depuis l'entrée CCN (idcc + référentiels). Même
// discipline que resolveCapitalDecesBranche : cast Record, typeof === "object",
// garde sur les tableaux, qualités inconnues filtrées, JAMAIS d'exception.
// Retourne null si la clé est absente, malformée ou de mode != "cascadeExclusive"
// → l'appelant retombe alors sur DEFAULT_DEVOLUTION_RANGS (ordre Syntec).
type DevolutionRangBrut = { qualites?: unknown; representation?: unknown };
type DevolutionConfigBrut = { mode?: unknown; rangs?: unknown };
export function resolveDevolutionCapitalDecesConfig(
  idcc: string | null,
  ref: Referentiels
): DevolutionConfig | null {
  if (!idcc) return null;
  const conventions = ref.ccn.conventions as Record<
    string,
    { devolutionCapitalDeces?: unknown } | undefined
  >;
  const raw = conventions?.[idcc]?.devolutionCapitalDeces;
  if (raw == null || typeof raw !== "object") return null;
  const d = raw as DevolutionConfigBrut;
  if (d.mode !== "cascadeExclusive" || !Array.isArray(d.rangs)) return null;
  const rangs: DevolutionRang[] = [];
  for (const r of d.rangs as unknown[]) {
    if (r == null || typeof r !== "object") continue;
    const rb = r as DevolutionRangBrut;
    if (!Array.isArray(rb.qualites)) continue;
    const qualites = (rb.qualites as unknown[]).filter(
      (q): q is DevolutionQualite => typeof q === "string" && DEVOLUTION_QUALITES_VALIDES.has(q)
    );
    rangs.push({ qualites, representation: rb.representation === true });
  }
  if (rangs.length === 0) return null;
  return { mode: "cascadeExclusive", rangs };
}

// Rangs effectifs : la config si elle est exploitable, sinon le repli Syntec.
function rangsEffectifs(config: DevolutionConfig | null | undefined): DevolutionRang[] {
  if (config && config.mode === "cascadeExclusive" && Array.isArray(config.rangs) && config.rangs.length > 0) {
    return config.rangs;
  }
  return DEFAULT_DEVOLUTION_RANGS;
}

// Qualité effective du partenaire de 1er rang. L'adaptateur la fournit
// explicitement (partenaireQualite) ; pour les appels directs « legacy » qui ne
// la portent pas, on la dérive du LABEL de relation (rétro-compat des tests de
// cascade pure). Toujours l'une de conjoint / pacs / concubin si un partenaire
// est présent → admise par le rang 1 par défaut, donc iso-comportement.
function qualitePartenaire(ctx: CapitalDecesBrancheDevolutionContexte): DevolutionQualite | undefined {
  if (!ctx.partenaireNom) return undefined;
  if (ctx.partenaireQualite) return ctx.partenaireQualite;
  if (ctx.partenaireRelation === "pacs_partner") return "pacs";
  if (ctx.partenaireRelation === "autre") return "concubin";
  return "conjoint";
}

// Cascade EXCLUSIVE pilotée par les `rangs` (data-driven, repli Syntec). Pour
// chaque rang dans l'ordre, on collecte les bénéficiaires PRÉSENTS dont la qualité
// est admise par ce rang ; le 1er rang non vide prend 100 % du capital (parts
// égales si plusieurs), return immédiat ; un rang vide est sauté ; tous les rangs
// vides → [] (« bénéficiaire à déterminer »). La surcharge manuelle REMPLACE toute
// la cascade. Tout est EXONÉRÉ : on répartit, on ne taxe rien. Jamais d'exception.
// `config` absente/null → DEFAULT_DEVOLUTION_RANGS (filet de sécurité Syntec).
export function devolutionCapitalDecesBrancheCascade(
  capital: number | null,
  ctx: CapitalDecesBrancheDevolutionContexte,
  config?: DevolutionConfig | null
): CapitalDecesRepartitionLigne[] {
  // Surcharge manuelle → prime (le salarié a modifié la clause au contrat).
  if (ctx.surcharge && ctx.surcharge.beneficiaires.length > 0) {
    return ctx.surcharge.beneficiaires.map((b) => ({
      beneficiaire: b.name || "Bénéficiaire",
      relation: b.relation,
      montant: Math.max(0, n(b.montant)),
      origine: "capital_principal" as const,
      source: "manuel" as const,
    }));
  }

  const cap = capital ?? 0;
  if (cap <= 0) return [];

  const partnerQualite = qualitePartenaire(ctx);
  for (const rang of rangsEffectifs(config)) {
    if (!rang || !Array.isArray(rang.qualites)) continue;
    const candidats: { beneficiaire: string; relation: CapitalDecesCaisseRelation }[] = [];
    for (const q of rang.qualites) {
      if (q === "conjoint" || q === "pacs" || q === "concubin") {
        // Le partenaire n'est retenu que si SA qualité figure dans ce rang
        // (seul axe de variation Syntec/HCR). Le LABEL de relation reste celui
        // posé par l'adaptateur (conjoint / pacs_partner / autre).
        if (ctx.partenaireNom && partnerQualite === q) {
          candidats.push({ beneficiaire: ctx.partenaireNom, relation: ctx.partenaireRelation ?? "conjoint" });
        }
      } else if (q === "enfants") {
        for (const e of ctx.enfants) candidats.push({ beneficiaire: e, relation: "enfant" });
      } else if (q === "ascendants") {
        // Rang déclaratif : le modèle ne porte pas les ascendants → souvent vide.
        for (const a of ctx.ascendants ?? []) candidats.push({ beneficiaire: a, relation: "ascendant" });
      } else if (q === "devolutionSuccessorale") {
        // Rang déclaratif : héritiers selon dévolution successorale, non portés
        // par le modèle → souvent vide. Label de relation "autre" (inchangé).
        for (const h of ctx.heritiers ?? []) candidats.push({ beneficiaire: h, relation: "autre" });
      }
      // toute autre qualité (déjà filtrée à la lecture) est ignorée.
    }
    if (candidats.length > 0) {
      const part = cap / candidats.length;
      return candidats.map((c) => ({
        beneficiaire: c.beneficiaire,
        relation: c.relation,
        montant: part,
        origine: "capital_principal" as const,
        source: "auto" as const,
      }));
    }
  }
  // Aucun rang alimenté → aucun bénéficiaire automatique (désignation invitée).
  return [];
}

// Dévolution du capital décès de BRANCHE pour le défunt `whichDefunt`, depuis le
// dossier. Construit le contexte à partir de coupleStatus (rang partenaire) et
// des enfants du défunt, lit la surcharge éventuelle au READ-TIME (jamais écrite
// ici), résout la config data-driven (idcc + référentiels, DEVOL-1), puis applique
// la cascade. `idcc`/`ref` sont optionnels : absents (appels legacy à 3 arguments),
// la config est null → repli sur l'ordre Syntec par défaut (iso-comportement). Les
// rangs ascendants/dévolution successorale ne sont pas portés par le modèle de
// données → rang sauté proprement. Fonction PURE.
export function devolutionCapitalDecesBranche(
  capital: number | null,
  data: PatrimonialData,
  whichDefunt: "p1" | "p2",
  idcc: string | null = null,
  ref: Referentiels = referentiels
): CapitalDecesRepartitionLigne[] {
  const deceasedKey = whichDefunt === "p1" ? "person1" : "person2";
  const survivorKey = deceasedKey === "person1" ? "person2" : "person1";

  // Rang partenaire — conjoint (marié), à défaut PACS, à défaut concubin notoire.
  // coupleStatus porte la distinction (married / pacs / cohab) ; divorced /
  // single → aucun partenaire. Le LABEL de relation (conjoint / pacs_partner /
  // autre) reste celui d'aujourd'hui ; la QUALITÉ (conjoint / pacs / concubin)
  // sert à tester l'admission par le rang selon la branche.
  const survivorNom = (survivorKey === "person1"
    ? `${data.person1FirstName ?? ""} ${data.person1LastName ?? ""}`
    : `${data.person2FirstName ?? ""} ${data.person2LastName ?? ""}`).trim();
  let partenaireNom: string | undefined;
  let partenaireRelation: CapitalDecesCaisseRelation | undefined;
  let partenaireQualite: DevolutionQualite | undefined;
  if (data.coupleStatus === "married") { partenaireNom = survivorNom || "Conjoint"; partenaireRelation = "conjoint"; partenaireQualite = "conjoint"; }
  else if (data.coupleStatus === "pacs") { partenaireNom = survivorNom || "Partenaire PACS"; partenaireRelation = "pacs_partner"; partenaireQualite = "pacs"; }
  else if (data.coupleStatus === "cohab") { partenaireNom = survivorNom || "Concubin"; partenaireRelation = "autre"; partenaireQualite = "concubin"; }

  // Rang enfants — enfants DU DÉFUNT (clause bénéficiaire : tous les enfants, sans
  // le filtre « à charge » propre au capital caisse L361-4 CSS).
  const enfants = data.childrenData
    .filter((c) => childMatchesDeceased(c.parentLink, deceasedKey))
    .map((c) => `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Enfant");

  // Surcharge lue au READ-TIME — jamais persistée pendant la consultation.
  const surcharge = data.prevoyance?.[whichDefunt]?.capitalDecesBrancheSurcharge;

  // Config de dévolution data-driven (DEVOL-1). null → repli Syntec par défaut.
  const config = resolveDevolutionCapitalDecesConfig(idcc, ref);

  return devolutionCapitalDecesBrancheCascade(capital, {
    partenaireNom, partenaireRelation, partenaireQualite, enfants, surcharge,
  }, config);
}

// ─── CALCUL SUCCESSION ────────────────────────────────────────────────────────

// ─── Helper SOURCE UNIQUE : composition fiscale lisible d'un héritier ──
// Utilisé par computeSuccession() (pour enrichir chaque result), par TabSuccession
// (rendu modal + tableau), et par les adapters PDF v2 (buildSuccessionAData).
// Format: "PP 100 000 € + NP fiscale 50 000 € + US fiscal 60 000 € (100 000 € × 60%)"
// Renvoie une string vide si tous les composants sont à 0.
export function formatCompositionFiscale(opts: {
  grossReceived: number;
  nueRawValue: number;
  nueValue: number;
  usufructRawValue: number;
  usufructFiscalValue: number;
  usufructPctPercent: number; // ex: 60 pour Duvergier âge 41-50
}): string {
  const parts: string[] = [];
  if (opts.grossReceived > 0)    parts.push(`PP ${euro(opts.grossReceived)}`);
  if (opts.nueRawValue > 0)      parts.push(`NP fiscale ${euro(opts.nueValue)}`);
  if (opts.usufructRawValue > 0) parts.push(`US fiscal ${euro(opts.usufructFiscalValue)} (${euro(opts.usufructRawValue)} × ${opts.usufructPctPercent}%)`);
  return parts.join(" + ");
}

export function getSuccessionTaxProfile(relation: string, handicap = false) {
  const HANDICAP_BONUS = 159325; // abattement supplémentaire cumulable — CGI art. 779 II
  if (relation === "enfant") {
    return {
      allowance: 100000 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe",
    };
  }
  if (relation === "frereSoeur") {
    return {
      allowance: 15932 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 24430, rate: 0.35 },
        { from: 24430, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème frère / sœur",
    };
  }
  if (relation === "neveuNiece") {
    return {
      allowance: 7967 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.55 }] as TaxBracket[],
      graphTitle: "Barème neveu / nièce",
    };
  }
  if (relation === "parent") {
    return {
      allowance: 100000 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe (ascendant)",
    };
  }
  if (relation === "petit-enfant") {
    return {
      allowance: 1594 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe (petit-enfant)",
    };
  }
  // Enfant du conjoint non adopté = tiers fiscal (1 594 € / 60%)
  if (relation === "enfant_conjoint") {
    return {
      allowance: 1594 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.6 }] as TaxBracket[],
      graphTitle: "Enfant du conjoint (tiers fiscal — 60%)",
    };
  }
  // NOTE : abattement handicap (159 325 €) est cumulable avec tout abattement légal
  // Il s'applique en supplément : abattement total = abattement relation + 159 325 €
  // À gérer via un flag "handicap" par héritier (prévu phase suivante)
  //
  // Distinction marié / PACS / concubin (vérifiée au 25/05/2026) :
  //  - "conjoint"      → marié : exonéré (art. 796-0 bis CGI, loi TEPA 22/08/2007).
  //  - "pacs_partner"  → PACS : exonéré aussi (art. 796-0 bis CGI, assimilation
  //                      explicite TEPA 2007). Hypothèse : le PACSé n'étant PAS
  //                      héritier légal (art. 731 CC), sa présence comme heir
  //                      implique une désignation testamentaire valide.
  //  - "autre" / défaut → tiers fiscal : abattement 1 594 € (art. 788 IV CGI) +
  //                      taux plat 60 %. C'est notamment le régime du concubin.
  const exemptRelation = relation === "conjoint" || relation === "pacs_partner";
  return {
    allowance: exemptRelation ? 0 : 1594 + (handicap ? HANDICAP_BONUS : 0),
    brackets: exemptRelation ? [] as TaxBracket[] : [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.6 }] as TaxBracket[],
    graphTitle:
      relation === "conjoint"     ? "Exonération conjoint" :
      relation === "pacs_partner" ? "Exonération partenaire PACS" :
      "Barème tiers (60%)",
  };
}

/**
 * Fiscalité AV :
 * - Avant 70 ans : art. 990 I — abattement 152 500 € / bénéficiaire, puis 20 % jusqu'à 700 k€, 31,25 % au-delà
 * - Après 70 ans : art. 757 B — abattement commun 30 500 € sur les primes (déjà alloué en amont), droits de succession selon barème lien
 *
 * FIX #3 — cette fonction est appelée UNE SEULE FOIS dans avLines ; results la réutilise depuis avLines.
 */
export function computeAvTax(relation: string, amountBefore70Capital: number, amountAfter70TaxableShare: number) {
  // Exonération TEPA (art. 796-0 bis CGI) : le conjoint marié ET le partenaire de
  // PACS sont exonérés du prélèvement 990 I (avant 70 ans) comme des droits de
  // succession (après 70 ans). Le concubin ("autre") reste TAXÉ comme un tiers.
  const isExoneraTEPA = relation === "conjoint" || relation === "pacs_partner";
  const before70Taxable = isExoneraTEPA ? 0 : Math.max(0, amountBefore70Capital - 152500);
  const before70Tax = isExoneraTEPA
    ? 0
    : before70Taxable <= 700000
      ? before70Taxable * 0.2
      : 700000 * 0.2 + (before70Taxable - 700000) * 0.3125;
  const profile = getSuccessionTaxProfile(relation);
  const after70Taxable = isExoneraTEPA ? 0 : Math.max(0, amountAfter70TaxableShare - profile.allowance);
  const after70Tax = isExoneraTEPA
    ? 0
    : computeTaxFromBrackets(after70Taxable, profile.brackets).tax;
  return {
    before70Tax,
    before70Taxable,
    after70Tax,
    after70Taxable,
    totalTax: before70Tax + after70Tax,
  };
}

export function computeSuccession(successionData: SuccessionData, data: PatrimonialData) {
  // Testament actif = supplante la dévolution légale
  const testamentMode = successionData.useTestament && (
    (successionData.legsMode === "global" && successionData.testamentHeirs.length > 0) ||
    (successionData.legsMode === "precis" && (successionData.legsPrecisItems || []).length > 0)
  );
  // Legs global : on convertit testamentHeirs en Heir[] avec les % saisis
  const buildLegsGlobalHeirs = (): Heir[] => {
    return successionData.testamentHeirs.map(h => {
      // Retrouver le childLink réel depuis la collecte si c'est un enfant
      const matchedChild = h.relation === "enfant"
        ? data.childrenData.find(c =>
            (c.firstName || "").toLowerCase() === h.firstName.toLowerCase() &&
            (c.lastName || "").toLowerCase() === h.lastName.toLowerCase()
          )
        : null;
      // Si l'enfant n'est pas biologique du défunt → tiers fiscal (enfant_conjoint)
      const effectiveRelation = matchedChild && !childMatchesDeceased(matchedChild.parentLink || "common_child", successionData.deceasedPerson)
        ? "enfant_conjoint"
        : h.relation;
      return {
        name: `${h.firstName} ${h.lastName}`.trim() || "Légataire",
        relation: effectiveRelation,
        share: h.shareGlobal || "0",
        priorDonations: h.priorDonations || "0",
        childLink: matchedChild ? (matchedChild.parentLink || "common_child") : (h.relation === "enfant" ? "common_child" : null),
      };
    });
  };
  // Legs précis : construire les héritiers depuis les items (nouvelle structure + rétrocompat)
  const buildLegsPrecisHeirs = (): Heir[] => {
    const seen = new Set<string>();
    const heirs: Heir[] = [];
    const addHeir = (name: string, relation: string) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      const matchedChild = relation === "enfant"
        ? data.childrenData.find(c =>
            (c.firstName || "").toLowerCase() === name.split(" ")[0]?.toLowerCase() &&
            (c.lastName || "").toLowerCase() === name.split(" ").slice(1).join(" ").toLowerCase()
          )
        : null;
      const effectiveRelation = matchedChild && !childMatchesDeceased(matchedChild.parentLink || "common_child", successionData.deceasedPerson)
        ? "enfant_conjoint"
        : relation;
      heirs.push({ name, relation: effectiveRelation, share: "0", priorDonations: "0", childLink: matchedChild?.parentLink || (relation === "enfant" ? "common_child" : null) });
    };
    (successionData.legsPrecisItems || []).forEach(item => {
      // Nouvelle structure : legataires[]
      if (item.legataires && item.legataires.length > 0) {
        item.legataires.forEach(l => {
          addHeir(l.heirName?.trim() || "", l.heirRelation);
          (l.contreparties || []).forEach(cp => addHeir(cp.heirName?.trim() || "", cp.heirRelation));
        });
      } else {
        // Ancienne structure (rétrocompat)
        addHeir((item as any).heirName?.trim() || "", (item as any).heirRelation);
        ((item as any).contreparties || []).forEach((cp: any) => addHeir(cp.heirName?.trim() || "", cp.heirRelation));
      }
    });
    return heirs;
  };

  const heirs = testamentMode && successionData.legsMode === "global"
    ? buildLegsGlobalHeirs()
    : testamentMode && successionData.legsMode === "precis"
      ? buildLegsPrecisHeirs()
      : successionData.heirs.length > 0
        ? successionData.heirs
        : buildCollectedHeirs(data, successionData.deceasedPerson);

  const deceasedKey = successionData.deceasedPerson;
  const survivorKey = deceasedKey === "person1" ? "person2" : "person1";
  const spouseEligible = isSpouseHeirEligible(data);
  const spouseOptions = getAvailableSpouseOptions(data, deceasedKey);
  const allowedSpouseValues = new Set(spouseOptions.map((o) => o.value));
  const spouseOption = spouseEligible && allowedSpouseValues.has(successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  const warnings: string[] = [];
  const reserveChildrenCount = data.childrenData.filter((c) => childMatchesDeceased(c.parentLink, deceasedKey)).length;
  const hasNonCommonChildren = testamentMode
    ? false
    : data.childrenData.some((c) => childMatchesDeceased(c.parentLink, deceasedKey) && c.parentLink !== "common_child");
  const usufruitierBirthDate = survivorKey === "person1" ? data.person1BirthDate : data.person2BirthDate;
  const usufruitierAge = getAgeFromBirthDate(usufruitierBirthDate);
  const demembrementPct = getDemembrementPercentages(usufruitierAge);

  if (!spouseEligible && spouseOption !== "none")
    warnings.push("Le conjoint n'a pas de vocation successorale automatique dans cette situation de couple.");
  if (spouseOption === "legal_usufruct_total" && hasNonCommonChildren)
    warnings.push("La totalité en usufruit n'est pas ouverte en dévolution légale en présence d'enfants non communs.");

  // ── Actif successoral immobilier ──
  const propertyLines: SuccessionPropertyLine[] = data.properties.map((property) => {
    const fullValue = Math.max(0, n(property.value));
    // Multi-crédits : capital restant total + assurance agrégée
    const loanAgg = resolveLoanValuesMulti(property);
    const debt = loanAgg.capital;
    const belongsToDeceased = property.ownership === deceasedKey || property.ownership === "common" || property.ownership === "indivision";
    // Quote-part du défunt selon type de propriété
    let baseShare = 0;
    if (property.ownership === "indivision") {
      // Quote-part exacte selon les % d'indivision saisis
      baseShare = deceasedKey === "person1"
        ? Math.min(1, Math.max(0, n(property.indivisionShare1) / 100 || 0.5))
        : Math.min(1, Math.max(0, n(property.indivisionShare2) / 100 || 0.5));
    } else if (property.ownership === "common" && data.matrimonialRegime !== "separation_biens") {
      baseShare = 0.5;
    } else if (property.ownership === deceasedKey) {
      baseShare = 1;
    }
    const rpAbatementEligible = property.type === "Résidence principale" && belongsToDeceased
      && (spouseEligible || data.childrenData.length > 0);

    // ── Crédit immobilier (calculé avant le bloc note pour que debtNote soit disponible) ──
    // Pour les biens communs ou en indivision : co-emprunteurs solidaires.
    // Après DC, le passif résiduel est ENTIÈREMENT à la charge du survivant (pas de la succession).
    // → netDebtShare = 0 : 100% de la quote-part du défunt passe en succession sans passif crédit.
    const isJointCredit = property.ownership === "common" || property.ownership === "indivision";
    const debtNote = isJointCredit && debt > 0 ? " — crédit solidaire : passif résiduel au survivant" : "";

    // Quote-part brute de dette (pour affichage et calcul assurance)
    const debtShareGross = property.ownership === "indivision"
      ? debt * baseShare
      : property.ownership === "common" && data.matrimonialRegime !== "separation_biens"
        ? debt * 0.5
        : property.ownership === deceasedKey ? debt : 0;

    // Assurance emprunteur DC — quotité agrégée par personne
    // Multi-crédits : moyenne pondérée des quotités DC sur tous les crédits avec assurance
    let insuranceRate = 0;
    if (property.loans && property.loans.length > 0) {
      const loansWithInsurance = loanAgg.loans.filter(r => r.loan.insurance && r.capital > 0);
      if (loansWithInsurance.length > 0) {
        const totalCap = loansWithInsurance.reduce((s, r) => s + r.capital, 0);
        for (const r of loansWithInsurance) {
          const w = totalCap > 0 ? r.capital / totalCap : 0;
          const rateForPerson = isJointCredit
            ? (deceasedKey === "person1"
                ? Math.min(100, Math.max(0, n(r.loan.insuranceRate1) || n(r.loan.insuranceRate)))
                : Math.min(100, Math.max(0, n(r.loan.insuranceRate2) || n(r.loan.insuranceRate))))
            : Math.min(100, Math.max(0, n(r.loan.insuranceRate)));
          insuranceRate += rateForPerson * w;
        }
      }
    } else if (property.loanInsurance) {
      if (isJointCredit) {
        insuranceRate = deceasedKey === "person1"
          ? Math.min(100, Math.max(0, n(property.loanInsuranceRate1) || n(property.loanInsuranceRate)))
          : Math.min(100, Math.max(0, n(property.loanInsuranceRate2) || n(property.loanInsuranceRate)));
      } else {
        insuranceRate = Math.min(100, Math.max(0, n(property.loanInsuranceRate)));
      }
    }
    const insuranceCover = debtShareGross * insuranceRate / 100;
    // Passif effectif : 0 pour commun/indivision (solidarité), sinon dette après DC
    const netDebtShare = isJointCredit ? 0 : Math.max(0, debtShareGross - insuranceCover);

    // Warnings crédit
    if (!isJointCredit && property.loanInsurance && insuranceRate > 0 && insuranceRate < 100 && debtShareGross > 0) {
      warnings.push(`${property.name || property.type} : assurance DC à ${insuranceRate}% → passif résiduel de ${Math.round(netDebtShare).toLocaleString("fr")} € à la charge de la succession.`);
    }
    if (isJointCredit && property.loanInsurance && debtShareGross > 0) {
      const survivorDebt = debtShareGross - insuranceCover;
      if (survivorDebt > 100) {
        warnings.push(`${property.name || property.type} : assurance DC à ${insuranceRate}% — passif résiduel de ${Math.round(survivorDebt).toLocaleString("fr")} € à la charge du survivant (solidarité crédit — hors succession).`);
      }
    }

    // ── Valeur successorale ──
    let estateValue = 0;
    let note = "";

    // Helper : calcule la valeur successorale d'une quote-part selon son droit
    const calcPartValue = (
      share: number,
      right: string,
      cpBirthDate: string,
      cpAge_fallback: string,
      cpLabel: string
    ): { value: number; noteStr: string } => {
      if (right === "usufruct") return { value: 0, noteStr: "Usufruit non retenu" };
      if (right === "bare") {
        const usufAge = cpBirthDate
          ? getAgeFromBirthDate(cpBirthDate)
          : (cpAge_fallback ? n(cpAge_fallback) : null);
        const dp = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
        if (!dp) {
          warnings.push(`Le bien « ${property.name || property.type} » (NP) : âge de l'usufruitier manquant.`);
          return { value: 0, noteStr: "NP non valorisable" };
        }
        return {
          value: fullValue * share * dp.nuePropriete,
          noteStr: `NP (${cpLabel} · ${usufAge} ans · ${Math.round(dp.nuePropriete * 100)}%)`,
        };
      }
      return { value: fullValue * share, noteStr: "PP" };
    };

    if (!belongsToDeceased) {
      note = "Bien hors succession du défunt";
    } else if ((property.ownership === "common" || property.ownership === "indivision") && (property.dismemberP1 || property.dismemberP2)) {
      // ── Démembrement dissocié par personne ──
      const isP1Deceased = deceasedKey === "person1";
      const dismember = isP1Deceased ? property.dismemberP1 : property.dismemberP2;
      if (dismember) {
        if (dismember.propertyRight === "usufruct") {
          // Usufruit du défunt s'éteint au décès — hors succession
          estateValue = 0;
          note = "Usufruit non retenu à l'actif successoral (s'éteint au décès)";
        } else {
          // NP ou PP : entre en succession
          const usufCounterpart = (dismember.counterparts || [])[0];
          const cpBirthDate = usufCounterpart?.birthDate || "";
          const cpLabel = usufCounterpart?.name || usufCounterpart?.relation || "usufruitier";
          const { value: v, noteStr } = calcPartValue(
            baseShare,
            dismember.propertyRight,
            cpBirthDate,
            "",
            cpLabel
          );
          estateValue = v;
          note = `${noteStr} (quote-part ${Math.round(baseShare * 100)}%)${debtNote}`;
        }
      } else {
        estateValue = fullValue * baseShare;
        note = `Part retenue (${Math.round(baseShare * 100)}%)${debtNote}`;
      }
    } else if (property.propertyRight === "usufruct") {
      note = "Usufruit non retenu à l'actif successoral (s'éteint au décès)";
    } else if (property.propertyRight === "bare") {
      const usufAge = property.counterpartBirthDate
        ? getAgeFromBirthDate(property.counterpartBirthDate)
        : (property.usufructAge ? n(property.usufructAge) : null);
      const dePercent = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
      estateValue = fullValue * baseShare * (dePercent ? dePercent.nuePropriete : 0);
      const counterLabel = property.counterpartName || property.counterpartRelation || "usufruitier";
      note = dePercent
        ? `Nue-propriété retenue — CGI art. 669 (âge ${counterLabel} : ${usufAge} ans)`
        : "Nue-propriété non valorisable sans âge de l'usufruitier";
      if (!dePercent)
        warnings.push(`Le bien « ${property.name || property.type} » est en nue-propriété mais l'âge de l'usufruitier n'est pas renseigné.`);
    } else {
      estateValue = fullValue * baseShare;
      note = property.ownership === "common"
        ? `Part communautaire retenue (50%)${debtNote}`
        : property.ownership === "indivision"
          ? `Quote-part indivision retenue (${Math.round(baseShare * 100)}%)${debtNote}`
          : "Bien propre retenu";
    }

    const residenceAbatement = rpAbatementEligible ? estateValue * 0.2 : 0;

    return {
      name: property.name || property.type,
      grossEstateValue: estateValue,
      residenceAbatement,
      debtShare: netDebtShare,       // 0 pour common/indivision (solidarité crédit)
      debtShareGross,                // quote-part brute de dette (informatif)
      insuranceCover,
      insuranceRate,
      netEstateValue: Math.max(0, estateValue - residenceAbatement - netDebtShare),
      note,
    };
  });

  // ── Actif successoral placements hors AV ──
  const placementLines: SuccessionPlacementLine[] = data.placements.map((placement) => {
    const value = Math.max(0, n(placement.deathValue || placement.value));
    const belongsToDeceased = placement.ownership === deceasedKey || placement.ownership === "common";
    const baseShare = placement.ownership === "common" && data.matrimonialRegime !== "separation_biens" ? 0.5
      : placement.ownership === deceasedKey ? 1 : 0;
    return {
      name: placement.name || placement.type,
      netEstateValue: belongsToDeceased && !isAV(placement.type) ? value * baseShare : 0,
      note: !belongsToDeceased ? "Placement hors succession du défunt"
        : isAV(placement.type) ? "Assurance-vie hors actif successoral classique"
          : placement.ownership === "common" ? "Part communautaire retenue" : "Placement propre retenu",
    };
  });

  // ── Lignes AV — FIX #3 : calcul de la fiscalité ici, réutilisé dans results ──
  // AV + PER : même régime successoral 990I / 757B
  const avContracts = data.placements.filter(
    (p) => (isAV(p.type) || isPERType(p.type)) && (p.ownership === deceasedKey || p.ownership === "common")
  );
  const totalAfter70Pool = avContracts.reduce((s, p) => s + Math.max(0, n(p.premiumsAfter70)), 0);
  const totalAfter70TaxablePool = Math.max(0, totalAfter70Pool - 30500);

  // ── Phase 1 : Collecter les montants par contrat (sans encore calculer la taxe) ──
  // La taxe 990I s'applique sur le TOTAL reçu par bénéficiaire, pas contrat par contrat.
  // L'abattement de 152 500 € est global par bénéficiaire, tous contrats confondus.
  type AvLineRaw = {
    contract: string; beneficiary: string; relation: string; sharePct: number;
    amount: number; amountBefore70Capital: number; amountAfter70Premiums: number; amountAfter70TaxableShare: number;
  };
  const avLinesRaw: AvLineRaw[] = avContracts.flatMap((placement) => {
    const rawValue = Math.max(0, n(placement.value));
    // Nantissement : réduire capital AV du crédit in fine nanti
    const placementIndexInData = data.placements.indexOf(placement);
    const pledgedProperty = data.properties.find(
      p => (p.loans && p.loans.length > 0
        ? p.loans.some(l => l.type === "in_fine" && +(l.pledgedPlacementIndex || "-1") === placementIndexInData)
        : p.loanEnabled && p.loanType === "in_fine" && +(p.loanPledgedPlacementIndex || "-1") === placementIndexInData)
    );
    let pledgedDebt = 0;
    if (pledgedProperty) {
      const lv = resolveLoanValuesMulti(pledgedProperty);
      const insurRate = pledgedProperty.loanInsurance ? Math.min(100, Math.max(0, n(pledgedProperty.loanInsuranceRate))) : 0;
      pledgedDebt = lv.capital * (1 - insurRate / 100);
    }
    const contractValue = Math.max(0, rawValue - pledgedDebt);
    const exemptCapital = Math.min(Math.max(0, n(placement.exemptFromSuccession)), contractValue);
    const taxableContractValue = contractValue - exemptCapital;
    const before70PremiumPool = Math.max(0, n(placement.premiumsBefore70));
    const after70Pool = Math.max(0, n(placement.premiumsAfter70));
    const totalPremiumPool = before70PremiumPool + after70Pool;
    const before70CapRatio = totalPremiumPool > 0 ? before70PremiumPool / totalPremiumPool : 1;
    const before70CapPool = taxableContractValue * before70CapRatio;
    const after70TaxableContractPool = totalAfter70Pool > 0
      ? totalAfter70TaxablePool * (after70Pool / totalAfter70Pool)
      : 0;
    return placement.beneficiaries.map((beneficiary, index) => {
      const sharePct = Math.max(0, n(beneficiary.share));
      const shareRatio = sharePct / 100;
      return {
        contract: placement.name || placement.type,
        beneficiary: beneficiary.name || `Bénéficiaire ${index + 1}`,
        relation: beneficiary.relation || "autre",
        sharePct,
        amount: contractValue * shareRatio,
        amountBefore70Capital: before70CapPool * shareRatio,
        amountAfter70Premiums: after70Pool * shareRatio,
        amountAfter70TaxableShare: after70TaxableContractPool * shareRatio,
        pledgedDebt: pledgedDebt * shareRatio,
      };
    });
  });

  // ── Phase 2 : Agréger par bénéficiaire et calculer la taxe 990I UNE SEULE FOIS ──
  // Construire un map : nom bénéficiaire → totaux cumulés tous contrats
  const benefMap: Record<string, { relation: string; totalBefore70: number; totalAfter70Taxable: number }> = {};
  for (const l of avLinesRaw) {
    if (!benefMap[l.beneficiary]) benefMap[l.beneficiary] = { relation: l.relation, totalBefore70: 0, totalAfter70Taxable: 0 };
    benefMap[l.beneficiary].totalBefore70 += l.amountBefore70Capital;
    benefMap[l.beneficiary].totalAfter70Taxable += l.amountAfter70TaxableShare;
  }
  // Calculer la taxe agrégée par bénéficiaire (abattement 152 500 € appliqué une fois)
  const benefTaxMap: Record<string, { before70Tax: number; after70Tax: number; totalTax: number; before70Taxable: number; after70Taxable: number }> = {};
  for (const [name, agg] of Object.entries(benefMap)) {
    const avTax = computeAvTax(agg.relation, agg.totalBefore70, agg.totalAfter70Taxable);
    benefTaxMap[name] = {
      before70Tax: avTax.before70Tax, after70Tax: avTax.after70Tax, totalTax: avTax.totalTax,
      before70Taxable: avTax.before70Taxable, after70Taxable: avTax.after70Taxable,
    };
  }
  // ── Phase 3 : Construire avLines avec taxe pro-ratée par contrat pour l'affichage ──
  const avLines: SuccessionAvLine[] = avLinesRaw.map((l) => {
    const agg = benefMap[l.beneficiary];
    const tax = benefTaxMap[l.beneficiary];
    // Pro-rata : part de ce contrat dans le total avant70 du bénéficiaire
    const ratioBefore70 = agg.totalBefore70 > 0 ? l.amountBefore70Capital / agg.totalBefore70 : 0;
    const ratioAfter70 = agg.totalAfter70Taxable > 0 ? l.amountAfter70TaxableShare / agg.totalAfter70Taxable : 0;
    return {
      ...l,
      before70Tax: tax.before70Tax * ratioBefore70,
      after70Tax: tax.after70Tax * ratioAfter70,
      totalTax: tax.before70Tax * ratioBefore70 + tax.after70Tax * ratioAfter70,
    };
  });

  // ── Masses successorales ──
  const propertyEstateBrut = propertyLines.reduce((s, l) => s + l.netEstateValue, 0);
  const placementsSuccession = placementLines.reduce((s, l) => s + l.netEstateValue, 0);
  const furnitureForfait = Math.max(0, (propertyEstateBrut + placementsSuccession) * 0.05);
  const collectedPropertyEstate = propertyEstateBrut + furnitureForfait;
  const activeNet = collectedPropertyEstate + placementsSuccession;

  const eligibleChildren = testamentMode
    ? heirs.filter((h) => h.relation === "enfant")
    : heirs.filter((h) => h.relation === "enfant" && childMatchesDeceased(h.childLink, deceasedKey));
  const childrenCount = eligibleChildren.length;
  const quotiteDisponible = getQuotiteDisponible(reserveChildrenCount);

  // En mode testament, l'option conjoint est ignorée si le legs couvre déjà le patrimoine
  const testamentCoversAll = testamentMode && (
    (successionData.legsMode === "global" && successionData.testamentHeirs.length > 0) ||
    (successionData.legsMode === "precis" && (successionData.legsPrecisItems || []).length > 0)
  );

  let spouseFullFraction = 0;
  let spouseUsufructFraction = 0;
  if (!testamentCoversAll) {
    switch (spouseOption) {
      case "legal_quarter_full": spouseFullFraction = spouseEligible ? 0.25 : 0; break;
      case "legal_usufruct_total": spouseUsufructFraction = spouseEligible && !hasNonCommonChildren ? 1 : 0; break;
      case "ddv_usufruct_total": spouseUsufructFraction = spouseEligible ? 1 : 0; break;
      case "ddv_quarter_full_3q_usufruct":
        spouseFullFraction = spouseEligible ? 0.25 : 0;
        spouseUsufructFraction = spouseEligible ? 0.75 : 0;
        break;
      case "ddv_quotite_disponible": spouseFullFraction = spouseEligible ? quotiteDisponible : 0; break;
    }
  }

  if (reserveChildrenCount > 0 && spouseFullFraction > quotiteDisponible + 1e-9)
    warnings.push("La pleine propriété attribuée au conjoint dépasse la quotité disponible.");
  if (spouseUsufructFraction > 0 && usufruitierAge === null)
    warnings.push("La date de naissance du conjoint survivant doit être renseignée pour valoriser le démembrement.");

  const childNueFraction = spouseUsufructFraction > 0 && childrenCount > 0
    ? (1 - spouseFullFraction) / childrenCount : 0;
  const childFullFraction = spouseUsufructFraction > 0
    ? 0
    : childrenCount > 0 ? Math.max(0, 1 - spouseFullFraction) / childrenCount : 0;

  const legalReserveAmount = reserveChildrenCount > 0 ? activeNet * (1 - quotiteDisponible) : 0;
  const legalDisposableAmount = reserveChildrenCount > 0 ? activeNet * quotiteDisponible : activeNet;

  // ── Résultats par héritier ──
  // En legs global : les fractions viennent du % saisi par héritier
  // En dévolution légale : fractions calculées (conjoint + enfants éligibles)
  const results: SuccessionResult[] = heirs.map((heir) => {
    let fraction = 0;
    let nueFraction = 0;
    let usufructFraction = 0;

    if (testamentCoversAll && successionData.legsMode === "global") {
      // Legs global : fraction = % saisi / 100
      const shareGlobal = +(heir.share || "0") / 100;
      const right = (successionData.testamentHeirs.find(
        th => (`${th.firstName} ${th.lastName}`.trim() || "Légataire") === heir.name
      )?.propertyRight) || "full";
      if (right === "usufruct") usufructFraction = shareGlobal;
      else if (right === "bare") nueFraction = shareGlobal;
      else fraction = shareGlobal;
    } else if (testamentCoversAll && successionData.legsMode === "precis") {
      // Legs précis : valeur totale reçue = items principaux + contreparties
      const _dk = successionData.deceasedPerson;
      const getAssetBaseValue = (it: { propertyIndex: number; assetType: string }) => {
        const _rp = it.assetType === "property" ? data.properties[it.propertyIndex] : null;
        const _rv = it.assetType === "property" ? n(_rp?.value) : n(data.placements[it.propertyIndex]?.value);
        const _bs = _rp
          ? _rp.ownership === "indivision"
            ? (_dk === "person1" ? Math.min(1, Math.max(0, n(_rp.indivisionShare1) / 100 || 0.5)) : Math.min(1, Math.max(0, n(_rp.indivisionShare2) / 100 || 0.5)))
            : _rp.ownership === "common" ? 0.5 : 1
          : 1;
        return _rv * _bs;
      };
      const getUsufructDate = (it: { propertyRight: string; heirBirthDate: string; contreparties?: { heirBirthDate: string }[] }) =>
        it.propertyRight === "usufruct" ? it.heirBirthDate : (it.contreparties||[])[0]?.heirBirthDate || "";

      let totalFiscalValue = 0;

      // Helper : valeur de base d'un bien (tient compte indivision/communauté)
      const getAssetBaseValueFree = (freeValue: string) => n(freeValue) || 0;

      // Valeur totale de l'actif net pour le calcul du résiduel
      const totalBiensExplicites = (successionData.legsPrecisItems || [])
        .filter(it => !it.isResidual)
        .reduce((s, it) => {
          if (it.assetType === "free") return s + (n(it.freeValue) || 0);
          return s + getAssetBaseValue(it);
        }, 0);

      (successionData.legsPrecisItems || []).forEach(it => {
        // Valeur de base du bien
        let av: number;
        if (it.assetType === "free") {
          av = it.isResidual ? Math.max(0, activeNet - totalBiensExplicites) : (n(it.freeValue) || 0);
        } else {
          av = it.isResidual ? Math.max(0, activeNet - totalBiensExplicites) : getAssetBaseValue(it);
        }

        // Nouvelle structure : legataires[]
        const legataires = it.legataires && it.legataires.length > 0
          ? it.legataires
          : (it as any).heirName ? [{ heirName: (it as any).heirName, heirRelation: (it as any).heirRelation, heirBirthDate: (it as any).heirBirthDate, sharePercent: (it as any).sharePercent, propertyRight: (it as any).propertyRight || "full", contreparties: (it as any).contreparties || [] }]
          : [];

        legataires.forEach(l => {
          if ((l.heirName?.trim() || "") === heir.name) {
            const sv = n(l.sharePercent) / 100;
            const ub = l.propertyRight === "usufruct" ? l.heirBirthDate : (l.contreparties||[])[0]?.heirBirthDate || "";
            const ua = ub ? getAgeFromBirthDate(ub) : null;
            const dp = (l.propertyRight === "bare" || l.propertyRight === "usufruct") && ua !== null ? getDemembrementPercentages(ua) : null;
            if (dp && l.propertyRight === "usufruct") totalFiscalValue += av * sv * dp.usufruct;
            else if (dp && l.propertyRight === "bare") totalFiscalValue += av * sv * dp.nuePropriete;
            else totalFiscalValue += av * sv;
          }
          // Contreparties
          (l.contreparties || [])
            .filter(cp => (cp.heirName?.trim() || "") === heir.name)
            .forEach(cp => {
              const cpSv = n(cp.sharePercent) / 100;
              const cpRight = l.propertyRight === "usufruct" ? "bare" : "usufruct";
              const ub = cpRight === "usufruct" ? cp.heirBirthDate : (l.propertyRight === "usufruct" ? l.heirBirthDate : (l.contreparties||[])[0]?.heirBirthDate || "");
              const ua = ub ? getAgeFromBirthDate(ub) : null;
              const dp = ua !== null ? getDemembrementPercentages(ua) : null;
              if (dp && cpRight === "usufruct") totalFiscalValue += av * cpSv * dp.usufruct;
              else if (dp && cpRight === "bare") totalFiscalValue += av * cpSv * dp.nuePropriete;
              else totalFiscalValue += av * cpSv;
            });
        });
      });

      if (activeNet > 0) fraction = totalFiscalValue / activeNet;
      else fraction = 0;
    } else if (heir.relation === "conjoint") {
      fraction = spouseFullFraction;
      usufructFraction = spouseUsufructFraction;
    } else if (heir.relation === "enfant") {
      // Vérification filiation : l'enfant doit être héritier du défunt
      const isEligible = testamentMode || childMatchesDeceased(heir.childLink, deceasedKey);
      if (isEligible) {
        fraction = childFullFraction;
        nueFraction = childNueFraction;
      }
    }

    const grossReceived = activeNet * fraction;
    const nueRawValue = activeNet * nueFraction;
    const nueValue = nueRawValue * demembrementPct.nuePropriete;
    const usufructRawValue = activeNet * usufructFraction;
    // NOTE : usufructTaxValue n'entre PAS dans successionTaxable (FIX #2)
    // Le conjoint est exonéré de droits de succession (CGI art. 796-0 bis).

    // ── AV/PER : taxe agrégée par bénéficiaire (abattement 152 500 € appliqué une fois) ──
    const avForHeir = avLines.filter((l) => l.beneficiary === heir.name);
    const avReceived = avForHeir.reduce((s, l) => s + l.amount, 0);
    // Utiliser benefTaxMap pour la taxe totale — calculée sur le cumul tous contrats
    const avDuties = benefTaxMap[heir.name]?.totalTax ?? 0;
    const avTaxableBefore70 = benefTaxMap[heir.name]?.before70Taxable ?? 0;
    const avTaxableAfter70 = benefTaxMap[heir.name]?.after70Taxable ?? 0;

    // ── Droits de succession (hors AV) ──
    // Vérifier si cet héritier est un enfant handicapé (depuis la collecte)
    const heirIsHandicap = data.childrenData.some(c =>
      (`${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase() === heir.name.toLowerCase()) && c.handicap
    );
    const profile = getSuccessionTaxProfile(heir.relation, heirIsHandicap);
    // FIX #2 : base = grossReceived + nueValue uniquement (pas usufructTaxValue)
    const residualAllowance = Math.max(0, profile.allowance - Math.max(0, n(heir.priorDonations)));
const successionTaxable = Math.max(0, grossReceived + nueValue - residualAllowance);
    const successionCalc = profile.brackets.length > 0
      ? computeTaxFromBrackets(successionTaxable, profile.brackets)
      : { tax: 0, fill: [] as FilledBracket[] };
    const successionDuties = successionCalc.tax;

    const duties = successionDuties + avDuties;

    // FIX #4 : netReceived cohérent — le conjoint reçoit aussi usufructRawValue économiquement
    const successionNetReceived = Math.max(0, grossReceived + nueRawValue + usufructRawValue - successionDuties);
    const avNetReceived = Math.max(0, avReceived - avDuties);
    const netReceived = successionNetReceived + avNetReceived;

    const currentBracket = successionCalc.fill.find((s) => successionTaxable <= s.to) || successionCalc.fill[successionCalc.fill.length - 1];
    const visualMax = currentBracket ? (Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(successionTaxable, 1)) : 1;
    const indicatorPct = successionTaxable > 0 && visualMax > 0 ? Math.min(100, Math.max(0, (successionTaxable / visualMax) * 100)) : 0;

    // ── Valeurs fiscales dérivées (source unique pour UI + PDF) ──
    // Formule fiscale taxable : PP + NP fiscale (Duvergier nue) + Usufruit fiscal (Duvergier usufruit).
    // Référence : CGI art. 669 (barème usufruit/nue-propriété par âge).
    const usufructFiscalValue = Math.round(usufructRawValue * demembrementPct.usufruct);
    const partRecueFiscale = grossReceived + nueValue + usufructFiscalValue;
    const netFiscal = Math.max(0, partRecueFiscale - successionDuties) + avNetReceived;
    const compositionFiscale = formatCompositionFiscale({
      grossReceived,
      nueRawValue,
      nueValue,
      usufructRawValue,
      usufructFiscalValue,
      usufructPctPercent: Math.round(demembrementPct.usufruct * 100),
    });

    return {
      name: heir.name,
      relation: heir.relation,
      fraction, nueFraction, usufructFraction,
      grossReceived, nueRawValue, nueValue, usufructRawValue,
      avReceived, successionTaxable, successionDuties, avDuties, duties,
      netReceived, successionNetReceived, avNetReceived,
      avTaxableBefore70, avTaxableAfter70,
      bracketFill: successionCalc.fill,
      graphTitle: profile.graphTitle,
      allowance: profile.allowance,
      indicatorPct, visualMax,
      currentBracketLabel: currentBracket?.label || "—",
      effectiveReceived: grossReceived + nueRawValue + usufructRawValue + avReceived,
      // Source unique des valeurs dérivées
      partRecueFiscale, netFiscal, usufructFiscalValue, compositionFiscale,
    };
  });

  // ── Graphique de référence (héritier le plus taxé) ──
  const taxableResults = results.filter((r) => r.successionTaxable > 0 && r.bracketFill.length > 0);
  const reference = [...taxableResults].sort((a, b) => b.successionTaxable - a.successionTaxable)[0] || null;
  const successionBracketFill = reference ? reference.bracketFill : [];
  const successionCurrentBracket = reference
    ? successionBracketFill.find((s) => reference.successionTaxable <= s.to) || successionBracketFill[successionBracketFill.length - 1]
    : null;
  const successionVisualMax = successionCurrentBracket
    ? (Number.isFinite(successionCurrentBracket.to) ? successionCurrentBracket.to : Math.max(reference.successionTaxable, 1))
    : 1;
  const successionIndicatorPct = reference ? Math.min(100, Math.max(0, (reference.successionTaxable / successionVisualMax) * 100)) : 0;

  // ── Camemberts ──
  const pieData: PieDatum[] = [
    legalReserveAmount > 0 ? { name: "Réserve légale", holder: `${reserveChildrenCount} enfant(s)`, value: legalReserveAmount } : null,
    legalDisposableAmount > 0 ? { name: reserveChildrenCount > 0 ? "Quotité disponible" : "Masse disponible", holder: spouseEligible ? "Conjoint / disposition" : "Libre disposition", value: legalDisposableAmount } : null,
  ].filter((e): e is PieDatum => Boolean(e));

  const receivedPieData: PieDatum[] = results
    .filter((r) => r.effectiveReceived > 0)
    .map((r) => ({ name: r.name, holder: r.relation, value: r.effectiveReceived }));

  const patrimoineLeguePieData: PieDatum[] = results
    .filter((r) => r.grossReceived + r.nueValue > 0)
    .map((r) => ({ name: r.name, holder: r.grossReceived > 0 ? "PP" : "NP", value: r.grossReceived + r.nueValue }));

  // ── Vérification réserve ──
  const reserveAllocatedToChildren = results
    .filter((r) => r.relation === "enfant")
    .reduce((s, r) => s + r.grossReceived + r.nueRawValue, 0);
  if (reserveChildrenCount > 0 && reserveAllocatedToChildren + 0.5 < legalReserveAmount) {
    warnings.push(`Réserve héréditaire spoliée : les enfants devraient recevoir au moins ${euro(legalReserveAmount)}, mais la simulation ne leur attribue que ${euro(reserveAllocatedToChildren)}.`);
  }

  // ════════════════════════════════════════════════════════════════════
  // CAPITAUX DÉCÈS HORS ACTIF SUCCESSORAL (Lot 3). Sortie PARALLÈLE à avLines :
  // n'entrent PAS dans activeNet / totalRights / totalSuccessionRights /
  // totalAvRights (qui restent strictement inchangés).
  // ════════════════════════════════════════════════════════════════════

  // ── Source 1 : capitaux décès des CAISSES (régime obligatoire du défunt) ──
  // EXONÉRÉS, hors succession (capital décès Sécurité sociale — BOFiP). Aucun
  // calcul fiscal : capital + capital orphelin + rentes de survie/éducation
  // (montants ANNUELS, jamais sommés avec des capitaux).
  const whichDefunt: "p1" | "p2" = deceasedKey === "person1" ? "p1" : "p2";
  const entreeDefunt = buildEntreePerso(data, whichDefunt);
  const caissesRef = (referentiels.caisses as { caisses?: Record<string, unknown> }).caisses ?? {};
  const capitalDecesCaisseLines: CapitalDecesCaisseLine[] = [];
  const rentesSurvieAnnuelles: RenteSurvieAnnuelle[] = [];
  if (entreeDefunt && entreeDefunt.caisse) {
    // buildEntreePerso ne pose pas la config CIPAV par points (injectée live
    // côté projection) : on la rebranche depuis la saisie persistée si présente,
    // sinon une caisse CIPAV retombe honnêtement sur donneeIndisponible.
    const entreeAvecCipav = { ...entreeDefunt, cipav: data.prevoyance?.[whichDefunt]?.cipav };
    const caisseRef = caissesRef[entreeDefunt.caisse];
    const cap = resolveCapitauxDeces(caisseRef, entreeAvecCipav, referentiels.cipav);
    const nbEnfants = Math.max(0, entreeDefunt.nbEnfantsACharge ?? 0);
    const capitalOrphelinTotal =
      cap.capitalParEnfant != null ? cap.capitalParEnfant * nbEnfants : undefined;

    // ── Dévolution (P3) — cascade légale L361-4 CSS ou surcharge manuelle ──
    // Conjoint/PACS du foyer (concubin EXCLU) = survivant marié/PACSé.
    const conjointPresent = data.coupleStatus === "married" || data.coupleStatus === "pacs";
    const conjointRelation: "conjoint" | "pacs_partner" =
      data.coupleStatus === "pacs" ? "pacs_partner" : "conjoint";
    const conjointNom = conjointPresent
      ? (survivorKey === "person1"
          ? `${data.person1FirstName ?? ""} ${data.person1LastName ?? ""}`
          : `${data.person2FirstName ?? ""} ${data.person2LastName ?? ""}`).trim() || "Conjoint"
      : undefined;
    // Enfants à charge DU DÉFUNT (childMatchesDeceased) ET rattachés au foyer —
    // même prédicat « à charge » que les parts fiscales (rattached !== false).
    const enfantsACharge = data.childrenData
      .filter((c) => childMatchesDeceased(c.parentLink, deceasedKey) && c.rattached !== false)
      .map((c) => `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Enfant");
    const surcharge = data.prevoyance?.[whichDefunt]?.capitalDecesCaisseSurcharge;
    const repartition = devolutionCapitalDecesCaisse(cap.capital, cap.capitalParEnfant, {
      conjointPresent, conjointNom, conjointRelation, enfantsACharge, surcharge,
    });

    capitalDecesCaisseLines.push({
      source: cap.source,
      capital: cap.capital,
      capitalParEnfant: cap.capitalParEnfant,
      nbEnfants,
      capitalOrphelinTotal,
      renteConjointAnnuelle: cap.renteConjointAnnuelle,
      renteEducationAnnuelle: cap.renteEducationAnnuelle,
      renteSurvieOrphelinAnnuelle: cap.renteSurvieOrphelinAnnuelle,
      situationRetenue: cap.situationRetenue,
      donneeIndisponible: cap.donneeIndisponible,
      exonere: true,
      repartition,
    });
    if (cap.renteConjointAnnuelle != null)
      rentesSurvieAnnuelles.push({ source: cap.source, type: "conjoint", montantAnnuel: cap.renteConjointAnnuelle });
    if (cap.renteEducationAnnuelle != null)
      rentesSurvieAnnuelles.push({ source: cap.source, type: "education", montantAnnuel: cap.renteEducationAnnuelle });
    if (cap.renteSurvieOrphelinAnnuelle != null)
      rentesSurvieAnnuelles.push({ source: cap.source, type: "survie_orphelin", montantAnnuel: cap.renteSurvieOrphelinAnnuelle });
  }
  const capitalDecesCaisseExonere = capitalDecesCaisseLines.reduce((s, l) => s + (l.capital ?? 0), 0);

  // ── Source 2 : contrats de prévoyance décès PRIVÉS (transmission) ──
  // Fiscalité 990 I via computeAvTax. Abattement 152 500 €/bénéficiaire COMMUN
  // avec les AV (recon #3) : consommé AV-FIRST → le contrat privé porte la taxe
  // MARGINALE sur l'abattement résiduel ; les avLines / totalAvRights restent
  // strictement inchangés. share est DÉJÀ un number (Lot 2) : lu tel quel
  // (clamp 0-100), sans conversion string→number.
  // Pont R2 : contrats de transmission RÉELS + anciens deces_capital mappés
  // (read-time, non destructif). C'est l'UNIQUE source côté succession → pas de
  // double-comptage (la succession ne lisait jamais le legacy auparavant).
  const contratsTransmission = getContratsTransmissionDecesAvecLegacy(getPrevoyancePerso(data, whichDefunt));
  type PriveRaw = {
    contrat: string; beneficiary: string; relation: string; sharePct: number;
    montant: number; natureAssiette: ContratTransmissionDeces["natureAssiette"]; assiette990I: number;
  };
  const priveRaw: PriveRaw[] = contratsTransmission.flatMap((c) => {
    const capitalTransmis = Math.max(0, typeof c.capitalTransmis === "number" ? c.capitalTransmis : 0);
    const primesAvant70 = Math.max(0, typeof c.primesAvant70 === "number" ? c.primesAvant70 : 0);
    const assietteBase = c.natureAssiette === "capital" ? capitalTransmis : primesAvant70;
    return (c.beneficiaires ?? []).map((b, index) => {
      const sharePct = Math.min(100, Math.max(0, typeof b.share === "number" ? b.share : 0));
      const ratio = sharePct / 100;
      return {
        contrat: c.libelle || "Contrat transmission",
        beneficiary: b.name || `Bénéficiaire ${index + 1}`,
        relation: b.relation || "autre",
        sharePct,
        montant: capitalTransmis * ratio,
        natureAssiette: c.natureAssiette,
        assiette990I: assietteBase * ratio,
      };
    });
  });
  // Agrégation par bénéficiaire (assiette 990 I cumulée tous contrats privés).
  const priveAssietteByBenef: Record<string, { relation: string; assiette: number }> = {};
  for (const l of priveRaw) {
    if (!priveAssietteByBenef[l.beneficiary]) priveAssietteByBenef[l.beneficiary] = { relation: l.relation, assiette: 0 };
    priveAssietteByBenef[l.beneficiary].assiette += l.assiette990I;
  }
  // Taxe MARGINALE par bénéficiaire = 990I(avBefore70 + assiettePrivée) − 990I(avBefore70).
  // avBefore70 = pool AV avant-70 du même bénéficiaire (benefMap) → l'abattement
  // 152 500 € déjà consommé par les AV n'est PAS recompté.
  const priveTaxByBenef: Record<string, { duties: number; taxable: number }> = {};
  for (const [name, agg] of Object.entries(priveAssietteByBenef)) {
    const avBefore70 = benefMap[name]?.totalBefore70 ?? 0;
    const baseline = computeAvTax(agg.relation, avBefore70, 0);
    const combined = computeAvTax(agg.relation, avBefore70 + agg.assiette, 0);
    priveTaxByBenef[name] = {
      duties: Math.max(0, combined.before70Tax - baseline.before70Tax),
      taxable: Math.max(0, combined.before70Taxable - baseline.before70Taxable),
    };
  }
  // Pro-rata par ligne (part de l'assiette du bénéficiaire portée par ce contrat).
  const capitalDecesPriveLinesTaxees: CapitalDecesPriveLine[] = priveRaw.map((l) => {
    const agg = priveAssietteByBenef[l.beneficiary];
    const tax = priveTaxByBenef[l.beneficiary];
    const ratio = agg.assiette > 0 ? l.assiette990I / agg.assiette : 0;
    return {
      contrat: l.contrat, beneficiary: l.beneficiary, relation: l.relation, sharePct: l.sharePct,
      montant: l.montant, natureAssiette: l.natureAssiette, assiette990I: l.assiette990I,
      before70Taxable: tax.taxable * ratio,
      duties: tax.duties * ratio,
    };
  });
  // Option A (R2) — contrats SANS bénéficiaire (deces_capital migré OU contrat de
  // transmission saisi sans bénéficiaire) : le capital est VISIBLE mais NON taxé
  // (aucune relation → pas de computeAvTax), marqué beneficiairesARenseigner.
  // CHANGEMENT DE COMPORTEMENT ASSUMÉ : avant R2, un tel contrat (priveRaw vide)
  // ne produisait AUCUNE ligne ; il en produit désormais une, à 0 droit.
  // Les contrats AVEC bénéficiaire passent par le pipeline ci-dessus, inchangé.
  const capitalDecesPriveLinesSansBenef: CapitalDecesPriveLine[] = contratsTransmission
    .filter((c) => (c.beneficiaires ?? []).length === 0)
    .map((c) => {
      const capitalTransmis = Math.max(0, typeof c.capitalTransmis === "number" ? c.capitalTransmis : 0);
      const primesAvant70 = Math.max(0, typeof c.primesAvant70 === "number" ? c.primesAvant70 : 0);
      return {
        contrat: c.libelle || "Contrat transmission",
        beneficiary: "",
        relation: "",
        sharePct: 0,
        montant: capitalTransmis,
        natureAssiette: c.natureAssiette,
        assiette990I: c.natureAssiette === "capital" ? capitalTransmis : primesAvant70,
        before70Taxable: 0,
        duties: 0,
        beneficiairesARenseigner: true,
      };
    });
  const capitalDecesPriveLines = [...capitalDecesPriveLinesTaxees, ...capitalDecesPriveLinesSansBenef];
  const capitalDecesPriveCapital = capitalDecesPriveLines.reduce((s, l) => s + l.montant, 0);
  const capitalDecesPriveDuties = capitalDecesPriveLines.reduce((s, l) => s + l.duties, 0);

  // Enfants à charge du défunt au sens de la prévoyance de branche (âge < 26 OU
  // âge inconnu) — prédicat COMMUN au capital (majoration par enfant, LOT BTP-1),
  // à la rente éducation 3b et à la condition substitutive de la rente conjoint
  // 3c. Factorisé ici pour éviter la triple duplication du filtre.
  const enfantsBrancheACharge = data.childrenData.filter((child) => {
    if (!childMatchesDeceased(child.parentLink, deceasedKey)) return false;
    const age = getAgeFromBirthDate(child.birthDate);
    return age === null || age < 26;
  });

  // ── Source 3 : capital décès de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) ──
  // EXONÉRÉ (art. 998 CGI, contrat de groupe professionnel) → chemin "caisse" :
  // AUCUN computeAvTax, HORS actif et HORS droits (sortie strictement additive).
  // Résolu seulement pour un défunt porteur d'un IDCC (salarié) ; sinon aucune
  // ligne. La catégorie cadre/non-cadre est dérivée du statut (LOT 1a-ii).
  const capitalDecesBrancheLines: CapitalDecesBrancheLine[] = [];
  if (entreeDefunt && entreeDefunt.idccCCN) {
    const categorie = categorieBranche(entreeDefunt.idccCCN, entreeDefunt.statutPro, referentiels);
    const passAnnuel = referentiels.pass.pass.annuel; // PASS du référentiel, jamais en dur
    // Contexte famille (LOT BTP-1) pour le mode "situationFamiliale" : présence
    // d'un conjoint (marié/PACS) ou d'un concubin (cohab — assimilé selon la
    // convention), et nombre d'enfants à charge. INERTE pour le mode historique
    // "pourcentageSalaireRef" (Syntec/HCR/Métallurgie ne lisent pas ce contexte).
    const br = resolveCapitalDecesBranche(
      entreeDefunt.idccCCN,
      categorie,
      entreeDefunt.salaireBrutAnnuel,
      passAnnuel,
      referentiels,
      {
        conjointPresent: data.coupleStatus === "married" || data.coupleStatus === "pacs",
        concubinPresent: data.coupleStatus === "cohab",
        nbEnfantsACharge: enfantsBrancheACharge.length,
      }
    );
    capitalDecesBrancheLines.push({
      source: br.source,
      capital: br.capital,
      categorie: br.categorie,
      exonere: true,
      donneeIndisponible: br.donneeIndisponible,
      beneficiairesAuContrat: true,
      // Dévolution (LOT DECES-A bis + DEVOL-1) — ordre data-driven (config CCN via
      // idcc), repli Syntec si absente, OU surcharge manuelle. Read-time : ne mute
      // jamais le dossier. EXONÉRÉ, additif, hors actif/droits.
      repartition: devolutionCapitalDecesBranche(br.capital, data, whichDefunt, entreeDefunt.idccCCN, referentiels),
    });
  }
  const capitalDecesBrancheExonere = capitalDecesBrancheLines.reduce((s, l) => s + (l.capital ?? 0), 0);

  // ── Source 3b : RENTE ÉDUCATION de branche (CCN), PAR ENFANT à charge ──
  // EXONÉRÉE, CUMULATIVE avec le capital (poste SÉPARÉ, JAMAIS additionnée au
  // capital). « À charge » = âge SEUL < 26 ans (décision actée — rattached
  // ignoré). Bloc STRICTEMENT additif : ne touche ni le capital, ni la
  // dévolution, ni les masses, ni les rentes caisses. Le résolveur de branche
  // n'est appelé QUE d'ici (jamais depuis projection.ts → hors 9 séries).
  const renteEducationBrancheLines: RenteEducationBrancheLine[] = [];
  if (entreeDefunt && entreeDefunt.idccCCN) {
    const categorie = categorieBranche(entreeDefunt.idccCCN, entreeDefunt.statutPro, referentiels);
    const passAnnuel = referentiels.pass.pass.annuel;
    for (const child of data.childrenData) {
      if (!childMatchesDeceased(child.parentLink, deceasedKey)) continue;
      const ageEnfant = getAgeFromBirthDate(child.birthDate);
      // Âge >= 26 → hors charge, aucune ligne. Âge inconnu (birthDate absent) →
      // on ne peut exclure l'enfant : ligne produite, marquée donneeIndisponible.
      if (ageEnfant !== null && ageEnfant >= 26) continue;
      const re = resolveRenteEducationBranche(
        entreeDefunt.idccCCN, categorie, entreeDefunt.salaireBrutAnnuel, passAnnuel, ageEnfant, referentiels
      );
      renteEducationBrancheLines.push({
        enfantPrenom: child.firstName || "Enfant",
        ageActuel: ageEnfant,
        montantAnnuelCourant: re.montantAnnuelCourant,
        phases: re.phases.map((p) => ({ deAge: p.deAge, aAge: p.aAge, montantAnnuel: p.montantAnnuel })),
        donneeIndisponible: re.donneeIndisponible || ageEnfant === null,
        exonere: true,
        source: re.source,
      });
    }
  }

  // ── Source 3c : RENTE CONJOINT SUBSTITUTIVE de branche (CCN) — LOT HCR-3.5 ──
  // EXONÉRÉE, additive (hors actif/droits, comme 3b). Versée au partenaire
  // survivant (conjoint/PACS/concubin selon la liste de la branche) UNIQUEMENT si
  // AUCUN enfant n'ouvre droit à la rente éducation (négation exacte du filtre 3b :
  // enfant du défunt, âge inconnu OU < 26 ans). Plafonnée à dureeMaxAnnees. Le
  // canal caisse rentesSurvieAnnuelles n'est PAS touché (ligne/rendu propres).
  const renteConjointBrancheLines: RenteConjointBrancheLine[] = [];
  if (entreeDefunt && entreeDefunt.idccCCN) {
    // Qualité du partenaire survivant (mapping IDENTIQUE à DEVOL-1). Le concubin
    // est ICI admissible si la branche l'inscrit dans `beneficiaires` (la liste
    // JSON décide — distinct de la dévolution du capital où il est exclu).
    let partenaireQualite: "conjoint" | "pacs" | "concubin" | null = null;
    if (data.coupleStatus === "married") partenaireQualite = "conjoint";
    else if (data.coupleStatus === "pacs") partenaireQualite = "pacs";
    else if (data.coupleStatus === "cohab") partenaireQualite = "concubin";

    // Âge du défunt au décès (réutilise getAgeFromBirthDate) — requis par le mode
    // "cibleCumulable" (durée = âge légal − âge). Inerte pour le mode substitutive.
    const ageDefunt = getAgeFromBirthDate(
      deceasedKey === "person1" ? data.person1BirthDate : data.person2BirthDate
    );

    const rc = resolveRenteConjointSubstitutiveBranche(
      entreeDefunt.idccCCN,
      categorieBranche(entreeDefunt.idccCCN, entreeDefunt.statutPro, referentiels),
      entreeDefunt.salaireBrutAnnuel,
      referentiels.pass.pass.annuel,
      referentiels,
      ageDefunt
    );

    // Exclusivité : le mode "substitutive" (HCR) n'est versé QUE si aucun enfant
    // n'ouvre droit à la rente éducation. Le mode "cibleCumulable" (BTP) est
    // CUMULABLE → cette condition ne s'applique PAS (rc.cumulableAvecRenteEducation).
    const ouvreRenteEducation = enfantsBrancheACharge.length > 0;
    const bloqueParExclusivite = !rc.cumulableAvecRenteEducation && ouvreRenteEducation;

    if (
      !rc.donneeIndisponible &&
      rc.montantAnnuel != null &&
      rc.dureeMaxAnnees != null &&
      partenaireQualite != null &&
      rc.beneficiairesQualites.includes(partenaireQualite) &&
      !bloqueParExclusivite
    ) {
      const beneficiaireNom = (survivorKey === "person1"
        ? `${data.person1FirstName ?? ""} ${data.person1LastName ?? ""}`
        : `${data.person2FirstName ?? ""} ${data.person2LastName ?? ""}`).trim() || "Conjoint survivant";
      renteConjointBrancheLines.push({
        montantAnnuel: rc.montantAnnuel,
        dureeMaxAnnees: rc.dureeMaxAnnees,
        beneficiaireNom,
        source: rc.source,
        exonere: true,
        donneeIndisponible: false,
        // Libellé UI mode-conscient (LOT UI-LABEL) — discriminant dérivé du résolveur.
        mode: rc.cumulableAvecRenteEducation ? "cibleCumulable" : "substitutive",
        finAgeDefunt: rc.finAgeDefunt ?? undefined,
      });
    }
  }

  return {
    deceasedKey, survivorKey, spouseEligible, spouseOptions, spouseOption, quotiteDisponible,
    warnings, activeNet, furnitureForfait,
    // ── Capitaux décès hors actif (Lot 3) — N'IMPACTENT PAS les masses/droits ci-dessus ──
    capitalDecesLines: { caisses: capitalDecesCaisseLines, prives: capitalDecesPriveLines, branche: capitalDecesBrancheLines, renteEducationBranche: renteEducationBrancheLines, renteConjointBranche: renteConjointBrancheLines },
    capitalDecesCaisseExonere,
    capitalDecesBrancheExonere,
    capitalDecesPriveCapital,
    capitalDecesPriveDuties,
    rentesSurvieAnnuelles,
    totalRights: results.reduce((s, r) => s + r.duties, 0),
    totalSuccessionRights: results.reduce((s, r) => s + r.successionDuties, 0),
    totalAvRights: results.reduce((s, r) => s + r.avDuties, 0),
    collectedPropertyEstate, placementsSuccession, propertyLines, placementLines, avLines, results,
    graphReferenceName: reference?.name || "Aucun héritier taxable",
    graphReferenceTitle: reference?.graphTitle || "Aucun barème applicable",
    bracketFill: successionBracketFill,
    currentBracketLabel: successionCurrentBracket?.label || "—",
    indicatorPct: successionIndicatorPct,
    visualMax: successionVisualMax,
    graphTaxableBase: reference?.successionTaxable || 0,
    testamentMode, reserveChildrenCount,
    pieData, receivedPieData, patrimoineLeguePieData,
    legalReserveAmount, legalDisposableAmount, usufruitierAge, demembrementPct,
  };
}
