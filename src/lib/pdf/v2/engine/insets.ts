// ─── LOT 11 C3 — Insets latéraux du corps PDF (SOURCE UNIQUE) ────────────────
//
// Le corps (.pdf-contrat) et le chrome @page (feeder margin-boxes) DOIVENT partager
// le même bord latéral, sinon en-tête/pied se décalent du texte. Ces valeurs étaient
// dupliquées (contrat.ts PAGE_PAD_LAT_PX / feeder.ts INSET_LATERAL_PX = 38) et
// recopiées en dur dans les 5 sections réglementaires (« padding:0 36px 0 44px »).
// On les centralise ici — ZÉRO changement de valeur, pur dédoublonnage.

// Inset latéral SYMÉTRIQUE des feuilles bilan (corps + feeder). 38px ≈ 10,05 mm :
// contenu = 210mm − 2×38px = 189,9mm = 538,3pt (largeur intérieure de la maquette).
export const INSET_LATERAL_PX = 38;

// Corps des documents RÉGLEMENTAIRES : inset ASYMÉTRIQUE (gauche 44 > droite 36) pour la
// respiration du liseré docReg (9px) ; le chrome @page docReg s'aligne sur ces mêmes bords.
export const DOCREG_INSET_GAUCHE_PX = 44; // padding-left du corps docReg
export const DOCREG_INSET_DROITE_PX = 36; // padding-right du corps docReg

// Padding CSS du corps docReg (« 0 {droite}px 0 {gauche}px ») — chaîne partagée par les
// 5 pages réglementaires (lettre / DER / DER annexe / fiche DDA / déclaration d'adéquation).
export const DOCREG_BODY_PADDING = `0 ${DOCREG_INSET_DROITE_PX}px 0 ${DOCREG_INSET_GAUCHE_PX}px`;
