// ─── Vue partagee : obligations de branche + gap-analysis (LOT 1) ─────────────
//
// Module PUR (aucune UI, aucun PDF). Pose le couple moteur+presentation,
// calque exact de runAuditConformite / mapAuditEnConstats (meme dossier) :
//   - resolveComparaisonBranche : orchestre les DEUX fonctions existantes
//     (resolveObligationsBranche + compareObligationsSouscrit) SANS les modifier.
//   - mapBrancheEnVue : aplatit le resultat en une vue prete a afficher, SOURCE
//     UNIQUE des libelles (garanties, verdicts, statuts).
//
// Colonne vertebrale = la checklist obligations (obligations.cadres / .nonCadres).
// Pour chaque ObligationItem on attache (left-join sur `garantie`) le verdict du
// ComparaisonItem de meme garantie ; sans correspondance -> non_applicable (cas du
// maintien employeur, jamais compare). Le verdictGlobal du college est LU sur
// ComparaisonCollege.verdictGlobal (jamais recalcule).
//
// Les DEUX "indetermine" (barème complexe vs donnee manquante) restent le MEME
// verdict ; seule la chaine `motif` (deja factuelle, fournie par le moteur) les
// distingue. On la passe telle quelle, on ne la reecrit pas.
//
// _comment unite : la rente education souscrit (tauxSalaireRefParEnfant) face a une
// obligation toujours en mode "complexe" -> jamais auto-comparee (toujours
// indetermine). Connu, sans impact, non traite ici.

import {
  resolveObligationsBranche,
  type ObligationsBranche,
  type ObligationItem,
  type ObligationGarantie,
  type ObligationsStatut,
} from "./obligations-branche";
import {
  compareObligationsSouscrit,
  type ComparaisonBranche,
  type ComparaisonCollege,
  type VerdictGarantie,
} from "./compare-obligations";
import type { EntrepriseAudit, GarantiesSouscrites } from "../../types/patrimoine";
import type { Referentiels } from "../../data/prevoyance";

// ─── Types de vue ─────────────────────────────────────────────────────────────

export type LigneGarantieVue = {
  garantie: ObligationGarantie;
  garantieLabel: string;
  obligationResume: string;
  presente: boolean;
  donneeIndisponible: boolean;
  verdict: VerdictGarantie;
  verdictLabel: string;
  motif: string;
};

export type CollegeVue = {
  libelle: "Cadres" | "Non-cadres";
  lignes: LigneGarantieVue[];
  verdictGlobal: VerdictGarantie;
  verdictGlobalLabel: string;
};

export type ComparaisonBrancheVue = {
  statut: ObligationsStatut;
  statutLabel: string;
  afficherAvertissementIncomplet: boolean;
  // true des qu'au moins une garantie souscrite est renseignee (LOT 4, additif).
  souscritRenseigne: boolean;
  idcc: string | null;
  nomCCN: string | null;
  colleges: CollegeVue[]; // un college dont la liste d'obligations est vide est OMIS
  tauxT1: { taux: number | null; label: string; donneeIndisponible: boolean } | null;
  sante: { presente: boolean; label: string } | null;
};

// ─── Libelles (source unique, ASCII sans accents) ─────────────────────────────
// Records typee sur les unions : tsc impose l'exhaustivite (un membre manquant
// casse la compilation), garde-fou si une union evolue.

const GARANTIE_LABEL: Record<ObligationGarantie, string> = {
  capitalDC: "Capital deces",
  renteEducation: "Rente education",
  renteConjoint: "Rente de conjoint",
  ij: "Indemnites journalieres",
  invalidite: "Invalidite",
  maintienEmployeur: "Maintien de salaire employeur",
};

// "A etudier" (relabel LOT 4, source unique) : un verdict moteur "indetermine"
// (souscrit absent OU bareme complexe) reste "indetermine" cote moteur ; seul le
// LIBELLE affiche change.
const VERDICT_LABEL: Record<VerdictGarantie, string> = {
  conforme: "Conforme",
  insuffisant: "Insuffisant",
  indetermine: "A etudier",
  non_applicable: "Non applicable",
};

const STATUT_LABEL: Record<ObligationsStatut, string> = {
  branche_documentee: "Obligations de branche documentees",
  donnees_incompletes: "Obligations de branche partiellement documentees",
  aucune_obligation_assuree: "Aucune obligation de prevoyance de branche",
  convention_inconnue: "Convention non reconnue",
  idcc_absent: "Aucune convention de branche renseignee",
};

// Statuts sans checklist exploitable -> aucune ligne (etat propre, pas de crash).
// idcc_absent / convention_inconnue : tableaux deja vides cote moteur ;
// aucune_obligation_assuree : tableaux pleins de "non prevu" cote moteur -> on
// les masque ici (choix de presentation, cf. en-tete LOT 1).
const STATUTS_SANS_COLLEGES: ReadonlySet<ObligationsStatut> = new Set<ObligationsStatut>([
  "idcc_absent",
  "convention_inconnue",
  "aucune_obligation_assuree",
]);

// ─── (a) Orchestration : calque de runAuditConformite ─────────────────────────

// true des qu'au moins une valeur numerique de garantie souscrite est renseignee
// (n'importe quel college / garantie / champ). Champ absent = non renseigne.
function aUnSouscritRenseigne(gs: GarantiesSouscrites | undefined): boolean {
  if (!gs) return false;
  for (const col of [gs.cadres, gs.nonCadres]) {
    if (!col) continue;
    for (const garantie of Object.values(col)) {
      if (garantie && typeof garantie === "object") {
        for (const v of Object.values(garantie)) {
          if (typeof v === "number" && Number.isFinite(v)) return true;
        }
      }
    }
  }
  return false;
}

export function resolveComparaisonBranche(
  entreprise: EntrepriseAudit,
  ref: Referentiels
): { obligations: ObligationsBranche; comparaison: ComparaisonBranche; souscritRenseigne: boolean } {
  // Fonction totale : les deux fonctions sous-jacentes le sont deja (jamais
  // d'exception ; idcc absent / convention inconnue -> statut dedie).
  const obligations = resolveObligationsBranche(entreprise.idccCCN, ref);
  const comparaison = compareObligationsSouscrit(obligations, entreprise.garantiesSouscrites);
  return { obligations, comparaison, souscritRenseigne: aUnSouscritRenseigne(entreprise.garantiesSouscrites) };
}

// ─── (b) Presentation : calque de mapAuditEnConstats ──────────────────────────

function ligneGarantie(item: ObligationItem, col: ComparaisonCollege): LigneGarantieVue {
  // left-join sur `garantie` : le verdict vient du ComparaisonItem de meme
  // garantie ; aucune correspondance (ex. maintienEmployeur) -> non_applicable.
  const cmp = col.items.find((c) => c.garantie === item.garantie);
  const verdict: VerdictGarantie = cmp ? cmp.verdict : "non_applicable";
  return {
    garantie: item.garantie,
    garantieLabel: GARANTIE_LABEL[item.garantie],
    obligationResume: item.resume,
    presente: item.presente,
    donneeIndisponible: item.donneeIndisponible ?? false,
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    motif: cmp ? cmp.motif : "", // motif factuel passe tel quel (jamais reecrit)
  };
}

function collegeVue(
  libelle: "Cadres" | "Non-cadres",
  items: ObligationItem[],
  col: ComparaisonCollege
): CollegeVue {
  return {
    libelle,
    lignes: items.map((item) => ligneGarantie(item, col)),
    verdictGlobal: col.verdictGlobal, // LU, jamais recalcule
    verdictGlobalLabel: VERDICT_LABEL[col.verdictGlobal],
  };
}

function tauxT1Label(t: ObligationsBranche["tauxT1Minimum"]): string {
  if (t.taux === null) return "Taux minimal T1 a documenter";
  const base = `${String(t.taux).replace(".", ",")} % T1`;
  return t.source === "ani_defaut" ? `${base} (plancher ANI par defaut)` : base;
}

export function mapBrancheEnVue(res: {
  obligations: ObligationsBranche;
  comparaison: ComparaisonBranche;
  souscritRenseigne?: boolean; // additif (LOT 4) : absent -> false (retro-compatible)
}): ComparaisonBrancheVue {
  const { obligations: o, comparaison: c } = res;

  const colleges: CollegeVue[] = [];
  if (!STATUTS_SANS_COLLEGES.has(o.statut)) {
    if (o.cadres.length > 0) colleges.push(collegeVue("Cadres", o.cadres, c.cadres));
    if (o.nonCadres.length > 0) colleges.push(collegeVue("Non-cadres", o.nonCadres, c.nonCadres));
  }

  // Contexte de branche reconnu (convention identifiee) : on expose T1 et sante.
  // idcc_absent / convention_inconnue -> pas de contexte -> null.
  const contexteBranche = o.statut !== "idcc_absent" && o.statut !== "convention_inconnue";

  return {
    statut: o.statut,
    statutLabel: STATUT_LABEL[o.statut],
    afficherAvertissementIncomplet: o.statut === "donnees_incompletes",
    souscritRenseigne: res.souscritRenseigne ?? false,
    idcc: o.idcc,
    nomCCN: o.nomCCN,
    colleges,
    tauxT1: contexteBranche
      ? {
          taux: o.tauxT1Minimum.taux,
          label: tauxT1Label(o.tauxT1Minimum),
          donneeIndisponible: o.tauxT1Minimum.donneeIndisponible,
        }
      : null,
    sante: contexteBranche
      ? { presente: o.santeMinimum.presente, label: o.santeMinimum.resume }
      : null,
  };
}

// ─── (c) Vue FUSIONNEE par garantie (LOT 4) ───────────────────────────────────
//
// Au-dessus de la vue par college : fusionne cadres/nonCadres PAR GARANTIE pour
// un rendu unique consomme a l'identique par l'ecran (Lot 5) et le PDF (Lot 6).
// Quand les deux colleges disent la meme chose -> { commun } ; sinon -> les deux.

type Verdict = VerdictGarantie;

export type ValeurFusionnee = { commun: string } | { cadres: string; nonCadres: string };
export type VerdictFusionne = { commun: Verdict } | { cadres: Verdict; nonCadres: Verdict };

export type LigneFusionnee = {
  garantie: ObligationGarantie;
  garantieLabel: string;
  estReference: boolean;            // maintienEmployeur : ligne de reference, pas de verdict
  obligation: ValeurFusionnee;
  souscrit: ValeurFusionnee | null; // null : le Lot 1 ne porte pas le detail souscrit
  verdict: VerdictFusionne | null;      // null si estReference
  verdictLabel: ValeurFusionnee | null; // null si estReference
  motif: ValeurFusionnee | null;        // null si estReference
};

export type VueObligationsFusionnee = {
  statut: ObligationsStatut;
  statutLabel: string;
  afficherAvertissementIncomplet: boolean;
  souscritRenseigne: boolean;
  afficherComparaison: boolean;     // = souscritRenseigne ; pilote les colonnes souscrit/verdict
  idcc: string | null;
  nomCCN: string | null;
  lignes: LigneFusionnee[];         // garanties prevues par la branche (maintien inclus, en reference)
  nonPrevues: { garantie: ObligationGarantie; garantieLabel: string }[]; // garanties NON prevues
  synthese: { conformes: number; insuffisants: number; aEtudier: number } | null; // null si !afficherComparaison
};

// Ordre du PIRE verdict au croisement cadres/nonCadres :
// insuffisant > indetermine (= A etudier) > conforme > non_applicable.
const RANG_PIRE_VERDICT: Record<Verdict, number> = {
  insuffisant: 3,
  indetermine: 2,
  conforme: 1,
  non_applicable: 0,
};

// Fusionne deux valeurs (cadres/nonCadres) : commun si egales OU si un seul
// college present ; sinon { cadres, nonCadres }. undefined = college absent.
function fusionnerValeur<T>(c: T | undefined, n: T | undefined): { commun: T } | { cadres: T; nonCadres: T } {
  if (c !== undefined && n === undefined) return { commun: c };
  if (n !== undefined && c === undefined) return { commun: n };
  return c === n ? { commun: c as T } : { cadres: c as T, nonCadres: n as T };
}

function pireVerdict(vf: VerdictFusionne): Verdict {
  if ("commun" in vf) return vf.commun;
  return RANG_PIRE_VERDICT[vf.cadres] >= RANG_PIRE_VERDICT[vf.nonCadres] ? vf.cadres : vf.nonCadres;
}

// Fonction PURE testable : fusionne la vue par college (Lot 1) en vue par garantie.
export function fusionnerColleges(vue: ComparaisonBrancheVue): VueObligationsFusionnee {
  const base = {
    statut: vue.statut,
    statutLabel: vue.statutLabel,
    afficherAvertissementIncomplet: vue.afficherAvertissementIncomplet,
    souscritRenseigne: vue.souscritRenseigne,
    idcc: vue.idcc,
    nomCCN: vue.nomCCN,
  };

  // Statuts sans colleges (idcc_absent / convention_inconnue / aucune_obligation_assuree)
  // -> etat vide propre : pas de comparaison, pas de synthese. Jamais d'exception.
  if (vue.colleges.length === 0) {
    return { ...base, afficherComparaison: false, lignes: [], nonPrevues: [], synthese: null };
  }

  const cadres = vue.colleges.find((c) => c.libelle === "Cadres");
  const nonCadres = vue.colleges.find((c) => c.libelle === "Non-cadres");

  // Index par garantie en preservant l'ordre d'apparition (ordre des obligations).
  const ordre: ObligationGarantie[] = [];
  const parGarantie = new Map<ObligationGarantie, { c?: LigneGarantieVue; n?: LigneGarantieVue }>();
  const sources: Array<[CollegeVue | undefined, "c" | "n"]> = [[cadres, "c"], [nonCadres, "n"]];
  for (const [col, key] of sources) {
    if (!col) continue;
    for (const l of col.lignes) {
      let e = parGarantie.get(l.garantie);
      if (!e) { e = {}; parGarantie.set(l.garantie, e); ordre.push(l.garantie); }
      e[key] = l;
    }
  }

  const lignes: LigneFusionnee[] = [];
  const nonPrevues: { garantie: ObligationGarantie; garantieLabel: string }[] = [];

  for (const g of ordre) {
    const e = parGarantie.get(g)!;
    const presentes = [e.c, e.n].filter((x): x is LigneGarantieVue => x !== undefined);
    const garantieLabel = presentes[0].garantieLabel;
    const estReference = g === "maintienEmployeur";

    // Garantie NON prevue par la branche (presente=false dans tous les colleges
    // ou elle apparait), hors maintien -> note de bas, PAS une ligne.
    if (!estReference && presentes.every((l) => l.presente === false)) {
      nonPrevues.push({ garantie: g, garantieLabel });
      continue;
    }

    const obligation = fusionnerValeur(e.c?.obligationResume, e.n?.obligationResume);

    if (estReference) {
      // Ligne de reference : pas de verdict/souscrit (le maintien n'est pas compare).
      lignes.push({ garantie: g, garantieLabel, estReference: true, obligation, souscrit: null, verdict: null, verdictLabel: null, motif: null });
      continue;
    }

    lignes.push({
      garantie: g,
      garantieLabel,
      estReference: false,
      obligation,
      souscrit: null, // pas de chaine "souscrit" cote vue Lot 1 -> on n'invente rien
      verdict: fusionnerValeur(e.c?.verdict, e.n?.verdict),
      verdictLabel: fusionnerValeur(e.c?.verdictLabel, e.n?.verdictLabel),
      motif: fusionnerValeur(e.c?.motif, e.n?.motif),
    });
  }

  const afficherComparaison = vue.souscritRenseigne;

  let synthese: VueObligationsFusionnee["synthese"] = null;
  if (afficherComparaison) {
    let conformes = 0, insuffisants = 0, aEtudier = 0;
    for (const l of lignes) {
      if (l.estReference || !l.verdict) continue; // maintien exclu de la synthese
      const pire = pireVerdict(l.verdict);
      if (pire === "conforme") conformes++;
      else if (pire === "insuffisant") insuffisants++;
      else if (pire === "indetermine") aEtudier++;
      // non_applicable : non compte
    }
    synthese = { conformes, insuffisants, aEtudier };
  }

  return { ...base, afficherComparaison, lignes, nonPrevues, synthese };
}

// Point d'entree unique (ecran Lot 5 + PDF Lot 6).
export function buildVueObligationsFusionnee(entreprise: EntrepriseAudit, ref: Referentiels): VueObligationsFusionnee {
  return fusionnerColleges(mapBrancheEnVue(resolveComparaisonBranche(entreprise, ref)));
}
