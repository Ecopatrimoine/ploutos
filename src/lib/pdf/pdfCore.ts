// ─── pdfCore — Noyau résiduel (post-bascule v1 → v2) ────────────────
//
// Après la bascule franche v1 → v2 puis le retrait du chemin window.print
// (openPrintPopup / generatePack), ce module n'expose plus que :
//   • `Recipient` type : routage destinataire (couple / person1 / person2)
//
// Tous les autres helpers v1 (kpi, sec, tbl, hbar, segB, summarizeBy,
// PAGINATION_THRESHOLD, resolveCabinetColors, resolveRecipient, ENCRE_OR)
// ont été supprimés en même temps que pdfReport.ts / pdfMission.ts /
// pdfDER.ts / pdfFicheDDA.ts / pdfAdequation.ts.

// ─── Destinataire du document ──────────────────────────────────────────────
// Consommé par PackPayload (concatPack) et buildCouvertureData pour le
// routage de l'en-tête « Préparé pour » en concubinage (foyers séparés).
export type Recipient = "person1" | "person2" | "couple";
