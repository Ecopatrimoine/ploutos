// LOT 10d D1 — complétude par section du Dossier client, DÉRIVÉE des données déjà
// présentes (aucune invention). Ne couvre QUE les sections à signal fiable ; les
// sections à valeur par défaut valide (rémunération, obligations fiscales, signature
// pré-remplie) n'ont pas de badge (cf. recon) et ne figurent pas ici.

const BESOIN_KEYS = [
  "besoinSante_depenses", "besoinSante_hospit", "besoinSante_depasse", "besoinSante_surcompl",
  "besoinPrev_arret", "besoinPrev_deces", "besoinPrev_fraisGen",
  "besoinRetraite_capital", "besoinRetraite_rente", "besoinRetraite_moderniser",
  "besoinEpargne_valoriser", "besoinEpargne_transmettre", "besoinEpargne_completer", "besoinEpargne_projet",
] as const;

export type CompletudeMission = {
  besoins: boolean;        // au moins un besoin coché
  profil: boolean;         // horizon + mode de gestion renseignés (les 2 selects qui partent vides)
  esg: boolean;            // préférence ESG renseignée
  recommandations: boolean; // au moins une recommandation
  piecesJointes: boolean;  // au moins une pièce jointe
};

export function completudeMission(mission: any, recommandations: any[], piecesJointes: any[]): CompletudeMission {
  const m = mission ?? {};
  return {
    besoins: BESOIN_KEYS.some((k) => !!m[k]),
    profil: (m.horizon ?? "") !== "" && (m.modeGestion ?? "") !== "",
    esg: (m.esgPref ?? "") !== "",
    recommandations: Array.isArray(recommandations) && recommandations.length > 0,
    piecesJointes: Array.isArray(piecesJointes) && piecesJointes.length > 0,
  };
}
