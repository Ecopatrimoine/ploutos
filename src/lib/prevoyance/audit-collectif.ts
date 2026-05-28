// ─── Audit conformité collective d'entreprise (Lot 8) ───────────────
//
// Produit un AuditConformite à partir d'une EntrepriseAudit + du
// référentiel CCN. 6 contrôles minimum (cf. spec §10.4) :
//   c_sante_ani_obligatoire           — art. L.911-7 CSS
//   c_cadres_15_t1                    — ANI 17 nov 2017
//   c_categories_objectives           — décret 2021-1002
//   c_ccn_branche_prevoyance          — selon CCN
//   c_ccn_branche_sante               — selon CCN
//   c_forfait_social_correctement_applique — L.137-15 et s. CSS
//
// CONFORMITÉ DDA — RÈGLE NON NÉGOCIABLE :
//   Aucun nom d'assureur ni de produit dans les actions correctives.

import type {
  AuditConformite,
  ControleConformite,
} from "./types";
import type { EntrepriseAudit } from "../../types/patrimoine";
import type { Referentiels } from "../../data/prevoyance";

export function runAuditConformite(
  e: EntrepriseAudit,
  ref: Referentiels
): AuditConformite {
  const controles: ControleConformite[] = [
    controleSanteAni(e),
    controleCadres15T1(e),
    controleCategoriesObjectives(e),
    controleCcnBranchePrevoyance(e, ref),
    controleCcnBrancheSante(e, ref),
    controleForfaitSocial(e),
  ];

  const applicables = controles.filter((c) => c.statut !== "non_applicable");
  const conformes = applicables.filter((c) => c.statut === "conforme");
  const scoreGlobal =
    applicables.length > 0
      ? Math.round((conformes.length / applicables.length) * 100)
      : 100;

  return { controles, scoreGlobal };
}

// ────────────────────────────────────────────────────────────────────

function controleSanteAni(e: EntrepriseAudit): ControleConformite {
  const effectif = e.effectif ?? 0;
  if (effectif <= 0) {
    return {
      id: "c_sante_ani_obligatoire",
      axe: "sante",
      libelle: "Complémentaire santé collective obligatoire (ANI 2013)",
      statut: "non_applicable",
      reference: "art. L.911-7 CSS",
      detail:
        "Effectif salarié = 0 : l'obligation ANI 2013 ne s'applique pas (entreprise sans salarié).",
    };
  }
  if (e.santeCollectiveEnPlace) {
    return {
      id: "c_sante_ani_obligatoire",
      axe: "sante",
      libelle: "Complémentaire santé collective obligatoire (ANI 2013)",
      statut: "conforme",
      reference: "art. L.911-7 CSS",
      detail: "Une complémentaire santé collective est déclarée en place.",
    };
  }
  return {
    id: "c_sante_ani_obligatoire",
    axe: "sante",
    libelle: "Complémentaire santé collective obligatoire (ANI 2013)",
    statut: "non_conforme",
    reference: "art. L.911-7 CSS",
    detail:
      "Aucune complémentaire santé collective déclarée alors que l'entreprise emploie des salariés. " +
      "L'employeur a l'obligation de proposer une couverture santé collective au minimum équivalente au panier ANI.",
    actionCorrective:
      "Mettre en place une couverture santé collective conforme au panier ANI, avec participation employeur d'au moins 50 %.",
  };
}

function controleCadres15T1(e: EntrepriseAudit): ControleConformite {
  if (!e.prevoyanceCadresEnPlace) {
    return {
      id: "c_cadres_15_t1",
      axe: "prevoyance",
      libelle: "Cotisation prévoyance cadres ≥ 1,50 % T1 (ANI 17 nov 2017)",
      statut: "vigilance",
      reference: "ANI 17 nov 2017",
      detail:
        "Aucune prévoyance cadres déclarée. Si l'entreprise emploie des cadres, " +
        "l'obligation de 1,50 % minimum sur la tranche 1 s'applique (reprise post-AGIRC).",
      actionCorrective:
        "Vérifier la présence de salariés cadres et, le cas échéant, mettre en place une prévoyance cadres conforme à 1,50 % T1.",
    };
  }
  const conforme = e.tauxT1Cadres >= 1.5;
  return {
    id: "c_cadres_15_t1",
    axe: "prevoyance",
    libelle: "Cotisation prévoyance cadres ≥ 1,50 % T1 (ANI 17 nov 2017)",
    statut: conforme ? "conforme" : "non_conforme",
    reference: "ANI 17 nov 2017",
    detail: conforme
      ? `Taux T1 cadres déclaré à ${e.tauxT1Cadres} %, conforme au minimum de 1,50 %.`
      : `Taux T1 cadres déclaré à ${e.tauxT1Cadres} %, inférieur au minimum obligatoire de 1,50 %.`,
    actionCorrective: conforme
      ? undefined
      : "Régulariser la cotisation prévoyance cadres au minimum 1,50 % de la T1.",
  };
}

function controleCategoriesObjectives(e: EntrepriseAudit): ControleConformite {
  const declaree = (e.categoriesObjectivesDeclarees ?? "").trim();
  if (!declaree) {
    return {
      id: "c_categories_objectives",
      axe: "categories_objectives",
      libelle: "Catégories objectives conformes au décret 2021-1002",
      statut: "non_conforme",
      reference: "décret n° 2021-1002 du 30 juillet 2021",
      detail:
        "Aucune catégorie objective déclarée. Sans définition conforme aux 5 critères du décret 2021-1002, " +
        "l'exonération de cotisations sociales attachée au contrat est remise en cause.",
      actionCorrective:
        "Formaliser les catégories de personnel selon les critères du décret 2021-1002 (CSP, cadres/non-cadres, sous-catégorie objective).",
    };
  }
  return {
    id: "c_categories_objectives",
    axe: "categories_objectives",
    libelle: "Catégories objectives conformes au décret 2021-1002",
    statut: "vigilance",
    reference: "décret n° 2021-1002 du 30 juillet 2021",
    detail:
      `Catégorie déclarée : "${declaree}". La conformité formelle aux 5 critères du décret 2021-1002 ` +
      `doit être vérifiée à la lecture du contrat et des actes de mise en place.`,
    actionCorrective:
      "Vérifier la rédaction contractuelle des catégories au regard des 5 critères du décret 2021-1002.",
  };
}

function controleCcnBranchePrevoyance(
  e: EntrepriseAudit,
  ref: Referentiels
): ControleConformite {
  if (!e.idccCCN) {
    return {
      id: "c_ccn_branche_prevoyance",
      axe: "ccn",
      libelle: "Plancher prévoyance de branche",
      statut: "non_applicable",
      reference: "—",
      detail: "Aucune CCN identifiée — l'obligation de branche ne peut pas être vérifiée.",
    };
  }
  const conv = (ref.ccn as any).conventions?.[e.idccCCN];
  const imposePrev = !!(conv?.prevoyanceCadres || conv?.prevoyanceNonCadres);
  if (!imposePrev) {
    return {
      id: "c_ccn_branche_prevoyance",
      axe: "ccn",
      libelle: `Plancher prévoyance de branche (CCN ${e.idccCCN})`,
      statut: "non_applicable",
      reference: `CCN ${e.idccCCN}`,
      detail:
        "Pas de plancher prévoyance spécifique à cette CCN au-delà du minimum légal " +
        "(ou champ non documenté dans le référentiel).",
    };
  }
  // CCN impose un plancher — sans détail vérifiable on lève une vigilance.
  return {
    id: "c_ccn_branche_prevoyance",
    axe: "ccn",
    libelle: `Plancher prévoyance imposé par CCN ${e.idccCCN}`,
    statut: "vigilance",
    reference: `CCN ${e.idccCCN} — ${e.nomCCN ?? "libellé non documenté"}`,
    detail:
      "La CCN identifiée impose un plancher de prévoyance (garanties minimum cadres et/ou non-cadres). " +
      "Vérifier que la couverture en place atteint le minimum conventionnel.",
    actionCorrective: "Vérifier que la couverture déclarée atteint les minima de la CCN (notice de prévoyance).",
  };
}

function controleCcnBrancheSante(
  e: EntrepriseAudit,
  ref: Referentiels
): ControleConformite {
  if (!e.idccCCN) {
    return {
      id: "c_ccn_branche_sante",
      axe: "ccn",
      libelle: "Panier santé de branche",
      statut: "non_applicable",
      reference: "—",
      detail: "Aucune CCN identifiée — l'obligation santé de branche ne peut pas être vérifiée.",
    };
  }
  const conv = (ref.ccn as any).conventions?.[e.idccCCN];
  const sante = conv?.santeMinimum;
  if (!sante || sante.panier === "ANI" || sante.TO_FILL) {
    return {
      id: "c_ccn_branche_sante",
      axe: "ccn",
      libelle: `Panier santé de branche (CCN ${e.idccCCN})`,
      statut: "non_applicable",
      reference: `CCN ${e.idccCCN}`,
      detail:
        "Pas de plancher santé spécifique au-delà du panier ANI dans cette CCN (ou champ non documenté).",
    };
  }
  return {
    id: "c_ccn_branche_sante",
    axe: "ccn",
    libelle: `Panier santé de branche supérieur à ANI (CCN ${e.idccCCN})`,
    statut: "vigilance",
    reference: `CCN ${e.idccCCN} — ${e.nomCCN ?? ""}`,
    detail:
      "La CCN impose un panier santé supérieur au minimum ANI. " +
      "Vérifier que la couverture en place atteint ce niveau.",
    actionCorrective:
      "Vérifier que le niveau de garanties santé déclaré atteint les minima de la CCN.",
  };
}

function controleForfaitSocial(e: EntrepriseAudit): ControleConformite {
  const effectif = e.effectif;

  // Effectif < 11 : exonération de forfait social sur les contributions
  // patronales de prévoyance/santé → non applicable (rien à auditer).
  if (effectif !== null && effectif < 11) {
    return {
      id: "c_forfait_social_correctement_applique",
      axe: "forfait_social",
      libelle: "Forfait social appliqué selon effectif",
      statut: "non_applicable",
      reference: "art. L.137-15 et s. CSS",
      detail:
        `Effectif = ${effectif} salariés (< 11) : forfait social à 0 % sur les contributions patronales ` +
        `de prévoyance et de santé collective. Aucun forfait social dû à ce titre.`,
    };
  }

  // Effectif >= 11 OU inconnu (null = prudence) : vigilance + rappel DSN.
  return {
    id: "c_forfait_social_correctement_applique",
    axe: "forfait_social",
    libelle: "Forfait social appliqué selon effectif",
    statut: "vigilance",
    reference: "art. L.137-15 et s. CSS",
    detail:
      effectif === null
        ? "Effectif non renseigné : impossible de déterminer le régime de forfait social. À partir de " +
          "11 salariés, le taux standard de 20 % s'applique sur les contributions patronales de " +
          "prévoyance / retraite supplémentaire. Renseigner l'effectif pour préciser l'analyse."
        : `Effectif = ${effectif} salariés (≥ 11) : taux standard de forfait social 20 % applicable sur ` +
          `les contributions patronales de prévoyance / retraite supplémentaire. Vérifier l'application ` +
          `effective sur la DSN.`,
    actionCorrective:
      "Vérifier l'application effective du taux de forfait social sur les bulletins de paie et la DSN.",
  };
}
