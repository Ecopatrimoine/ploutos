// ─── Moteur de règles & constats individuels (Lot 6) ────────────────────
//
// 8 règles de cartographie des risques individuels :
//   Axe décès        — dc_tns_sans_capital
//                    — dc_capital_insuffisant_dettes
//                    — dc_pas_de_rente_conjoint_enfants_jeunes
//   Axe incapacité   — ij_carence_caisse_sans_madelin
//                    — ij_plafond_insuffisant
//                    — ij_pas_de_subrogation
//   Axe invalidité   — inv_cat2_aucune_couverture_compl
//                    — inv_tns_madelin_absent
//
// Les 4 règles de conformité collective (conf_*) sont reportées au
// LOT 8 (avec le UI TabPrevoyanceCollective).
//
// CONFORMITÉ DDA — RÈGLE NON NÉGOCIABLE :
//   Aucun champ `action` ne mentionne un assureur, un produit, une
//   marque, ni n'affirme qu'une solution est meilleure qu'une autre.
//   Toutes les actions sont formulées en termes de BESOIN à évaluer
//   (cf. spec §13.2/§13.4).

import type {
  AuditConformite,
  Constat,
  ConstatSeverite,
  ContratIndividuel,
  ContexteRegle,
  Regle,
} from "./types";
import type { ContratTransmissionDeces, StatutPro } from "../../types/patrimoine";
import { referentiels } from "../../data/prevoyance";
import { capitalDecesCarmf, pensionInvaliditeBaseAnnuelle } from "./carmf";

const TNS_STATUTS: StatutPro[] = [
  "tns_liberal",
  "tns_commercant",
  "tns_artisan",
  "gerant_majoritaire",
];

function isTNS(statut: StatutPro | ""): boolean {
  return TNS_STATUTS.includes(statut as StatutPro);
}

function sumContratsParType(
  contrats: ContratIndividuel[],
  type: ContratIndividuel["type"]
): number {
  return contrats
    .filter((c) => c.type === type)
    .reduce((acc, c) => acc + (Number.isFinite(c.capitalOuMontant) ? c.capitalOuMontant : 0), 0);
}

// Capital décès TOUTES SOURCES confondues (VOIE A — R1, pont constats) :
//   capital individuel legacy (ContratIndividuel "deces_capital")
// + capital de transmission (ContratTransmissionDeces.capitalTransmis).
//
// Stratégie anti-double-comptage = SOMME, choix TRANSITOIRE assumé :
//   - Objectif premier (présence : règle « TNS sans capital ») : la somme
//     vaut > 0 dès qu'UNE source porte un capital → le faux constat disparaît
//     dès qu'un contrat de transmission est saisi. Correct dans tous les cas.
//   - Montant (règle « capital < dettes ») : la somme additionne les deux
//     sources. Un même contrat saisi DEUX FOIS (legacy + transmission) serait
//     compté double — cas transitoire que la migration R2 supprime (le legacy
//     deces_capital est migré puis retiré → une seule source, somme = total
//     exact). Il n'existe aucun identifiant commun entre les deux objets pour
//     dédupliquer en R1 ; la somme est le total honnête « toutes sources ».
// Rétro-compat : sans contrat de transmission (cas de TOUS les tests/appels
// existants), le terme transmission vaut 0 → résultat identique à avant.
export function capitalDecesUnifie(
  contratsIndividuels: ContratIndividuel[],
  contratsTransmission: ContratTransmissionDeces[] | undefined
): number {
  const legacy = sumContratsParType(contratsIndividuels, "deces_capital");
  const transmission = (contratsTransmission ?? []).reduce(
    (acc, c) => acc + (Number.isFinite(c.capitalTransmis) ? c.capitalTransmis : 0),
    0
  );
  return legacy + transmission;
}

function hasContratActif(
  contrats: ContratIndividuel[],
  type: ContratIndividuel["type"]
): boolean {
  return contrats.some(
    (c) => c.type === type && (c.capitalOuMontant > 0 || (c.baseInvalidite ?? 0) > 0)
  );
}

function totalAtIdx(s: ContexteRegle["projection"]["series"], i: number): number {
  return (
    s.salaire[i] +
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i] +
    s.renteInvalEnfants[i]
  );
}

function formatEUR(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} €`;
}

function libelleCible(cible: "p1" | "p2"): string {
  return cible === "p1" ? "la personne 1" : "la personne 2";
}

// Phrase explicative en italique à ajouter au détail des constats qui
// s'appuient sur conjointACharge. Convention : balise HTML <em>…</em>
// pour l'italique — le UI BlocConstats du LOT 7 décidera du rendu
// (rendu HTML direct ou parseur dédié).
function phraseExplicativeConjoint(ctx: ContexteRegle): string {
  const p1 = `${Math.round(ctx.revenuP1Mensuel).toLocaleString("fr-FR")} €`;
  const p2 = `${Math.round(ctx.revenuP2Mensuel).toLocaleString("fr-FR")} €`;
  return (
    ` <em>Cette analyse considère votre conjoint comme dépendant ` +
    `financièrement car ses revenus propres (${p2}/mois) sont ` +
    `inférieurs à 50 % des vôtres (${p1}/mois). Si la situation ` +
    `diffère (patrimoine personnel important, revenus à venir ` +
    `prochainement), affinez le conseil.</em>`
  );
}

// ────────────────────────────────────────────────────────────────────
// Axe DC — 3 règles
// ────────────────────────────────────────────────────────────────────

export const regleDcTnsSansCapital: Regle = (ctx, cible) => {
  const e = ctx.entree;
  if (!isTNS(e.statutPro)) return null;
  const capital = capitalDecesUnifie(e.contratsIndividuels, ctx.contratsTransmissionDeces);
  if (capital > 0) return null;
  // Critère d'alerte : présence de conjoint à charge ou d'enfants mineurs.
  if (!ctx.conjointACharge && ctx.enfantsMineurs === 0) return null;

  const motifs: string[] = [];
  if (ctx.conjointACharge) motifs.push("conjoint sans revenu propre");
  if (ctx.enfantsMineurs > 0)
    motifs.push(`${ctx.enfantsMineurs} enfant${ctx.enfantsMineurs > 1 ? "s" : ""} mineur${ctx.enfantsMineurs > 1 ? "s" : ""}`);

  const detailBase =
    `En tant que TNS, ${libelleCible(cible)} ne dispose d'aucun capital décès souscrit à titre individuel. ` +
    `Le capital décès du régime obligatoire est généralement forfaitaire et insuffisant au regard ` +
    `de la situation du foyer (${motifs.join(" et ")}).`;
  // Phrase explicative ajoutée seulement si la règle s'est déclenchée
  // grâce au critère "conjoint à charge".
  const detail = ctx.conjointACharge ? detailBase + phraseExplicativeConjoint(ctx) : detailBase;
  return {
    id: `dc_tns_sans_capital_${cible}`,
    severite: "alerte",
    axe: "deces",
    cible,
    titre: "TNS sans capital décès individuel — situation à risque",
    detail,
    reference: "Art. L.911-1 et s. CSS",
    action:
      "Évaluer la mise en place d'une couverture décès individuelle, dimensionnée selon les revenus à remplacer " +
      "et les charges récurrentes du foyer (dettes, scolarité, dépendance éventuelle).",
  };
};

export const regleDcCapitalInsuffisantDettes: Regle = (ctx, cible) => {
  if (ctx.dettesImmobilieres <= 0) return null;
  // Capital décès individuel + capital décès obligatoire CARMF (71 500 € pour
  // un médecin titulaire, proratisé pour un conjoint collaborateur) lorsque
  // le client est affilié CARMF. Les autres régimes obligatoires restent
  // souvent TO_VERIFY → seul l'individuel compte alors.
  const capitalCarmf = ctx.entree.carmf
    ? capitalDecesCarmf(referentiels.carmf, ctx.entree.carmf)
    : 0;
  const capital =
    capitalDecesUnifie(ctx.entree.contratsIndividuels, ctx.contratsTransmissionDeces) + capitalCarmf;
  if (capital >= ctx.dettesImmobilieres) return null;
  const trou = ctx.dettesImmobilieres - capital;

  return {
    id: `dc_capital_insuffisant_dettes_${cible}`,
    severite: "attention",
    axe: "deces",
    cible,
    titre: "Capital décès insuffisant pour apurer les dettes immobilières",
    detail:
      `Le capital décès individuel cumulé pour ${libelleCible(cible)} est de ${formatEUR(capital)}, ` +
      `alors que les dettes immobilières en cours s'élèvent à ${formatEUR(ctx.dettesImmobilieres)}. ` +
      `En cas de décès, les héritiers peuvent être contraints à céder un bien pour rembourser le solde.`,
    action:
      `Évaluer le besoin d'un capital décès additionnel d'environ ${formatEUR(trou)}, ` +
      `ou réviser à la baisse ce besoin si une assurance emprunteur DC est déjà en place sur la dette.`,
    impactChiffre: { montant: trou, libelle: "Déficit de capital décès face aux dettes immobilières" },
  };
};

export const regleDcPasDeRenteConjointEnfantsJeunes: Regle = (ctx, cible) => {
  // Critère : conjoint à charge + enfants mineurs (vulnérabilité du foyer).
  if (!ctx.conjointACharge || ctx.enfantsMineurs === 0) return null;
  const renteConj = sumContratsParType(ctx.entree.contratsIndividuels, "deces_rente_conj");
  if (renteConj > 0) return null;

  const detailBase =
    `Le foyer compte ${ctx.enfantsMineurs} enfant${ctx.enfantsMineurs > 1 ? "s" : ""} mineur${ctx.enfantsMineurs > 1 ? "s" : ""} ` +
    `et un conjoint dont les revenus propres sont insuffisants pour maintenir le train de vie du foyer. ` +
    `En cas de décès de ${libelleCible(cible)}, le conjoint survivant et les enfants se retrouveraient sans ` +
    `revenu de remplacement régulier au-delà du seul capital décès.`;
  return {
    id: `dc_pas_de_rente_conjoint_enfants_jeunes_${cible}`,
    severite: "alerte",
    axe: "deces",
    cible,
    titre: "Pas de rente conjoint malgré un conjoint sans revenu suffisant et des enfants mineurs",
    detail: detailBase + phraseExplicativeConjoint(ctx),
    action:
      "Évaluer la mise en place d'une rente conjoint (rente viagère ou temporaire) " +
      "dimensionnée pour maintenir le train de vie du foyer pendant la période de vulnérabilité.",
  };
};

// ────────────────────────────────────────────────────────────────────
// Axe incapacité — 3 règles
// ────────────────────────────────────────────────────────────────────

export const regleIjCarenceCaisseSansMadelin: Regle = (ctx, cible) => {
  if (!isTNS(ctx.entree.statutPro)) return null;
  // Carence longue = IJ obligatoire = 0 à J60 (caisses CARMF/CARPIMKO 90j,
  // ou caisses TO_FILL non documentées).
  const idxJ60 = ctx.projection.axe.findIndex((p) => p.jour === 60);
  if (idxJ60 < 0) return null;
  const ijObl_J60 = ctx.projection.series.ijObligatoire[idxJ60];
  const carenceLongue = ijObl_J60 === 0;
  if (!carenceLongue) return null;
  const hasIJ = hasContratActif(ctx.entree.contratsIndividuels, "ij");
  if (hasIJ) return null;

  return {
    id: `ij_carence_caisse_sans_madelin_${cible}`,
    severite: "alerte",
    axe: "incapacite",
    cible,
    titre: "Caisse à carence longue et aucune IJ complémentaire individuelle",
    detail:
      `Le régime obligatoire de ${libelleCible(cible)} ne verse aucune indemnité avant le 60ᵉ jour d'arrêt ` +
      `(carence longue typique des caisses libérales). Sans IJ complémentaire individuelle, le revenu de ` +
      `remplacement reste à zéro pendant toute cette période.`,
    action:
      "Évaluer la mise en place d'indemnités journalières individuelles avec une franchise courte (≤ 30 jours) " +
      "pour combler la fenêtre sans revenu du régime obligatoire.",
  };
};

export const regleIjPlafondInsuffisant: Regle = (ctx, cible) => {
  const idxJ180 = ctx.projection.axe.findIndex((p) => p.jour === 180);
  if (idxJ180 < 0) return null;
  const total = totalAtIdx(ctx.projection.series, idxJ180);
  const ref = ctx.projection.revenuReferenceMensuel;
  if (ref <= 0) return null;
  const ratio = total / ref;
  // Décision D : alerte dès que le trou atteint 30 % (ratio ≤ 0,70).
  // 30 % pile → alerte ; 29 % → pas d'alerte.
  if (ratio > 0.7) return null;
  const trou = Math.max(0, ref - total);

  return {
    id: `ij_plafond_insuffisant_${cible}`,
    severite: "attention",
    axe: "incapacite",
    cible,
    titre: "Couverture incapacité insuffisante à 6 mois d'arrêt",
    detail:
      `À J180 d'arrêt, le revenu de remplacement estimé pour ${libelleCible(cible)} est de ${formatEUR(total)}/mois ` +
      `contre ${formatEUR(ref)} de référence — soit une perte de ${Math.round((1 - ratio) * 100)} %.`,
    action:
      "Évaluer la mise en place d'une couverture complémentaire IJ visant un revenu de remplacement " +
      "proche du revenu de référence sur la durée maximale d'arrêt (jusqu'à 1 095 jours).",
    impactChiffre: { montant: trou, libelle: "Manque à gagner mensuel à J180" },
  };
};

// Règle renommée (anciennement ij_pas_de_subrogation, cf. revue
// Lot 6 du 2026-05-27). La vraie règle "absence de subrogation"
// arrivera quand le référentiel CCN aura le champ subrogation:boolean
// rempli (cf. docs/ROADMAP_PREVOYANCE.md).
export const regleIjCcnNonDocumentee: Regle = (ctx, cible) => {
  // Critère : IDCC saisi MAIS useLegalDefault=true (la CCN n'est pas
  // documentée OU ses paliers restent TO_VERIFY). On ne déclenche pas
  // pour un TNS (qui n'a pas d'IDCC). Le constat informe que le
  // calcul présenté est un PLANCHER (maintien légal Mensualisation).
  if (!ctx.entree.idccCCN) return null;
  if (!ctx.projection.useLegalDefault) return null;

  const idcc = ctx.entree.idccCCN;
  return {
    id: `ij_ccn_non_documentee_${cible}`,
    severite: "info",
    axe: "incapacite",
    cible,
    titre: "Convention collective non documentée",
    detail:
      `L'IDCC saisi (${idcc}) n'est pas encore dans le référentiel Ploutos. Le calcul de maintien ` +
      `employeur repose sur la loi Mensualisation (L.1226-1 C. trav., 7 jours de carence puis 30 j à ` +
      `90 % à partir d'un an d'ancienneté, paliers évoluant ensuite). La CCN applicable peut prévoir ` +
      `des dispositions plus favorables (carence supprimée, maintien plus long, taux plus élevés). ` +
      `Le calcul présenté est donc un PLANCHER, non la situation réelle.`,
    reference: "L.1226-1 et D.1226-1 et s. C. trav.",
    action:
      `Vérifier sur Légifrance / KALI les dispositions de maintien de salaire prévues par la CCN ${idcc}, ` +
      `puis signaler à l'équipe Ploutos pour enrichissement du référentiel. ` +
      `Le module sera enrichi à mesure des situations rencontrées.`,
  };
};

// ────────────────────────────────────────────────────────────────────
// Axe invalidité — 2 règles
// ────────────────────────────────────────────────────────────────────

export const regleInvCat2AucuneCouvertureCompl: Regle = (ctx, cible) => {
  const idxJ1095 = ctx.projection.axe.findIndex((p) => p.jour === 1095);
  if (idxJ1095 < 0) return null;
  const series = ctx.projection.series;
  const renteColl = series.renteInvalCollective[idxJ1095];
  const renteInd = series.renteInvalIndividuelle[idxJ1095];
  if (renteColl > 0 || renteInd > 0) return null; // une couverture compl. existe

  const pension = series.pensionInvalObligatoire[idxJ1095];
  const ref = ctx.projection.revenuReferenceMensuel;
  if (ref <= 0) return null;
  if (pension / ref >= 0.6) return null; // pension obligatoire couvre déjà ≥ 60 %
  const trou = Math.max(0, ref - pension);

  return {
    id: `inv_cat2_aucune_couverture_compl_${cible}`,
    severite: "alerte",
    axe: "invalidite",
    cible,
    titre: "Invalidité : pension obligatoire seule insuffisante, aucune couverture complémentaire",
    detail:
      `En cas d'invalidité (catégorie projetée ${ctx.projection.categorieInvaliditeProjetee}), ` +
      `la pension du régime obligatoire couvre ${Math.round((pension / ref) * 100)} % du revenu de référence ` +
      `de ${libelleCible(cible)}. Aucune rente complémentaire (collective ou individuelle) n'est en place.`,
    action:
      "Évaluer la mise en place d'une rente invalidité complémentaire visant un revenu de remplacement " +
      "proche du revenu de référence en cas d'invalidité reconnue.",
    impactChiffre: { montant: trou, libelle: "Manque à gagner invalidité mensuel" },
  };
};

export const regleInvTnsMadelinAbsent: Regle = (ctx, cible) => {
  if (!isTNS(ctx.entree.statutPro)) return null;
  const hasInv = hasContratActif(ctx.entree.contratsIndividuels, "invalidite");
  if (hasInv) return null;

  return {
    id: `inv_tns_madelin_absent_${cible}`,
    severite: "alerte",
    axe: "invalidite",
    cible,
    titre: "TNS sans rente invalidité individuelle",
    detail:
      `Le régime obligatoire d'invalidité des TNS est souvent forfaitaire ou plafonné à un niveau très ` +
      `inférieur aux revenus réels. Sans rente invalidité individuelle, ${libelleCible(cible)} risque ` +
      `une perte de revenus durable et non compensée en cas d'invalidité reconnue.`,
    action:
      "Évaluer la mise en place d'une rente invalidité individuelle couvrant les trois catégories " +
      "(activité réduite, totale, totale avec tierce personne), dimensionnée selon le revenu professionnel.",
  };
};

// ────────────────────────────────────────────────────────────────────
// Constats de cohérence de saisie (décisions H7 / H11)
// ────────────────────────────────────────────────────────────────────

export const regleSurCouvertureBornee: Regle = (ctx, cible) => {
  if (!ctx.projection.surCouvertureBornee) return null;
  return {
    id: `couverture_bornee_100_${cible}`,
    severite: "info",
    axe: "incapacite",
    cible,
    titre: "Couverture supérieure à 100 % du revenu — plafonnée",
    detail:
      "La couverture saisie dépasse 100 % du revenu ; elle est plafonnée à 100 % " +
      "(principe indemnitaire — pas de sur-indemnisation possible : un revenu de " +
      "remplacement ne peut excéder le revenu d'activité).",
    reference: "Principe indemnitaire — droit des assurances",
    action:
      "Vérifier la cohérence des taux de couverture saisis : aucun contrat ne peut " +
      "garantir plus de 100 % du revenu d'activité.",
  };
};

export const regleCollectiveTnsIgnoree: Regle = (ctx, cible) => {
  if (!ctx.projection.couvertureCollectiveIgnoreeTNS) return null;
  return {
    id: `collective_tns_ignoree_${cible}`,
    severite: "attention",
    axe: "incapacite",
    cible,
    titre: "Couverture collective non accessible (statut TNS)",
    detail:
      "Statut TNS : la couverture collective d'entreprise n'est pas accessible " +
      "(vous n'êtes pas salarié au sens social). Une couverture passe par un contrat " +
      "individuel (type Madelin). Vérifiez la nature des contrats saisis.",
    reference: "Art. L.911-1 et s. CSS",
    action:
      "Vérifier la nature des contrats saisis : la protection d'un dirigeant TNS " +
      "passe par un contrat individuel, non par le contrat collectif de l'entreprise.",
  };
};

// Constat de sur-couverture (SURCOUV §3). Distinct de
// regleSurCouvertureBornee (H11, base d'UN contrat > 100 %) : ici on
// constate le CUMUL des contrats individuels au regard du revenu de
// référence. Deux formulations selon la nature du contrat en cause.
// Priorité au cas forfaitaire (sur-couverture RÉELLE, enjeu fiscal/social)
// sur le cas indemnitaire (garantie sur-dimensionnée mais bornée).
export const regleSurCouvertureContrat: Regle = (ctx, cible) => {
  if (ctx.projection.revenuReferenceMensuel <= 0) return null;

  if (ctx.projection.surCouvertureForfaitaire) {
    return {
      id: `sur_couverture_forfaitaire_${cible}`,
      severite: "attention",
      axe: "incapacite",
      cible,
      titre: "Sur-couverture : couverture totale au-delà de 100 % du revenu",
      detail:
        "Votre couverture totale dépasse 100 % de votre revenu d'activité (sur-couverture). " +
        "Un contrat forfaitaire verse l'intégralité du montant souscrit, mais percevoir en arrêt " +
        "davantage qu'en activité peut soulever des questions fiscales et sociales, et représente " +
        "une cotisation potentiellement surdimensionnée.",
      reference: "Principe indemnitaire — droit des assurances",
      action:
        "Vérifier l'adéquation des montants souscrits au revenu d'activité ; un réajustement de la " +
        "cotisation pourrait être étudié pour éviter une sur-couverture.",
    };
  }

  if (ctx.projection.surCouvertureIndemnitaireBornee) {
    return {
      id: `sur_couverture_indemnitaire_${cible}`,
      severite: "info",
      axe: "incapacite",
      cible,
      titre: "Couverture indemnités journalières dimensionnée au-delà du revenu",
      detail:
        "Votre couverture indemnités journalières est dimensionnée au-delà de votre revenu d'activité. " +
        "Comme votre contrat est indemnitaire, il ne versera que le complément jusqu'à 100 % de votre " +
        "revenu : une partie de la garantie souscrite ne sera pas utilisée. Un réajustement de la " +
        "cotisation pourrait être étudié.",
      reference: "Principe indemnitaire — droit des assurances",
      action:
        "Vérifier le dimensionnement de la garantie au regard du revenu d'activité : la fraction " +
        "au-delà de 100 % ne sera pas indemnisée.",
    };
  }

  return null;
};

// ────────────────────────────────────────────────────────────────────
// Constats spécifiques CARMF (médecins libéraux) — SPEC_PREVOYANCE_CARMF §8
// ────────────────────────────────────────────────────────────────────

export const regleCarmfCarenceAffiliation: Regle = (ctx, cible) => {
  const c = ctx.entree.carmf;
  if (!c || c.cumulEmploiRetraite) return null;
  if (c.ancienneteAffiliationTrimestres >= 8) return null;
  const restants = 8 - c.ancienneteAffiliationTrimestres;
  return {
    id: `carmf_carence_affiliation_${cible}`,
    severite: "alerte",
    axe: "incapacite",
    cible,
    titre: "Carence d'affiliation CARMF — protection limitée aux 90 premiers jours",
    detail:
      `L'affiliation à la CARMF totalise ${c.ancienneteAffiliationTrimestres} trimestre(s) ; il en faut 8 ` +
      `(2 ans) pour ouvrir droit aux indemnités journalières et à la pension d'invalidité CARMF. Pendant ` +
      `cette période (encore ~${restants} trimestre(s)), la protection se limite aux indemnités CPAM des ` +
      `90 premiers jours d'arrêt — au-delà, le revenu de remplacement est nul.`,
    reference: "CARMF — carence d'affiliation (8 trimestres)",
    action:
      "Évaluer le besoin d'une couverture individuelle couvrant la période de carence d'affiliation, " +
      "pendant laquelle aucune prestation CARMF n'est versée au-delà du 90e jour.",
  };
};

export const regleCarmfAnteriorite: Regle = (ctx, cible) => {
  const c = ctx.entree.carmf;
  if (!c || c.cumulEmploiRetraite) return null;
  const t = c.ancienneteAffiliationTrimestres;
  if (t < 8 || t >= 24) return null;
  const reduction = t < 16 ? "deux tiers" : "un tiers";
  return {
    id: `carmf_anteriorite_${cible}`,
    severite: "info",
    axe: "incapacite",
    cible,
    titre: "Prestations CARMF potentiellement réduites (antériorité d'affiliation)",
    detail:
      `Avec ${t} trimestres d'affiliation, les prestations CARMF peuvent être réduites de ${reduction} si ` +
      `l'incapacité a une origine antérieure à l'affiliation. Le taux plein est atteint à 24 trimestres (6 ans).`,
    reference: "CARMF — réduction pour antériorité (8 à 23 trimestres)",
    action:
      "Vérifier l'ancienneté d'affiliation et la date d'origine de l'incapacité pour estimer le niveau réel des droits CARMF.",
  };
};

export const regleCarmfCumulEmploiRetraite: Regle = (ctx, cible) => {
  const c = ctx.entree.carmf;
  if (!c || !c.cumulEmploiRetraite) return null;
  return {
    id: `carmf_cumul_emploi_retraite_${cible}`,
    severite: "attention",
    axe: "incapacite",
    cible,
    titre: "Cumul emploi-retraite : aucune couverture incapacité-invalidité CARMF",
    detail:
      "En cumul emploi-retraite, le médecin est exclu du régime invalidité-décès CARMF : ni indemnités " +
      "journalières CARMF, ni pension d'invalidité. Seules les indemnités CPAM des 90 premiers jours subsistent.",
    reference: "CARMF — exclusion du régime ID en cumul emploi-retraite",
    action:
      "Vérifier la pertinence d'une couverture individuelle pour compenser l'absence de protection CARMF en cumul emploi-retraite.",
  };
};

export const regleCarmfInvaliditeStop62: Regle = (ctx, cible) => {
  const c = ctx.entree.carmf;
  if (!c || c.cumulEmploiRetraite || c.ancienneteAffiliationTrimestres < 8) return null;
  return {
    id: `carmf_invalidite_stop_62_${cible}`,
    severite: "info",
    axe: "invalidite",
    cible,
    titre: "Pension d'invalidité CARMF limitée au 62e anniversaire",
    detail:
      "La pension d'invalidité CARMF et ses majorations cessent au 62e anniversaire, avec bascule vers la " +
      "retraite — ce n'est pas une protection à vie.",
    reference: "CARMF — durée de la pension d'invalidité (jusqu'à 62 ans)",
    action:
      "Évaluer le besoin de revenus de remplacement au-delà de 62 ans, la pension d'invalidité CARMF cessant à cet âge.",
  };
};

export const regleCarmfPlafondConjoint: Regle = (ctx, cible) => {
  const c = ctx.entree.carmf;
  if (!c || c.cumulEmploiRetraite || c.ancienneteAffiliationTrimestres < 8) return null;
  if (!(c.marie && c.anneesMariage >= 2)) return null;
  const plafond = referentiels.carmf.invalidite.majorations.conjoint.plafondRessourcesConjoint;
  if (c.ressourcesConjoint > plafond) return null; // aucune majoration → autre sujet
  const base = pensionInvaliditeBaseAnnuelle(referentiels.carmf, c);
  if (base <= 0 || c.ressourcesConjoint + base * 0.35 <= plafond) return null; // pas d'écrêtement
  return {
    id: `carmf_plafond_conjoint_${cible}`,
    severite: "info",
    axe: "invalidite",
    cible,
    titre: "Majoration conjoint CARMF réduite (plafond de ressources)",
    detail:
      `La majoration de 35 % pour conjoint est écrêtée : les ressources du conjoint ` +
      `(${Math.round(c.ressourcesConjoint).toLocaleString("fr-FR")} €) plus la majoration dépasseraient le ` +
      `plafond de ${plafond.toLocaleString("fr-FR")} €, au-delà duquel la majoration est réduite à due concurrence.`,
    reference: "CARMF — plafond de ressources de la majoration conjoint",
    action:
      "Vérifier les ressources du conjoint : la majoration de pension est réduite lorsque leur cumul dépasse le plafond.",
  };
};

// ────────────────────────────────────────────────────────────────────
// Constats spécifiques CNBF (avocats) — SPEC_PREVOYANCE_CAISSES_FORFAITAIRES §6
// ────────────────────────────────────────────────────────────────────

// Note constat : les 90 premiers jours d'arrêt d'un avocat ne sont pas
// couverts par la CNBF mais par la prévoyance de branche du barreau
// (LPA/AON), hors caisse. Sans montant (dépend du barreau). Se déclenche
// pour toute caisse CNBF, quelle que soit l'ancienneté.
export const regleCnbfLpaAon: Regle = (ctx, cible) => {
  if (ctx.entree.caisse !== "CNBF") return null;
  return {
    id: `cnbf_lpa_aon_${cible}`,
    severite: "attention",
    axe: "incapacite",
    cible,
    titre: "Couverture des 90 premiers jours (LPA/AON)",
    detail:
      "Les 90 premiers jours sont normalement couverts par LPA/AON (prévoyance de branche du barreau) — pensez à renseigner cette couverture collective.",
    reference: "CNBF — prévoyance de branche du barreau (LPA/AON), 90 premiers jours",
    action:
      "Renseigner la couverture collective LPA/AON du barreau du client.",
  };
};

// Note constat : pour une ancienneté ≥ 20 ans (240 mois), la pension
// d'invalidité CNBF correspond à 50 % de la retraite proportionnelle
// (selon points acquis), non calculable forfaitairement → non estimée
// ici, à récupérer sur le relevé CNBF. Sans montant (informer sans déformer).
export const regleCnbfInvalidite20ans: Regle = (ctx, cible) => {
  if (ctx.entree.caisse !== "CNBF") return null;
  if (ctx.entree.ancienneteMois < 240) return null;
  return {
    id: `cnbf_invalidite_20ans_${cible}`,
    severite: "attention",
    axe: "invalidite",
    cible,
    titre: "Invalidité CNBF (ancienneté ≥ 20 ans) non estimée",
    detail:
      "Ancienneté ≥ 20 ans : la pension d'invalidité CNBF correspond à 50 % de votre retraite proportionnelle (selon points acquis), non estimée ici — à récupérer sur votre relevé CNBF.",
    reference: "CNBF — pension d'invalidité proportionnelle (ancienneté ≥ 20 ans)",
    action:
      "Récupérer le relevé CNBF du client pour estimer la pension d'invalidité proportionnelle.",
  };
};

// ────────────────────────────────────────────────────────────────────
// Orchestrateur + tri par sévérité
// ────────────────────────────────────────────────────────────────────

const REGLES_INDIVIDUELLES: Regle[] = [
  regleDcTnsSansCapital,
  regleDcCapitalInsuffisantDettes,
  regleDcPasDeRenteConjointEnfantsJeunes,
  regleIjCarenceCaisseSansMadelin,
  regleIjPlafondInsuffisant,
  regleIjCcnNonDocumentee,
  regleInvCat2AucuneCouvertureCompl,
  regleInvTnsMadelinAbsent,
  regleSurCouvertureBornee,
  regleSurCouvertureContrat,
  regleCollectiveTnsIgnoree,
  regleCarmfCarenceAffiliation,
  regleCarmfAnteriorite,
  regleCarmfCumulEmploiRetraite,
  regleCarmfInvaliditeStop62,
  regleCarmfPlafondConjoint,
  regleCnbfLpaAon,
  regleCnbfInvalidite20ans,
];

const ORDRE_SEVERITE: Record<ConstatSeverite, number> = {
  non_conformite: 0,
  alerte: 1,
  attention: 2,
  info: 3,
};

export function evaluerToutesLesRegles(
  ctx: ContexteRegle,
  cible: "p1" | "p2"
): Constat[] {
  const constats: Constat[] = [];
  for (const regle of REGLES_INDIVIDUELLES) {
    const c = regle(ctx, cible);
    if (c) constats.push(c);
  }
  return constats.sort((a, b) => ORDRE_SEVERITE[a.severite] - ORDRE_SEVERITE[b.severite]);
}

// ────────────────────────────────────────────────────────────────────
// Règles de conformité collective (Lot 8)
// ────────────────────────────────────────────────────────────────────

// Mapping ControleConformite → Constat. On adresse les 4 règles
// conf_* attendues + on remonte les autres contrôles non-conformes /
// en vigilance comme constats génériques d'axe "conformite".
// Conformes et non-applicables ne génèrent rien (silencieux).

const MAPPING_CONFORMITE: Record<string, string> = {
  c_sante_ani_obligatoire: "conf_ani_sante_obligatoire",
  c_cadres_15_t1: "conf_cadres_15_t1",
  c_categories_objectives: "conf_categories_objectives_invalides",
  c_ccn_branche_prevoyance: "conf_ccn_branche_obligatoire_non_respectee",
  c_ccn_branche_sante: "conf_ccn_branche_obligatoire_non_respectee",
  c_forfait_social_correctement_applique: "conf_forfait_social_a_auditer",
};

export function mapAuditEnConstats(audit: AuditConformite): Constat[] {
  const constats: Constat[] = [];
  for (const c of audit.controles) {
    if (c.statut === "conforme" || c.statut === "non_applicable") continue;
    const baseId = MAPPING_CONFORMITE[c.id] ?? c.id;
    const severite: ConstatSeverite =
      c.statut === "non_conforme" ? "non_conformite" : "attention";
    constats.push({
      id: `${baseId}_${c.id}`,
      severite,
      axe: "conformite",
      cible: "entreprise",
      titre: c.libelle,
      detail: c.detail,
      reference: c.reference,
      action: c.actionCorrective ?? "Vérifier la conformité du dispositif déclaré et le formaliser au regard de la référence légale citée.",
    });
  }
  return constats.sort((a, b) => ORDRE_SEVERITE[a.severite] - ORDRE_SEVERITE[b.severite]);
}
