import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import { BRAND, SURFACE } from "../../constants";
import type { DonationItem, DonationHeir, Hypothesis, DifferenceLine } from "../../types/patrimoine";
import { n, euro, deepClone, getDemembrementPercentages } from "../../lib/calculs/utils";
import { Field, DifferenceBadge } from "../shared";
import { computeIR } from "../../lib/calculs/ir";
import { computeIFI } from "../../lib/calculs/ifi";
import { computeSuccession } from "../../lib/calculs/succession";
import { buildHypothesisDifferenceLines } from "../../lib/hypotheses";
import { computeDonation, computeNotaryFees } from "../../lib/calculs/donation";

const DONATION_RELATIONS = [
  { value: "enfant",        label: "Enfant (abatt. 100 000 €)" },
  { value: "parent",        label: "Parent (abatt. 100 000 €)" },
  { value: "petit-enfant",  label: "Petit-enfant (abatt. 1 594 €)" },
  { value: "frereSoeur",    label: "Frère / Sœur (abatt. 15 932 €)" },
  { value: "neveuNiece",    label: "Neveu / Nièce (abatt. 7 967 €)" },
  { value: "conjoint",      label: "Conjoint / Partenaire (abatt. 80 724 €)" },
  { value: "tiers",         label: "Tiers (abatt. 1 594 €)" },
];

// ── TabHypotheses ─────────────────────────────────────────────────────────────
const TabHypotheses = React.memo(function TabHypotheses(props: any) {
  const {
    data, irOptions, successionData, hypotheses, baseSnapshot,
    ir, ifi, succession, baseReference,
    renameHypothesis, updateHypothesisNotes, updateHypothesisObjective,
    saveBaseSnapshot, restoreBaseSnapshot,
    saveHypothesis, loadHypothesis, clearHypothesis,
    addDonation, removeDonation,
    person1, person2,
  } = props;

  const [donationModal, setDonationModal] = React.useState<{ hypoId: number; donation: DonationItem | null } | null>(null);

  const hypothesisResults = React.useMemo(() =>
    hypotheses.map((hypothesis: Hypothesis) => {
      if (!hypothesis.data || !hypothesis.irOptions || !hypothesis.successionData) {
        return { hypothesis, ir: null, ifi: null, succession: null, differences: [] as DifferenceLine[] };
      }
      return {
        hypothesis,
        ir: computeIR(hypothesis.data, hypothesis.irOptions),
        ifi: computeIFI(hypothesis.data),
        succession: computeSuccession(hypothesis.successionData, hypothesis.data),
        differences: buildHypothesisDifferenceLines(baseSnapshot.data, baseSnapshot.irOptions, hypothesis.data, hypothesis.irOptions),
      };
    }),
    [hypotheses, baseSnapshot]
  );

  return (
    <TabsContent value="hypotheses">
      <div className="space-y-4">

        {/* Base de référence */}
        <Card className="rounded-2xl border-0 shadow-md" style={{ background: SURFACE.cardSoft }}>
          <CardContent className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Base de référence</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {baseSnapshot.savedAt ? `Figée le ${new Date(baseSnapshot.savedAt).toLocaleString("fr-FR")}` : "Aucune base figée"}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  {[
                    { label: "IR", value: baseReference.ir.finalIR },
                    { label: "IFI", value: baseReference.ifi.ifi },
                    { label: "Succession", value: baseReference.succession.totalRights },
                    { label: "Actif successoral", value: baseReference.succession.activeNet },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border, background: "white" }}>
                      <span className="text-slate-500">{label} : </span>
                      <strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="h-8 rounded-xl px-3 text-sm" style={{ background: BRAND.navy }} onClick={saveBaseSnapshot}>
                  Figer la base actuelle
                </Button>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={restoreBaseSnapshot} disabled={!baseSnapshot.data}>
                  Recharger
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Situation courante */}
        <div className="rounded-2xl border px-5 py-3" style={{ borderColor: SURFACE.border, background: "white" }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Situation courante</div>
            {[
              { label: "IR", value: ir.finalIR, base: baseReference.ir.finalIR },
              { label: "IFI", value: ifi.ifi, base: baseReference.ifi.ifi },
              { label: "Succession", value: succession.totalRights, base: baseReference.succession.totalRights },
              { label: "Actif successoral", value: succession.activeNet, base: baseReference.succession.activeNet },
            ].map(({ label, value, base }) => {
              const diff = value - base;
              return (
                <div key={label} className="flex items-baseline gap-2 rounded-xl border px-3 py-1.5 text-xs" style={{ borderColor: SURFACE.border }}>
                  <span className="text-slate-500">{label} : </span>
                  <strong style={{ color: BRAND.navy }}>{euro(value)}</strong>
                  {baseSnapshot.data && (
                    <span className={`text-xs font-medium ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                      {diff >= 0 ? "+" : ""}{euro(diff)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3 cartes hypothèses */}
        <div className="grid gap-4 md:grid-cols-3">
          {hypothesisResults.map((item: any) => (
            <Card key={item.hypothesis.id} className="rounded-2xl border shadow-none" style={{ borderColor: SURFACE.border }}>
              <CardContent className="p-4 space-y-3">

                {/* Nom + boutons */}
                <div className="flex items-center gap-2">
                  <Input
                    value={item.hypothesis.name}
                    onChange={(e) => renameHypothesis(item.hypothesis.id, e.target.value)}
                    className="h-8 flex-1 rounded-xl text-sm font-semibold"
                    style={{ color: BRAND.navy }}
                  />
                  <Button className="h-8 w-8 rounded-xl p-0" style={{ background: BRAND.navy }}
                    onClick={() => saveHypothesis(item.hypothesis.id)} title="Enregistrer">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0"
                    onClick={() => loadHypothesis(item.hypothesis.id)} disabled={!item.hypothesis.data} title="Charger">
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" className="h-8 w-8 rounded-xl p-0"
                    onClick={() => clearHypothesis(item.hypothesis.id)} title="Effacer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Field label="Hypothèse">
                  <Textarea value={item.hypothesis.notes}
                    onChange={(e) => updateHypothesisNotes(item.hypothesis.id, e.target.value)}
                    className="rounded-xl min-h-[64px] text-sm" />
                </Field>
                <Field label="Objectifs">
                  <Textarea value={item.hypothesis.objective || ""}
                    onChange={(e) => updateHypothesisObjective(item.hypothesis.id, e.target.value)}
                    className="rounded-xl min-h-[64px] text-sm" />
                </Field>

                <div className="text-xs text-slate-400">
                  {item.hypothesis.savedAt
                    ? `Capturée : ${new Date(item.hypothesis.savedAt).toLocaleString("fr-FR")}`
                    : "Aucune capture."}
                </div>

                {item.ir && item.ifi && item.succession ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "IR", value: item.ir.finalIR, base: baseReference.ir.finalIR },
                        { label: "IFI", value: item.ifi.ifi, base: baseReference.ifi.ifi },
                        { label: "Succession", value: item.succession.totalRights, base: baseReference.succession.totalRights },
                        { label: "Actif succ.", value: item.succession.activeNet, base: baseReference.succession.activeNet },
                      ].map(({ label, value, base }) => {
                        const diff = value - base;
                        return (
                          <div key={label} className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: SURFACE.border }}>
                            <div className="text-slate-500">{label}</div>
                            <div className="font-semibold" style={{ color: BRAND.navy }}>{euro(value)}</div>
                            <div className={`text-xs ${Math.abs(diff) < 1 ? "text-slate-400" : diff < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {diff >= 0 ? "+" : ""}{euro(diff)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {item.differences.length > 0 && (
                      <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Modifications vs base</div>
                        {item.differences.map((diff: DifferenceLine, i: number) => (
                          <div key={diff.label + i} className="flex items-start justify-between gap-2 text-xs">
                            <div className="flex-1">
                              <div className="font-medium text-slate-700">{diff.label}</div>
                              <div className="text-slate-400">{diff.baseValue} → <strong>{diff.hypothesisValue}</strong></div>
                            </div>
                            <DifferenceBadge impact={diff.impact} />
                          </div>
                        ))}
                      </div>
                    )}
                    {item.differences.length === 0 && baseSnapshot.data && (
                      <div className="text-xs text-slate-400">Aucune différence détectée vs la base.</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-3 py-4 text-xs text-center text-slate-400" style={{ borderColor: SURFACE.border }}>
                    Enregistre la situation courante pour comparer.
                  </div>
                )}

                {/* ── Simulations donation ── */}
                <div className="border-t pt-3 space-y-2" style={{ borderColor: SURFACE.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
                      Simulations donation
                    </span>
                    <Button
                      variant="outline"
                      className="h-7 rounded-lg px-2 text-xs gap-1"
                      style={{ color: BRAND.navy, borderColor: BRAND.gold }}
                      onClick={() => {
                        const newDon: DonationItem = {
                          id: Date.now().toString(),
                          assetType: "property", assetIndex: 0,
                          freeLabel: "", freeValue: "",
                          donationType: "full", sharePercent: "100",
                          donorAge: "", donationDate: new Date().toISOString().slice(0, 10),
                          heirs: [{
                            id: Date.now().toString(),
                            name: "", relation: "enfant",
                            sharePercent: "100", priorDonations: "0",
                          }],
                        };
                        setDonationModal({ hypoId: item.hypothesis.id, donation: newDon });
                      }}
                    >
                      <Plus className="h-3 w-3" /> Donation
                    </Button>
                  </div>

                  {(item.hypothesis.donations || []).map((don: DonationItem) => {
                    const donData = item.hypothesis.data || data;
                    let result = null;
                    try { result = donData ? computeDonation(don, donData) : null; } catch { result = null; }
                    if (!result) return null;
                    return (
                      <div key={don.id} className="rounded-xl border p-3 space-y-2 text-xs"
                        style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold" style={{ color: BRAND.navy }}>
                            {don.donationType === "dismembered" ? "NP " : "PP "}
                            {result.assetLabel}
                            {n(don.sharePercent) < 100 ? ` (${don.sharePercent}%)` : ""}
                          </div>
                          <div className="flex gap-1">
                            <button className="text-slate-400 hover:text-sky-600 px-1"
                              onClick={() => setDonationModal({ hypoId: item.hypothesis.id, donation: { ...don } })}>
                              ✎
                            </button>
                            <button className="text-slate-400 hover:text-red-500 px-1"
                              onClick={() => removeDonation?.(item.hypothesis.id, don.id)}>
                              ✕
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const notary = don.assetType === "property" ? computeNotaryFees(result.donatedValue) : null;
                          return (
                            <>
                              <div className="grid grid-cols-2 gap-1">
                                <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: SURFACE.border }}>
                                  <div className="text-slate-400">Valeur transmise</div>
                                  <div className="font-semibold" style={{ color: BRAND.navy }}>{euro(result.donatedValue)}</div>
                                </div>
                                <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: SURFACE.border }}>
                                  <div className="text-slate-400">Droits donation</div>
                                  <div className="font-semibold text-amber-600">{euro(result.totalDonationTax)}</div>
                                </div>
                              </div>
                              {notary && (
                                <div className="rounded-lg px-2 py-2" style={{ background: "rgba(81,106,199,0.04)", border: "0.5px solid rgba(81,106,199,0.2)" }}>
                                  <div style={{ fontSize: "10px", fontWeight: 600, color: "#516AC7", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Frais de notaire</div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 8px" }}>
                                    {[
                                      ["Émoluments TTC", euro(notary.emolumentsTTC)],
                                      ["Sécurité immobilière", euro(notary.securiteImmobiliere)],
                                      ["Débours (forfait)", euro(notary.debours)],
                                    ].map(([label, val], i) => (
                                      <React.Fragment key={i}>
                                        <span style={{ fontSize: "11px", color: "#64748b" }}>{label}</span>
                                        <span style={{ fontSize: "11px", color: "#101B3B", textAlign: "right" }}>{val}</span>
                                      </React.Fragment>
                                    ))}
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#516AC7", borderTop: "0.5px solid rgba(81,106,199,0.2)", paddingTop: "4px", marginTop: "2px" }}>Total</span>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#516AC7", borderTop: "0.5px solid rgba(81,106,199,0.2)", paddingTop: "4px", marginTop: "2px", textAlign: "right" }}>{euro(notary.total)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        <div className="grid grid-cols-2 gap-1">
                          <div className="rounded-lg p-2 text-center"
                            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                            <div className="font-semibold text-red-600 text-xs mb-0.5">Décès &lt; 15 ans</div>
                            <div className="text-slate-500 text-xs">Rappel fiscal</div>
                            <div className="font-bold text-xs mt-1" style={{ color: BRAND.navy }}>
                              {euro(result.before15.totalCost)}
                            </div>
                            {result.before15.additionalSuccessionTax > 0 && (
                              <div className="text-xs text-red-500">
                                +{euro(result.before15.additionalSuccessionTax)} succ.
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg p-2 text-center"
                            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <div className="font-semibold text-emerald-600 text-xs mb-0.5">Décès &gt; 15 ans</div>
                            <div className="text-slate-500 text-xs">Aucun rappel</div>
                            <div className="font-bold text-xs mt-1" style={{ color: BRAND.navy }}>
                              {euro(result.after15.totalCost)}
                            </div>
                            <div className="text-xs text-emerald-500">Abattements rechargés</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Modal Donation ── */}
        {donationModal && (
          <DonationModal
            donation={donationModal.donation}
            data={data}
            colorNavy={BRAND.navy}
            colorGold={BRAND.gold}
            colorSky={BRAND.sky}
            onSave={(don) => {
              addDonation?.(donationModal.hypoId, don);
              setDonationModal(null);
            }}
            onUpdate={(don) => {
              // update via remove + add
              removeDonation?.(donationModal.hypoId, don.id);
              addDonation?.(donationModal.hypoId, don);
              setDonationModal(null);
            }}
            onClose={() => setDonationModal(null)}
          />
        )}

      </div>
    </TabsContent>
  );
});

TabHypotheses.displayName = "TabHypotheses";
export { TabHypotheses };

// ─── Modal Donation ───────────────────────────────────────────────────────────
interface DonationModalProps {
  donation: DonationItem | null;
  data: any;
  colorNavy: string;
  colorGold: string;
  colorSky: string;
  onSave: (don: DonationItem) => void;
  onUpdate: (don: DonationItem) => void;
  onClose: () => void;
}

function DonationModal({ donation, data, colorNavy, colorGold, colorSky, onSave, onUpdate, onClose }: DonationModalProps) {
  const isEdit = !!(donation?.id && (data?.properties?.length || data?.placements?.length || donation?.assetType === "free"));

  const [don, setDon] = React.useState<DonationItem>(
    donation || {
      id: Date.now().toString(),
      assetType: "property", assetIndex: 0,
      freeLabel: "", freeValue: "",
      donationType: "full", sharePercent: "100",
      donorAge: "", donationDate: new Date().toISOString().slice(0, 10),
      heirs: [{
        id: Date.now().toString(),
        name: "", relation: "enfant",
        sharePercent: "100", priorDonations: "0",
      }],
    }
  );

  const preview = React.useMemo(() => {
    try { return computeDonation(don, data); } catch { return null; }
  }, [don, data]);

  const update = (patch: Partial<DonationItem>) => setDon(d => ({ ...d, ...patch }));

  const updateHeir = (hid: string, patch: Partial<DonationHeir>) =>
    setDon(d => ({ ...d, heirs: d.heirs.map(h => h.id === hid ? { ...h, ...patch } : h) }));

  const addHeir = () =>
    setDon(d => ({
      ...d, heirs: [...d.heirs, {
        id: Date.now().toString(),
        name: "", relation: "enfant", sharePercent: "0", priorDonations: "0",
      }],
    }));

  const removeHeir = (hid: string) =>
    setDon(d => ({ ...d, heirs: d.heirs.filter(h => h.id !== hid) }));

  const propertyOptions = (data?.properties || []).map((p: any, i: number) => ({
    value: i, label: p.name || p.type || ("Bien " + (i + 1)),
  }));
  const placementOptions = (data?.placements || []).map((p: any, i: number) => ({
    value: i, label: p.name || p.type || ("Placement " + (i + 1)),
  }));

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "10px",
    border: "1px solid rgba(227,175,100,0.4)", fontSize: "13px",
    background: "#fff", boxSizing: "border-box",
  };
  const sel: React.CSSProperties = { ...inp };
  const lbl: React.CSSProperties = {
    fontSize: "11px", fontWeight: 700, color: colorSky,
    textTransform: "uppercase", letterSpacing: "1px",
    display: "block", marginBottom: "6px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "640px",
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(16,27,59,0.25)", fontFamily: "'Lato', sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          background: `linear-gradient(135deg, ${colorNavy} 0%, #26428B 100%)`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>
            🎁 Simulation de donation
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px",
            color: "#fff", width: "30px", height: "30px", cursor: "pointer", fontSize: "18px",
          }}>×</button>
        </div>

        {/* Corps */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Bien */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={lbl}>Type de bien</label>
              <select value={don.assetType} onChange={e => update({ assetType: e.target.value as any, assetIndex: 0 })} style={sel}>
                <option value="property">Bien immobilier</option>
                <option value="placement">Placement / AV</option>
                <option value="free">Montant libre</option>
              </select>
            </div>
            <div>
              {don.assetType === "property" && propertyOptions.length > 0 && (
                <>
                  <label style={lbl}>Bien</label>
                  <select value={don.assetIndex} onChange={e => update({ assetIndex: +e.target.value })} style={sel}>
                    {propertyOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </>
              )}
              {don.assetType === "placement" && placementOptions.length > 0 && (
                <>
                  <label style={lbl}>Placement</label>
                  <select value={don.assetIndex} onChange={e => update({ assetIndex: +e.target.value })} style={sel}>
                    {placementOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </>
              )}
              {don.assetType === "free" && (
                <>
                  <label style={lbl}>Valeur (€)</label>
                  <input type="number" value={don.freeValue}
                    onChange={e => update({ freeValue: e.target.value })}
                    placeholder="0" style={inp} />
                </>
              )}
            </div>
          </div>

          {/* Paramètres */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={lbl}>Type de donation</label>
              <select value={don.donationType} onChange={e => update({ donationType: e.target.value as any })} style={sel}>
                <option value="full">Pleine propriété</option>
                <option value="dismembered">Nue-propriété (démembrement)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Quote-part (%)</label>
              <input type="number" min="1" max="100" value={don.sharePercent}
                onChange={e => update({ sharePercent: e.target.value })} style={inp} />
            </div>
            {don.donationType === "dismembered" && (
              <div>
                <label style={lbl}>Âge donateur</label>
                <input type="number" min="18" max="99" value={don.donorAge}
                  onChange={e => update({ donorAge: e.target.value })}
                  placeholder="ex: 60" style={inp} />
                {n(don.donorAge) > 0 && (
                  <div style={{ fontSize: "11px", color: colorSky, marginTop: "4px" }}>
                    NP = {Math.round(getDemembrementPercentages(n(don.donorAge)).nuePropriete)}%
                    {" "}· US = {Math.round(getDemembrementPercentages(n(don.donorAge)).usufruct)}%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Donataires */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Donataires</label>
              <button onClick={addHeir} style={{
                fontSize: "12px", padding: "4px 10px", borderRadius: "8px",
                border: `1px solid ${colorGold}`, background: "transparent",
                cursor: "pointer", color: colorNavy, fontWeight: 600,
              }}>+ Donataire</button>
            </div>
            {don.heirs.map((heir) => (
              <div key={heir.id} style={{
                display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr auto",
                gap: "8px", marginBottom: "8px", alignItems: "end",
              }}>
                <div>
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "3px" }}>Nom</div>
                  <input value={heir.name} onChange={e => updateHeir(heir.id, { name: e.target.value })}
                    placeholder="Prénom Nom" style={{ ...inp, padding: "7px 10px", fontSize: "12px" }} />
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "3px" }}>Lien</div>
                  <select value={heir.relation} onChange={e => updateHeir(heir.id, { relation: e.target.value })}
                    style={{ ...sel, padding: "7px 10px", fontSize: "12px" }}>
                    {DONATION_RELATIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "3px" }}>Part (%)</div>
                  <input type="number" min="0" max="100" value={heir.sharePercent}
                    onChange={e => updateHeir(heir.id, { sharePercent: e.target.value })}
                    style={{ ...inp, padding: "7px 10px", fontSize: "12px" }} />
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#888", marginBottom: "3px" }}>Dons antérieurs (€)</div>
                  <input type="number" min="0" value={heir.priorDonations}
                    onChange={e => updateHeir(heir.id, { priorDonations: e.target.value })}
                    style={{ ...inp, padding: "7px 10px", fontSize: "12px" }} />
                </div>
                <button onClick={() => removeHeir(heir.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#aaa", fontSize: "16px", paddingBottom: "6px",
                }}>✕</button>
              </div>
            ))}
          </div>

          {/* Prévisualisation */}
          {preview && (
            <div style={{
              borderRadius: "14px", border: "1px solid rgba(227,175,100,0.3)",
              background: "rgba(251,236,215,0.3)", padding: "14px 16px",
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: colorSky, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                Résultat de la simulation
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div style={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.08)", padding: "10px", background: "#fff" }}>
                  <div style={{ fontSize: "10px", color: "#888" }}>Valeur transmise</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: colorNavy }}>{euro(preview.donatedValue)}</div>
                  {preview.donationType === "dismembered" && (
                    <div style={{ fontSize: "10px", color: colorSky }}>
                      NP {Math.round(preview.npPercent * 100)}%
                    </div>
                  )}
                </div>
                <div style={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.08)", padding: "10px", background: "#fff" }}>
                  <div style={{ fontSize: "10px", color: "#888" }}>Droits de donation</div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#d97706" }}>{euro(preview.totalDonationTax)}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{
                  borderRadius: "10px", border: "1px solid rgba(239,68,68,0.25)",
                  padding: "10px", background: "rgba(239,68,68,0.04)", textAlign: "center",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "11px", color: "#dc2626", marginBottom: "4px" }}>
                    Décès &lt; 15 ans
                  </div>
                  <div style={{ fontSize: "10px", color: "#888" }}>Coût total (donation + rappel)</div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: colorNavy, marginTop: "3px" }}>
                    {euro(preview.before15.totalCost)}
                  </div>
                  {preview.before15.additionalSuccessionTax > 0 && (
                    <div style={{ fontSize: "10px", color: "#dc2626" }}>
                      dont {euro(preview.before15.additionalSuccessionTax)} rappel succ.
                    </div>
                  )}
                </div>
                <div style={{
                  borderRadius: "10px", border: "1px solid rgba(16,185,129,0.25)",
                  padding: "10px", background: "rgba(16,185,129,0.04)", textAlign: "center",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "11px", color: "#059669", marginBottom: "4px" }}>
                    Décès &gt; 15 ans
                  </div>
                  <div style={{ fontSize: "10px", color: "#888" }}>Coût total (donation seule)</div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: colorNavy, marginTop: "3px" }}>
                    {euro(preview.after15.totalCost)}
                  </div>
                  <div style={{ fontSize: "10px", color: "#059669" }}>Abattements rechargés</div>
                </div>
              </div>
              {/* Frais de notaire — immobilier uniquement */}
              {donation.assetType === "property" && (() => {
                const notary = computeNotaryFees(preview.donatedValue);
                return (
                  <div style={{ marginTop: "10px", borderRadius: "10px", border: "0.5px solid rgba(81,106,199,0.25)", background: "rgba(81,106,199,0.04)", padding: "10px 12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#516AC7", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Frais de notaire estimés</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 12px" }}>
                      {[
                        ["Émoluments TTC", euro(notary.emolumentsTTC), false],
                        ["Sécurité immobilière (0,10%)", euro(notary.securiteImmobiliere), false],
                        ["Débours (forfait)", euro(notary.debours), false],
                        ["Total frais de notaire", euro(notary.total), true],
                      ].map(([label, val, bold]: any, i) => (
                        <React.Fragment key={i}>
                          <span style={{ fontSize: "11px", color: bold ? "#516AC7" : "#64748b", fontWeight: bold ? 700 : 400, borderTop: bold ? "0.5px solid rgba(81,106,199,0.2)" : "none", paddingTop: bold ? "4px" : "0" }}>{label}</span>
                          <span style={{ fontSize: "11px", color: bold ? "#516AC7" : "#101B3B", fontWeight: bold ? 700 : 400, textAlign: "right", borderTop: bold ? "0.5px solid rgba(81,106,199,0.2)" : "none", paddingTop: bold ? "4px" : "0" }}>{val}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex", justifyContent: "flex-end", gap: "10px", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
            fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#6b7280",
          }}>Annuler</button>
          <button onClick={() => isEdit ? onUpdate(don) : onSave(don)} style={{
            padding: "10px 24px", borderRadius: "12px", border: "none",
            background: `linear-gradient(135deg, ${colorNavy} 0%, #26428B 100%)`,
            color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(16,27,59,0.25)",
          }}>
            Enregistrer →
          </button>
        </div>

      </div>
    </div>
  );
}
