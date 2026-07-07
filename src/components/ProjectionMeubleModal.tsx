// ─── ProjectionMeubleModal — projete 10 ans d'un bien meuble au reel (Lot 2) ──
//
// Modale patron ChargesModal/AmortissementModal (shadcn Dialog). LECTURE SEULE :
// calcul a l'ouverture via computeProjectionMeuble (fonction pure, hors moteur).
// Aucune persistance, aucun export. Centre sur l'accumulation ARD / deficit.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { BRAND, SURFACE } from "../constants";
import { euro } from "../lib/calculs/utils";
import { computeProjectionMeuble } from "../lib/calculs/projectionMeuble";
import type { Property } from "../types/patrimoine";

type Props = {
  property: Property;
  onClose: () => void;
};

export function ProjectionMeubleModal({ property, onClose }: Props) {
  const proj = computeProjectionMeuble(property, 10);
  const L = proj.lignes;
  const hasDeficits = L.some((l) => l.stockDeficits > 0 || l.deficitsImputes > 0);
  const dernier = L[L.length - 1];
  const chartData = L.map((l) => ({ annee: `An ${l.annee}`, base: Math.round(l.baseImposable), ard: Math.round(l.stockArd) }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl rounded-2xl" style={{ background: SURFACE.card, maxHeight: "90vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.navy }}>Projete 10 ans — {property.name || "bien meuble"} (BIC reel)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Bandeau hypotheses */}
          <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: BRAND.cream, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
            Recettes et charges constantes — amortissement {proj.manuel ? "au montant manuel constant" : "selon le plan par composants"} — interets d'emprunt non degressifs — simulation indicative, hors evolution legislative.
          </div>

          {/* Tableau annee par annee */}
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ color: BRAND.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <th style={{ textAlign: "left", padding: "5px 8px" }}>Annee</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Dotation</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Amort. utilise</th>
                  <th style={{ textAlign: "right", padding: "5px 8px", color: BRAND.sky }}>Stock ARD</th>
                  {hasDeficits && <th style={{ textAlign: "right", padding: "5px 8px" }}>Def. imputes</th>}
                  {hasDeficits && <th style={{ textAlign: "right", padding: "5px 8px" }}>Stock deficits</th>}
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>Base imposable</th>
                  <th style={{ textAlign: "right", padding: "5px 8px" }}>PS estimes</th>
                </tr>
              </thead>
              <tbody>
                {L.map((l) => {
                  const bascule = proj.anneeBascule === l.annee;
                  return (
                    <tr key={l.annee} style={{ borderTop: `1px solid ${SURFACE.border}`, background: bascule ? "rgba(196,151,61,0.12)" : undefined }}>
                      <td style={{ padding: "5px 8px", fontWeight: 600, color: BRAND.navy }}>An {l.annee}{bascule && <span style={{ color: BRAND.goldText, fontSize: 10, marginLeft: 5, fontWeight: 700 }}>bascule</span>}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{euro(l.dotation)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{euro(l.utilise)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: BRAND.sky }}>{euro(l.stockArd)}</td>
                      {hasDeficits && <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.muted }}>{l.deficitsImputes > 0 ? euro(l.deficitsImputes) : "—"}</td>}
                      {hasDeficits && <td style={{ padding: "5px 8px", textAlign: "right", color: BRAND.warning }}>{l.stockDeficits > 0 ? euro(l.stockDeficits) : "—"}</td>}
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: BRAND.navy }}>{euro(l.baseImposable)}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: l.psEstimes > 0 ? BRAND.danger : BRAND.muted }}>{euro(l.psEstimes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mini graphe : barres base + courbe stock ARD */}
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

          {/* Annee de bascule */}
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: proj.anneeBascule ? BRAND.warningBg : "rgba(38,66,139,0.06)", border: `1px solid ${proj.anneeBascule ? BRAND.warningBorder : "rgba(38,66,139,0.2)"}`, color: proj.anneeBascule ? BRAND.warning : BRAND.sky, fontWeight: 600 }}>
            {proj.anneeBascule
              ? `Premiere annee imposable : an ${proj.anneeBascule}.`
              : `Aucune base imposable sur ${L.length} ans — stock ARD restant : ${euro(dernier.stockArd)}.`}
          </div>

          <button type="button" onClick={onClose} className="w-full rounded-xl py-2 text-sm font-medium" style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}>Fermer</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
