// Lot 8 C3 — suppression d'une ligne avec friction proportionnelle :
// - ligne VIDE (aucune donnee saisie) -> suppression directe, sans confirmation ;
// - ligne REMPLIE -> confirmation legere "Supprimer [libelle] ?" (meme decision
//   par defaut que la suppression de dossier).
// `hasData` : au moins un champ non vide sur la ligne. `remove` : effet reel.
export function confirmRemove(hasData: boolean, label: string, remove: () => void): void {
  if (!hasData || window.confirm(`Supprimer ${label} ?`)) remove();
}
