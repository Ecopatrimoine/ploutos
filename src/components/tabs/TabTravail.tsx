import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList } from "recharts";
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "../../constants";
import type { Child, Property, Placement, PatrimonialData, IrOptions, SuccessionData, Heir, TestamentHeir, LegsPrecisItem, DemembrementContrepartie, OtherLoan, PERRente, Hypothesis, BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket, Beneficiary, DifferenceLine, Loan } from "../../types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets, personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs, getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance, isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts, placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate, placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance, propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName } from "../../lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "../../lib/calculs/credit";
import { Field, MoneyField, MetricCard, HelpTooltip, BracketFillChart, SectionTitle, DifferenceBadge } from "../shared";


// ── TabTravail ─────────────────────────────────────────────────────────────────────
const TabTravail = React.memo(function TabTravail(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, setChargesDetailField, chargesDialogOpen, setChargesDialogOpen, irOptions, setIrOptions, ir, person1, person2 } = props;

  return (
<TabsContent value="travail" className="space-y-4">
  <div className="grid gap-4 md:grid-cols-2">
    {([1, 2] as const).map((which) => {
      const groupe = which === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
      const categorie = which === 1 ? data.person1Csp : data.person2Csp;
      const categories = groupe ? PCS_CATEGORIES[groupe] ?? [] : [];
      return (
        <div key={which} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.cardSoft }}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>{which === 1 ? person1 : person2}</div>

          {/* Intitulé du poste */}
          <Field label="Intitulé du poste">
            <Input
              value={which === 1 ? data.person1JobTitle : data.person2JobTitle}
              onChange={(e) => setField(which === 1 ? "person1JobTitle" : "person2JobTitle", e.target.value)}
              className="rounded-xl"
            />
          </Field>

          {/* Sélecteur 1 — Groupe PCS */}
          <Field label="Groupe socioprofessionnel (PCS)">
            <Select
              value={groupe}
              onValueChange={(v) => {
                setField(which === 1 ? "person1PcsGroupe" : "person2PcsGroupe", v);
                setField(which === 1 ? "person1Csp" : "person2Csp", "");
              }}
            >
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner un groupe…" /></SelectTrigger>
              <SelectContent>
                {PCS_GROUPES.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    <span className="font-medium">{g.code}</span> — {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Sélecteur 2 — Catégorie PCS (affiché seulement si groupe choisi) */}
          {groupe && categories.length > 0 && (
            <Field label="Catégorie socioprofessionnelle">
              <Select
                value={categorie}
                onValueChange={(v) => setField(which === 1 ? "person1Csp" : "person2Csp", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner une catégorie…">
                    {categorie ? (() => { const found = categories.find(c => c.code === categorie); return found ? `${found.code} — ${found.label}` : categorie; })() : "Sélectionner une catégorie…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-medium">{c.code}</span> — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Badge récapitulatif fiscal */}
          {groupe && (
            <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{
              background: isIndependant(groupe) ? "rgba(227,175,100,0.15)" : "rgba(81,106,199,0.1)",
              color: isIndependant(groupe) ? BRAND.gold : BRAND.sky,
              border: `1px solid ${isIndependant(groupe) ? "rgba(227,175,100,0.3)" : "rgba(81,106,199,0.2)"}`,
            }}>
              {isRetraite(groupe) && "🔵 Retraité — revenus de pension"}
              {isSansActivite(groupe) && "⚪ Sans activité professionnelle"}
              {groupe === "1" && "🟡 Indépendant — Bénéfices Agricoles (BA)"}
              {groupe === "2" && !isProfessionLiberale(categorie) && "🟡 Indépendant — BIC (artisan / commerçant)"}
              {isProfessionLiberale(categorie) && "🟡 Indépendant — BNC (profession libérale)"}
              {["3","4","5","6"].includes(groupe) && !isProfessionLiberale(categorie) && isFonctionnaire(categorie) && "🟢 Fonctionnaire — salarié du secteur public (IR identique, retraite spécifique)"}
              {["3","4","5","6"].includes(groupe) && !isProfessionLiberale(categorie) && !isFonctionnaire(categorie) && "🔵 Salarié — revenus traitement & salaires"}
            </div>
          )}
        </div>
      );
    })}
  </div>
</TabsContent>

  );
});

TabTravail.displayName = "TabTravail";
export { TabTravail };
