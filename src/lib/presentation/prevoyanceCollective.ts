// LOT 10c-bis — couche de PRÉSENTATION de la conformité prévoyance collective.
// ZÉRO moteur : on ne recalcule rien, on RÉ-ÉTAGE ce que le moteur produit déjà
// (audit-collectif.ts). On n'affiche que ce qui existe ; aucun chiffre inventé.
//
// Rappel recon : aucun écart de conformité ne porte de montant € (les verdicts sont
// qualitatifs). Le seul chiffre € du domaine est le risque « 3 PASS » (art. 7 CCN 1947
// / ANI 2017) — une CONSTANTE du référentiel, mais CONDITIONNELLE (dépend de la présence
// de salariés cadres, que le moteur ne tranche pas). On l'attache donc uniquement à
// l'écart cadres, avec sa condition explicite — jamais comme chiffre-roi certain.

import type { AuditConformite, ControleConformite, ControleStatut } from "../prevoyance/types";
import { referentiels } from "../../data/prevoyance";

export type SeveriteEcart = "non_conforme" | "vigilance";

// Risque conditionnel chiffré (uniquement l'écart cadres 1,5 % T1).
export type RisqueConditionnel = {
  montant: number;         // 144 180 = 3 × PASS
  montantLabel: string;    // "144 180 €"
  condition: string;       // "si l'entreprise emploie des salariés cadres"
  base: string;            // base réglementaire chiffrée
};

export type EcartCollectif = {
  id: string;              // = id du contrôle d'audit (c_*)
  titre: string;           // libellé du contrôle
  severite: SeveriteEcart;
  reference: string;
  detail: string;
  actionCorrective: string;              // le fallback est appliqué ici (jamais vide)
  risqueConditionnel: RisqueConditionnel | null;
};

export type VerdictConformite = {
  conforme: boolean;
  nbEcarts: number;
  titre: string;           // "Conforme" | "N écart(s) détecté(s)"
};

export type SanteAniInfo = {
  statut: ControleStatut;
  label: string;           // libellé lisible du statut
  detail: string;
  reference: string;
} | null;

// Action corrective par défaut (miroir de BlocAuditConformite) — un écart en porte
// toujours une, même quand le contrôle ne l'a pas explicitée.
const ACTION_FALLBACK =
  "Vérifier la conformité du dispositif déclaré et le formaliser au regard de la référence légale citée.";

const LABEL_STATUT: Record<ControleStatut, string> = {
  conforme: "Conforme",
  non_conforme: "Non conforme",
  vigilance: "Vigilance",
  non_applicable: "Non applicable",
};

function estEcart(statut: ControleStatut): statut is SeveriteEcart {
  return statut === "non_conforme" || statut === "vigilance";
}

// Le risque « 3 PASS » lu depuis le référentiel (constante réelle, pas un calcul).
function risqueCadres(): RisqueConditionnel {
  const s = referentiels.pass.prevoyanceCadres1_50;
  return {
    montant: s.sanctionMontant,
    montantLabel: `${s.sanctionMontant.toLocaleString("fr-FR")} €`,
    condition: "si l'entreprise emploie des salariés cadres",
    base: "3 × PASS · ANI 17 nov. 2017 (reprise art. 7 CCN 1947)",
  };
}

// Écarts = contrôles d'audit non conformes ou en vigilance. Tri : non_conforme d'abord.
export function buildEcartsCollectifs(audit: AuditConformite): EcartCollectif[] {
  return audit.controles
    .filter((c) => estEcart(c.statut))
    .map((c: ControleConformite): EcartCollectif => ({
      id: c.id,
      titre: c.libelle,
      severite: c.statut as SeveriteEcart,
      reference: c.reference,
      detail: c.detail,
      actionCorrective: c.actionCorrective ?? ACTION_FALLBACK,
      risqueConditionnel: c.id === "c_cadres_15_t1" ? risqueCadres() : null,
    }))
    .sort((a, b) =>
      a.severite === b.severite ? 0 : a.severite === "non_conforme" ? -1 : 1,
    );
}

// Verdict de la carte-roi : qualitatif (décision David 10c-bis) — pas de chiffre-roi.
export function buildVerdictConformite(audit: AuditConformite): VerdictConformite {
  const nbEcarts = audit.controles.filter((c) => estEcart(c.statut)).length;
  return {
    conforme: nbEcarts === 0,
    nbEcarts,
    titre:
      nbEcarts === 0
        ? "Conforme"
        : `${nbEcarts} écart${nbEcarts > 1 ? "s" : ""} détecté${nbEcarts > 1 ? "s" : ""}`,
  };
}

// Card contexte « Santé ANI » : extrait le contrôle santé ANI de l'audit (statut lisible).
export function buildSanteAni(audit: AuditConformite): SanteAniInfo {
  const c = audit.controles.find((x) => x.id === "c_sante_ani_obligatoire");
  if (!c) return null;
  return { statut: c.statut, label: LABEL_STATUT[c.statut], detail: c.detail, reference: c.reference };
}
