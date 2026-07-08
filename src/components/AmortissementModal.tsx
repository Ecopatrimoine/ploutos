// ─── AmortissementModal — plan d'amortissement par composants (Lot 1bis) ──────
//
// Modale patron ChargesModal (shadcn Dialog). Affiche le plan ligne par ligne
// (Composant | Part % | Base | Duree | Dotation/an) + Mobilier + TOTAL. Part % et
// Duree sont EDITABLES par composant : le CGP controle et ajuste. UI PURE : ecrit
// Property.amortissementComposants (overrides part/duree en FRACTION/annees) via
// updateProperty ; tout le calcul vient de amortissementAuto (moteur, source
// unique). Garde : la somme des parts immobilieres doit valoir 100 % pour valider.
//
// Draft local : les edits ne sont commit qu'au "Valider" (sum = 100 %), pour
// pouvoir bloquer une repartition invalide. "Annuler" jette le draft ;
// "Reinitialiser la grille" efface les overrides (retour au referentiel).

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BRAND, SURFACE } from "../constants";
import { n, euro, isSet, pct } from "../lib/calculs/utils";
import { amortissementAuto } from "../lib/calculs/locationMeublee";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

const COMPO_LABEL: Record<string, string> = {
  grosOeuvre: "Gros œuvre",
  toiture: "Toiture",
  installationsTechniques: "Installations techniques",
  facadeEtancheite: "Façade / étanchéité",
  agencements: "Agencements",
};

type Overrides = Record<string, { part?: number; duree?: number }>;

type Props = {
  property: Property;
  updateProperty: (id: any, field: string, value: unknown) => void;
  onClose: () => void;
};

export function AmortissementModal({ property, updateProperty, onClose }: Props) {
  const [draft, setDraft] = React.useState<Overrides>(() => ({ ...(property.amortissementComposants || {}) }));

  const partTerrain = isSet(property.partTerrain) ? n(property.partTerrain) : refMeuble.amortissement.partTerrainDefaut;
  const prix = n(property.prixAcquisition);
  const valeurMobilier = n(property.valeurMobilier);
  const plan = amortissementAuto(prix, partTerrain, valeurMobilier, draft);
  const sommeOk = Math.abs(plan.sommeParts - 1) < 1e-9;

  const setOverride = (compo: string, key: "part" | "duree", raw: string) => {
    setDraft((prev) => {
      const next: Overrides = { ...prev };
      const cur = { ...(next[compo] || {}) };
      if (raw.trim() === "") delete cur[key];
      else cur[key] = key === "part" ? n(raw) / 100 : Math.max(1, Math.floor(n(raw)));
      if (cur.part == null && cur.duree == null) delete next[compo];
      else next[compo] = cur;
      return next;
    });
  };

  const valider = () => {
    updateProperty(property.id, "amortissementComposants", Object.keys(draft).length ? draft : undefined);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-2xl" style={{ background: SURFACE.card }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.navy }}>Détail de l'amortissement (par composants)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: BRAND.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Composant</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Part %</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Base</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Durée (ans)</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Dotation/an</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {plan.detail.map((d) => (
                  <tr key={d.composant} style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: BRAND.navy }}>
                      {COMPO_LABEL[d.composant] || d.composant}
                      {d.ajuste && <span style={{ color: BRAND.sky, fontSize: 10, marginLeft: 6, fontWeight: 700 }}>ajusté</span>}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <Input value={String(Math.round(d.part * 1000) / 10).replace(".", ",")} onChange={(e) => setOverride(d.composant, "part", e.target.value)} className="h-7 text-sm w-16 ml-auto" style={{ textAlign: "right", fontWeight: 700 }} inputMode="decimal" aria-label={`Part ${COMPO_LABEL[d.composant] || d.composant}`} />
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: BRAND.muted }}>{euro(plan.baseBati * d.part)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <Input value={String(d.duree)} onChange={(e) => setOverride(d.composant, "duree", e.target.value)} className="h-7 text-sm w-16 ml-auto" style={{ textAlign: "right", fontWeight: 700 }} inputMode="numeric" aria-label={`Durée ${COMPO_LABEL[d.composant] || d.composant}`} />
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{euro(d.dotation)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px solid ${SURFACE.border}`, color: BRAND.muted }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>Mobilier</td>
                  <td></td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{euro(valeurMobilier)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{refMeuble.amortissement.dureeMobilier}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{euro(plan.mobilier)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: BRAND.navy, color: "#fff" }}>
                  <td style={{ padding: "8px", fontWeight: 700 }} colSpan={4}>TOTAL amortissement annuel</td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 800 }}>{euro(plan.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
            style={{ background: sommeOk ? BRAND.successBg : BRAND.warningBg, border: `1px solid ${sommeOk ? BRAND.successBorder : BRAND.warningBorder}`, color: sommeOk ? BRAND.success : BRAND.warning }}>
            <span>Somme des parts immobilières</span>
            <span style={{ fontWeight: 800 }}>{pct(plan.sommeParts, 1)}{sommeOk ? " ✓" : " — doit valoir 100 %"}</span>
          </div>

          <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
            Méthode par composants, durées d'usage BOFiP — convention indicative, ajustable. Part et durée modifiables par composant ; base = prix hors terrain réparti selon la part.
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => setDraft({})} className="rounded-xl px-3 py-2 text-sm font-medium" style={{ background: "rgba(99,120,150,0.1)", color: BRAND.muted }}>Réinitialiser la grille</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium" style={{ background: "rgba(99,120,150,0.1)", color: BRAND.muted }}>Annuler</button>
            <button type="button" onClick={valider} disabled={!sommeOk} className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: sommeOk ? BRAND.navy : SURFACE.border, color: "#fff", cursor: sommeOk ? "pointer" : "not-allowed", opacity: sommeOk ? 1 : 0.6 }}>
              Valider
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
