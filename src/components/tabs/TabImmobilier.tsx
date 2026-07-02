import React from "react";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan, DismemberCounterpart } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { resolvePropertyRef } from "../../lib/calculs/refs";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";


// ── TabImmobilier ─────────────────────────────────────────────────────────────────────
const TabImmobilier = React.memo(function TabImmobilier(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, addProperty, updateProperty, removeProperty, addLoan, updateLoan, removeLoan, loanModalPropertyId, setLoanModalPropertyId, ownerOptions, person1, person2, activeDonations, restoreBaseSnapshot } = props;

  // Indices des biens concernés par une donation active
  const donatedPropertyIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (!activeDonations || activeDonations.length === 0) return ids;
    for (const d of activeDonations as any[]) {
      if (d.assetType !== "property") continue;
      const prop = resolvePropertyRef(data.properties, { id: d.assetId, index: d.assetIndex });
      if (prop?.id) ids.add(prop.id);
    }
    return ids;
  }, [activeDonations, data.properties]);

  return (
<TabsContent value="immobilier" className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <h3 className="font-semibold" style={{ color: BRAND.navy }}>Immobilier</h3>
    <div className="flex items-end gap-2">
      <Select onValueChange={(v) => { if (v) addProperty(v); }}>
        <SelectTrigger className="h-9 rounded-xl min-w-[240px] text-sm"><SelectValue placeholder="Ajouter un bien…" /></SelectTrigger>
        <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>
  {data.properties.length === 0 && <div className="border border-dashed p-6 text-center text-sm text-slate-400" style={{ borderColor: SURFACE.border, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>Aucun bien immobilier saisi. Choisissez une nature dans le menu ci-dessus.</div>}
  {data.properties.map((property, index) => {
    const isDonated = property.id != null && donatedPropertyIds.has(property.id);
    return (
    <Card key={property.id} className="border " style={{ borderColor: isDonated ? "rgba(227,175,100,0.6)" : SURFACE.border, position: "relative", overflow: "hidden" }}>
      {/* Badge donation active */}
      {isDonated && (
        <div style={{
          background: "linear-gradient(120deg, rgba(227,175,100,0.15) 0%, rgba(251,236,215,0.4) 100%)",
          borderBottom: "0.5px solid rgba(227,175,100,0.4)",
          padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>🎁</span>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: BRAND.warning }}>Donation active sur ce bien</span>
              <span style={{ fontSize: "11px", color: BRAND.warning, marginLeft: "8px" }}>— Champs verrouillés</span>
            </div>
          </div>
          <button
            onClick={restoreBaseSnapshot}
            style={{
              fontSize: "11px", fontWeight: 600, color: BRAND.warning,
              background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`,
              borderRadius: "8px", padding: "4px 10px", cursor: "pointer",
            }}>
            Recharger la situation de base →
          </button>
        </div>
      )}
      {/* Overlay semi-transparent hachuré pour bloquer les clics si donation active — textes restent lisibles */}
      {isDonated && (
        <div style={{
          position: "absolute", inset: 0,
          top: "37px",
          zIndex: 10,
          background: "rgba(255,255,255,0.45)",
          backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(200,195,185,0.18) 8px, rgba(200,195,185,0.18) 9px)",
          cursor: "not-allowed",
          borderRadius: "0 0 14px 14px",
        }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        />
      )}
      <CardContent className="p-4 space-y-3">
        {/* Identité + suppression */}
        <div className="flex items-end gap-2">
          <div className="flex-1 grid gap-2 grid-cols-[1.4fr_1.6fr_1fr_1fr]">
            <Field label="Nom"><Input value={property.name} onChange={(e) => updateProperty(property.id, "name", e.target.value)} className="rounded-xl h-8 text-sm" /></Field>
            <Field label="Nature">
              <Select value={property.type} onValueChange={(v) => updateProperty(property.id, "type", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Propriétaire">
              <Select value={property.ownership} onValueChange={(v) => updateProperty(property.id, "ownership", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ownerOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Droit">
              <Select value={property.propertyRight} onValueChange={(v) => updateProperty(property.id, "propertyRight", v)}>
                <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_RIGHTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          {n(property.rentGrossAnnual) > 0 && n(property.value) > 0 && (() => {
            const rdt = Math.round(n(property.rentGrossAnnual) / n(property.value) * 1000) / 10;
            return (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mb-0.5"
                style={{ background: rdt >= 8 ? BRAND.successBg : BRAND.cream,
                         color: rdt >= 8 ? BRAND.success : BRAND.goldText,
                         border: `1px solid ${rdt >= 8 ? BRAND.successBorder : BRAND.warningBorder}` }}>
                {rdt} % brut
              </span>
            );
          })()}
          <Button variant="outline" className="h-8 w-8 shrink-0 rounded-xl p-0 mb-0.5" onClick={() => removeProperty(property.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {/* Valeurs financières — grille adaptative, sans divs vides */}
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
          <MoneyField label={property.propertyRight === "full" ? "Valeur estimée" : "Valeur PP"} tooltip="Valeur vénale actuelle du bien. En pleine propriété, c'est la valeur retenue pour l'IFI et la succession. En démembrement, seule la valeur de la pleine propriété est saisie ici." value={property.value} onChange={(e) => updateProperty(property.id, "value", e.target.value)} compact />
          {property.propertyRight !== "full" && (() => {
            const familyOptions = [
              { key: "person1", label: person1, birthDate: data.person1BirthDate, relation: "conjoint" },
              { key: "person2", label: person2, birthDate: data.person2BirthDate, relation: "conjoint" },
              ...(data.childrenData || []).map((c: any, ci: number) => ({
                key: `child_${ci}`,
                label: `${c.firstName} ${c.lastName}`.trim() || `Enfant ${ci + 1}`,
                birthDate: c.birthDate,
                relation: "enfant",
              })),
              { key: "other", label: "Autre personne", birthDate: "", relation: "tiers" },
            ];
            const isNP = property.propertyRight === "bare";
            const isCommon = property.ownership === "common" || property.ownership === "indivision";

            // Helper : sélecteur contrepartie pour une personne donnée
            const renderContrepartie = (
              personLabel: string,
              currentKey: string,
              currentBirthDate: string,
              ownerBirthDate: string,
              onSelect: (key: string, bd: string, rel: string, name: string) => void,
              onBirthDate: (bd: string) => void,
              rightLabel: string,
              onRight: (v: string) => void,
              currentRight: string,
            ) => {
              const sel = familyOptions.find(f => f.key === currentKey);
              const usufBD = currentRight === "bare"
                ? (sel?.birthDate || currentBirthDate || "")
                : ownerBirthDate;
              const usufAge = usufBD ? getAgeFromBirthDate(usufBD) : null;
              const demer = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
              return (
                <div style={{ flex: 1, minWidth: "220px", borderRadius: "12px", border: "0.5px solid rgba(81,106,199,0.2)", padding: "10px 12px", background: "rgba(81,106,199,0.03)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>{personLabel}</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "0 0 auto", minWidth: "130px" }}>
                      <Field label="Droit">
                        <Select value={currentRight} onValueChange={onRight}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Pleine propriété</SelectItem>
                            <SelectItem value="bare">Nue-propriété</SelectItem>
                            <SelectItem value="usufruct">Usufruit</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {currentRight !== "full" && (
                      <div style={{ flex: 1, minWidth: "160px" }}>
                        <Field label={currentRight === "bare" ? "Usufruitier" : "Nu-propriétaire"}>
                          <Select value={currentKey || ""} onValueChange={(v) => {
                            const found = familyOptions.find(f => f.key === v);
                            onSelect(v, found?.birthDate || "", found?.relation || "tiers", found?.label || "");
                          }}>
                            <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                            <SelectContent>
                              {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}
                    {currentRight !== "full" && currentKey === "other" && (
                      <div style={{ flex: "0 0 auto" }}>
                        <Field label="Date naissance">
                          <DateFr value={currentBirthDate || ""} onChange={(iso) => onBirthDate(iso || "")} className="rounded-xl h-8 text-sm w-36" />
                        </Field>
                      </div>
                    )}
                    {currentRight !== "full" && demer && (
                      <div style={{ fontSize: "11px", color: BRAND.sky, background: "rgba(81,106,199,0.08)", borderRadius: "8px", padding: "4px 8px", whiteSpace: "nowrap", alignSelf: "flex-end", marginBottom: "2px" }}>
                        {usufAge} ans · {currentRight === "bare" ? `NP=${Math.round(demer.nuePropriete*100)}%` : `US=${Math.round(demer.usufruct*100)}%`}
                      </div>
                    )}
                    {currentRight !== "full" && !demer && (
                      <div style={{ fontSize: "11px", color: "#d97706", alignSelf: "flex-end", marginBottom: "4px" }}>⚠️ Âge manquant</div>
                    )}
                  </div>
                </div>
              );
            };

            // Helper pour ajouter/modifier/supprimer une contrepartie dans la liste
            const mkDismember = (pKey: "dismemberP1" | "dismemberP2", current: any, right: string, counterparts: DismemberCounterpart[]) =>
              updateProperty(property.id, pKey, { propertyRight: right, counterparts });

            if (isCommon) {
              const defaultRight = property.propertyRight;
              const dp1 = { propertyRight: property.dismemberP1?.propertyRight || defaultRight, counterparts: property.dismemberP1?.counterparts || [] };
              const dp2 = { propertyRight: property.dismemberP2?.propertyRight || defaultRight, counterparts: property.dismemberP2?.counterparts || [] };

              const renderPersonBlock = (
                pLabel: string, pKey: "dismemberP1" | "dismemberP2",
                dp: { propertyRight: string; counterparts: DismemberCounterpart[] },
                ownerBD: string
              ) => {
                const pRight = dp.propertyRight || "full";
                const safeCounterparts = dp.counterparts || [];
                // Pour le barème : si NP → âge du 1er usufruitier ; si US → âge du owner
                const firstCp = safeCounterparts[0];
                const usufBD = pRight === "bare" ? (firstCp?.birthDate || "") : ownerBD;
                const usufAge = usufBD ? getAgeFromBirthDate(usufBD) : null;
                const demer = usufAge !== null ? getDemembrementPercentages(usufAge) : null;

                return (
                  <div style={{ flex: 1, minWidth: "240px", borderRadius: "12px", border: "0.5px solid rgba(81,106,199,0.2)", padding: "12px", background: "rgba(81,106,199,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.8px" }}>{pLabel}</div>
                      {demer && (
                        <div style={{ fontSize: "11px", color: BRAND.sky, background: "rgba(81,106,199,0.1)", borderRadius: "6px", padding: "2px 8px" }}>
                          {usufAge} ans · US={Math.round(demer.usufruct*100)}% · NP={Math.round(demer.nuePropriete*100)}%
                        </div>
                      )}
                    </div>
                    {/* Droit */}
                    <div style={{ marginBottom: "10px" }}>
                      <Field label="Droit de propriété">
                        <Select value={pRight} onValueChange={(v) => mkDismember(pKey, dp, v, dp.counterparts)}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Pleine propriété</SelectItem>
                            <SelectItem value="bare">Nue-propriété</SelectItem>
                            <SelectItem value="usufruct">Usufruit</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {/* Contreparties */}
                    {pRight !== "full" && (
                      <div className="space-y-2">
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {pRight === "bare" ? "Usufruitier(s)" : "Nu-propriétaire(s)"}
                        </div>
                        {safeCounterparts.map((cp, ci) => (
                          <div key={cp.id} style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                            <div style={{ flex: 2 }}>
                              <Select value={cp.key || ""} onValueChange={(v) => {
                                const found = familyOptions.find(f => f.key === v);
                                const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, key: v, birthDate: found?.birthDate || c.birthDate, relation: found?.relation || "tiers", name: found?.label || c.name } : c);
                                mkDismember(pKey, dp, pRight, updated);
                              }}>
                                <SelectTrigger className="rounded-xl h-7 text-xs"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                                <SelectContent>
                                  {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {cp.key === "other" && (
                              <DateFr value={cp.birthDate} onChange={(iso) => {
                                const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, birthDate: iso || "" } : c);
                                mkDismember(pKey, dp, pRight, updated);
                              }} className="rounded-xl h-7 text-xs w-32" />
                            )}
                            {safeCounterparts.length > 1 && (
                              <input type="number" placeholder="%" min="0" max="100" value={cp.sharePercent}
                                onChange={(e) => {
                                  const updated = dp.counterparts.map((c, i) => i === ci ? { ...c, sharePercent: e.target.value } : c);
                                  mkDismember(pKey, dp, pRight, updated);
                                }}
                                style={{ width: "50px", borderRadius: "8px", padding: "0 6px", height: "28px", fontSize: "12px" }}
                              />
                            )}
                            <button onClick={() => {
                              mkDismember(pKey, dp, pRight, safeCounterparts.filter((_, i) => i !== ci));
                            }} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "14px", paddingBottom: "2px" }}>✕</button>
                          </div>
                        ))}
                        <button onClick={() => {
                          const newCp: DismemberCounterpart = { id: Date.now().toString(), key: "", birthDate: "", relation: "enfant", name: "", sharePercent: "" };
                          mkDismember(pKey, dp, pRight, [...safeCounterparts, newCp]);
                        }} style={{ fontSize: "11px", color: BRAND.sky, background: "none", border: "0.5px dashed rgba(81,106,199,0.4)", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", marginTop: "2px" }}>
                          + {pRight === "bare" ? "Usufruitier" : "Nu-propriétaire"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "11px", color: BRAND.sky, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>Démembrement par personne</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {renderPersonBlock(person1, "dismemberP1", dp1, data.person1BirthDate)}
                    {renderPersonBlock(person2, "dismemberP2", dp2, data.person2BirthDate)}
                  </div>
                </div>
              );
            }

            // Mode simple — bien propre
            const selectedPerson = familyOptions.find(f => f.key === property.counterpartKey);
            const ownerBirthDate = property.ownership === "person2" ? data.person2BirthDate : data.person1BirthDate;
            const usufructBirthDate = isNP ? (selectedPerson?.birthDate || property.counterpartBirthDate || "") : ownerBirthDate;
            const counterpartAge = usufructBirthDate ? getAgeFromBirthDate(usufructBirthDate) : null;
            const demer = counterpartAge !== null ? getDemembrementPercentages(counterpartAge) : null;
            return (
              <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
                <div style={{ minWidth: "200px", flex: "1" }}>
                  <Field label={isNP ? "Usufruitier (contrepartie NP)" : "Nu-propriétaire (contrepartie US)"} tooltip="Personne qui détient l'autre partie du bien.">
                    <Select value={property.counterpartKey || ""} onValueChange={(v) => {
                      const found = familyOptions.find(f => f.key === v);
                      updateProperty(property.id, "counterpartKey", v);
                      updateProperty(property.id, "counterpartBirthDate", found?.birthDate || "");
                      updateProperty(property.id, "counterpartRelation", found?.relation || "tiers");
                      updateProperty(property.id, "counterpartName", found?.label || "");
                    }}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>
                        {familyOptions.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {property.counterpartKey === "other" && (
                  <div style={{ minWidth: "160px", flex: "1" }}>
                    <Field label="Date de naissance">
                      <DateFr value={property.counterpartBirthDate || ""} onChange={(iso) => updateProperty(property.id, "counterpartBirthDate", iso || "")} className="rounded-xl h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {demer && (
                  <div className="text-xs rounded-xl px-3 py-1.5 self-end mb-0.5" style={{ background: "rgba(81,106,199,0.07)", color: BRAND.sky, whiteSpace: "nowrap" }}>
                    {isNP ? "Usufruitier" : "Vous"} · {counterpartAge} ans · {isNP ? `NP = ${Math.round(demer.nuePropriete * 100)}%` : `US = ${Math.round(demer.usufruct * 100)}%`}
                  </div>
                )}
                {!demer && (
                  <div className="text-xs text-amber-600 self-end mb-1">
                    {isNP && !property.counterpartKey ? "⚠️ Sélectionnez l'usufruitier" : "⚠️ Date de naissance manquante"}
                  </div>
                )}
              </div>
            );
          })()}
          {propertyNeedsPropertyTax(property.type) && <MoneyField label="Taxe foncière/an" tooltip="Montant annuel de la taxe foncière. Déductible des revenus fonciers en régime réel." value={property.propertyTaxAnnual} onChange={(e) => updateProperty(property.id, "propertyTaxAnnual", e.target.value)} compact />}
          {propertyNeedsRent(property.type) && <MoneyField label="Loyer brut/an" tooltip="Total des loyers encaissés sur l'année, avant déduction des charges. Utilisé pour calculer le revenu foncier net imposable." value={property.rentGrossAnnual} onChange={(e) => updateProperty(property.id, "rentGrossAnnual", e.target.value)} compact />}
          {propertyNeedsInsurance(property.type) && <MoneyField label="Assurance/an" tooltip="Prime d'assurance habitation annuelle du bien locatif. Déductible des revenus fonciers en régime réel." value={property.insuranceAnnual} onChange={(e) => updateProperty(property.id, "insuranceAnnual", e.target.value)} compact />}
          {propertyNeedsWorks(property.type) && <MoneyField label="Travaux/an" tooltip="Dépenses de travaux d'entretien et de réparation annuelles. Déductibles des revenus fonciers en régime réel. Les travaux de construction ou d'agrandissement ne sont pas déductibles." value={property.worksAnnual} onChange={(e) => updateProperty(property.id, "worksAnnual", e.target.value)} compact />}
          {propertyNeedsRent(property.type) && <MoneyField label="Autres charges/an" tooltip="Autres charges déductibles : frais de gestion locative, charges de copropriété non récupérables, frais comptables, etc." value={property.otherChargesAnnual} onChange={(e) => updateProperty(property.id, "otherChargesAnnual", e.target.value)} compact />}
          {/* ── Bloc crédit ── */}
          </div>
          {/* ── Multi-crédits : bouton ouvre modale ── */}
          {(() => {
            const loanCount = (property.loans || []).length || (property.loanEnabled ? 1 : 0);
            const totalCapital = property.loans && property.loans.length > 0
              ? resolveLoanValuesMulti(property).capital
              : (property.loanEnabled ? n(property.loanCapitalRemaining) || resolveLoanValuesMulti(property).capital : 0);
            return (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    setLoanModalPropertyId(property.id);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium border transition-colors hover:opacity-90"
                  style={{
                    background: loanCount > 0 ? "rgba(38,66,139,0.08)" : "rgba(229,231,235,0.5)",
                    borderColor: loanCount > 0 ? "rgba(38,66,139,0.25)" : SURFACE.border,
                    color: loanCount > 0 ? BRAND.sky : BRAND.muted,
                  }}>
                  <span>{loanCount > 0 ? `💳 ${loanCount} crédit${loanCount > 1 ? "s" : ""}` : "💳 Ajouter un crédit"}</span>
                  {totalCapital > 0 && <span className="text-xs opacity-70">— {euro(totalCapital)} restant</span>}
                </button>
              </div>
            );
          })()}
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(145px,1fr))]">
          {property.ownership === "indivision" && (
            <>
              <MoneyField label={`% ${person1}`} tooltip={`Quote-part de propriété de ${person1} dans l'indivision. La somme des deux parts (foyer + co-indivisaires extérieurs s'il y en a) doit égaler 100%.`} value={property.indivisionShare1} onChange={(e) => updateProperty(property.id, "indivisionShare1", e.target.value)} compact />
              <MoneyField label={`% ${person2}`} tooltip={`Quote-part de propriété de ${person2} dans l'indivision. La somme des deux parts (foyer + co-indivisaires extérieurs s'il y en a) doit égaler 100%.`} value={property.indivisionShare2} onChange={(e) => updateProperty(property.id, "indivisionShare2", e.target.value)} compact />
            </>
          )}
        </div>

        {/* ─── Co-propriétaires / co-associés extérieurs au foyer ────────
             Pertinent pour : indivision (partagée avec tiers) ou SCI
             familiale étendue / SCI avec amis / SCI avec associés. */}
        {(property.ownership === "indivision" || property.type === "SCI IR" || property.type === "SCI IS") && (() => {
          const externals = property.externalShares || [];
          const s1 = n(property.indivisionShare1);
          const s2 = n(property.indivisionShare2);
          const sExt = externals.reduce((sum, e) => sum + n(e.sharePercent), 0);
          const totalSomme = s1 + s2 + sExt;
          const ecartSomme = 100 - totalSomme;
          const addExternal = () => {
            const next = [...externals, { id: `ext-${Date.now()}`, name: "", relation: "Associé", sharePercent: "0" }];
            updateProperty(property.id, "externalShares", next);
          };
          const updateExternal = (extIdx: number, field: "name" | "relation" | "sharePercent", value: string) => {
            const next = externals.map((e, i) => i === extIdx ? { ...e, [field]: value } : e);
            updateProperty(property.id, "externalShares", next);
          };
          const removeExternal = (extIdx: number) => {
            const next = externals.filter((_, i) => i !== extIdx);
            updateProperty(property.id, "externalShares", next);
          };
          return (
            <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(81,106,199,0.04)", border: `1px solid rgba(81,106,199,0.15)` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.sky }}>
                  Co-propriétaires extérieurs au foyer
                </div>
                <Button onClick={addExternal} variant="outline" className="h-7 rounded-lg px-2 text-xs">
                  <Plus className="mr-1 h-3 w-3" />Ajouter
                </Button>
              </div>
              {externals.length === 0 ? (
                <div className="text-xs italic" style={{ color: BRAND.mutedLight }}>
                  Ajoutez des co-indivisaires ou co-associés de SCI extérieurs à votre foyer (frère, ami, partenaire d'affaires…). Leurs parts sont déclarées par eux, pas par votre foyer.
                </div>
              ) : (
                <div className="space-y-2">
                  {externals.map((ext, extIdx) => (
                    <div key={ext.id} className="grid gap-2 items-end" style={{ gridTemplateColumns: "2fr 1.4fr 80px 32px" }}>
                      <Field label={extIdx === 0 ? "Nom complet" : undefined}>
                        <Input value={ext.name} onChange={(e) => updateExternal(extIdx, "name", e.target.value)} placeholder="ex: Jean Martin" className="h-8 text-sm rounded-lg" />
                      </Field>
                      <Field label={extIdx === 0 ? "Relation" : undefined}>
                        <Select value={ext.relation} onValueChange={(v) => updateExternal(extIdx, "relation", v)}>
                          <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Associé">Associé / Partenaire d'affaires</SelectItem>
                            <SelectItem value="Frère/Sœur">Frère / Sœur</SelectItem>
                            <SelectItem value="Parent">Parent (père / mère)</SelectItem>
                            <SelectItem value="Cousin">Cousin / Cousine</SelectItem>
                            <SelectItem value="Oncle/Tante">Oncle / Tante</SelectItem>
                            <SelectItem value="Neveu/Nièce">Neveu / Nièce</SelectItem>
                            <SelectItem value="Ami">Ami</SelectItem>
                            <SelectItem value="Ex-conjoint">Ex-conjoint</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={extIdx === 0 ? "% parts" : undefined}>
                        <Input type="number" value={ext.sharePercent} onChange={(e) => updateExternal(extIdx, "sharePercent", e.target.value)} placeholder="0" className="h-8 text-sm rounded-lg text-right" />
                      </Field>
                      <Button onClick={() => removeExternal(extIdx)} variant="outline" className="h-8 w-8 rounded-lg p-0" title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" style={{ color: BRAND.danger }} />
                      </Button>
                    </div>
                  ))}
                  {/* Synthèse somme */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t" style={{ borderColor: "rgba(81,106,199,0.15)" }}>
                    <span className="text-xs" style={{ color: BRAND.muted }}>
                      Somme : <strong style={{ color: BRAND.navy }}>{(s1 + s2).toFixed(0)} % foyer + {sExt.toFixed(0)} % extérieurs = {totalSomme.toFixed(0)} %</strong>
                    </span>
                    {Math.abs(ecartSomme) > 0.5 && (
                      <span className="text-xs font-bold" style={{ color: ecartSomme > 0 ? BRAND.warning : BRAND.danger }}>
                        {ecartSomme > 0 ? `⚠ Manque ${ecartSomme.toFixed(0)} %` : `⚠ Dépasse de ${(-ecartSomme).toFixed(0)} %`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
    );
  })}
</TabsContent>

  );
});

TabImmobilier.displayName = "TabImmobilier";
export { TabImmobilier };
