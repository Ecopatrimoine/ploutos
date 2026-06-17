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

// Delai de secours : si les polices ne se chargent pas (CDN injoignable / hors
// ligne), on imprime QUAND MEME au plus tard apres ce delai. Ne JAMAIS bloquer.
const TIMEOUT_POLICES_MS = 3000;
// Petit delai de grace apres fonts.ready, le temps que le layout se stabilise.
const DELAI_GRACE_MS = 80;
// Repli quand FontFaceSet est indisponible (jsdom, vieux moteur) : court delai.
const DELAI_REPLI_MS = 200;

// ─── Coquille print — popup + window.print() APRES chargement des polices ──
// Cause corrigee (Lot 9bis) : on attend `document.fonts.ready` du popup AVANT
// d'imprimer. Sinon l'impression peut etre capturee avant le chargement de
// Lato/Fraunces (CDN) -> Chromium calcule mal l'avance des glyphes -> espaces
// avales. Garde-fous : timeout de secours, repli si FontFaceSet absent, erreurs
// avalees -> l'impression part TOUJOURS (le bouton ne reste jamais mort).
export function openPrintPopup(html: string): void {
  const popup = (globalThis as any).window?.open?.("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!popup) { (globalThis as any).window?.alert?.("Autorise les popups pour ce site."); return; }
  popup.document.write(html);
  popup.document.close();
  popup.focus();

  const lancerImpression = () => {
    try { popup.print(); } catch { /* popup ferme entre-temps : on ignore */ }
  };

  // FontFaceSet.ready du document popup, si l'environnement l'expose.
  let fontsReady: Promise<unknown> | null = null;
  try {
    const fonts = popup.document?.fonts;
    if (fonts && typeof fonts.ready?.then === "function") fontsReady = fonts.ready;
  } catch { fontsReady = null; }

  // Pas de FontFaceSet (jsdom, vieux navigateur) -> repli : court delai puis print.
  if (!fontsReady) {
    setTimeout(lancerImpression, DELAI_REPLI_MS);
    return;
  }

  // Course : polices pretes OU timeout de secours -> impression (apres delai de
  // grace). then(ok, err) => quelle que soit l'issue, on imprime exactement une
  // fois (Promise.race ne se resout qu'une seule fois).
  const apresGrace = () => setTimeout(lancerImpression, DELAI_GRACE_MS);
  const secours = new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_POLICES_MS));
  Promise.race([fontsReady, secours]).then(apresGrace, apresGrace);
}
