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
  // Export Electron (printToPDF) : état de chargement + message d'erreur sobre.
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // Détection Electron (même pattern que App.tsx / useClients).
  const isElectron =
    typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;

  // Entrées du feeder mémoïsées (partagées : aperçu URL + export Electron inline).
  const feederOpts = useMemo(() => {
    if (!p.open || p.packItems.length === 0) return null;
    const bodies = renderPackItemBodies(p.packItems, p.overrides, p.payload);
    const t = resolvePackTokens(p.payload.cabinet, p.overrides);
    const cab = (p.payload.cabinet || {}) as Record<string, any>;
    const nom = cab.cabinetNom || cab.nom || "EcoPatrimoine Conseil";
    const cabinetLibelle = `${nom} — confidentiel`;
    const doctitle = `${p.payload.clientName || "Dossier client"} — Dossier patrimonial`;
    return { bodies, t, doctitle, cabinetLibelle };
  }, [p.open, p.packItems, p.overrides, p.payload]);

  // Aperçu : document feeder avec polices URL (variante légère same-origin).
  const html = useMemo(
    () => (feederOpts ? buildFeederDocument({ ...feederOpts, polyfillCode: pagedPolyfillCode }) : ""),
    [feederOpts]
  );

  // Écoute la fin de pagination (postMessage émis par le document de l'iframe).
  useEffect(() => {
    if (!p.open) {
      setPages(null);
      setPret(false);
      setExporting(false);
      setExportErr(null);
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

  // IMPRIMER : dialogue d'impression natif du navigateur ciblé sur l'iframe paginé.
  // Marche partout (web ET Electron) ; sur web c'est aussi la voie « Enregistrer au
  // format PDF ».
  const imprimer = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  // TÉLÉCHARGER : sous Electron, vrai fichier PDF via printToPDF (rendu fidèle, offline,
  // polices base64 inline autoportantes). Sous web : repli sur le dialogue d'impression
  // (seul chemin web fidèle) — l'utilisateur choisit « Enregistrer au format PDF ».
  const telecharger = async () => {
    if (!isElectron) {
      imprimer();
      return;
    }
    if (!feederOpts) return;
    setExportErr(null);
    setExporting(true);
    try {
      // Import DYNAMIQUE : les ~165 Ko de polices base64 ne sont chargés qu'ICI (clic
      // Télécharger sous Electron), jamais à l'ouverture de l'aperçu (lazy, cf. B1).
      const { FONT_FACES_STYLE_INLINE } = await import("../../lib/pdf/v2/fontsInline");
      // Document AUTOPORTANT : même feeder paginé, mais polices base64 inline.
      const htmlInline = buildFeederDocument({
        ...feederOpts,
        polyfillCode: pagedPolyfillCode,
        fontsHtml: FONT_FACES_STYLE_INLINE,
      });
      const base =
        (p.payload.clientName || "rapport").replace(/[^A-Za-z0-9._-]+/g, "_") || "rapport";
      const res = await (window as any).electronAPI.exportPdf(htmlInline, `${base}.pdf`);
      if (res?.error) setExportErr("Échec de l'export PDF : " + res.error);
      // { canceled:true } -> rien ; { canceled:false, path } -> succès (pas de toast ici).
    } catch (e: any) {
      setExportErr("Échec de l'export PDF : " + (e?.message || String(e)));
    } finally {
      setExporting(false);
    }
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
          <div style={{ fontSize: 10.5, color: "#7E8F9F", fontStyle: "italic", maxWidth: 360 }}>
            {isElectron
              ? "« Télécharger » enregistre le PDF sur votre disque."
              : "Sur navigateur : « Télécharger » ouvre l'impression — choisissez « Enregistrer au format PDF »."}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {exportErr && (
              <span style={{ fontSize: 11, color: "#B91C1C", maxWidth: 220, lineHeight: 1.3 }}>{exportErr}</span>
            )}
            <button onClick={p.onClose} style={{ background: "transparent", color: "#637896", border: "1px solid #D8D2C6", padding: "9px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
            <button
              onClick={imprimer}
              disabled={!pret}
              title="Ouvre le dialogue d'impression du navigateur"
              style={{
                background: "transparent", color: pret ? "#101B3B" : "#7E8F9F",
                border: "1px solid #D8D2C6", padding: "9px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                cursor: pret ? "pointer" : "not-allowed",
              }}
            >
              Imprimer
            </button>
            <button
              onClick={telecharger}
              disabled={!pret || exporting}
              title={isElectron ? "Enregistrer le PDF sur le disque" : "Choisissez « Enregistrer au format PDF » dans le dialogue"}
              style={{
                background: pret && !exporting ? "#101B3B" : "#E2E8F0", color: pret && !exporting ? "#E3AF64" : "#7E8F9F",
                border: "none", padding: "9px 18px", borderRadius: 10, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                cursor: pret && !exporting ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>↓</span> {exporting ? "Export en cours…" : "Télécharger le PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
