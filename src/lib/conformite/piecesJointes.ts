// ─── Lot 8e — Modèle « pièce jointe IPID / DIC » ──────────────────────────
//
// PRINCIPE CRITIQUE :
//   Ploutos NE GÉNÈRE JAMAIS d'IPID / DIC. Ce sont des documents normalisés
//   FOURNIS PAR L'ASSUREUR (règlement d'exécution UE 2017/1469 pour l'IPID,
//   règlement (UE) n° 1286/2014 PRIIPs pour le DIC). Le cabinet les
//   RATTACHE au dossier client et les RÉFÉRENCE dans la fiche DDA.
//
// Ce module fournit UNIQUEMENT le modèle de métadonnées + les helpers de
// filtre/lecture. Aucune fonction de fabrication n'est exportée, et un test
// d'introspection vérifie cette discipline (cf. tests/piecesJointes.test.ts).

export type PieceJointeType = "ipid" | "dic" | "autre";

export type PieceJointe = {
  /** Identifiant unique (crypto.randomUUID() côté UI). */
  id: string;
  /** Catégorie réglementaire de la pièce. */
  type: PieceJointeType;
  /** Nom du fichier original (peut contenir le nom de l'assureur — c'est de
   *  la SAISIE UTILISATEUR, pas du contenu codé en dur dans Ploutos). */
  nom: string;
  /** Type MIME (application/pdf le plus souvent). */
  mimeType: string;
  /** Taille en octets. */
  taille: number;
  /** Date d'upload au format ISO. */
  uploadedAt: string;
  /** Texte libre pour rattacher la pièce à un contrat / une garantie. */
  contratLie?: string;
  /** Contenu en data URL (base64) — pattern existant (cf. logo cabinet).
   *  Migration future vers Supabase Storage prévue via storagePath. */
  dataUrl?: string;
  /** Chemin Supabase Storage — futur Lot 8e-storage. */
  storagePath?: string;
};

export const PIECE_TYPE_LABELS: Record<PieceJointeType, string> = {
  ipid:  "IPID — Information sur le Produit d'Assurance",
  dic:   "DIC — Document d'Informations Clés (PRIIPs)",
  autre: "Autre pièce jointe",
};

/** Filtre une liste de pièces par type. */
export function filterByType(
  pieces: ReadonlyArray<PieceJointe>,
  type: PieceJointeType,
): PieceJointe[] {
  return (pieces || []).filter(p => p && p.type === type);
}

/** Vrai si au moins une pièce IPID est présente. */
export function hasIPID(pieces: ReadonlyArray<PieceJointe>): boolean {
  return filterByType(pieces, "ipid").length > 0;
}

/** Vrai si au moins une pièce DIC est présente. */
export function hasDIC(pieces: ReadonlyArray<PieceJointe>): boolean {
  return filterByType(pieces, "dic").length > 0;
}

/** Vrai si la pièce a un contenu persisté (dataUrl OU storagePath). */
export function isPiecePersistable(p: PieceJointe | null | undefined): boolean {
  if (!p) return false;
  const hasContent = (typeof p.dataUrl === "string" && p.dataUrl.length > 0)
                  || (typeof p.storagePath === "string" && p.storagePath.length > 0);
  return hasContent && typeof p.nom === "string" && p.nom.trim().length > 0;
}

/** Formate un poids en bytes vers une chaîne lisible (KB/MB). */
export function formatTaille(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
