// ─── pdfCore — Noyau résiduel (post-bascule v1 → v2) ────────────────
//
// Après la bascule franche v1 → v2, ce module n'expose plus que ce qui
// reste utilisé par le pipeline v2 (pop-card, runners individuels) :
//   • `Recipient` type : routage destinataire (couple / person1 / person2)
//   • `openPrintPopup` : ouverture popup print → window.print()
//
// Tous les autres helpers v1 (kpi, sec, tbl, hbar, segB, summarizeBy,
// PAGINATION_THRESHOLD, resolveCabinetColors, resolveRecipient, ENCRE_OR)
// ont été supprimés en même temps que pdfReport.ts / pdfMission.ts /
// pdfDER.ts / pdfFicheDDA.ts / pdfAdequation.ts.

// ─── Destinataire du document ──────────────────────────────────────────────
// Consommé par PackPayload (concatPack) et buildCouvertureData pour le
// routage de l'en-tête « Préparé pour » en concubinage (foyers séparés).
export type Recipient = "person1" | "person2" | "couple";

// ─── Coquille print — popup + window.print() ───────────────────────────────
export function openPrintPopup(html: string): void {
  const popup = (globalThis as any).window?.open?.("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!popup) { (globalThis as any).window?.alert?.("Autorise les popups pour ce site."); return; }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => { popup.print(); }, 500);
}
