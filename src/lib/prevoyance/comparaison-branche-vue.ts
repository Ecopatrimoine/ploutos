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
import type { EntrepriseAudit } from "../../types/patrimoine";
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

const VERDICT_LABEL: Record<VerdictGarantie, string> = {
  conforme: "Conforme",
  insuffisant: "Insuffisant",
  indetermine: "Indetermine",
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

export function resolveComparaisonBranche(
  entreprise: EntrepriseAudit,
  ref: Referentiels
): { obligations: ObligationsBranche; comparaison: ComparaisonBranche } {
  // Fonction totale : les deux fonctions sous-jacentes le sont deja (jamais
  // d'exception ; idcc absent / convention inconnue -> statut dedie).
  const obligations = resolveObligationsBranche(entreprise.idccCCN, ref);
  const comparaison = compareObligationsSouscrit(obligations, entreprise.garantiesSouscrites);
  return { obligations, comparaison };
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
