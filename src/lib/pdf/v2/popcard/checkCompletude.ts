// ─── Lot Dossier client — vérification de complétude par doc ──────────
//
// Pour chaque doc/section présent dans le pack PDF coché par l'utilisateur,
// vérifie les champs requis cabinet/mission/data et liste les manques.
// L'utilisateur peut ensuite « Compléter d'abord » ou « Continuer quand
// même » (les champs vides apparaîtront en « à confirmer » dans le PDF).

import type { PieceJointe } from "../../../conformite/piecesJointes";

export type PackItem =
  // Documents réglementaires
  | "lettre" | "der" | "derAnnexe" | "dda" | "adequation"
  // Bilan patrimonial — sections
  | "couverture" | "cabinet" | "famille" | "travail"
  | "bilanEndettement" | "ir" | "ifi"
  | "successionA" | "successionB" | "capitauxDeces"
  | "profil" | "prevoyancePersoP1" | "prevoyancePersoP2" | "prevoyanceColl"
  | "hypos" | "recommandations" | "mentions";

export type CompletudeManque = {
  /** Identifiant du doc/section concerné. */
  pack: PackItem;
  /** Libellé humain du doc/section (pour l'affichage). */
  packLabel: string;
  /** Liste des champs manquants — chaîne libre affichée à l'utilisateur. */
  fields: string[];
};

export type CheckParams = {
  cabinet: Record<string, any>;
  mission: Record<string, any>;
  data: Record<string, any>;
  recommandations?: ReadonlyArray<any>;
  piecesJointes?: ReadonlyArray<PieceJointe>;
};

const PACK_LABELS: Record<PackItem, string> = {
  lettre:           "Lettre de mission",
  der:              "DER",
  derAnnexe:        "DER - annexe",
  dda:              "Fiche conseil DDA",
  adequation:       "Déclaration d'adéquation",
  couverture:       "Page de couverture",
  cabinet:          "Présentation cabinet",
  famille:          "Composition familiale",
  travail:          "Situation professionnelle",
  bilanEndettement: "Bilan & endettement",
  ir:               "Impôt sur le revenu (IR)",
  ifi:              "IFI",
  successionA:      "Succession civile",
  successionB:     "Assurance-vie & transmission",
  capitauxDeces:    "Capitaux décès",
  profil:           "Profil & adéquation MIF II",
  prevoyancePersoP1: "Prévoyance personnelle (P1)",
  prevoyancePersoP2: "Prévoyance personnelle (P2)",
  prevoyanceColl:   "Prévoyance collective",
  hypos:            "Hypothèses et conséquences",
  recommandations:  "Recommandations & plan d'action",
  mentions:         "Mentions légales",
};

const empty = (v: any): boolean => v === undefined || v === null || v === "" || v === false;

/** Vérifie le pack et retourne la liste des manques (1 entrée par doc qui en a). */
export function checkCompletude(packItems: PackItem[], p: CheckParams): CompletudeManque[] {
  const result: CompletudeManque[] = [];

  for (const pack of packItems) {
    const fields = collectMissing(pack, p);
    if (fields.length > 0) {
      result.push({ pack, packLabel: PACK_LABELS[pack], fields });
    }
  }
  return result;
}

function collectMissing(pack: PackItem, p: CheckParams): string[] {
  const out: string[] = [];
  const { cabinet, mission, data, piecesJointes } = p;

  switch (pack) {
    // ─── Documents réglementaires ────────────────────────────────────
    case "lettre": {
      if (empty(cabinet.cabinetName) && empty(cabinet.nom)) out.push("cabinet.cabinetName (dénomination)");
      if (empty(cabinet.orias)) out.push("cabinet.orias (numéro ORIAS)");
      if (empty(cabinet.rcpMontants)) out.push("cabinet.rcpMontants (montants RCP — sinon « à confirmer » en M1)");
      if (empty(cabinet.remunerationType) && empty(cabinet.remuneration)) out.push("cabinet.remunerationType (mode de rémunération non sélectionné)");
      if (empty(cabinet.natureConseil)) out.push("cabinet.natureConseil (indépendant ou non indépendant)");
      if (empty(mission.justifDomicile)) out.push("mission.justifDomicile (justificatif domicile LCB-FT non collecté)");
      if (empty(mission.justifOrigineFonds)) out.push("mission.justifOrigineFonds (justificatif origine des fonds LCB-FT non collecté)");
      if (mission.ppe && empty(mission.ppeDetails)) out.push("mission.ppeDetails (PPE cochée mais détails non saisis)");
      break;
    }
    case "der": {
      if (empty(cabinet.orias)) out.push("cabinet.orias (numéro ORIAS)");
      if (empty(cabinet.rcpMontants)) out.push("cabinet.rcpMontants (montants RCP — page 1 DER)");
      if (!cabinet.statutCoa && !cabinet.statutMia && !cabinet.statutCif && !cabinet.statutIobsp) {
        out.push("Aucun statut ORIAS coché — la page 3 « Références légales » sera vide");
      }
      if (cabinet.statutCif && empty(cabinet.mediateurAmf)) out.push("cabinet.mediateurAmf (CIF actif sans médiateur AMF)");
      break;
    }
    case "derAnnexe": {
      // L'annexe Références partage exactement les prérequis de "der" (mêmes statuts
      // ORIAS) : on NE double-compte PAS les manques ici (sinon ils apparaîtraient en
      // double dans la pop-card de complétude). No-op → retourne [].
      break;
    }
    case "dda": {
      const ipidCount = (piecesJointes || []).filter((pj: any) => pj?.type === "ipid").length;
      if (ipidCount === 0) out.push("Aucune pièce IPID rattachée (la fiche affichera « IPID à remettre »)");
      const anyBesoin = Object.keys(mission).some(k => k.startsWith("besoin") && !!mission[k]);
      if (!anyBesoin) out.push("Aucun besoin client coché dans le tab Dossier client (besoins santé/prévoyance/retraite/épargne)");
      break;
    }
    case "adequation": {
      if (empty(cabinet.periodiciteRevue)) out.push("cabinet.periodiciteRevue (non saisie — affichera « périodicité à confirmer »)");
      const recosComplete = (p.recommandations || []).filter((r: any) => r?.libelle && r?.justification);
      if (recosComplete.length === 0) out.push("Aucune recommandation finalisée dans le plan d'action");
      if (empty(mission.horizon)) out.push("mission.horizon (horizon de placement non sélectionné)");
      break;
    }

    // ─── Bilan patrimonial — sections ─────────────────────────────────
    case "couverture": {
      if (empty(cabinet.cabinetName) && empty(cabinet.nom)) out.push("cabinet.cabinetName (dénomination)");
      if (empty(cabinet.logoSrc)) out.push("cabinet.logoSrc (logo non téléversé)");
      break;
    }
    case "famille": {
      if (empty(data.person1FirstName)) out.push("data.person1FirstName (prénom personne 1)");
      if (empty(data.coupleStatus)) out.push("data.coupleStatus (statut couple non sélectionné)");
      break;
    }
    case "travail": {
      if (empty(data.person1Csp)) out.push("data.person1Csp (catégorie pro non saisie)");
      break;
    }
    case "bilanEndettement": {
      const noProps = !Array.isArray(data.properties) || data.properties.length === 0;
      const noPlacements = !Array.isArray(data.placements) || data.placements.length === 0;
      if (noProps && noPlacements) out.push("Aucun bien immobilier ni placement saisi");
      break;
    }
    case "ir": {
      if (empty(data.salary1) && empty(data.ca1) && empty(data.pensions)) {
        out.push("Aucun revenu saisi (salaire/CA/pension P1)");
      }
      break;
    }
    case "ifi": {
      const noProps = !Array.isArray(data.properties) || data.properties.length === 0;
      if (noProps) out.push("Aucun bien immobilier saisi (page IFI vide)");
      break;
    }
    case "successionA":
    case "successionB": {
      if (empty(data.coupleStatus)) out.push("data.coupleStatus (statut couple requis pour la dévolution)");
      const noChildren = !Array.isArray(data.childrenData) || data.childrenData.length === 0;
      const noProps = !Array.isArray(data.properties) || data.properties.length === 0;
      if (noChildren && noProps) out.push("Aucun enfant ni bien à transmettre saisi");
      break;
    }
    case "capitauxDeces": {
      // Section informative tolérante : données « non disponibles » rendues « n.d. »,
      // corps vide exclu du pack (cf. concatPack). Aucun manque bloquant à signaler.
      break;
    }
    case "profil": {
      if (empty(mission.attitude)) out.push("mission.attitude (Q1 profil non répondu)");
      if (empty(mission.horizon)) out.push("mission.horizon (horizon non sélectionné)");
      break;
    }
    case "prevoyancePersoP1": {
      // C1 — sans statut pro, la projection est indisponible : la section n'est PAS imprimée
      // (cohérence empty state écran), d'où le libellé explicite plutôt qu'un manque bloquant.
      if (!data.travail?.p1?.statutPro) out.push("Statut professionnel P1 absent — section Prévoyance personnelle (P1) non imprimée");
      break;
    }
    case "prevoyancePersoP2": {
      if (!data.travail?.p2?.statutPro) out.push("Pas de 2e personne / statut P2 absent — section Prévoyance personnelle (P2) non imprimée");
      break;
    }
    case "prevoyanceColl": {
      // Section dirigeant / analyse externe — pas de manque bloquant identifié
      break;
    }
    case "hypos": {
      // Vérifié au niveau App.tsx (hypothesisResults calculé) — si vide, pas bloquant
      break;
    }
    case "recommandations": {
      // C1 — aucune reco complète → page vide exclue du pack : on l'annonce explicitement.
      const recosComplete = (p.recommandations || []).filter((r: any) => r?.libelle && r?.justification);
      if (recosComplete.length === 0) out.push("Aucune recommandation finalisée — section non imprimée");
      break;
    }
    case "mentions":
    case "cabinet": {
      // Pages texte hardcodé — pas de champ à vérifier
      break;
    }
  }

  return out;
}

/** Ordre canonique du pack PDF généré : bilan patrimonial AVANT docs réglementaires
 *  (les docs réglementaires s'appuient sur l'état patrimonial diagnostiqué). */
export const PACK_ORDER: PackItem[] = [
  // Bilan patrimonial
  "couverture", "cabinet", "famille", "travail",
  "bilanEndettement", "ir", "ifi",
  "successionA", "successionB", "capitauxDeces",
  "profil", "prevoyancePersoP1", "prevoyancePersoP2", "prevoyanceColl",
  "hypos", "recommandations", "mentions",
  // Documents réglementaires (après le bilan)
  "lettre", "der", "derAnnexe", "dda", "adequation",
];

/** Trie un pack selon l'ordre canonique. */
export function sortPack(pack: PackItem[]): PackItem[] {
  const set = new Set(pack);
  return PACK_ORDER.filter(p => set.has(p));
}
