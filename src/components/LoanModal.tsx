import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, MoneyField } from "./shared";
import { BRAND, SURFACE, labelPlacement } from "../constants";
import type { PatrimonialData, Loan } from "../types/patrimoine";
import { euro, n, isAV, isPERType } from "../lib/calculs/utils";
import { resolveLoanValuesMulti, resolveOneLoan } from "../lib/calculs/credit";

interface LoanModalProps {
  loanModalPropertyId: string | null;
  setLoanModalPropertyId: (v: string | null) => void;
  data: PatrimonialData;
  addLoan: (propertyId: string) => void;
  updateLoan: (propertyId: string, loanId: string, key: keyof Loan, value: string | boolean) => void;
  removeLoan: (propertyId: string, loanId: string) => void;
  person1: string;
  person2: string;
}

export function LoanModal({ loanModalPropertyId, setLoanModalPropertyId, data, addLoan, updateLoan, removeLoan, person1, person2 }: LoanModalProps) {
  if (loanModalPropertyId === null) return null;
  const prop = data.properties.find((p) => p.id === loanModalPropertyId);
  if (!prop) return null;

  const loans = prop.loans || [];
  const isJoint = prop.ownership === "common" || prop.ownership === "indivision";
  const totalAgg = resolveLoanValuesMulti(prop);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={() => setLoanModalPropertyId(null)}>
      <div className="border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: 14, background: "#fff", borderColor: SURFACE.border }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: SURFACE.border }}>
          <div>
            <div className="font-bold text-base" style={{ color: BRAND.navy }}>
              💳 Crédits — {prop.name || prop.type}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {loans.length} crédit{loans.length !== 1 ? "s" : ""} · Capital total restant : <strong>{euro(totalAgg.capital)}</strong> · Mensualités : <strong>{euro(totalAgg.monthlyPayment)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-8 rounded-xl px-3 text-sm" onClick={() => addLoan(loanModalPropertyId)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Ajouter un crédit
            </Button>
            <button onClick={() => setLoanModalPropertyId(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-1">✕</button>
          </div>
        </div>

        {/* Liste */}
        <div className="p-4 space-y-4">
          {loans.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun crédit. Cliquez sur "Ajouter un crédit" pour commencer.
            </div>
          )}
          {loans.map((loan) => {
            const lv = resolveOneLoan(loan);
            const isInFine = loan.type === "in_fine";
            const isPTZ = loan.type === "ptz" || loan.type === "pel";
            const pledgedIdx = +(loan.pledgedPlacementIndex || "-1");
            return (
              <div key={loan.id} className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
                {/* En-tête crédit */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input value={loan.label} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "label", e.target.value)}
                      className="rounded-xl h-7 text-sm font-semibold w-40 border-0 bg-transparent px-1"
                      style={{ color: BRAND.navy }} placeholder="Nom du crédit" />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(38,66,139,0.1)", color: BRAND.sky }}>
                      {lv.capital > 0 ? euro(lv.capital) + " restant" : "—"}
                    </span>
                    {lv.monthlyPayment > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(16,27,59,0.07)", color: BRAND.navy }}>
                        {euro(lv.monthlyPayment)}/mois
                      </span>
                    )}
                  </div>
                  <Button variant="outline" className="h-7 w-7 rounded-xl p-0" onClick={() => removeLoan(loanModalPropertyId, loan.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Ligne 1 : type + montant + taux + durée + date */}
                <div className="grid gap-2 grid-cols-[1.1fr_1fr_0.7fr_0.7fr_1fr]">
                  <Field label="Type">
                    <Select value={loan.type} onValueChange={(v) => updateLoan(loanModalPropertyId, loan.id, "type", v)}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amortissable">Amortissable</SelectItem>
                        <SelectItem value="in_fine">In fine</SelectItem>
                        <SelectItem value="relais">Relais</SelectItem>
                        <SelectItem value="ptz">PTZ (0%)</SelectItem>
                        <SelectItem value="pel">PEL</SelectItem>
                        <SelectItem value="travaux">Travaux</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <MoneyField label="Montant initial (€)" tooltip="Capital emprunté." value={loan.amount} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "amount", e.target.value)} compact />
                  <Field label="Taux (%)">
                    <Input type="number" step="0.01" placeholder="3.5" disabled={isPTZ} value={loan.rate} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "rate", e.target.value)} className="rounded-xl h-8 text-sm" />
                  </Field>
                  <Field label="Durée (ans)">
                    <Input type="number" min="1" max="30" placeholder="20" value={loan.duration} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "duration", e.target.value)} className="rounded-xl h-8 text-sm" />
                  </Field>
                  <Field label="Date de départ">
                    <DateFr value={loan.startDate} onChange={(iso) => updateLoan(loanModalPropertyId, loan.id, "startDate", iso || "")} className="rounded-xl h-8 text-sm" />
                  </Field>
                </div>
                {/* Ligne 2 : capital restant + intérêts + mensualité */}
                <div className="grid gap-2 grid-cols-3">
                  <MoneyField label="Capital restant dû (€)" tooltip="Auto-calculé si vide. Saisissez pour forcer la valeur." value={loan.capitalRemaining} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "capitalRemaining", e.target.value)} compact />
                  <MoneyField label="Intérêts/an (€)" tooltip="Auto-calculés si vide. Déductibles en régime réel foncier pour les biens locatifs." value={loan.interestAnnual} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "interestAnnual", e.target.value)} compact />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">Mensualité calculée</span>
                    <div className="flex items-center h-8 rounded-xl px-3 text-sm font-medium" style={{ background: "rgba(81,106,199,0.07)", color: BRAND.sky }}>
                      {lv.monthlyPayment > 0 ? euro(lv.monthlyPayment) : "—"}
                    </div>
                  </div>
                </div>
                {isInFine && n(loan.amount) > 0 && (
                  <div className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(81,106,199,0.06)", color: BRAND.sky, border: "1px solid rgba(81,106,199,0.18)" }}>
                    📐 <strong>IFI — Déduction dégressive (art. 974 II)</strong> : {euro(lv.ifiDeduction)} (capital réel : {euro(lv.capital)})
                  </div>
                )}
                {isPTZ && <div className="text-xs rounded-xl px-3 py-1.5" style={{ background: SURFACE.app, color: BRAND.muted }}>ℹ️ PTZ/PEL : taux 0% → pas de déduction IR foncier</div>}
                {/* AV nantie */}
                {isInFine && (
                  <Field label="AV nantie en garantie" tooltip="AV nantie à la banque pour un crédit in fine.">
                    <Select value={loan.pledgedPlacementId || "__none__"} onValueChange={(v) => updateLoan(loanModalPropertyId, loan.id, "pledgedPlacementId", v === "__none__" ? "" : v)}>
                      <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {data.placements.map((p) => (
                          <SelectItem key={p.id} value={p.id!}>
                            {p.name || labelPlacement(p.type)}{isAV(p.type) || isPERType(p.type) ? "" : " ⚠️ non-AV"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {/* Assurance emprunteur */}
                <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: SURFACE.border }}>
                  <div className="flex items-center gap-2">
                    <button role="switch" aria-checked={loan.insurance}
                      onClick={() => updateLoan(loanModalPropertyId, loan.id, "insurance", !loan.insurance)}
                      className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                      style={{ background: loan.insurance ? BRAND.gold : SURFACE.border }}>
                      <span className="inline-block h-3 w-3 rounded-full bg-white shadow transition-transform"
                        style={{ transform: loan.insurance ? "translateX(13px)" : "translateX(2px)" }} />
                    </button>
                    <span className="text-xs font-semibold" style={{ color: BRAND.navy }}>Assurance emprunteur</span>
                  </div>
                  {loan.insurance && (
                    <div className="grid gap-2 grid-cols-[1.2fr_0.9fr_1fr_0.9fr]">
                      <Field label="Garanties">
                        <Select value={loan.insuranceGuarantees || "dc"} onValueChange={(v) => updateLoan(loanModalPropertyId, loan.id, "insuranceGuarantees", v)}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dc">DC</SelectItem>
                            <SelectItem value="dc_ptia">DC + PTIA</SelectItem>
                            <SelectItem value="dc_ptia_itt">DC + PTIA + ITT</SelectItem>
                            <SelectItem value="dc_ptia_itt_ipp">DC + PTIA + ITT + IPP</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      {!isJoint ? (
                        <MoneyField label="Quotité DC (%)" tooltip="% couvert en cas de décès." value={loan.insuranceRate} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "insuranceRate", e.target.value)} compact />
                      ) : (
                        <>
                          <MoneyField label={`DC ${person1} (%)`} value={loan.insuranceRate1} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "insuranceRate1", e.target.value)} compact />
                          <MoneyField label={`DC ${person2} (%)`} value={loan.insuranceRate2} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "insuranceRate2", e.target.value)} compact />
                        </>
                      )}
                      <MoneyField label="Prime annuelle (€)" tooltip="Auto-calculée si vide (estimation 0.3% capital/an). Déductible en régime réel foncier." value={loan.insurancePremium} onChange={(e) => updateLoan(loanModalPropertyId, loan.id, "insurancePremium", e.target.value)} compact />
                      <Field label="Couverture">
                        <Select value={loan.insuranceCoverage || "banque"} onValueChange={(v) => updateLoan(loanModalPropertyId, loan.id, "insuranceCoverage", v)}>
                          <SelectTrigger className="rounded-xl h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="banque">Banque</SelectItem>
                            <SelectItem value="delegation">Délégation</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Récap total */}
          {loans.length > 1 && (
            <div className="rounded-xl border p-3" style={{ borderColor: SURFACE.border, background: "rgba(38,66,139,0.04)" }}>
              <div className="text-xs font-semibold mb-2" style={{ color: BRAND.navy }}>Récapitulatif total</div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                {[
                  { label: "Capital total restant", value: euro(totalAgg.capital) },
                  { label: "Intérêts/an total", value: euro(totalAgg.interestAnnual) },
                  { label: "Mensualités totales", value: euro(totalAgg.monthlyPayment) },
                  { label: "Primes assurance/an", value: euro(totalAgg.insurancePremiumAnnual) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: "white", border: `1px solid ${SURFACE.border}` }}>
                    <div className="text-slate-500 mb-1">{label}</div>
                    <div className="font-bold text-sm" style={{ color: BRAND.navy }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: SURFACE.border }}>
          <Button className="rounded-xl px-5" style={{ background: BRAND.navy }} onClick={() => setLoanModalPropertyId(null)}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
