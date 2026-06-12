// ─── AlerteAncienneteNonFiable — avertissement ancienneté non fiable (LOT ANCIEN-UI) ──
//
// Lot PUREMENT UI (option b : alerte seule, AUCUN nouveau champ de saisie ni
// modification du moteur / des types / du mapping / du calcul).
//
// Rend un avertissement discret quand l'ancienneté du salarié n'est PAS fiable :
// la date d'embauche n'est pas renseignée → l'ancienneté dérivée retombe à 0
// (cf. calcAncienneteMois, mapping.ts) ALORS QUE le maintien de salaire employeur
// applicable est conditionné par l'ancienneté (au moins un palier à
// ancienneteMois > 0, ex. Syntec non-cadres, Métallurgie 3248, ou le maintien
// légal Mensualisation qui démarre à 12 mois). Dans ce cas, le moteur écarte
// silencieusement ces paliers et le maintien est sous-évalué sans que
// l'utilisateur le sache.
//
// On ne RECALCULE rien : on relit le maintien applicable via les fonctions
// moteur exportées (getMaintienParams + categorieMaintien) uniquement pour
// décider de l'affichage.

import type { StatutPro } from "../../types/patrimoine";
import { BRAND } from "../../constants";
import { STATUTS_SALARIE } from "../../lib/prevoyance/constants";
import { getMaintienParams, categorieMaintien } from "../../lib/prevoyance/projection";
import { referentiels } from "../../data/prevoyance";

// Date d'embauche ABSENTE ou invalide → l'ancienneté dérivée vaut 0 « par défaut
// de saisie » (et non parce que le salarié est réellement récent). MÊME critère
// d'invalidité que calcAncienneteMois (mapping.ts), pour rester aligné.
function dateEmbaucheManquante(raw: string | null | undefined): boolean {
  if (!raw) return true;
  return Number.isNaN(new Date(raw).getTime());
}

// Décide si l'alerte doit s'afficher. Trois conditions CUMULATIVES :
//   1. statut salarié / assimilé — même périmètre que isSalarieOuAssimile du
//      moteur (STATUTS_SALARIE). Les TNS s'appuient sur dateDebutActivite et
//      n'ont pas de maintien employeur → jamais d'alerte.
//   2. date d'embauche absente / invalide (ancienneté = 0 faute de saisie). Une
//      date saisie donnant réellement < 12 mois est un résultat CORRECT → pas
//      d'alerte (on teste la DATE, pas ancienneteMois === 0).
//   3. le maintien applicable (CCN documentée, sinon légal Mensualisation) a au
//      moins un palier à ancienneteMois > 0. Si son seul palier est à 0 mois
//      (ex. IDCC 2264), l'ancienneté n'a aucun effet → pas d'alerte.
export function doitAlerterAncienneteNonFiable(
  statutPro: StatutPro | "",
  idccCCN: string | null,
  dateEmbauche: string | null | undefined
): boolean {
  if (!STATUTS_SALARIE.includes(statutPro as StatutPro)) return false;
  if (!dateEmbaucheManquante(dateEmbauche)) return false;
  const maintien = getMaintienParams(idccCCN, referentiels, categorieMaintien(statutPro));
  return maintien.paliers.some((p) => p.ancienneteMois > 0);
}

type Props = {
  statutPro: StatutPro | "";
  idccCCN: string | null;
  dateEmbauche: string | null | undefined;
  // Classe optionnelle ajoutée à l'encart (espacement géré par le parent). Le
  // composant rendant null quand l'alerte ne s'applique pas, aucune marge vide
  // n'est laissée dans le DOM.
  className?: string;
};

export function AlerteAncienneteNonFiable({ statutPro, idccCCN, dateEmbauche, className = "" }: Props) {
  if (!doitAlerterAncienneteNonFiable(statutPro, idccCCN, dateEmbauche)) return null;
  return (
    <div
      className={`rounded-xl p-3 text-sm ${className}`.trim()}
      style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}
    >
      Date d'embauche non renseignée : le maintien de salaire employeur est calculé
      avec 0 d'ancienneté et peut être sous-évalué. Renseignez la date d'embauche
      dans le bloc Travail.
    </div>
  );
}
