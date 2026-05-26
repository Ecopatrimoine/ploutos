// ─── Lot 9 (bascule) — Wrapper print browser pour le pipeline PDF v2 ──
//
// Réutilise `openPrintPopup` v1 (pdfCore.ts:169) — exactement le même
// mécanisme popup + window.print() que les builders v1, donc 0 surprise
// de comportement utilisateur (autorisation popup, dialogue d'impression
// natif du navigateur, choix « Enregistrer au format PDF »).
//
// Ce module fournit le point d'entrée commun pour tous les documents v2 :
// chaque caller passe son HTML déjà assemblé par un render*.ts.
//
// NB : le script `scripts/generatePdfLocal.ts` reste l'outil DEV pour
// régénérer les PDFs de validation visuelle via Playwright (fichiers .pdf
// sur disque). printV2 est l'équivalent RUNTIME browser (popup print).

import { openPrintPopup } from "../pdfCore";

export function printV2(html: string): void {
  openPrintPopup(html);
}
