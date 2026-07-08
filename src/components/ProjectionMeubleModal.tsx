// ─── ProjectionMeubleModal — projection sur 10 ans d'un bien meuble reel (Lot 2) ──
//
// Modale patron ChargesModal/AmortissementModal (shadcn Dialog). LECTURE SEULE
// cote calcul : projection via computeProjectionMeuble (fonction pure, hors moteur).
// Le bandeau "Situation de depart" (Lot 2ter) persiste anneeAcquisition /
// stockArdAnterieur sur le bien (updateProperty) au clic "Appliquer / Recalculer".

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { BRAND, SURFACE } from "../constants";
import { euro, pct } from "../lib/calculs/utils";
import { HelpTooltip } from "./shared";
import { computeProjectionMeuble } from "../lib/calculs/projectionMeuble";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

type Props = {
  property: Property;
  updateProperty: (id: any, field: string, value: unknown) => void;
  onClose: () => void;
};

export function ProjectionMeubleModal({ property, updateProperty, onClose }: Props) {
  const anneeCourante = refMeuble.millesime;
  // Draft de saisie + valeurs APPLIQUEES qui pilotent le calcul (recalcul au clic).
  const [draft, setDraft] = React.useState({
    anneeAcquisition: property.anneeAcquisition ?? "",
    stockArdAnterieur: property.stockArdAnterieur ?? "",
  });
  const [applied, setApplied] = React.useState(draft);

  const bienProj = { ...property, anneeAcquisition: applied.anneeAcquisition, stockArdAnterieur: applied.stockArdAnterieur };
  const proj = computeProjectionMeuble(bienProj, 10);
  const L = proj.lignes;
  const hasDeficits = L.some((l) => l.stockDeficits > 0 || l.deficitsImputes > 0);
  const pv = proj.pvDisponible;
  const censi = property.dispositifFiscal === "censiBouvard";
  const dernier = L[L.length - 1];
  const chartData = L.map((l) => ({ annee: `An ${l.annee}`, base: Math.round(l.baseImposable), ard: Math.round(l.stockArd) }));

  const appliquer = () => {
    setApplied(draft);
    updateProperty(property.id, "anneeAcquisition", draft.anneeAcquisition);
    updateProperty(property.id, "stockArdAnterieur", draft.stockArdAnterieur);
  };

  // Colonne detention : age reel si annee d'acquisition renseignee, sinon rang.
  const detention = (l: { annee: number; age: number }) =>
    proj.anneesEcoulees > 0 ? (l.age === 1 ? "1re année" : `${l.age}e année`) : `An ${l.annee}`;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl rounded-2xl" style={{ background: SURFACE.card, maxHeight: "90vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.navy }}>Projection sur 10 ans — {property.name || "bien meublé"} (BIC réel)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Situation de depart (Lot 2ter) */}
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(38,66,139,0.05)", border: `1px solid rgba(38,66,139,0.2)` }}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.sky }}>Situation de départ</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: BRAND.muted }}>Année d'acquisition</label>
                <Input value={draft.anneeAcquisition} onChange={(e) => setDraft((d) => ({ ...d, anneeAcquisition: e.target.value }))} placeholder={String(anneeCourante)} className="h-8 text-sm w-28 rounded-xl" inputMode="numeric" />
              </div>
              <div>
                <label className="text-[11px] font-bold flex items-center gap-1 mb-1" style={{ color: BRAND.muted }}>Stock ARD antérieur<HelpTooltip text="Amortissements déjà constatés non encore déduits — visible sur la liasse 2033, tableau des ARD." /></label>
                <Input value={draft.stockArdAnterieur} onChange={(e) => setDraft((d) => ({ ...d, stockArdAnterieur: e.target.value }))} placeholder="0" className="h-8 text-sm w-32 rounded-xl" inputMode="decimal" />
              </div>
              <button type="button" onClick={appliquer} className="h-8 rounded-xl px-3 text-sm font-semibold" style={{ background: BRAND.navy, color: "#fff" }}>Appliquer / Recalculer</button>
            </div>
          </div>

          {/* Bandeau hypothèses */}
          <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: BRAND.cream, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
            Recettes et charges constantes — amortissement {proj.manuel ? "au montant manuel constant" : "selon le plan par composants"} — intérêts d'emprunt non dégressifs — simulation indicative, hors évolution législative.
          </div>

          {/* Tableau année par année */}
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ color: BRAND.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <th style={{ textAlign: "left", padding: "5px 8px" }}>{proj.anneesEcoulees > 0 ? "Détention" : "Année"}</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Dotation</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Amort. utilisé</th>
                  <th style={{ textAlign: "right", padding: "5px 8px", color: BRAND.sky }}>Stock ARD</th>
                  {hasDeficits && <th style={{ textAlign: "right", padding: "5px 8px" }}>Déf. imputés</th>}
                  {hasDeficits && <th style={{ textAlign: "right", padding: "5px 8px" }}>Stock déficits</th>}
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Base imposable</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>PS estimés</th>
                  {pv && <th style={{ textAlign: "right", padding: "5px 8px", color: BRAND.goldText }}>PV brute si vente</th>}
                  {pv && <th style={{ textAlign: "right", padding: "5px 8px", color: BRAND.danger }}>Impôt PV si vente</th>}
                </tr>
              </thead>
              <tbody>
                {L.map((l) => {
                  const bascule = proj.anneeBascule === l.annee;
                  return (
                    <tr key={l.annee} style={{ borderTop: `1px solid ${SURFACE.border}`, background: bascule ? "rgba(196,151,61,0.12)" : undefined }}>
                      <td style={{ padding: "5px 8px", fontWeight: 600, color: BRAND.navy }}>{detention(l)}{bascule && <span style={{ color: BRAND.goldText, fontSize: 10, marginLeft: 5, fontWeight: 700 }}>bascule</span>}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{euro(l.dotation)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{euro(l.utilise)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: BRAND.sky }}>{euro(l.stockArd)}</td>
                      {hasDeficits && <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{l.deficitsImputes > 0 ? euro(l.deficitsImputes) : "—"}</td>}
                      {hasDeficits && <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.warning }}>{l.stockDeficits > 0 ? euro(l.stockDeficits) : "—"}</td>}
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: BRAND.navy }}>{euro(l.baseImposable)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: l.psEstimes > 0 ? BRAND.danger : BRAND.muted }}>{euro(l.psEstimes)}</td>
                      {pv && <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: l.moinsValue ? BRAND.success : BRAND.goldText }}>{l.moinsValue ? "MV" : euro(l.pvBrute)}</td>}
                      {pv && <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: l.impotPvTotal > 0 ? BRAND.danger : BRAND.muted }}>
                        {l.moinsValue ? "—" : euro(l.impotPvTotal)}
                        {!l.moinsValue && <HelpTooltip text={`Abattement IR ${pct(l.abattementIr, 0)} -> base ${euro(l.baseIr)} -> IR 19 % = ${euro(l.impotIr)}.\nAbattement PS ${pct(l.abattementPs, 1)} -> base ${euro(l.basePs)} -> PS 17,2 % = ${euro(l.impotPs)}.\nTotal ${euro(l.impotPvTotal)}.${l.alerteSurtaxe ? "\nSurtaxe PV elevees (art. 1609 nonies G) non incluse." : ""}`} />}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mini graphe : barres base + courbe stock ARD (reste centré sur l'ARD) */}
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" />
                <XAxis dataKey="annee" tick={{ fontSize: 10, fill: BRAND.muted }} />
                <YAxis tick={{ fontSize: 10, fill: BRAND.muted }} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: any, name: any) => [euro(v as number), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="base" name="Base imposable" fill={BRAND.gold} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="ard" name="Stock ARD" stroke={BRAND.sky} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Année de bascule */}
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: proj.anneeBascule ? BRAND.warningBg : "rgba(38,66,139,0.06)", border: `1px solid ${proj.anneeBascule ? BRAND.warningBorder : "rgba(38,66,139,0.2)"}`, color: proj.anneeBascule ? BRAND.warning : BRAND.sky, fontWeight: 600 }}>
            {proj.anneeBascule
              ? `Première année imposable : an ${proj.anneeBascule}.`
              : `Aucune base imposable sur ${L.length} ans — stock ARD restant : ${euro(dernier.stockArd)}.`}
          </div>

          {/* Avertissement plus-value (seulement si le volet est calculé) */}
          {pv && (
            <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
              <strong>Plus-value immobilière — impôt après abattements pour durée de détention (art. 150 VC)</strong> : IR 19 % + PS 17,2 %, exonération IR à 22 ans / PS à 30 ans. Hypothèses : prix de cession = valeur estimée actuelle (sans revalorisation) ; forfait frais d'acquisition 7,5 % ; forfait travaux 15 % à compter de la 6ᵉ année de détention ({proj.anneeAcquisition ? `détention décomptée depuis ${proj.anneeAcquisition}` : "l'impôt PV s'appuie sur le rang d'année (an 1 = 1ʳᵉ année de détention)"}) ; amortissements déduits réintégrés (LF 2025, art. 150 VB III), y compris mobilier par prudence. Amortissements antérieurs estimés par application du plan actuel depuis l'acquisition, corrigés du stock ARD saisi — ajustez le stock ARD pour coller à la liasse réelle. {proj.alerteSurtaxe && "Surtaxe sur les PV élevées (art. 1609 nonies G) non incluse. "}Résidences de services : réintégration non applicable.
              {censi && <div style={{ marginTop: 6, fontStyle: "italic" }}>Bien en résidence de services probable (Censi-Bouvard) — la réintégration des amortissements ne s'applique pas (exception LF 2025) ; colonne donnée à titre conservateur.</div>}
            </div>
          )}

          <button type="button" onClick={onClose} className="w-full rounded-xl py-2 text-sm font-medium" style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}>Fermer</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
