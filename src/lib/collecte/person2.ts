// LOT 10e — ADDENDUM U3 : affichage CONDITIONNEL de la Personne 2 dans la Collecte.
// ZERO moteur : pur predicat d'affichage. Regle (retour David) :
//   - identite P2 renseignee            -> on AFFICHE la carte P2 (donnees dormantes
//     jamais masquees silencieusement), avec note discrete si la situation n'est plus
//     un couple ;
//   - couple (married/pacs/cohab) SANS identite P2 -> invite compacte "Renseignez la
//     personne 2 -> Donnees familiales" (pas de carte vide) ;
//   - seul (single/divorced/widowed) SANS identite P2 -> rien (P1 pleine largeur).
//
// "Couple" au sens FOYER (vie courante) = 3 valeurs, coherent avec TabTravail /
// dossierResume.COUPLE_STATUSES. Distinct du "foyer fiscal" (married||pacs) utilise
// cote IR/IFI/succession — a ne pas confondre.

const COUPLE_COLLECTE = new Set(["married", "pacs", "cohab"]);

export function isCoupleCollecte(coupleStatus: string | undefined | null): boolean {
  return COUPLE_COLLECTE.has(String(coupleStatus ?? ""));
}

export function hasPerson2Identity(data: { person2FirstName?: string; person2LastName?: string } | null | undefined): boolean {
  return Boolean(
    String(data?.person2FirstName ?? "").trim() || String(data?.person2LastName ?? "").trim(),
  );
}

export type Person2Mode = "card" | "invite" | "none";

// Mode d'affichage de la colonne / carte Personne 2 dans un sous-onglet de collecte.
export function person2Mode(data: any): Person2Mode {
  if (hasPerson2Identity(data)) return "card";      // donnees dormantes : toujours affichees
  if (isCoupleCollecte(data?.coupleStatus)) return "invite";
  return "none";
}

// Vrai si la carte P2 est affichee alors que la situation n'est plus un couple
// (donnees "dormantes") -> justifie une note discrete.
export function person2Dormant(data: any): boolean {
  return hasPerson2Identity(data) && !isCoupleCollecte(data?.coupleStatus);
}
