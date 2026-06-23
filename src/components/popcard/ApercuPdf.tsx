// ─── Phase 1 — Surface d'aperçu du moteur PDF unifié (paged.js) ────────────────
//
// Affiche le résultat PAGINÉ par paged.js dans un IFRAME isolé (paged.js mute le DOM
// du document où il tourne : on l'enferme dans l'iframe pour ne pas toucher le DOM
// de l'app). Le document de l'iframe est autonome : fonts + CSS @page + contenu en
// flux + polyfill paged.js inliné + handler en-tête/(suite) (cf. feeder.ts).
//
// Bouton TÉLÉCHARGER = impression navigateur ciblée sur l'iframe paginé
// (iframe.contentWindow.print()) → « Enregistrer au format PDF ». Pas de Chromium
// serveur. Coexiste avec l'ancien chemin window.print (generatePack) — ce dernier
// reste le filet jusqu'à la fin de la migration.

import React, { useEffect, useMemo, useRef, useState } from "react";
import pagedPolyfillCode from "pagedjs/dist/paged.polyfill.js?raw";
import {
  renderPackItemBodies,
  resolvePackTokens,
  type PackOverrides,
  type PackPayload,
} from "../../lib/pdf/v2/popcard/concatPack";
import type { PackItem } from "../../lib/pdf/v2/popcard/checkCompletude";
import { buildFeederDocument } from "../../lib/pdf/v2/engine/feeder";

export type ApercuPdfProps = {
  open: boolean;
  onClose: () => void;
  packItems: PackItem[];
  overrides: PackOverrides;
  payload: PackPayload;
};

export function ApercuPdf(p: ApercuPdfProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [pret, setPret] = useState(false);

  // Document autonome en flux (mémoïsé sur les entrées du pack).
  const html = useMemo(() => {
    if (!p.open || p.packItems.length === 0) return "";
    const bodies = renderPackItemBodies(p.packItems, p.overrides, p.payload);
    const t = resolvePackTokens(p.payload.cabinet, p.overrides);
    const cab = (p.payload.cabinet || {}) as Record<string, any>;
    const nom = cab.cabinetNom || cab.nom || "EcoPatrimoine Conseil";
    const cabinetLibelle = `${nom} — confidentiel`;
    const doctitle = `${p.payload.clientName || "Dossier client"} — Dossier patrimonial`;
    return buildFeederDocument({ bodies, t, doctitle, cabinetLibelle, polyfillCode: pagedPolyfillCode });
  }, [p.open, p.packItems, p.overrides, p.payload]);

  // Écoute la fin de pagination (postMessage émis par le document de l'iframe).
  useEffect(() => {
    if (!p.open) {
      setPages(null);
      setPret(false);
      return;
    }
    const onMsg = (e: MessageEvent) => {
      if (e.data && (e.data as any).pagedDone) {
        setPages((e.data as any).pages ?? null);
        setPret(true);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [p.open]);

  if (!p.open) return null;

  const telecharger = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 24, backdropFilter: "blur(3px)" }}
      onClick={p.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#F8F6F7", borderRadius: 18, width: "min(960px,96vw)", height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(15,23,42,.4)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #D8D2C6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, background: "#fff" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#101B3B", margin: 0 }}>Aperçu PDF — nouveau moteur (paged.js)</h2>
            <div style={{ fontSize: 11.5, color: "#637896", marginTop: 3 }}>
              {pret ? `${pages ?? "?"} feuille(s) A4 paginées — pagination mesurée, plus de coupe silencieuse.` : "Pagination en cours…"}
            </div>
          </div>
          <button onClick={p.onClose} style={{ background: "transparent", border: "none", fontSize: 22, color: "#637896", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Aperçu paginé (iframe isolé) */}
        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", justifyContent: "center", background: "#E9E6E1" }}>
          <iframe
            ref={iframeRef}
            title="Aperçu PDF"
            srcDoc={html}
            style={{ width: 800, minHeight: "100%", border: "none", background: "#fff", boxShadow: "0 4px 24px rgba(15,23,42,.18)" }}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #D8D2C6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#fff" }}>
          <div style={{ fontSize: 10.5, color: "#7E8F9F", fontStyle: "italic" }}>
            Nouveau moteur (Phase 1). L'ancien bouton « Générer le pack PDF » reste disponible en parallèle.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={p.onClose} style={{ background: "transparent", color: "#637896", border: "1px solid #D8D2C6", padding: "9px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
            <button
              onClick={telecharger}
              disabled={!pret}
              style={{
                background: pret ? "#101B3B" : "#E2E8F0", color: pret ? "#E3AF64" : "#7E8F9F",
                border: "none", padding: "9px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                cursor: pret ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>↓</span> Télécharger le PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
