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
  Constat,
  ConstatSeverite,
  ContratIndividuel,
  ContexteRegle,
  Regle,
} from "./types";
import type { StatutPro } from "../../types/patrimoine";

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
    s.maintienEmployeur[i] +
    s.ijObligatoire[i] +
    s.ijComplementaireCollective[i] +
    s.ijComplementaireIndividuelle[i] +
    s.pensionInvalObligatoire[i] +
    s.renteInvalCollective[i] +
    s.renteInvalIndividuelle[i]
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
  const capital = sumContratsParType(e.contratsIndividuels, "deces_capital");
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
  const capital = sumContratsParType(ctx.entree.contratsIndividuels, "deces_capital");
  // Note : le capital décès régime obligatoire est lu du référentiel
  // (souvent TO_VERIFY pour l'instant). On compare donc juste au
  // capital individuel ; le constat reste pertinent même quand le
  // référentiel sera complet.
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
    impactChiffre: { montant: trou, libelle: "Trou de capital décès face aux dettes immobilières" },
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
  if (ratio >= 0.7) return null; // trou < 30 % → pas d'alerte
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
    impactChiffre: { montant: trou, libelle: "Trou de revenu mensuel à J180" },
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
    impactChiffre: { montant: trou, libelle: "Trou de revenu invalidité mensuel" },
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
