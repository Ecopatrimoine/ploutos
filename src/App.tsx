declare const __ANTHROPIC_KEY__: string;
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Plus, Trash2, Database, FileText, Settings } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid, LabelList
} from "recharts";
import { useClients, ClientManager } from "./useClients";
import type { ClientRecord, ClientPayload } from "./useClients";
import { useAuth } from "./hooks/useAuth";
import { useLicense } from "./hooks/useLicense";
import { useAdmin } from "./hooks/useAdmin";
import { AdminDashboard } from "./components/AdminDashboard";
import { LicenceGate } from "./components/LicenceGate";
import { LicenceBanner } from "./components/LicenceBanner";
import { AuthGate } from "./components/AuthGate";
import { LoginTransition } from "./components/LoginTransition";
import { LoanModal } from "./components/LoanModal";
import { HelpMenu } from "./components/HelpMenu";
import { supabase } from "./lib/supabase";

// ── Imports modules refactorisés ──────────────────────────────────────────────
import { BRAND, SURFACE, EMPTY_CHARGES_DETAIL, PLACEMENT_TYPES_BY_FAMILY, ALL_PLACEMENTS, PLACEMENT_FAMILIES, PROPERTY_TYPES, PROPERTY_RIGHTS, CHILD_LINKS, CUSTODY_OPTIONS, COUPLE_STATUS_OPTIONS, MATRIMONIAL_OPTIONS, CHART_COLORS, RECEIVED_COLORS, LEGUE_COLORS, TESTAMENT_RELATION_OPTIONS, BENEFICIARY_RELATION_OPTIONS, PCS_GROUPES, PCS_CATEGORIES, SEUIL_MICRO_BA } from "./constants";
import type {
  Child, Property, Placement, PatrimonialData, IrOptions,
  SuccessionData, Heir, TestamentHeir, LegsPrecisItem,
  DemembrementContrepartie, OtherLoan, PERRente, Hypothesis,
  BaseSnapshot, ChargesDetail, TaxBracket, FilledBracket,
  Beneficiary, DifferenceLine
} from "./types/patrimoine";
import { n, euro, deepClone, isAV, isPERType, getDemembrementPercentages, computeTaxFromBrackets,
  personLabel, fractionRVTO, childMatchesDeceased, getAgeFromBirthDate, buildCollectedHeirs,
  getFamilyBeneficiaries, isSpouseHeirEligible, getAvailableSpouseOptions, computeKilometricAllowance,
  isIndependant, isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire,
  getGroupeLabel, getCategorieLabel, sumChargesDetail, getBaseFiscalParts, getChildrenFiscalParts,
  placementFiscalSummary, placementNeedsTaxableIncome, placementNeedsDeathValue, placementNeedsOpenDate,
  placementNeedsPFU, isCashPlacement, propertyNeedsRent, propertyNeedsPropertyTax, propertyNeedsInsurance,
  propertyNeedsWorks, propertyNeedsLoan, safeFilePart, buildExportFileName
} from "./lib/calculs/utils";
import { resolveLoanValues, resolveLoanValuesMulti, resolveOneLoan, calcMonthlyPayment } from "./lib/calculs/credit";
import type { Loan } from "./types/patrimoine";
import { computeIR } from "./lib/calculs/ir";
import { computeIFI } from "./lib/calculs/ifi";
import { computeSuccession } from "./lib/calculs/succession";
import { buildHypothesisDifferenceLines } from "./lib/hypotheses";
import { runSelfChecks } from "./lib/selfChecks";

// ── Composants onglets (React.memo — re-render uniquement si leurs données changent) ──
import { TabFamiliale } from "./components/tabs/TabFamiliale";
import { TabTravail } from "./components/tabs/TabTravail";
import { TabRevenus } from "./components/tabs/TabRevenus";
import { TabImmobilier } from "./components/tabs/TabImmobilier";
import { TabPlacements } from "./components/tabs/TabPlacements";
import { TabCredits } from "./components/tabs/TabCredits";
import { TabIR } from "./components/tabs/TabIR";
import { TabIFI } from "./components/tabs/TabIFI";
import { TabSuccession } from "./components/tabs/TabSuccession";
import { TabHypotheses } from "./components/tabs/TabHypotheses";
import { TabMission } from "./components/tabs/TabMission";
import { TabParametres } from "./components/tabs/TabParametres";

// ─── COMPOSANTS UI ────────────────────────────────────────────────────────────

// ── Tooltip d'aide ──
function HelpTooltip({ text }: { text: string }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <span className="relative inline-flex items-center" style={{ verticalAlign: "middle" }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors ml-1"
        style={{ width: 15, height: 15, background: "rgba(38,66,139,0.13)", color: "#26428B", border: "1px solid rgba(38,66,139,0.25)", cursor: "help", flexShrink: 0 }}
        tabIndex={-1}
        aria-label="Aide"
      >?</button>
      {visible && (
        <span
          className="absolute z-50 rounded-xl shadow-xl text-xs leading-relaxed"
          style={{
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a2d6b",
            color: "#f0f4ff",
            padding: "8px 12px",
            minWidth: 200,
            maxWidth: 280,
            pointerEvents: "none",
            whiteSpace: "normal",
            borderRadius: 12,
          }}
        >
          {text}
          <span style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#1a2d6b", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
        </span>
      )}
    </span>
  );
}

function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold tracking-wide flex items-center gap-0.5" style={{ color: BRAND.sky }}>
        {label}{tooltip && <HelpTooltip text={tooltip} />}
      </Label>
      {children}
    </div>
  );
}

function MoneyField({ label, value, onChange, compact, tooltip }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; compact?: boolean; tooltip?: string }) {
  return (
    <Field label={label} tooltip={tooltip}>
      <Input
        value={value || ""}
        onChange={onChange}
        className={compact ? "rounded-xl h-8 text-sm border shadow-sm transition-all focus-visible:ring-2" : "rounded-2xl border shadow-sm transition-all focus-visible:ring-2"}
        style={{ background: SURFACE.input, borderColor: SURFACE.inputBorder }}
        inputMode="decimal"
      />
    </Field>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-2xl border shadow-none backdrop-blur-sm" style={{ borderColor: SURFACE.borderStrong, background: `linear-gradient(180deg, ${SURFACE.card} 0%, ${SURFACE.cardSoft} 100%)` }}>
      <CardContent className="p-4">
        <div className="text-sm font-medium" style={{ color: BRAND.sky }}>{label}</div>
        <div className="mt-1 text-xl font-semibold" style={{ color: BRAND.navy }}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function BracketFillChart({ title, data, referenceValue, valueLabel }: {
  title: string; data: FilledBracket[]; referenceValue: number; valueLabel: string;
}) {
  const chartData = data.map((item, index) => ({
    label: item.label,
    filled: Math.round(item.filled),
    tax: Math.round(item.tax),
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const currentIndex = data.findIndex((s) => referenceValue <= s.to);
  const safeIndex = currentIndex >= 0 ? currentIndex : Math.max(0, data.length - 1);
  const currentSlice = data[safeIndex];
  const localMax = currentSlice ? (Number.isFinite(currentSlice.to) ? currentSlice.to : Math.max(referenceValue, 1)) : Math.max(referenceValue, 1);
  const indicatorPct = localMax > 0 ? Math.min(100, Math.max(0, (referenceValue / localMax) * 100)) : 0;

  return (
    <Card className="rounded-2xl border shadow-none backdrop-blur-sm" style={{ borderColor: SURFACE.borderStrong, background: SURFACE.card }}>
      <CardHeader><CardTitle style={{ color: BRAND.navy }}>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">{valueLabel} : <strong>{euro(referenceValue)}</strong></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tranche active : <strong>{currentSlice?.label || "—"}</strong></span>
            <span>{euro(referenceValue)} / {euro(localMax)}</span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "rgba(81,106,199,0.16)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${indicatorPct}%`, background: `linear-gradient(90deg, ${BRAND.gold} 0%, ${BRAND.blue} 100%)` }} />
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: number) => euro(value)} />
              <Bar dataKey="filled" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={entry.fill} />)}
                <LabelList dataKey="filled" position="top" formatter={(value: number) => euro(value)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl p-3 shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND.cream} 0%, ${BRAND.gold} 100%)` }}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-semibold" style={{ color: BRAND.navy }}>{title}</div>
        <div className="text-sm text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}

function DifferenceBadge({ impact }: { impact: DifferenceLine["impact"] }) {
  if (impact === "up") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Hausse</span>;
  if (impact === "down") return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Baisse</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Modification</span>;
}

// ─── APP ──────────────────────────────────────────────────────────────────────

// Logo chargé dynamiquement — remplacez ce placeholder par votre fichier PNG via l'interface
const DEFAULT_LOGO_SRC = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUxIiBoZWlnaHQ9IjI3NiIgdmlld0JveD0iMCAwIDI1MSAyNzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xNjdfMTA0KSI+CjxwYXRoIGQ9Ik0xMDAuMjMgMjIwLjA4Qzg5LjAyMDEgMjIwLjA4IDc5LjYzMDEgMjE0Ljg3IDc0LjQ2MDEgMjA1Ljc5QzY1LjcxMDEgMTkwLjQxIDc0LjYzMDEgMTc3LjI4IDgxLjgwMDEgMTY2LjcyQzg2Ljk2MDEgMTU5LjEyIDkyLjgxMDEgMTUwLjUxIDk1LjkwMDEgMTM4LjU3Qzk3LjgwMDEgMTMxLjIyIDk3LjY0MDEgMTE3LjYxIDk2LjA4MDEgMTE5LjgyQzkzLjE0MDEgMTIzLjk4IDg3LjY2MDEgMTMxLjczIDc3LjMwMDEgMTMxLjczQzc0LjgzMDEgMTMxLjczIDcyLjM2MDEgMTMxLjI1IDY5Ljk1MDEgMTMwLjMxQzYyLjcyMDEgMTI3LjQ4IDU4Ljg0MDEgMTE5LjYxIDYwLjk4MDEgMTEyLjE2QzY0Ljc2MDEgOTkuMDIwMSA3NC44MDAxIDY0LjEyIDExMC43NyA2NC4wM0MxMTAuNzcgNjQuMDMgMjA2LjUgNjMuOCAyMDYuNTEgNjMuOEMyMTIuMjggNjMuOCAyMTcuNyA2Ny4xMTAxIDIyMC4yNCA3Mi42OTAxQzIyMS4yIDc0Ljc5MDEgMjIxLjU2IDc3LjEyMDEgMjIxLjU0IDc5LjQzTDIyMS4zNCA5OC4xN0MyMjEuMjUgMTA2LjMyIDIxNC42OSAxMTIuOTEgMjA2LjU0IDExMy4wNEwxOTAuMiAxMTMuMjlDMTg5Ljg0IDExMy4yOSAxODkuNTUgMTEzLjU3IDE4OS41MyAxMTMuOTNMMTg3LjAyIDE1Mi4xOEMxODYuNzQgMTU2LjUxIDE4OC45NiAxNjEuMTYgMTkwLjY3IDE1OC45OUMxOTMuODIgMTU0Ljk5IDE5OC43OSAxNTIuNiAyMDMuOTYgMTUyLjZDMjA5LjkyIDE1Mi42IDIxNS40IDE1NS42NyAyMTguNjEgMTYwLjgyQzIyNS4yMiAxNzEuNDEgMjE5LjYgMTg2LjA0IDIxMy45NiAxOTcuNjFDMjA3LjA1IDIxMS43NyAxOTMuMTMgMjIwLjIzIDE3Ni43MSAyMjAuMjNDMTc2LjcxIDIyMC4yMyAxMDIuMzkgMjIwLjEgMTAwLjI0IDIyMC4xTDEwMC4yMyAyMjAuMDhaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0xNTYuNDkgMTAxLjM1QzE0Ny4yNSA5OS41OSAxMzguOTUgMTAwLjUyIDEyOS42NCAxMDAuODVDMTI3LjYyIDEyNi41OSAxMjUuOTEgMTY4LjU1IDExNy4zNSAxOTAuOTFDMTE1LjIxIDE5Ni41IDExMC45NyAyMDAuNDUgMTA2LjMxIDIwMS4yNEMxMDAgMjAyLjMxIDkzLjcxIDIwMC45NiA5MC40NiAxOTUuMjVDODMuMTUgMTgyLjQxIDEwNC41NiAxNzEuNTggMTEyLjEzIDE0Mi4zMUMxMTUuNjUgMTI4LjcgMTE3LjIyIDExNS4zOSAxMTguMTIgMTAxLjI4Qzg2LjAzIDk1LjMyIDg4LjU3IDEyMS40NSA3OS4wMyAxMTcuNzJDODQuMDMgMTAwLjMzIDkxLjkxIDgyLjU3IDExMi40NiA4Mi41MkwyMDIuOSA4Mi4zTDIwMi43IDEwMC40MkwxNzMuNTcgMTAwLjg2TDE3MC4zIDE1MC42N0MxNjkuNzggMTU4LjUyIDE2OS44NiAxNjYuNSAxNzIuMTMgMTc0LjAyQzE3NC4wMyAxODAuMzIgMTgwLjQ2IDE4Mi4zNCAxODYuMyAxODEuODdDMTk3LjU0IDE4MC45NiAxOTguNjcgMTY2LjcyIDE5OC44OSAxNjcuNjNDMTk4LjI4IDE2NS4xMiAyMDkuNSAxNjMuMDIgMTk3LjE3IDE4OC4zMUMxOTIuNzQgMTk3LjM5IDE4NC4yMSAyMDEuODQgMTc0LjMgMjAxLjdDMTU5Ljk5IDIwMS41MSAxNTAuMzcgMTkxIDE1MC42NCAxNzYuNEMxNTEuMDkgMTUxLjY1IDE1NC41MSAxMjcuODcgMTU2LjUxIDEwMS4zNkwxNTYuNDkgMTAxLjM1WiIgZmlsbD0iI0Y4RjZGNyIvPgo8cGF0aCBkPSJNMTE0Ljk5IDI2Mi45OEM4NC4wNCAyNTcuMSA1Ni43NiAyNDAuMTkgMzcuNjggMjE0Ljg2QzE3LjM0IDE4Ny44NyA4LjczMDAyIDE1NC41NyAxMy40MyAxMjEuMUMxOC4xMyA4Ny42MyAzNS41OSA1OCA2Mi41OCAzNy42NUM4OC4zMSAxOC4yNiAxMTkuNzcgOS41Mzk5NiAxNTEuNjUgMTIuODRDMTUzLjIxIDEzIDE1NC43OCAxMy4xOCAxNTYuMzQgMTMuNEMxODkuODEgMTguMSAyMTkuNDQgMzUuNTYgMjM5Ljc5IDYyLjU1TDI0Ny43MiA1Ni41OEMyMjUuMDQgMjYuNDkgMTkyLjMxIDguNDI5OTYgMTU3LjczIDMuNTY5OTZDMTU2LjE3IDMuMzQ5OTYgMTU0LjYxIDMuMTY5OTYgMTUzLjA0IDIuOTk5OTZDMTE5Ljg2IC0wLjUwMDA0NSA4NS4zNCA4LjA2OTk2IDU2LjYgMjkuNzJDLTMuNTg5OTggNzUuMDggLTE1LjYxIDE2MC42NCAyOS43NCAyMjAuODNDNTEuMDcgMjQ5LjE0IDgxLjMxIDI2Ni43OCAxMTMuNjEgMjcyLjgyTDExNC45OCAyNjIuOThIMTE0Ljk5WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNNDAuNyAyMzYuODRDMzYuMTQgMjMyLjI4IDMxLjg4IDIyNy4zOCAyNy45NSAyMjIuMTdDNS42NjAwMSAxOTIuNTkgLTMuNzc5OTkgMTU2LjA5IDEuMzgwMDEgMTE5LjRDNi41MzAwMSA4Mi43MSAyNS42NyA1MC4yMyA1NS4yNSAyNy45M0M4My40MSA2LjcyMDAxIDExOC4yMSAtMi45Mjk5OSAxNTMuMjYgMC43ODAwMTRDMTU1LjA3IDAuOTcwMDE0IDE1Ni41OSAxLjE1MDAxIDE1OC4wMyAxLjM2MDAxQzE5NC43MiA2LjUyMDAxIDIyNy4yIDI1LjY1IDI0OS41IDU1LjI0TDI1MC44NSA1Ny4wM0wyMzkuMzUgNjUuN0wyMzggNjMuOTFDMjE4LjAyIDM3LjQgMTg4LjkxIDIwLjI1IDE1Ni4wMyAxNS42M0MxNTQuNjUgMTUuNDQgMTUzLjE0IDE1LjI1IDE1MS40MiAxNS4wOEMxMjAuMTUgMTEuODQgODkuMDggMjAuNSA2My45MyAzOS40NUMzNy40MiA1OS40MyAyMC4yNyA4OC41NCAxNS42NSAxMjEuNDJDMTEuMDMgMTU0LjMgMTkuNDkgMTg3LjAxIDM5LjQ3IDIxMy41MkM1OC4xIDIzOC4yNCA4NS4wNyAyNTUuMDMgMTE1LjQxIDI2MC43OUwxMTcuNTEgMjYxLjE5TDExNS41MiAyNzUuNDZMMTEzLjIxIDI3NS4wM0M4NS41MyAyNjkuODUgNjAuMzcgMjU2LjUxIDQwLjcxIDIzNi44Nkw0MC43IDIzNi44NFpNMjMzLjQ1IDQzLjU4QzIxMi45OSAyMy4xMiAxODYuNTcgOS44OTAwMSAxNTcuNCA1Ljc5MDAxQzE1Ni4wMSA1LjYwMDAxIDE1NC41NSA1LjQyMDAxIDE1Mi43OSA1LjIzMDAxQzExOC44NyAxLjY1MDAxIDg1LjE5IDEwLjk4IDU3Ljk1IDMxLjUxQzI5LjMyIDUzLjA5IDEwLjggODQuNTIgNS44MTAwMSAxMjAuMDJDMC44MjAwMDkgMTU1LjUyIDkuOTUwMDEgMTkwLjg0IDMxLjUzIDIxOS40N0M1MS4yNiAyNDUuNjUgNzkuNjYgMjYzLjU4IDExMS43MiAyNzAuMTVMMTEyLjQ3IDI2NC43NUM4MS44OCAyNTguNDIgNTQuNzUgMjQxLjIzIDM1Ljg4IDIxNi4xOUMxNS4xOCAxODguNzIgNi40MjAwMSAxNTQuODMgMTEuMiAxMjAuNzdDMTUuOTkgODYuNzEgMzMuNzUgNTYuNTUgNjEuMjIgMzUuODVDODcuMjggMTYuMjEgMTE5LjQ3IDcuMjUwMDEgMTUxLjg3IDEwLjZDMTUzLjY1IDEwLjc4IDE1NS4yMSAxMC45NyAxNTYuNjUgMTEuMTdDMTg5Ljk3IDE1Ljg1IDIxOS41NiAzMi45NSAyNDAuMjEgNTkuNDJMMjQ0LjU2IDU2LjE0QzI0MS4wOSA1MS42OSAyMzcuMzggNDcuNSAyMzMuNDYgNDMuNTdMMjMzLjQ1IDQzLjU4WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMjA2LjczIDQ5LjQ5OTlDMjE5LjI4OSA0OS40OTk5IDIyOS40NyAzOS4zMTg5IDIyOS40NyAyNi43NTk5QzIyOS40NyAxNC4yMDA5IDIxOS4yODkgNC4wMTk5IDIwNi43MyA0LjAxOTlDMTk0LjE3MSA0LjAxOTkgMTgzLjk5IDE0LjIwMDkgMTgzLjk5IDI2Ljc1OTlDMTgzLjk5IDM5LjMxODkgMTk0LjE3MSA0OS40OTk5IDIwNi43MyA0OS40OTk5WiIgZmlsbD0iI0UzQUY2NCIvPgo8cGF0aCBkPSJNMjI0LjI2IDkuMTk5OTVMMjE3LjkyIDE1LjUzOTlDMjIxLjQ4IDE5LjA5OTkgMjIzLjEyIDIzLjk4OTkgMjIyLjQyIDI4Ljk1OTlDMjIxLjIgMzcuNjA5OSAyMTMuMTcgNDMuNjYgMjA0LjUyIDQyLjQ1QzIwMS4wOCA0MS45NyAxOTcuOTggNDAuNDE5OSAxOTUuNTMgMzcuOTc5OUMxOTEuOTcgMzQuNDE5OSAxOTAuMzMgMjkuNTI5OSAxOTEuMDMgMjQuNTQ5OUMxOTIuMjUgMTUuODk5OSAyMDAuMjggOS44NDk5NSAyMDguOTMgMTEuMDU5OUMyMTIuMzcgMTEuNTM5OSAyMTUuNDcgMTMuMDg5OSAyMTcuOTIgMTUuNTI5OUwyMjQuMjYgOS4xODk5NU0yMjQuMjYgOS4xOTk5NUMyMjAuNTggNS41MTk5NSAyMTUuNzMgMi45Njk5NSAyMTAuMTggMi4xODk5NUMxOTYuNjEgMC4yNzk5NDkgMTg0LjA2IDkuNzM5OTUgMTgyLjE2IDIzLjMwOTlDMTgxLjAzIDMxLjMzOTkgMTgzLjg4IDM5IDE4OS4yIDQ0LjMyQzE5Mi44OCA0OCAxOTcuNzMgNTAuNTUgMjAzLjI4IDUxLjMzQzIxNi44NSA1My4yNCAyMjkuNCA0My43Nzk5IDIzMS4zIDMwLjIwOTlDMjMyLjQzIDIyLjE3OTkgMjI5LjU4IDE0LjUxOTkgMjI0LjI2IDkuMTk5OTVaIiBmaWxsPSIjMTAxQjNCIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTY3XzEwNCI+CjxyZWN0IHdpZHRoPSIyNTAuODUiIGhlaWdodD0iMjc1LjQ1IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=";


// ─── CABINET SETTINGS PERSISTENCE ────────────────────────────────────────────

const _isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const _eAPI = _isElectron ? (window as any).electronAPI : null;

// Clé localStorage liée à l'utilisateur — isolation complète entre comptes
function getCabinetKey(userId: string) {
  return userId ? `ploutos_cabinet_${userId}` : "ploutos_cabinet";
}

// Pas de migration automatique depuis les anciennes clés génériques :
// Supabase est la source de vérité — chaque utilisateur charge ses données depuis Supabase au login.
// Une migration locale contaminerait les nouveaux comptes avec les données d'autres utilisateurs.
function migrateCabinetForUser(_userId: string) {
  // Intentionnellement vide — migration supprimée
}

// Lit le cabinet depuis localStorage — retourne null si absent ou invalide
function loadCabinetFromStorage(userId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(getCabinetKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data === "object" && data !== null && (data.nom !== undefined || data.colorNavy !== undefined)) {
      return data;
    }
    return null;
  } catch { return null; }
}

// Charge le cabinet avec stratégie multi-couches :
// 1. Fichier Electron (si dispo) — le plus à jour en local
// 2. localStorage — toujours synchronisé à chaque sauvegarde
// 3. null — premier lancement
async function loadCabinetAsync(userId: string): Promise<Record<string, string> | null> {
  if (_isElectron && _eAPI?.readCabinet) {
    try {
      const data = await _eAPI.readCabinet();
      if (data && typeof data === "object" && (data.nom !== undefined || data.colorNavy !== undefined)) {
        try { localStorage.setItem(getCabinetKey(userId), JSON.stringify(data)); } catch {}
        return data;
      }
      console.warn("[Ploutos] cabinet.json vide ou invalide, fallback localStorage");
    } catch (e) {
      console.warn("[Ploutos] readCabinet() échoué:", e, "— fallback localStorage");
    }
  }
  return loadCabinetFromStorage(userId);
}

// Charge les paramètres cabinet depuis Supabase (multi-appareils)
// Merge avec les données locales : Supabase gagne sauf pour logoSrc/signatureSrc (stockés local only)
async function loadCabinetFromSupabase(userId: string): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase
      .from("cabinet_settings")
      .select("settings")
      .eq("user_id", userId)
      .single();
    if (error || !data?.settings) return null;
    return data.settings as Record<string, string>;
  } catch { return null; }
}

// Sauvegarde triple : localStorage + fichier Electron + Supabase
// Si l'un échoue, les deux autres sont intacts — données jamais perdues
async function saveCabinetAsync(data: Record<string, string>, userId?: string) {
  // Toujours horodater pour le merge multi-appareils
  const ts = new Date().toISOString();
  const dataWithTs: Record<string, string> = { ...data, updatedAt: ts };
  // Normaliser nom ↔ cabinetName avant sauvegarde
  if (!dataWithTs.cabinetName && dataWithTs.nom) dataWithTs.cabinetName = dataWithTs.nom;
  if (!dataWithTs.nom && dataWithTs.cabinetName) dataWithTs.nom = dataWithTs.cabinetName;

  // 1. localStorage (synchrone, toujours disponible)
  try { localStorage.setItem(getCabinetKey(userId || ""), JSON.stringify(dataWithTs)); } catch {}
  // 2. Fichier Electron
  if (_isElectron && _eAPI?.writeCabinet) {
    try { await _eAPI.writeCabinet(dataWithTs); } catch (e) {
      console.warn("[Ploutos] writeCabinet() échoué:", e);
    }
  }
  // 3. Supabase (multi-appareils, multi-versions)
  if (userId) {
    try {
      // logoSrc et signatureSrc sont trop volumineux pour Supabase — on les garde local only
      const { logoSrc: _l, signatureSrc: _s, ...dataWithoutImages } = dataWithTs as any;
      await supabase.from("cabinet_settings").upsert(
        { user_id: userId, settings: dataWithoutImages, updated_at: ts },
        { onConflict: "user_id" }
      );
    } catch (e) { console.warn("[Ploutos] Supabase cabinet sync échoué:", e); }
  }
}

const DEFAULT_CABINET = {
  nom: "",
  forme: "",
  rcs: "",
  villeRcs: "",
  adresse: "",
  codePostal: "",
  ville: "",
  tel: "",
  email: "",
  conseiller: "",
  orias: "",
  rcpAssureur: "",
  rcpContrat: "",
  mediateur: "",
  mediateurUrl: "",
  mediateurAdresse: "",
  partenaires: "",
  colorNavy: "#101B3B",
  colorSky: "#26428B",
  colorBlue: "#516AC7",
  colorGold: "#E3AF64",
  colorCream: "#FBECD7",
  logoSrc: "",
  signatureSrc: "",
  cabinetName: "",
};

function AppInner({ userId, userEmail, authState, onSignOut }: { userId: string; userEmail: string; authState: string; onSignOut: () => void }) {
  const { licence } = useLicense(userId || null);
  const { isAdmin } = useAdmin(userEmail || null);
  const [showAdmin, setShowAdmin] = useState(false);
  // ── Logo cabinet : initialisé synchroniquement pour éviter le flash du logo Ploutos
  const [logoSrc, setLogoSrc] = useState(() => {
    migrateCabinetForUser(userId);
    const saved = loadCabinetFromStorage(userId);
    return (saved?.logoSrc as string) || DEFAULT_LOGO_SRC;
  });

  // Charger le logo depuis Electron ou localStorage (multi-couches)
  useEffect(() => {
    loadCabinetAsync(userId).then(saved => {
      const sl = saved?.logoSrc as string;
      if (sl && sl.startsWith("data:")) setLogoSrc(sl);
    });
  }, [userId]);



  const [cabinet, setCabinet] = useState(() => {
    const saved = loadCabinetFromStorage(userId);
    if (saved) {
      const base = { ...DEFAULT_CABINET, ...saved };
      // Normaliser nom ↔ cabinetName (un seul des deux peut être rempli selon la version)
      if (!base.cabinetName && base.nom) base.cabinetName = base.nom;
      if (!base.nom && base.cabinetName) base.nom = base.cabinetName;
      return base;
    }
    // Premier lancement : état vide — Supabase sera chargé dans le useEffect
    return { ...DEFAULT_CABINET };
  });

  // Charger le cabinet au démarrage : local d'abord, puis Supabase (merge par timestamp)
  useEffect(() => {
    // Helper normalisation nom <-> cabinetName
    const normalize = (base: Record<string, string>): Record<string, string> => {
      if (!base.cabinetName && base.nom) base.cabinetName = base.nom;
      if (!base.nom && base.cabinetName) base.nom = base.cabinetName;
      return base;
    };

    // 1. Charger local immédiatement
    loadCabinetAsync(userId).then(localData => {
      if (localData) setCabinet(prev => normalize({ ...DEFAULT_CABINET, ...prev, ...localData }) as typeof DEFAULT_CABINET);
    });

    // 2. Charger Supabase si connecté — merge par timestamp (le plus récent gagne)
    if (userId) {
      loadCabinetFromSupabase(userId).then(remoteData => {
        if (!remoteData) return;
        setCabinet(prev => {
          const localTs  = (prev as any).updatedAt  ? new Date((prev as any).updatedAt).getTime()  : 0;
          const remoteTs = (remoteData as any).updatedAt ? new Date((remoteData as any).updatedAt).getTime() : 0;

          // Le plus récent gagne — Supabase gagne en cas d'égalité
          const winner = remoteTs >= localTs ? remoteData : prev;
          const loser  = remoteTs >= localTs ? prev      : remoteData;
          const merged = normalize({ ...DEFAULT_CABINET, ...loser, ...winner } as Record<string, string>);

          // Logo et signature : toujours local only (trop volumineux pour Supabase)
          merged.logoSrc      = (prev as any).logoSrc      || "";
          merged.signatureSrc = (prev as any).signatureSrc || "";

          // Sauvegarder localement le merge
          try { localStorage.setItem(getCabinetKey(userId), JSON.stringify(merged)); } catch {}
          if (_isElectron && _eAPI?.writeCabinet) _eAPI.writeCabinet(merged).catch(() => {});

          return merged as typeof DEFAULT_CABINET;
        });
      });
    }
  }, [userId]);

  const updateCabinet = (key: keyof typeof cabinet, val: string) => {
    setCabinet(prev => {
      const next = { ...prev, [key]: val };
      // Synchroniser nom <-> cabinetName automatiquement
      if (key === "nom") (next as any).cabinetName = val;
      if (key === "cabinetName") (next as any).nom = val;
      saveCabinetAsync(next as Record<string, string>, userId);
      return next;
    });
  };
  const { clients, syncStatus, syncNow, createClient, saveClient, deleteClient, duplicateClient, renameClient } = useClients(userId, authState)
  const [activeClient, setActiveClient] = useState<ClientRecord | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  // Couleurs dynamiques tirées des paramètres cabinet
  const CAB = {
    navy: cabinet.colorNavy,
    sky: cabinet.colorSky,
    blue: cabinet.colorBlue,
    gold: cabinet.colorGold,
    cream: cabinet.colorCream,
  };
  const [signatureSrc, setSignatureSrc] = useState<string>("");
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setSignatureSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  // ── Données mission ──
  const [mission, setMission] = useState({
    // Besoins
    besoinSante_depenses: false, besoinSante_hospit: false, besoinSante_depasse: false, besoinSante_surcompl: false,
    besoinPrev_arret: false, besoinPrev_deces: false, besoinPrev_fraisGen: false,
    besoinRetraite_capital: false, besoinRetraite_rente: false, besoinRetraite_moderniser: false,
    besoinEpargne_valoriser: false, besoinEpargne_transmettre: false, besoinEpargne_completer: false, besoinEpargne_projet: false,
    // Rémunération
    remuHonoraire: false, remuCommission: true, remuMixte: false, remuHonoraireMontant: "",
    // Profil investisseur — attitude
    attitude: 0 as 0|8|12|18,
    reactionBaisse: 0 as 0|6|12|18,
    // Profil investisseur — pertes/gains
    aSubiPertes: false, ampleurPertes: "" as ""|-5|-10|-20|-99,
    reactionPertes: 0 as 0|1|2|3,
    aRealiseGains: false, ampleurGains: "" as ""|5|10|20|99,
    reactionGains: 0 as 0|1|2|3,
    modeGestion: "" as ""|"pilote"|"libre",
    // Connaissances financières — tableau
    connaitFondsEuros: false, investiFondsEuros: false,
    connaitActions: false, investiActions: false,
    connaitOPCVM: false, investiOPCVM: false,
    connaitImmo: false, investiImmo: false,
    connaitTrackers: false, investiTrackers: false,
    connaitStructures: false, investiStructures: false,
    // Connaissances financières — questions theorie
    savoirUCRisque: false, savoirHorizonUC: false, savoirRisqueRendement: false,
    // Horizon
    horizon: "" as ""| "0-4" | "5-8" | "9-15" | "15+",
    // Obligations fiscales
    residenceFranceIR: true, residenceFranceIFI: false,
    nationaliteUS: false, residentFiscalUS: false,
    ppe: false, ppeDetails: "",
    // Lieu signature
    lieuSignature: "Perpignan",
  });
  const updateMission = (key: keyof typeof mission, val: unknown) => setMission(prev => ({ ...prev, [key]: val }));
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const newLogo = ev.target.result as string;
        setLogoSrc(newLogo);
        // Persister le logo avec les paramètres cabinet
        saveCabinetAsync({ ...cabinet, logoSrc: newLogo } as Record<string, string>, userId);
      }
    };
    reader.readAsDataURL(file);
  };
  const [clientName, setClientName] = useState("Client");
  const [notes, setNotes] = useState("");
  const [placementFamily, setPlacementFamily] = useState("cash");
  const [data, setData] = useState<PatrimonialData>({
    person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "", person1PcsGroupe: "5",
    person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [], salary1: "", salary2: "", pensions: "", pensions1: "", pensions2: "", csgDeductibleFoncier: "",
    perDeduction: "", pensionDeductible: "", otherDeductible: "", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: {...EMPTY_CHARGES_DETAIL},
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: {...EMPTY_CHARGES_DETAIL},
    properties: [], placements: [], otherLoans: [],
  });
  const [successionData, setSuccessionData] = useState<SuccessionData>({
    deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
    useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [],
  });
  const [irOptions, setIrOptions] = useState<IrOptions>({
    expenseMode1: "standard", expenseMode2: "standard",
    km1: "", km2: "", cv1: "", cv2: "",
    mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
    other1: "", other2: "", foncierRegime: "micro",
  });
  // Concubinage : quelle personne afficher dans l'onglet IR
  const [concubinPerson, setConcubinPerson] = useState<1 | 2>(1);
  // Picker famille pour les legs
  const [legsPickerOpen, setLegsPickerOpen] = useState<"global" | "precis" | null>(null);
  const [loanModalIndex, setLoanModalIndex] = useState<number | null>(null); // index du bien dont on édite les crédits
  const [exportStatus, setExportStatus] = useState("");
  const [exportFallbackOpen, setExportFallbackOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfMissionModalOpen, setPdfMissionModalOpen] = useState(false);
  const [pdfSections, setPdfSections] = useState({
    cabinet: true, famille: true, travail: true, bilan: true,
    ir: true, ifi: true, succession: true, hypos: true, mentions: true,
  });
  const [pdfMissionSections, setPdfMissionSections] = useState({
    legal: true, famille: true, travail: true, besoins: true,
    bilan: true, ir: true, ifi: true, succession: true, profil: true, signature: true,
  });
  // Dialog détail charges
  const [chargesDialogOpen, setChargesDialogOpen] = useState<1|2|null>(null);
  const [chargesPdfLoading, setChargesPdfLoading] = useState(false);
  const [exportFallbackContent, setExportFallbackContent] = useState("");
  const [exportFallbackFileName, setExportFallbackFileName] = useState("");
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([
    { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
  ]);
  const [baseSnapshot, setBaseSnapshot] = useState<BaseSnapshot>({ savedAt: null, data: null, successionData: null, irOptions: null });

  // ── Autosave ──
  useEffect(() => {
    if (!activeClient) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      const payload = {
        clientName, notes, data, irOptions, successionData, hypotheses, baseSnapshot, mission,
      };
      const displayName = clientName || activeClient.displayName;
      saveClient(activeClient.id, payload as ClientPayload, displayName);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2500);
    }, 1500);
    return () => clearTimeout(timer);
  }, [data, clientName, notes, irOptions, successionData, hypotheses, baseSnapshot, mission, activeClient]);

  const person1 = personLabel(data, 1);
  const person2 = personLabel(data, 2);

  // Résout la quotité DC effective selon le propriétaire et la personne ciblée
  const resolveInsuranceRate = (property: Property, target?: "person1" | "person2"): number => {
    if (!property.loanInsurance) return 0;
    const isMulti = property.ownership === "common" || property.ownership === "indivision";
    if (!isMulti) return Math.min(100, Math.max(0, n(property.loanInsuranceRate)));
    if (target === "person1") return Math.min(100, Math.max(0, n(property.loanInsuranceRate1)));
    if (target === "person2") return Math.min(100, Math.max(0, n(property.loanInsuranceRate2)));
    // Total : somme des deux quotités (pour calcul prime)
    return Math.min(200, Math.max(0, n(property.loanInsuranceRate1) + n(property.loanInsuranceRate2)));
  };

  // ownerOptions inclut les enfants comme titulaires possibles
  const childOwnerOptions = data.childrenData
    .filter(c => c.firstName || c.lastName)
    .map((c, i) => ({
      value: `child_${i}`,
      label: `${c.firstName || ""} ${c.lastName || ""}`.trim() || `Enfant ${i + 1}`,
    }));
  const ownerOptions = [
    { value: "person1", label: person1 },
    { value: "person2", label: person2 },
    { value: "common", label: "Communauté" },
    { value: "indivision", label: "Indivision" },
    ...childOwnerOptions,
  ];

  // ── Setters ──
  const setField = useCallback(<K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) =>
    setData((prev) => ({ ...prev, [key]: value })), []);

  // Met à jour une ligne du détail charges et recalcule le total automatiquement
  const setChargesDetailField = useCallback((person: 1 | 2, field: keyof ChargesDetail, value: string) => {
    setData((prev) => {
      const detailKey = (person === 1 ? "chargesDetail1" : "chargesDetail2") as keyof PatrimonialData;
      const totalKey  = (person === 1 ? "chargesReelles1" : "chargesReelles2") as keyof PatrimonialData;
      const newDetail = { ...(prev[detailKey] as ChargesDetail), [field]: value };
      const newTotal  = sumChargesDetail(newDetail);
      return { ...prev, [detailKey]: newDetail, [totalKey]: newTotal > 0 ? String(Math.round(newTotal)) : "" };
    });
  }, []);

  const addChild = useCallback(() => setData((prev) => ({ ...prev, childrenData: [...prev.childrenData, { firstName: "", lastName: "", birthDate: "", parentLink: "common_child", custody: "full", rattached: true, handicap: false, schoolLevel: "" }] })), []);
  const updateChild = useCallback((index: number, key: keyof Child, value: string | boolean) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.map((c, i) => i === index ? { ...c, [key]: value } : c) })), []);
  const removeChild = useCallback((index: number) =>
    setData((prev) => ({ ...prev, childrenData: prev.childrenData.filter((_, i) => i !== index) })), []);

  const addProperty = useCallback((type: string) => setData((prev) => ({
    ...prev,
    properties: [...prev.properties, { name: "", type, ownership: "person1", propertyRight: "full", usufructAge: "", value: "", propertyTaxAnnual: "", rentGrossAnnual: "", insuranceAnnual: "", worksAnnual: "", otherChargesAnnual: "", loanEnabled: false, loanType: "amortissable", loanAmount: "", loanRate: "", loanDuration: "", loanStartDate: "", loanCapitalRemaining: "", loanInterestAnnual: "", loanPledgedPlacementIndex: "-1", loanInsurance: false, loanInsuranceGuarantees: "dc", loanInsuranceRate: "", loanInsuranceRate1: "", loanInsuranceRate2: "", loanInsurancePremium: "", loanInsuranceCoverage: "banque", indivisionShare1: "", indivisionShare2: "" }],
  })), []);
  const updateProperty = useCallback((index: number, key: keyof Property, value: string | boolean | Loan[]) =>
    setData((prev) => ({ ...prev, properties: prev.properties.map((p, i) => i === index ? { ...p, [key]: value } : p) })), []);
  const removeProperty = useCallback((index: number) =>
    setData((prev) => ({ ...prev, properties: prev.properties.filter((_, i) => i !== index) })), []);

  // ── CRUD Loans (multi-crédits) ──
  const generateLoanId = () => `loan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const emptyLoan = (): Loan => ({
    id: generateLoanId(), type: "amortissable", label: "Prêt principal",
    amount: "", rate: "", duration: "", startDate: "",
    capitalRemaining: "", interestAnnual: "",
    pledgedPlacementIndex: "-1",
    insurance: false, insuranceGuarantees: "dc",
    insuranceRate: "", insuranceRate1: "", insuranceRate2: "",
    insurancePremium: "", insuranceCoverage: "banque",
  });
  const addLoan = useCallback((propertyIndex: number) => {
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => {
        if (i !== propertyIndex) return p;
        const loans = p.loans || [];
        const newLoan = emptyLoan();
        if (loans.length === 0) newLoan.label = "Prêt principal";
        else if (newLoan.type === "ptz" || loans.some(l => l.type === "ptz")) newLoan.label = "PTZ";
        else newLoan.label = `Prêt ${loans.length + 1}`;
        return { ...p, loans: [...loans, newLoan] };
      }),
    }));
  }, []);
  const updateLoan = useCallback((propertyIndex: number, loanIndex: number, key: keyof Loan, value: string | boolean) =>
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => i !== propertyIndex ? p : {
        ...p, loans: (p.loans || []).map((l, li) => li !== loanIndex ? l : { ...l, [key]: value }),
      }),
    })), []);
  const removeLoan = useCallback((propertyIndex: number, loanIndex: number) =>
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => i !== propertyIndex ? p : {
        ...p, loans: (p.loans || []).filter((_, li) => li !== loanIndex),
      }),
    })), []);
  // Migration : convertir anciens champs loan* → loans[0] si loanEnabled et loans vide
  const migrateLoans = useCallback((propertyIndex: number) => {
    setData((prev) => ({
      ...prev, properties: prev.properties.map((p, i) => {
        if (i !== propertyIndex) return p;
        if (p.loans && p.loans.length > 0) return p; // déjà migré
        if (!p.loanEnabled) return { ...p, loans: [] };
        const migrated: Loan = {
          id: generateLoanId(), type: p.loanType || "amortissable", label: "Prêt principal",
          amount: p.loanAmount || "", rate: p.loanRate || "", duration: p.loanDuration || "",
          startDate: p.loanStartDate || "", capitalRemaining: p.loanCapitalRemaining || "",
          interestAnnual: p.loanInterestAnnual || "", pledgedPlacementIndex: p.loanPledgedPlacementIndex || "-1",
          insurance: p.loanInsurance || false, insuranceGuarantees: p.loanInsuranceGuarantees || "dc",
          insuranceRate: p.loanInsuranceRate || "", insuranceRate1: p.loanInsuranceRate1 || "",
          insuranceRate2: p.loanInsuranceRate2 || "", insurancePremium: p.loanInsurancePremium || "",
          insuranceCoverage: p.loanInsuranceCoverage || "banque",
        };
        return { ...p, loans: [migrated] };
      }),
    }));
  }, []);

  const addPlacement = useCallback((type: string) => setData((prev) => ({
    ...prev,
    placements: [...prev.placements, { name: "", type, ownership: "person1", value: "", annualIncome: "", taxableIncome: "", deathValue: "", openDate: "", pfuEligible: placementNeedsPFU(type), pfuOptOut: false, totalPremiumsNet: "", premiumsBefore70: "", premiumsAfter70: "", exemptFromSuccession: "", ucRatio: "", annualWithdrawal: "", annualContribution: "", perDeductible: true, perWithdrawal: "", perWithdrawalCapital: "", perWithdrawalInterest: "", perAnticiped: false, beneficiaries: [{ name: "", relation: "autre", share: "100" }] }],
  })), []);
  const updatePlacementStr = useCallback(<K extends Exclude<keyof Placement, "pfuEligible" | "beneficiaries">>(index: number, key: K, value: Placement[K]) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, [key]: value } : p) })), []);
  const updatePlacementBool = useCallback((index: number, value: boolean) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === index ? { ...p, pfuEligible: value } : p) })), []);
  const removePlacement = useCallback((index: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.filter((_, i) => i !== index) })), []);

  const addPlacementBeneficiary = useCallback((placementIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: [...p.beneficiaries, { name: "", relation: "autre", share: "0" }] } : p) })), []);
  const updatePlacementBeneficiary = useCallback((placementIndex: number, bIndex: number, key: keyof Beneficiary, value: string) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.map((b, j) => j === bIndex ? { ...b, [key]: value } : b) } : p) })), []);
  const removePlacementBeneficiary = useCallback((placementIndex: number, bIndex: number) =>
    setData((prev) => ({ ...prev, placements: prev.placements.map((p, i) => i === placementIndex ? { ...p, beneficiaries: p.beneficiaries.filter((_, j) => j !== bIndex) } : p) })), []);

  const importFamilyBeneficiaries = (placementIndex: number) => {
    const family = getFamilyBeneficiaries(data);
    setData((prev) => ({
      ...prev,
      placements: prev.placements.map((p, i) => {
        if (i !== placementIndex) return p;
        const existingKeys = new Set(p.beneficiaries.map((b) => `${b.name}__${b.relation}`));
        const merged = [...p.beneficiaries];
        family.forEach((b) => {
          const key = `${b.name}__${b.relation}`;
          if (!existingKeys.has(key)) { merged.push(b); existingKeys.add(key); }
        });
        return { ...p, beneficiaries: merged };
      }),
    }));
  };

  // ── Calculs mémoïsés ──
  const ir = useMemo(() => computeIR(data, irOptions, concubinPerson), [data, irOptions, concubinPerson]);
  const ifi = useMemo(() => computeIFI(data), [data]);
  const succession = useMemo(() => computeSuccession(successionData, data), [successionData, data]);
  const spouseOptions = useMemo(() => getAvailableSpouseOptions(data, successionData.deceasedPerson), [data, successionData.deceasedPerson]);
  const effectiveSpouseOption = spouseOptions.some((o) => o.value === successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  useEffect(() => {
    if (successionData.spouseOption !== effectiveSpouseOption) {
      setSuccessionData((prev) => ({ ...prev, spouseOption: effectiveSpouseOption }));
    }
  }, [effectiveSpouseOption, successionData.spouseOption]);

  useEffect(() => {
    const id = "ecp-scrollbar-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #e8e0d6 !important; border-radius: 99px; }
      ::-webkit-scrollbar-thumb { background: #26428B !important; border-radius: 99px; border: 2px solid #e8e0d6; transition: background 0.2s; }
      ::-webkit-scrollbar-thumb:hover { background: #1a2e6b !important; }
      ::-webkit-scrollbar-corner { background: #e8e0d6; }
      * { scrollbar-width: thin !important; scrollbar-color: #26428B #e8e0d6 !important; }
      [data-radix-popper-content-wrapper] > * { background: #ffffff !important; }
      [role="listbox"] { background: #ffffff !important; }
      [data-radix-select-content] { background: #ffffff !important; }
      [data-radix-select-viewport] { background: #ffffff !important; }
    `;
    document.head.appendChild(el);
  
    return () => { document.getElementById(id)?.remove(); };
  }, []);


  // ── Composant modal sélection PDF ──
  const PdfModal = ({ open, onClose, sections, setSections, onPrint, title, sectionLabels }: {
    open: boolean; onClose: () => void;
    sections: Record<string, boolean>;
    setSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    onPrint: (s: Record<string, boolean>) => void;
    title: string;
    sectionLabels: { key: string; label: string; always?: boolean }[];
  }) => {
    if (!open) return null;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"#fff", borderRadius:"16px", padding:"28px 32px", minWidth:"360px", maxWidth:"480px", width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }}>
          <div style={{ fontFamily:"'Lato',sans-serif", fontWeight:900, fontSize:"16px", color:"#101B3B", marginBottom:"6px" }}>{title}</div>
          <div style={{ fontSize:"13px", color:"#888", marginBottom:"20px" }}>Sélectionnez les sections à inclure</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>
            {sectionLabels.map(({ key, label, always }) => (
              <label key={key} style={{ display:"flex", alignItems:"center", gap:"10px", cursor: always ? "default" : "pointer", opacity: always ? 0.5 : 1 }}>
                <input type="checkbox" checked={always || sections[key]} disabled={always}
                  onChange={e => setSections(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ width:"16px", height:"16px", accentColor:"#101B3B" }} />
                <span style={{ fontSize:"14px", color:"#333", fontWeight: sections[key] ? 600 : 400 }}>{label}</span>
              </label>
            ))}
          </div>
          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"8px 18px", borderRadius:"8px", border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:"13px", color:"#666" }}>Annuler</button>
            <button onClick={() => { onClose(); onPrint(sections); }} style={{ padding:"8px 22px", borderRadius:"8px", border:"none", background:"#101B3B", cursor:"pointer", fontSize:"13px", color:"#fff", fontWeight:700 }}>
              Générer le PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  const showPdfModal = () => setPdfModalOpen(true);

  const baseReference = useMemo(() => {
    if (baseSnapshot.data && baseSnapshot.irOptions && baseSnapshot.successionData) {
      return {
        ir: computeIR(baseSnapshot.data, baseSnapshot.irOptions),
        ifi: computeIFI(baseSnapshot.data),
        succession: computeSuccession(baseSnapshot.successionData, baseSnapshot.data),
      };
    }
    return {
      ir: computeIR(data, irOptions),
      ifi: computeIFI(data),
      succession: computeSuccession(successionData, data),
    };
  }, [baseSnapshot, data, irOptions, successionData]);

  const hypothesisResults = useMemo(() =>
    hypotheses.map((hypothesis) => {
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


  // ── Succession ──
  const syncCollectedHeirs = () => setSuccessionData((prev) => ({ ...prev, heirs: buildCollectedHeirs(data, successionData.deceasedPerson) }));

  // Membres de la famille disponibles pour le picker
  const getFamilyMembers = () => {
    const members: { firstName: string; lastName: string; birthDate: string; relation: string }[] = [];
    const deceased = successionData.deceasedPerson;
    if (deceased === "person1" && (data.person2FirstName || data.person2LastName)) {
      members.push({ firstName: data.person2FirstName, lastName: data.person2LastName, birthDate: data.person2BirthDate, relation: "conjoint" });
    }
    if (deceased === "person2" && (data.person1FirstName || data.person1LastName)) {
      members.push({ firstName: data.person1FirstName, lastName: data.person1LastName, birthDate: data.person1BirthDate, relation: "conjoint" });
    }
    data.childrenData.forEach((child) => {
      if (child.firstName || child.lastName) {
        const link = child.parentLink || "common_child";
        const isChildOfDeceased =
          link === "common_child" ||
          (link === "person1_only" && deceased === "person1") ||
          (link === "person2_only" && deceased === "person2");
        const relation = isChildOfDeceased ? "enfant" : "enfant_conjoint";
        members.push({ firstName: child.firstName || "", lastName: child.lastName || "", birthDate: child.birthDate || "", relation });
      }
    });
    return members;
  };

  // Ajouter un membre famille dans legs global
  const addFamilyMemberToLegsGlobal = (member: { firstName: string; lastName: string; birthDate: string; relation: string }) => {
    setSuccessionData((prev) => ({
      ...prev,
      testamentHeirs: [...prev.testamentHeirs, { ...member, priorDonations: "0", shareGlobal: "", propertyRight: "full" }],
    }));
  };

  // Ajouter un membre famille dans legs précis
  const addFamilyMemberToLegsPrecis = (member: { firstName: string; lastName: string; birthDate: string; relation: string }, itemIndex?: number) => {
    const newLegataire = { heirName: `${member.firstName} ${member.lastName}`.trim(), heirRelation: member.relation, heirBirthDate: member.birthDate, sharePercent: "100", propertyRight: "full", contreparties: [] };
    setSuccessionData((prev) => {
      const items = [...(prev.legsPrecisItems || [])];
      if (itemIndex !== undefined && items[itemIndex]) {
        // Ajouter le légataire à un bien existant
        items[itemIndex] = { ...items[itemIndex], legataires: [...(items[itemIndex].legataires || []), newLegataire] };
      } else {
        // Créer un nouveau bien avec ce légataire
        items.push({ propertyIndex: 0, assetType: "property" as const, legataires: [newLegataire] });
      }
      return { ...prev, legsPrecisItems: items };
    });
  };

  // Import famille → héritiers testamentaires
  const importFamilyToTestament = () => {
    const deceased = successionData.deceasedPerson;
    const newHeirs: TestamentHeir[] = [];
    // Conjoint survivant
    if (deceased === "person1" && (data.person2FirstName || data.person2LastName)) {
      newHeirs.push({ firstName: data.person2FirstName, lastName: data.person2LastName, birthDate: data.person2BirthDate, relation: "conjoint", priorDonations: "0", shareGlobal: "", propertyRight: "full" });
    }
    if (deceased === "person2" && (data.person1FirstName || data.person1LastName)) {
      newHeirs.push({ firstName: data.person1FirstName, lastName: data.person1LastName, birthDate: data.person1BirthDate, relation: "conjoint", priorDonations: "0", shareGlobal: "", propertyRight: "full" });
    }
    // Enfants — relation déduite du lien de filiation réel
    data.childrenData.forEach((child) => {
      const link = child.parentLink || "common_child";
      // Enfant du défunt (commun ou propre) → "enfant" → abattement 100k, ligne directe
      // Enfant du conjoint seul → "enfant_conjoint" → tiers fiscal 60%, abattement 1594€
      const isChildOfDeceased =
        link === "common_child" ||
        (link === "person1_only" && deceased === "person1") ||
        (link === "person2_only" && deceased === "person2");
      const relation = isChildOfDeceased ? "enfant" : "enfant_conjoint";
      newHeirs.push({
        firstName: child.firstName || "",
        lastName: child.lastName || "",
        birthDate: child.birthDate || "",
        relation,
        priorDonations: "0",
        shareGlobal: "",
        propertyRight: "full",
      });
    });
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: newHeirs, useTestament: true }));
  };

  const addTestamentHeir = () => setSuccessionData((prev) => ({ ...prev, testamentHeirs: [...prev.testamentHeirs, { firstName: "", lastName: "", birthDate: "", relation: "enfant", priorDonations: "0", shareGlobal: "", propertyRight: "full" }] }));
  const updateTestamentHeir = (index: number, key: keyof TestamentHeir, value: string) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === index ? { ...h, [key]: value } : h) }));
  const removeTestamentHeir = (index: number) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.filter((_, i) => i !== index) }));
  const addLegsPrecisItem = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "property" as const, legataires: [] }] }));
  const addLegsPrecisItemFree = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "free" as const, freeLabel: "", freeValue: "", legataires: [] }] }));
  const addLegsPrecisItemResidual = () => setSuccessionData((prev) => ({ ...prev, legsPrecisItems: [...(prev.legsPrecisItems || []), { propertyIndex: 0, assetType: "free" as const, freeLabel: "Reste du patrimoine", freeValue: "", isResidual: true, legataires: [] }] }));
  const updateLegsPrecisItem = (index: number, key: keyof LegsPrecisItem, value: any) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === index ? { ...l, [key]: value } : l) }));
  const removeLegsPrecisItem = (index: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).filter((_, i) => i !== index) }));

  // Helpers légataires (nouvelle structure)
  // Recalcule les parts égales entre légataires (arrondi au centième, dernier absorbe le résidu)
  const rebalanceShares = (legataires: any[]): any[] => {
    const n = legataires.length;
    if (n === 0) return legataires;
    const base = Math.floor(10000 / n) / 100; // ex: 3 légataires → 33.33
    const last = Math.round((100 - base * (n - 1)) * 100) / 100;
    return legataires.map((l, i) => ({ ...l, sharePercent: String(i === n - 1 ? last : base) }));
  };

  const addLegataire = (itemIndex: number, legataire: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => {
      if (i !== itemIndex) return it;
      const newLegs = rebalanceShares([...(it.legataires || []), { ...legataire, sharePercent: "100", propertyRight: "full", contreparties: [] }]);
      return { ...it, legataires: newLegs };
    }) }));
  const updateLegataire = (itemIndex: number, legIndex: number, key: string, value: any) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => li === legIndex ? { ...l, [key]: value } : l) } : it) }));
  const removeLegataire = (itemIndex: number, legIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => {
      if (i !== itemIndex) return it;
      const filtered = (it.legataires || []).filter((_, li) => li !== legIndex);
      return { ...it, legataires: rebalanceShares(filtered) };
    }) }));

  // Contreparties sur légataire
  const rebalanceContreparties = (contreparties: any[]): any[] => {
    const n = contreparties.length;
    if (n === 0) return contreparties;
    const base = Math.floor(10000 / n) / 100;
    const last = Math.round((100 - base * (n - 1)) * 100) / 100;
    return contreparties.map((c, i) => ({ ...c, sharePercent: String(i === n - 1 ? last : base) }));
  };

  const addContrepartieLegataire = (itemIndex: number, legIndex: number, cp: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => {
      if (li !== legIndex) return l;
      const newCps = rebalanceContreparties([...(l.contreparties || []), { ...cp, sharePercent: "100" }]);
      return { ...l, contreparties: newCps };
    }) } : it) }));
  const updateContrepartieLegataire = (itemIndex: number, legIndex: number, cpIndex: number, key: string, value: string) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => li === legIndex ? { ...l, contreparties: (l.contreparties || []).map((c, ci) => ci === cpIndex ? { ...c, [key]: value } : c) } : l) } : it) }));
  const removeContrepartieLegataire = (itemIndex: number, legIndex: number, cpIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((it, i) => i === itemIndex ? { ...it, legataires: (it.legataires || []).map((l, li) => { if (li !== legIndex) return l; const filtered = (l.contreparties || []).filter((_, ci) => ci !== cpIndex); return { ...l, contreparties: rebalanceContreparties(filtered) }; }) } : it) }));
  // Ajouter une contrepartie de démembrement
  const addContrepartie = (itemIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: [...(l.contreparties || []), { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" }] } : l) }));
  const updateContrepartie = (itemIndex: number, cpIndex: number, key: keyof DemembrementContrepartie, value: string) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: (l.contreparties || []).map((c, ci) => ci === cpIndex ? { ...c, [key]: value } : c) } : l) }));
  const removeContrepartie = (itemIndex: number, cpIndex: number) =>
    setSuccessionData((prev) => ({ ...prev, legsPrecisItems: (prev.legsPrecisItems || []).map((l, i) => i === itemIndex ? { ...l, contreparties: (l.contreparties || []).filter((_, ci) => ci !== cpIndex) } : l) }));

  // ── Contreparties legs global (nu-propriétaires liés à un usufruitier) ──
  const addContrepartieGlobal = (heirIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) => {
    setSuccessionData((prev) => {
      const newHeirs = prev.testamentHeirs.map((h, i) => {
        if (i !== heirIndex) return h;
        const existing = ((h as any).contreparties || []) as DemembrementContrepartie[];
        const newCp: DemembrementContrepartie = { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" };
        const updated = [...existing, newCp];
        // Auto-équilibrage : répartir 100% équitablement entre tous les NP liés
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...h, contreparties: balanced };
      });
      return { ...prev, testamentHeirs: newHeirs };
    });
  };
  const updateContrepartieGlobal = (heirIndex: number, cpIndex: number, key: keyof DemembrementContrepartie, value: string) =>
    setSuccessionData((prev) => ({ ...prev, testamentHeirs: prev.testamentHeirs.map((h, i) => i === heirIndex ? { ...h, contreparties: ((h as any).contreparties || []).map((c: any, ci: number) => ci === cpIndex ? { ...c, [key]: value } : c) } : h) }));
  const removeContrepartieGlobal = (heirIndex: number, cpIndex: number) => {
    setSuccessionData((prev) => {
      const newHeirs = prev.testamentHeirs.map((h, i) => {
        if (i !== heirIndex) return h;
        const updated = ((h as any).contreparties || []).filter((_: any, ci: number) => ci !== cpIndex) as DemembrementContrepartie[];
        // Re-équilibrer après suppression
        if (updated.length === 0) return { ...h, contreparties: [] };
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp: any, ci: number) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...h, contreparties: balanced };
      });
      return { ...prev, testamentHeirs: newHeirs };
    });
  };

  // ── Auto-équilibrage quotités legs précis : répartir 100% entre les contreparties d'un item ──
  const addContrepartieWithBalance = (itemIndex: number, membre?: { heirName: string; heirRelation: string; heirBirthDate: string }) => {
    setSuccessionData((prev) => {
      const newItems = (prev.legsPrecisItems || []).map((l, i) => {
        if (i !== itemIndex) return l;
        const existing = l.contreparties || [];
        const newCp: DemembrementContrepartie = { heirName: membre?.heirName || "", heirRelation: membre?.heirRelation || "enfant", heirBirthDate: membre?.heirBirthDate || "", sharePercent: "100" };
        const updated = [...existing, newCp];
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...l, contreparties: balanced };
      });
      return { ...prev, legsPrecisItems: newItems };
    });
  };
  const removeContrepartieWithBalance = (itemIndex: number, cpIndex: number) => {
    setSuccessionData((prev) => {
      const newItems = (prev.legsPrecisItems || []).map((l, i) => {
        if (i !== itemIndex) return l;
        const updated = (l.contreparties || []).filter((_, ci) => ci !== cpIndex);
        if (updated.length === 0) return { ...l, contreparties: [] };
        const equalShare = Math.round(10000 / updated.length) / 100;
        const balanced = updated.map((cp, ci) => ({ ...cp, sharePercent: ci < updated.length - 1 ? String(equalShare) : String(Math.round((100 - equalShare * (updated.length - 1)) * 100) / 100) }));
        return { ...l, contreparties: balanced };
      });
      return { ...prev, legsPrecisItems: newItems };
    });
  };

  // ── Hypothèses ──
  const renameHypothesis = (id: number, name: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, name } : h));
  const updateHypothesisNotes = (id: number, notesValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: notesValue } : h));
  const updateHypothesisObjective = (id: number, objectiveValue: string) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, objective: objectiveValue } : h));
  const saveBaseSnapshot = () =>
    setBaseSnapshot({ savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) });
  const restoreBaseSnapshot = () => {
    if (!baseSnapshot.data || !baseSnapshot.successionData || !baseSnapshot.irOptions) return;
    setData(deepClone(baseSnapshot.data));
    setSuccessionData(deepClone(baseSnapshot.successionData));
    setIrOptions(deepClone(baseSnapshot.irOptions));
  };
  const saveHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, savedAt: new Date().toISOString(), data: deepClone(data), successionData: deepClone(successionData), irOptions: deepClone(irOptions) } : h));
  const loadHypothesis = (id: number) => {
    const selected = hypotheses.find((h) => h.id === id);
    if (!selected?.data || !selected.successionData || !selected.irOptions) return;
    setData(deepClone(selected.data));
    setSuccessionData(deepClone(selected.successionData));
    setIrOptions(deepClone(selected.irOptions));
  };
  const clearHypothesis = (id: number) =>
    setHypotheses((prev) => prev.map((h) => h.id === id ? { ...h, notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null } : h));

  // ── PDF ──
  // ── Sauvegarde client et retour liste ──
  const handleSaveAndClose = () => {
    if (!activeClient) return
    const payload: ClientPayload = {
      clientName, notes, data, irOptions, successionData, hypotheses, baseSnapshot, mission,
    }
    const displayName = [(data as any).person1LastName, (data as any).person1FirstName].filter(Boolean).join(' ') || clientName
    saveClient(activeClient.id, payload as ClientPayload, displayName)
    setActiveClient(null)
  }

  const handleOpenClient = (client: ClientRecord) => {
    const p = client.payload
    if (p.clientName) setClientName(p.clientName as string)
    if (p.notes) setNotes(p.notes as string)
    if (p.data) {
      const d = p.data as any;
      // Migration : nouveaux champs absents des dossiers existants
      d.pensions1 = d.pensions1 ?? "";
      d.pensions2 = d.pensions2 ?? "";
      d.csgDeductibleFoncier = d.csgDeductibleFoncier ?? "";
      d.childrenData = (d.childrenData || []).map((c: any) => ({ schoolLevel: "", ...c }));
      d.properties = (d.properties || []).map((p: any) => {
        const base = { loanInsuranceGuarantees: "dc", loanInsuranceCoverage: "banque", ...p };
        // Migration multi-crédits : convertir ancien loanEnabled → loans[0]
        if (!base.loans || base.loans.length === 0) {
          if (base.loanEnabled && base.loanAmount) {
            base.loans = [{
              id: `loan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
              type: base.loanType || "amortissable", label: "Prêt principal",
              amount: base.loanAmount || "", rate: base.loanRate || "",
              duration: base.loanDuration || "", startDate: base.loanStartDate || "",
              capitalRemaining: base.loanCapitalRemaining || "", interestAnnual: base.loanInterestAnnual || "",
              pledgedPlacementIndex: base.loanPledgedPlacementIndex || "-1",
              insurance: base.loanInsurance || false, insuranceGuarantees: base.loanInsuranceGuarantees || "dc",
              insuranceRate: base.loanInsuranceRate || "", insuranceRate1: base.loanInsuranceRate1 || "",
              insuranceRate2: base.loanInsuranceRate2 || "", insurancePremium: base.loanInsurancePremium || "",
              insuranceCoverage: base.loanInsuranceCoverage || "banque",
            }];
          } else {
            base.loans = [];
          }
        }
        return base;
      });
      setData(d as typeof data);
    }
    if (p.irOptions) setIrOptions(p.irOptions as typeof irOptions)
    if (p.successionData) setSuccessionData(p.successionData as typeof successionData)
    if (p.hypotheses) setHypotheses(p.hypotheses as typeof hypotheses)
    if (p.baseSnapshot) setBaseSnapshot(p.baseSnapshot as typeof baseSnapshot)
    if (p.mission) setMission(p.mission as typeof mission)
    setActiveClient(client)
  }

  const handleCreateClient = (name: string) => {
    const client = createClient(name)
    // Remettre tous les états à zéro pour un nouveau dossier vierge
    setClientName(name)
    setNotes("")
    setData({
      person1FirstName: "", person1LastName: "", person1BirthDate: "", person1JobTitle: "", person1Csp: "", person1PcsGroupe: "5",
      person2FirstName: "", person2LastName: "", person2BirthDate: "", person2JobTitle: "", person2Csp: "", person2PcsGroupe: "5",
      coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
      person1Handicap: false, person2Handicap: false,
      childrenData: [], salary1: "", salary2: "", pensions: "", pensions1: "", pensions2: "", csgDeductibleFoncier: "",
      perDeduction: "", pensionDeductible: "", otherDeductible: "", perRentes: [],
      ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "", chargesDetail1: {...EMPTY_CHARGES_DETAIL},
      ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "", chargesDetail2: {...EMPTY_CHARGES_DETAIL},
      properties: [], placements: [], otherLoans: [],
    })
    setSuccessionData({
      deceasedPerson: "person1", spousePresent: true, spouseOption: "legal_quarter_full",
      useTestament: false, legsMode: "global", heirs: [], testamentHeirs: [], legsPrecisItems: [],
    })
    setIrOptions({
      expenseMode1: "standard", expenseMode2: "standard",
      km1: "", km2: "", cv1: "", cv2: "",
      mealCount1: "", mealCount2: "", mealUnit1: "5.35", mealUnit2: "5.35",
      other1: "", other2: "", foncierRegime: "micro",
    })
    setHypotheses([
      { id: 1, name: "Hypothèse 1", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 2, name: "Hypothèse 2", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
      { id: 3, name: "Hypothèse 3", notes: "", objective: "", savedAt: null, data: null, successionData: null, irOptions: null },
    ])
    setBaseSnapshot({ savedAt: null, data: null, successionData: null, irOptions: null })
    setActiveClient(client)
  }

  // ── PWA Install Prompt ──
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    // Détecter si déjà installée
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setInstallPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setInstallPrompt(null);
    }
  };

  const generatePdf = () => {
    // modal state géré via setPdfModalOpen
    // ── modal state géré en dehors — voir bouton PDF ──
    showPdfModal();
  };

  const buildAndPrintPdf = (sections: Record<string, boolean>) => {
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const dateTimeStr = new Date().toLocaleString("fr-FR");
    const immobilierBrut = data.properties.reduce((s, p) => s + n(p.value), 0);
    const immobilierNet = data.properties.reduce((s, p) => {
      const debt = n(p.loanCapitalRemaining);
      const insurRate = p.loanInsurance ? Math.min(100, Math.max(0, n(p.loanInsuranceRate))) : 0;
      return s + Math.max(0, n(p.value) - Math.max(0, debt * (1 - insurRate / 100)));
    }, 0);
    const placementsTotal = data.placements.reduce((s, p) => s + n(p.value), 0);
    const avTotal = data.placements.filter((p) => isAV(p.type) || isPERType(p.type)).reduce((s, p) => s + n(p.value), 0);
    const patrimoineTotal = immobilierNet + placementsTotal;
    const coupleLabel: Record<string,string> = { married:"Marié(s)", pacs:"Pacsé(s)", cohab:"Concubinage", single:"Célibataire", divorced:"Divorcé(e)", widowed:"Veuf/Veuve" };
    const showIFI = ifi.ifi > 0;
    const clientName2 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || clientName || "Client";
    const logoSrc2 = cabinet.logoSrc || "";

    // ── Helpers ──
    const kpi = (label: string, value: string, sub?: string, accent = false) =>
      `<div class="kpi${accent?" kpi-accent":""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;
    const sec = (title: string, body: string) =>
      `<div class="section"><div class="section-title">${title}</div>${body}</div>`;
    const tbl = (headers: string[], rows: string[][], hl?: number) =>
      `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${i%2===0?"row-even":"row-odd"}">${row.map((cell,j)=>`<td${j===hl?' class="highlight"':""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const pH = (title: string) =>
      `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName2} · ${dateStr}</div></div>`;
    const pF = (label: string) =>
      `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"} · ${label}</span><span>${dateStr}</span></div>`;

    // ── Graphique barres horizontales SVG ──
    const hbar = (items: {label:string;value:number;color:string}[], width=420) => {
      const maxVal = Math.max(...items.map(i=>i.value),1);
      const rowH=28; const lW=140; const bW=width-lW-85; const svgH=items.length*rowH+8;
      return `<svg width="${width}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
        const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
        return `<text x="${lW-8}" y="${y+14}" text-anchor="end" font-size="8" fill="#555" font-family="Lato,sans-serif">${item.label}</text>
        <rect x="${lW}" y="${y+2}" width="${bw}" height="16" rx="4" fill="${item.color}" opacity="0.88"/>
        <text x="${lW+bw+6}" y="${y+14}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
      }).join("")}</svg>`;
    };

    // ── Barre segmentée ──
    const segB = (segs:{label:string;value:number;color:string}[], width=420) => {
      const total=segs.reduce((s,i)=>s+i.value,0); if(total<=0) return "";
      let x=0;
      const rects=segs.map(seg=>{ const w=(seg.value/total)*width;
        const r=`<rect x="${x}" y="0" width="${w}" height="18" fill="${seg.color}"/><text x="${x+w/2}" y="13" text-anchor="middle" font-size="7.5" fill="white" font-family="Lato,sans-serif" font-weight="700">${Math.round(seg.value/total*100)}%</text>`;
        x+=w; return r; }).join("");
      const legend=segs.map((seg,i)=>`<g transform="translate(${i*200},0)"><circle cx="7" cy="7" r="5" fill="${seg.color}"/><text x="16" y="12" font-size="8" fill="#444" font-family="Lato,sans-serif">${seg.label} — ${euro(seg.value)}</text></g>`).join("");
      return `<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="18" rx="4" fill="#e5e7eb"/>${rects}<g transform="translate(0,26)">${legend}</g></svg>`;
    };

    // ── Waterfall IR SVG ──
    const wfall = () => {
      const fraisPro=ir.retainedExpenses||0;
      const perDed=ir.perDeductionCalc||0;
      const autresDed=Math.max(0,(ir.deductibleCharges||0)-perDed);
      const items=[
        {label:"Revenus bruts",value:ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0),color:"#101B3B",type:"add"},
        ...(fraisPro>0?[{label:irOptions.expenseMode1==="actual"||irOptions.expenseMode2==="actual"?"Frais réels":"Abatt. 10%",value:fraisPro,color:"#60a5fa",type:"ded"}]:[]),
        ...(perDed>0?[{label:"Versements PER",value:perDed,color:"#a78bfa",type:"ded"}]:[]),
        ...(autresDed>0?[{label:"Autres déductions",value:autresDed,color:"#86efac",type:"ded"}]:[]),
        {label:"Rev. net imposable",value:ir.revenuNetGlobal,color:"#26428B",type:"total"},
        {label:"IR barème",value:ir.bareme||0,color:"#dc2626",type:"tax"},
        ...(ir.foncierSocialLevy>0?[{label:"Prél. sociaux",value:ir.foncierSocialLevy,color:"#f97316",type:"tax"}]:[]),
        ...(ir.totalPFU>0?[{label:"PFU placements",value:ir.totalPFU,color:"#f97316",type:"tax"}]:[]),
        ...(ir.avRachatImpot>0?[{label:"Fiscalité AV",value:ir.avRachatImpot,color:"#f97316",type:"tax"}]:[]),
        {label:"IR total dû",value:ir.finalIR,color:"#b91c1c",type:"result"},
      ];
      const maxVal=Math.max(...items.map(i=>i.value),1);
      const rowH=26; const lW=140; const bW=260; const svgH=items.length*rowH+8;
      return `<svg width="${lW+bW+90}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
        const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
        const isDed=item.type==="ded"; const isTax=item.type==="tax";
        return `<text x="${lW-6}" y="${y+13}" text-anchor="end" font-size="8" fill="${isDed?"#92400e":isTax?"#c2410c":"#555"}" font-family="Lato,sans-serif">${isDed?"− ":isTax?"+ ":""}${item.label}</text>
        <rect x="${lW}" y="${y+1}" width="${bw}" height="15" rx="3" fill="${item.color}" opacity="${isDed?0.55:0.9}"/>
        <text x="${lW+bw+6}" y="${y+13}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
      }).join("")}</svg>`;
    };

    const activeHypos=hypothesisResults.filter(h=>h.ir&&h.ifi&&h.succession&&h.hypothesis.savedAt);
    const sign=(v:number)=>v>0?"+":"";
    const cls=(v:number)=>Math.abs(v)<1?"neutral":v<0?"pos":"neg";
    const heirRows=succession.results.map(r=>[
      r.name||"—",r.relation,
      euro(r.grossReceived+r.nueRawValue+r.avReceived),
      euro(r.successionTaxable),euro(r.avDuties>0?r.avDuties:0),
      euro(r.duties),`<strong>${euro(r.netReceived)}</strong>`,
    ]);

    // ── CSS commun ──
    const css=`
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Lato','Helvetica Neue',Arial,sans-serif;font-size:9pt;color:#333;background:#fff;}
    .cover{height:100vh;background:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:0;page-break-after:always;position:relative;overflow:hidden;}
    .cover-inner{padding:56px 60px;flex:1;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2;}
    .cover-logo{max-height:52px;max-width:180px;}
    .cover-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 0;}
    .cover-doc-type{font-size:9pt;font-weight:700;color:${cabinet.colorGold};letter-spacing:4px;text-transform:uppercase;margin-bottom:20px;}
    .cover-client{font-size:34pt;font-weight:900;color:${cabinet.colorNavy};line-height:1.05;margin-bottom:10px;}
    .cover-date{font-size:10pt;color:#888;margin-bottom:28px;}
    .cover-bar{width:52px;height:4px;background:${cabinet.colorGold};border-radius:2px;margin-bottom:22px;}
    .cover-tagline{font-size:9.5pt;color:#666;}
    .cover-footer{font-size:7.5pt;color:#aaa;border-top:1px solid #e5e7eb;padding-top:12px;}
    /* formes géométriques cover */
    .cover-shape1{position:absolute;top:-60px;right:-60px;width:320px;height:320px;border-radius:50%;background:${cabinet.colorNavy};opacity:0.06;z-index:1;}
    .cover-shape2{position:absolute;top:40px;right:60px;width:140px;height:140px;border-radius:50%;background:${cabinet.colorGold};opacity:0.12;z-index:1;}
    .cover-shape3{position:absolute;bottom:80px;right:-30px;width:200px;height:200px;background:${cabinet.colorSky};opacity:0.07;transform:rotate(45deg);z-index:1;}
    .cover-shape4{position:absolute;bottom:-40px;left:220px;width:160px;height:160px;border-radius:50%;background:${cabinet.colorGold};opacity:0.08;z-index:1;}
    .cover-shape5{position:absolute;top:0;left:0;width:6px;height:100%;background:linear-gradient(180deg,${cabinet.colorNavy} 0%,${cabinet.colorGold} 100%);z-index:3;}
    .page{padding:34px 42px;page-break-after:always;}
    .page:last-child{page-break-after:auto;}
    .page-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${cabinet.colorGold};padding-bottom:8px;margin-bottom:20px;}
    .page-header-title{font-size:13pt;font-weight:700;color:${cabinet.colorNavy};}
    .page-header-client{font-size:8pt;color:${cabinet.colorSky};font-weight:600;}
    .page-footer{margin-top:20px;border-top:1px solid #e5e0d8;padding-top:7px;font-size:7pt;color:#aaa;display:flex;justify-content:space-between;}
    .section{margin-bottom:18px;}
    .section-title{font-size:9.5pt;font-weight:700;color:${cabinet.colorSky};border-left:3px solid ${cabinet.colorGold};padding-left:8px;margin-bottom:9px;text-transform:uppercase;letter-spacing:0.4px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px;}
    .kpi-grid-3{grid-template-columns:repeat(3,1fr);}
    .kpi-grid-2{grid-template-columns:repeat(2,1fr);}
    .kpi{background:linear-gradient(160deg,${cabinet.colorCream} 0%,#fff8f0 100%);border:1px solid rgba(227,175,100,0.3);border-radius:8px;padding:9px 11px;}
    .kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
    .kpi-value{font-size:13pt;font-weight:700;color:#101B3B;line-height:1;}
    .kpi-sub{font-size:7pt;color:#777;margin-top:2px;}
    .kpi-accent{background:linear-gradient(160deg,${cabinet.colorNavy} 0%,${cabinet.colorSky} 100%);border-color:${cabinet.colorSky};}
    .kpi-accent .kpi-label{color:rgba(255,255,255,0.7);}
    .kpi-accent .kpi-value{color:${cabinet.colorGold};}
    .kpi-accent .kpi-sub{color:rgba(255,255,255,0.5);}
    table{width:100%;border-collapse:collapse;font-size:7.5pt;margin-bottom:4px;}
    th{background:linear-gradient(90deg,rgba(227,175,100,0.18) 0%,rgba(227,175,100,0.06) 100%);text-align:left;padding:5px 7px;font-weight:700;color:${cabinet.colorSky};border-bottom:2px solid rgba(227,175,100,0.35);font-size:7pt;text-transform:uppercase;letter-spacing:0.3px;}
    td{padding:4px 7px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:top;}
    .row-even{background:#fff;} .row-odd{background:rgba(251,236,215,0.14);}
    td.highlight{font-weight:700;color:#101B3B;}
    .graph-box{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:12px 14px;margin-bottom:8px;}
    .graph-title{font-size:7.5pt;font-weight:700;color:${cabinet.colorSky};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:9px;}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px;}
    .info-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 14px;margin-bottom:8px;}
    .info-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.04);}
    .info-row:last-child{border-bottom:none;}
    .info-label{color:#666;font-size:8pt;} .info-value{font-weight:600;color:#101B3B;font-size:8pt;}
    .legal-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 14px;margin-bottom:11px;font-size:8.5pt;line-height:1.6;}
    .legal-title{font-weight:700;color:${cabinet.colorSky};margin-bottom:5px;font-size:9pt;}
    .legal-block ul{padding-left:16px;} .legal-block li{margin-bottom:3px;}
    .demarche-block{border:1px solid rgba(227,175,100,0.22);border-radius:10px;padding:16px;background:linear-gradient(135deg,${cabinet.colorNavy}06 0%,${cabinet.colorGold}0a 100%);}
    .demarche-step{display:flex;align-items:flex-start;gap:11px;margin-bottom:12px;}
    .demarche-step:last-child{margin-bottom:0;}
    .demarche-num{width:26px;height:26px;border-radius:50%;background:${cabinet.colorNavy};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9.5pt;font-weight:700;flex-shrink:0;}
    .demarche-text{font-size:8.5pt;line-height:1.5;} .demarche-text strong{color:${cabinet.colorNavy};}
    .hypo-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.25);border-radius:10px;padding:14px 16px;margin-bottom:14px;}
    .hypo-title{font-size:11pt;font-weight:700;color:${cabinet.colorNavy};margin-bottom:3px;}
    .hypo-notes{font-size:8pt;color:#555;font-style:italic;background:rgba(227,175,100,0.1);padding:5px 9px;border-radius:4px;margin-bottom:9px;border-left:3px solid ${cabinet.colorGold};}
    .hypo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:9px 0;}
    .hypo-kpi{background:#fff;border:1px solid rgba(227,175,100,0.2);border-radius:6px;padding:7px 9px;}
    .hypo-kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;margin-bottom:2px;}
    .hypo-kpi-value{font-size:11pt;font-weight:700;color:#101B3B;}
    .hypo-kpi-delta{font-size:7pt;font-weight:600;margin-top:2px;}
    .pos{color:#16a34a;} .neg{color:#dc2626;} .neutral{color:#888;}
    .notes-box{background:#f8f7f6;border:1px solid rgba(227,175,100,0.2);border-radius:8px;padding:12px 14px;font-size:8.5pt;white-space:pre-wrap;min-height:50px;color:#333;line-height:1.6;}
    .mentions{font-size:7pt;color:#888;line-height:1.5;}
    .besoins-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:11px;}
    .besoin-card{border:1.5px solid ${cabinet.colorNavy};border-radius:8px;padding:11px 13px;}
    .besoin-card-title{font-weight:700;font-size:9pt;text-align:center;margin-bottom:7px;color:${cabinet.colorNavy};}
    .besoin-item{margin-bottom:4px;font-size:8pt;line-height:1.4;display:flex;align-items:flex-start;gap:2px;}
    .profil-card{background:linear-gradient(135deg,${cabinet.colorNavy}08 0%,${cabinet.colorGold}12 100%);border:1px solid rgba(227,175,100,0.25);border-radius:10px;padding:14px;text-align:center;margin-bottom:12px;}
    .profil-badge{display:inline-block;padding:5px 18px;border-radius:20px;font-weight:900;font-size:13pt;color:#fff;margin:7px 0;}
    .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:18px;}
    .sign-box{border:1px dashed #bbb;border-radius:8px;min-height:72px;padding:10px;background:#fafafa;}
    .sign-label{font-weight:700;font-size:8.5pt;margin-bottom:3px;color:${cabinet.colorSky};}
    .sign-check{display:flex;align-items:flex-start;gap:7px;font-size:8.5pt;line-height:1.5;margin-bottom:5px;}
    @media print{
      @page{margin:0.9cm 1.1cm;size:A4;}
      .cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .kpi,.hypo-block,.hypo-kpi,.graph-box,.demarche-block,.besoin-card,.profil-card{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }`;

    // ── Cover SVG géométrique ──
    const makeCover = (docType: string) => `
<div class="cover">
  <div class="cover-shape1"></div>
  <div class="cover-shape2"></div>
  <div class="cover-shape3"></div>
  <div class="cover-shape4"></div>
  <div class="cover-shape5"></div>
  <div class="cover-inner">
    <div>${logoSrc2
      ? `<img src="${logoSrc2}" class="cover-logo" alt="Logo"/>`
      : `<div style="font-size:17pt;font-weight:900;color:${cabinet.colorNavy}">${cabinet.cabinetName||"Ploutos"}</div>`}
    </div>
    <div class="cover-body">
      <div class="cover-doc-type">${docType}</div>
      <div class="cover-client">${clientName2}</div>
      <div class="cover-date">${dateStr}</div>
      <div class="cover-bar"></div>
      <div class="cover-tagline">${docType === "Rapport patrimonial"
        ? "Analyse fiscale · Bilan patrimonial · Succession"
        : "En application des articles L.521-2 et R.521-2 du code des assurances"}</div>
    </div>
    <div class="cover-footer">
      ${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel · Simulation à titre indicatif
    </div>
  </div>
</div>`;

    // ── PAGE PRÉSENTATION CABINET ──
    const pageCabinet = () => `<div class="page">
  ${pH("Notre cabinet & notre démarche")}
  <div class="two-col">
    <div>${sec("À propos",`<div class="info-block">
      ${cabinet.cabinetName?`<div class="info-row"><span class="info-label">Cabinet</span><span class="info-value">${cabinet.cabinetName}</span></div>`:""}
      ${cabinet.orias?`<div class="info-row"><span class="info-label">ORIAS</span><span class="info-value">${cabinet.orias}</span></div>`:""}
      ${cabinet.ville?`<div class="info-row"><span class="info-label">Ville</span><span class="info-value">${cabinet.ville}</span></div>`:""}
      ${cabinet.tel?`<div class="info-row"><span class="info-label">Tél.</span><span class="info-value">${cabinet.tel}</span></div>`:""}
      ${cabinet.email?`<div class="info-row"><span class="info-label">Email</span><span class="info-value">${cabinet.email}</span></div>`:""}
      ${cabinet.conseiller?`<div class="info-row"><span class="info-label">Conseiller</span><span class="info-value">${cabinet.conseiller}</span></div>`:""}
    </div>`)}</div>
    <div>${sec("Objet du document",`<div class="info-block" style="font-size:8.5pt;line-height:1.6;color:#444;">
      <p>Ce rapport patrimonial est établi sur la base des informations que vous nous avez communiquées lors de notre entretien. Il a pour objectif de dresser un état des lieux complet de votre situation patrimoniale et fiscale, d'identifier les opportunités d'optimisation et de vous proposer des pistes adaptées à vos objectifs, votre horizon et votre profil.</p>
      <p style="margin-top:6px;font-size:7.5pt;color:#888;font-style:italic">Document remis à titre indicatif — simulation non contractuelle. Ne constitue pas un conseil en investissement au sens de MIF2, ni un conseil fiscal ou juridique.</p>
    </div>`)}</div>
  </div>
  ${sec("Notre démarche en 5 étapes",`<div class="demarche-block">
    <div class="demarche-step"><div class="demarche-num">1</div><div class="demarche-text"><strong>Collecte</strong> — Recueil de votre situation personnelle, professionnelle, patrimoniale et fiscale.</div></div>
    <div class="demarche-step"><div class="demarche-num">2</div><div class="demarche-text"><strong>Analyse</strong> — Étude de votre patrimoine, revenus et fiscalité actuelle (IR, IFI, succession).</div></div>
    <div class="demarche-step"><div class="demarche-num">3</div><div class="demarche-text"><strong>Optimisation</strong> — Simulation de scénarios pour mesurer l'impact fiscal de différentes stratégies.</div></div>
    <div class="demarche-step"><div class="demarche-num">4</div><div class="demarche-text"><strong>Recommandations</strong> — Propositions adaptées à votre profil, objectifs et horizon de placement.</div></div>
    <div class="demarche-step"><div class="demarche-num">5</div><div class="demarche-text"><strong>Suivi</strong> — Mise à jour régulière en fonction de votre situation et de la législation.</div></div>
  </div>`)}
  ${pF("Rapport confidentiel")}
</div>`;

    // ── PAGE FAMILLE ──
    const pageFamille = () => `<div class="page">
  ${pH("Composition familiale")}
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1FirstName||data.person1LastName?`<div class="info-row"><span class="info-label">Identité</span><span class="info-value">${[data.person1FirstName,data.person1LastName].filter(Boolean).join(" ")}</span></div>`:""}
      ${data.person1BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${data.person1Handicap?`<div class="info-row"><span class="info-label">Handicap</span><span class="info-value" style="color:#dc2626">Oui</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(data.person2FirstName||data.person2LastName)?sec("Personne 2",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${[data.person2FirstName,data.person2LastName].filter(Boolean).join(" ")}</span></div>
      ${data.person2BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${sec("Situation familiale",`<div class="info-block">
    <div class="info-row"><span class="info-label">Statut</span><span class="info-value">${coupleLabel[data.coupleStatus]||data.coupleStatus}</span></div>
    ${data.coupleStatus==="married"?`<div class="info-row"><span class="info-label">Régime</span><span class="info-value">${{communaute_legale:"Communauté légale",separation_biens:"Séparation de biens",communaute_universelle:"Communauté universelle",participation_acquets:"Participation aux acquêts"}[data.matrimonialRegime]||data.matrimonialRegime}</span></div>`:""}
    <div class="info-row"><span class="info-label">Quotient familial</span><span class="info-value">${ir.parts} part(s)</span></div>
    <div class="info-row"><span class="info-label">Enfants</span><span class="info-value">${data.childrenData.length}</span></div>
  </div>`)}
  ${data.childrenData.length>0?sec("Enfants",tbl(
    ["Prénom","Naissance","Lien","Garde","Rattaché","Handicap"],
    data.childrenData.map(c=>[
      c.firstName||"—",
      c.birthDate?new Date(c.birthDate).toLocaleDateString("fr-FR"):"—",
      {common_child:"Commun",person1_only:"P1 seul",person2_only:"P2 seul"}[c.parentLink]||c.parentLink,
      {full:"Pleine",alternate:"Alternée"}[c.custody]||c.custody,
      c.rattached?"Oui":"Non",c.handicap?"Oui":"Non",
    ])
  )):""}
  ${pF("Composition familiale")}
</div>`;

    // ── PAGE TRAVAIL / REVENUS ──
    const pageTravail = () => `<div class="page">
  ${pH("Situation professionnelle & Revenus")}
  <div class="kpi-grid kpi-grid-3">
    ${kpi("Revenus bruts",euro(ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0)))}
    ${kpi("Rev. net imposable",euro(ir.revenuNetGlobal))}
    ${kpi("IR estimé",euro(ir.finalIR),"",true)}
  </div>
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${n(data.salary1)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary1))}</span></div>`:""}
      ${n(data.ca1)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca1))}</span></div>`:""}
      ${n(data.pensions)>0?`<div class="info-row"><span class="info-label">Pensions/retraites</span><span class="info-value">${euro(n(data.pensions))}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(n(data.salary2)>0||n(data.ca2)>0)?sec("Personne 2",`<div class="info-block">
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
      ${n(data.salary2)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary2))}</span></div>`:""}
      ${n(data.ca2)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca2))}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${(ir.retainedExpenses>0||ir.deductibleCharges>0)?sec("Déductions",`<div class="info-block">
    ${ir.retainedExpenses>0?`<div class="info-row"><span class="info-label">${irOptions.expenseMode1==="actual"||irOptions.expenseMode2==="actual"?"Frais réels":"Abattement 10%"}</span><span class="info-value">${euro(ir.retainedExpenses)}</span></div>`:""}
    ${(ir.perDeductionCalc||0)>0?`<div class="info-row"><span class="info-label">PER déductible</span><span class="info-value">${euro(ir.perDeductionCalc||0)}</span></div>`:""}
    ${Math.max(0,(ir.deductibleCharges||0)-(ir.perDeductionCalc||0))>0?`<div class="info-row"><span class="info-label">Autres déductions</span><span class="info-value">${euro(Math.max(0,(ir.deductibleCharges||0)-(ir.perDeductionCalc||0)))}</span></div>`:""}
  </div>`):""}
  ${pF("Situation professionnelle")}
</div>`;

    // ── PAGE BILAN PATRIMONIAL ──
    const pageBilan = () => {
      const patItems=[
        {label:"Immobilier net",value:immobilierNet,color:"#101B3B"},
        {label:"AV / PER",value:avTotal,color:"#26428B"},
        {label:"Autres placements",value:Math.max(0,placementsTotal-avTotal),color:"#E3AF64"},
      ].filter(i=>i.value>0);
      let s2=0; let d2=0;
      for(const p of data.placements){
        const val=n(p.value);
        if(["Livret A","LDDS","LEP","Livret jeune","Compte courant","Compte épargne"].includes(p.type)){s2+=val;}
        else if(p.type==="Assurance-vie fonds euros"){s2+=val;}
        else if(p.type==="Assurance-vie unités de compte"||p.type==="Contrat de capitalisation"){
          const uc=Math.min(100,Math.max(0,n(p.ucRatio)||100));
          d2+=val*uc/100; s2+=val*(100-uc)/100;
        } else{d2+=val;}
      }
      const t2=s2+d2;
      return `<div class="page">
  ${pH("Bilan patrimonial")}
  <div class="kpi-grid">
    ${kpi("Patrimoine total",euro(patrimoineTotal),"",true)}
    ${kpi("Immobilier net",euro(immobilierNet),`${data.properties.length} bien(s)`)}
    ${kpi("Placements",euro(placementsTotal),`AV/PER : ${euro(avTotal)}`)}
    ${kpi("Passif",euro(data.properties.reduce((s,p)=>s+n(p.loanCapitalRemaining),0)),"Crédits immo")}
  </div>
  <div class="two-col">
    ${patItems.length>0?`<div>${sec("Répartition",`<div class="graph-box"><div class="graph-title">Par classe d'actifs</div>${hbar(patItems,240)}</div>`)}</div>`:"<div></div>"}
    ${t2>0?`<div>${sec("Exposition marchés",`<div class="graph-box"><div class="graph-title">Sécurisé vs Dynamique</div>${segB([{label:"Sécurisé",value:s2,color:"#101B3B"},{label:"Dynamique",value:d2,color:"#E3AF64"}],240)}<div style="font-size:7pt;color:#888;margin-top:6px;font-style:italic">Sécurisé : livrets, fonds euros. Dynamique : PEA, CTO, UC.</div></div>`)}</div>`:"<div></div>"}
  </div>
  ${data.properties.length>0?sec("Immobilier",tbl(
    ["Bien","Type","Valeur","Cap. restant","Loyer/an"],
    data.properties.map(p=>[p.name||p.type,p.type,euro(n(p.value)),n(p.loanCapitalRemaining)>0?euro(n(p.loanCapitalRemaining)):"—",n(p.rentGrossAnnual)>0?euro(n(p.rentGrossAnnual)):"—"])
  )):""}
  ${pF("Bilan patrimonial")}
</div>`;
    };

    // ── PAGE IR ──
    const pageIR = () => `<div class="page">
  ${pH("Impôt sur le Revenu")}
  <div class="kpi-grid">
    ${kpi("IR total",euro(ir.finalIR),"",true)}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("Taux moyen",`${((ir.averageRate||0)*100).toFixed(1)}%`)}
    ${kpi("Quotient familial",`${ir.parts} part(s)`,`RNG : ${euro(ir.revenuNetGlobal)}`)}
  </div>
  ${sec("Décomposition du calcul fiscal",`<div class="graph-box"><div class="graph-title">De vos revenus à l'impôt</div>${wfall()}</div>`)}
  ${ir.foncierBrut>0?sec("Revenus fonciers",`<div class="kpi-grid kpi-grid-3">
    ${kpi("Loyers bruts",euro(ir.foncierBrut))}${kpi("Foncier taxable",euro(ir.taxableFonciers))}${kpi("Prél. sociaux",euro(ir.foncierSocialLevy))}
  </div>`):""}
  ${pF("IR — Rapport confidentiel")}
</div>`;

    // ── PAGE IFI ──
    const pageIFI = () => showIFI ? `<div class="page">
  ${pH("Impôt sur la Fortune Immobilière")}
  <div class="kpi-grid">
    ${kpi("Actif net taxable",euro(ifi.netTaxable),"",true)}
    ${kpi("IFI brut",euro(ifi.grossIfi))}
    ${kpi("Décote",euro(ifi.decote))}
    ${kpi("IFI net dû",euro(ifi.ifi),"",true)}
  </div>
  ${ifi.lines&&ifi.lines.length>0?sec("Biens taxables",tbl(
    ["Bien","Type","Valeur brute","Abatt. RP","Dette déd.","Net taxable"],
    ifi.lines.map((l:any)=>[l.name,l.type,euro(l.grossValue),euro(l.residenceAbatement),euro(l.deductibleDebt),euro(l.taxableNet)]),5
  )):""}
  ${pF("IFI — Rapport confidentiel")}
</div>` : "";

    // ── PAGE SUCCESSION ──
    const pageSuccession = () => `<div class="page">
  ${pH("Succession")}
  <div class="kpi-grid">
    ${kpi("Actif successoral net",euro(succession.activeNet||0),"",true)}
    ${kpi("Droits totaux",euro(succession.totalRights||0),"",true)}
    ${kpi("Défunt",succession.deceasedKey==="person1"?[data.person1FirstName,data.person1LastName].filter(Boolean).join(" "):[data.person2FirstName,data.person2LastName].filter(Boolean).join(" "))}
    ${succession.pieData&&succession.pieData.length>0?kpi("Réserve légale",euro(succession.pieData[0]?.value||0)):kpi("Héritiers",`${succession.results.length}`)}
  </div>
  ${succession.receivedPieData&&succession.receivedPieData.length>0?sec("Répartition par héritier",`<div class="graph-box"><div class="graph-title">Montant reçu par héritier</div>${hbar(succession.receivedPieData.map((d:any,i:number)=>({label:d.name||`Héritier ${i+1}`,value:d.value,color:["#101B3B","#26428B","#E3AF64","#8094D4","#C4A882"][i%5]})),420)}</div>`):""}
  ${succession.results.length>0?sec("Détail par héritier",tbl(
    ["Héritier","Lien","Actif reçu","Base taxable","Droits AV","Droits succ.","Net estimé"],
    heirRows,6
  )):""}
  ${pF("Succession — Rapport confidentiel")}
</div>`;

    // ── PAGE HYPOTHÈSES ──
    const pageHypos = () => activeHypos.length>0?`<div class="page">
  ${pH("Scénarios d'optimisation")}
  ${activeHypos.map(h=>{
    const hIR=h.ir!.finalIR; const hIFI=h.ifi!.ifi; const hSucc=h.succession!.totalRights;
    const dIR=hIR-ir.finalIR; const dIFI=hIFI-ifi.ifi; const dSucc=hSucc-succession.totalRights;
    return `<div class="hypo-block">
      <div class="hypo-title">${h.hypothesis.name}</div>
      ${h.hypothesis.objective?`<div style="font-size:8pt;color:#26428B;font-weight:600;margin-bottom:3px">Objectif : ${h.hypothesis.objective}</div>`:""}
      ${h.hypothesis.notes?`<div class="hypo-notes">${h.hypothesis.notes}</div>`:""}
      <div class="hypo-grid">
        <div class="hypo-kpi"><div class="hypo-kpi-label">IR</div><div class="hypo-kpi-value">${euro(hIR)}</div><div class="hypo-kpi-delta ${cls(dIR)}">${sign(dIR)}${euro(dIR)}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">IFI</div><div class="hypo-kpi-value">${euro(hIFI)}</div><div class="hypo-kpi-delta ${cls(dIFI)}">${sign(dIFI)}${euro(dIFI)}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">Succession</div><div class="hypo-kpi-value">${euro(hSucc)}</div><div class="hypo-kpi-delta ${cls(dSucc)}">${sign(dSucc)}${euro(dSucc)}</div></div>
        <div class="hypo-kpi"><div class="hypo-kpi-label">Total fiscal</div><div class="hypo-kpi-value">${euro(hIR+hIFI+hSucc)}</div><div class="hypo-kpi-delta ${cls(dIR+dIFI+dSucc)}">${sign(dIR+dIFI+dSucc)}${euro(dIR+dIFI+dSucc)}</div></div>
      </div>
    </div>`;
  }).join("")}
  ${pF("Scénarios")}
</div>`:"";

    // ── PAGE MENTIONS ──
    const pageMentions = () => `<div class="page">
  ${pH("Notes & Mentions légales")}
  ${sec("Notes du conseiller",`<div class="notes-box">${notes||"Aucune note saisie."}</div>`)}
  ${sec("Mentions légales",`<div class="mentions">
    <p><strong>Nature :</strong> Simulation établie sur la base des informations communiquées. Ne constitue pas un conseil en investissement, juridique ou fiscal.</p><br/>
    <p><strong>Limites :</strong> Calculs basés sur la législation en vigueur à la date d'édition. Situations particulières exclues (Dutreil, SCI, holding, démembrement complexe…).</p><br/>
    <p><strong>Confidentialité :</strong> Document strictement confidentiel. Toute reproduction interdite sans accord préalable.</p><br/>
    <p>Généré le <strong>${dateTimeStr}</strong> par ${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS ${cabinet.orias}`:""}</p>
  </div>`)}
  ${pF("Rapport confidentiel")}
</div>`;

    // ── ASSEMBLAGE RAPPORT ──
    const pages = [
      makeCover("Rapport patrimonial"),
      sections.cabinet ? pageCabinet() : "",
      sections.famille ? pageFamille() : "",
      sections.travail ? pageTravail() : "",
      sections.bilan ? pageBilan() : "",
      sections.ir ? pageIR() : "",
      sections.ifi && showIFI ? pageIFI() : "",
      sections.succession ? pageSuccession() : "",
      sections.hypos && activeHypos.length>0 ? pageHypos() : "",
      sections.mentions ? pageMentions() : "",
    ].filter(Boolean).join("");

    const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport — ${clientName2}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

    const popup=window.open("","_blank","width=900,height=700,scrollbars=yes");
    if(!popup){alert("Autorise les popups pour ce site.");return;}
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(()=>{popup.print();},500);
  };

    const generateMissionPdf = () => { setPdfMissionModalOpen(true); };

  const buildAndPrintMission = (sections: Record<string, boolean>) => {
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const dateTimeStr = new Date().toLocaleString("fr-FR");
    const immobilierNet = data.properties.reduce((s, p) => {
      const debt = n(p.loanCapitalRemaining);
      const insurRate = p.loanInsurance ? Math.min(100, Math.max(0, n(p.loanInsuranceRate))) : 0;
      return s + Math.max(0, n(p.value) - Math.max(0, debt * (1 - insurRate / 100)));
    }, 0);
    const placementsTotal = data.placements.reduce((s, p) => s + n(p.value), 0);
    const avTotal = data.placements.filter((p) => isAV(p.type) || isPERType(p.type)).reduce((s, p) => s + n(p.value), 0);
    const patrimoineTotal = immobilierNet + placementsTotal;
    const coupleLabel: Record<string,string> = { married:"Marié(s)", pacs:"Pacsé(s)", cohab:"Concubinage", single:"Célibataire", divorced:"Divorcé(e)", widowed:"Veuf/Veuve" };
    const showIFI = ifi.ifi > 0;
    const clientName3 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || clientName || "Client";
    const logoSrc3 = cabinet.logoSrc || "";
    const p1n = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ") || "—";
    const p2n = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ") || "—";

    const pts = mission.attitude + mission.reactionBaisse +
      (mission.connaitFondsEuros?1:0)+(mission.investiFondsEuros?1:0)+
      (mission.connaitActions?1:0)+(mission.investiActions?3:0)+
      (mission.connaitOPCVM?1:0)+(mission.investiOPCVM?3:0)+
      (mission.connaitImmo?1:0)+(mission.investiImmo?2:0)+
      (mission.connaitTrackers?1:0)+(mission.investiTrackers?3:0)+
      (mission.connaitStructures?1:0)+(mission.investiStructures?4:0)+
      (mission.reactionPertes||0)+(mission.reactionGains||0)+
      (mission.modeGestion==="pilote"?2:mission.modeGestion==="libre"?4:0)+
      (mission.savoirUCRisque?2:0)+(mission.savoirHorizonUC?2:0)+(mission.savoirRisqueRendement?2:0);
    const profil = pts<=10?"Sécuritaire":pts<=20?"Prudent":pts<=40?"Équilibré":pts<=60?"Dynamique":"Offensif";
    const profilColor = pts<=10?"#22c55e":pts<=20?"#84cc16":pts<=40?"#E3AF64":pts<=60?"#f97316":"#dc2626";

    const cb = (v: boolean) => v
      ? `<span style="display:inline-block;width:12px;height:12px;border:2px solid #26428B;border-radius:2px;background:#26428B;margin-right:5px;vertical-align:middle"></span>`
      : `<span style="display:inline-block;width:12px;height:12px;border:2px solid #bbb;border-radius:2px;margin-right:5px;vertical-align:middle"></span>`;
    const rb = (checked: boolean) => checked
      ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #26428B;background:#26428B;margin-right:5px;vertical-align:middle"></span>`
      : `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #bbb;margin-right:5px;vertical-align:middle"></span>`;

    // Réutilise les mêmes helpers que buildAndPrintPdf mais avec variables locales
    const kpi = (label: string, value: string, sub?: string, accent = false) =>
      `<div class="kpi${accent?" kpi-accent":""}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:""}</div>`;
    const sec = (title: string, body: string) =>
      `<div class="section"><div class="section-title">${title}</div>${body}</div>`;
    const tbl = (headers: string[], rows: string[][], hl?: number) =>
      `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${i%2===0?"row-even":"row-odd"}">${row.map((cell,j)=>`<td${j===hl?' class="highlight"':""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const pH = (title: string) =>
      `<div class="page-header"><div class="page-header-title">${title}</div><div class="page-header-client">${clientName3} · ${dateStr}</div></div>`;
    const pF = (label: string) =>
      `<div class="page-footer"><span>${cabinet.cabinetName||"Ploutos"} · ${label}</span><span>${dateStr}</span></div>`;

    const hbar = (items: {label:string;value:number;color:string}[], width=420) => {
      const maxVal=Math.max(...items.map(i=>i.value),1);
      const rowH=28; const lW=140; const bW=width-lW-85; const svgH=items.length*rowH+8;
      return `<svg width="${width}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
        const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
        return `<text x="${lW-8}" y="${y+14}" text-anchor="end" font-size="8" fill="#555" font-family="Lato,sans-serif">${item.label}</text>
        <rect x="${lW}" y="${y+2}" width="${bw}" height="16" rx="4" fill="${item.color}" opacity="0.88"/>
        <text x="${lW+bw+6}" y="${y+14}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
      }).join("")}</svg>`;
    };

    const segB = (segs:{label:string;value:number;color:string}[], width=420) => {
      const total=segs.reduce((s,i)=>s+i.value,0); if(total<=0) return "";
      let x=0;
      const rects=segs.map(seg=>{ const w=(seg.value/total)*width;
        const r=`<rect x="${x}" y="0" width="${w}" height="18" fill="${seg.color}"/><text x="${x+w/2}" y="13" text-anchor="middle" font-size="7.5" fill="white" font-family="Lato,sans-serif" font-weight="700">${Math.round(seg.value/total*100)}%</text>`;
        x+=w; return r; }).join("");
      const legend=segs.map((seg,i)=>`<g transform="translate(${i*200},0)"><circle cx="7" cy="7" r="5" fill="${seg.color}"/><text x="16" y="12" font-size="8" fill="#444" font-family="Lato,sans-serif">${seg.label} — ${euro(seg.value)}</text></g>`).join("");
      return `<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="18" rx="4" fill="#e5e7eb"/>${rects}<g transform="translate(0,26)">${legend}</g></svg>`;
    };

    const wfall = () => {
      const fraisPro=ir.retainedExpenses||0; const perDed=ir.perDeductionCalc||0;
      const autresDed=Math.max(0,(ir.deductibleCharges||0)-perDed);
      const items=[
        {label:"Revenus bruts",value:ir.salaries+ir.foncierBrut+(ir.taxablePlacements||0),color:"#101B3B",type:"add"},
        ...(fraisPro>0?[{label:irOptions.expenseMode1==="actual"||irOptions.expenseMode2==="actual"?"Frais réels":"Abatt. 10%",value:fraisPro,color:"#60a5fa",type:"ded"}]:[]),
        ...(perDed>0?[{label:"Versements PER",value:perDed,color:"#a78bfa",type:"ded"}]:[]),
        ...(autresDed>0?[{label:"Autres déductions",value:autresDed,color:"#86efac",type:"ded"}]:[]),
        {label:"Rev. net imposable",value:ir.revenuNetGlobal,color:"#26428B",type:"total"},
        {label:"IR barème",value:ir.bareme||0,color:"#dc2626",type:"tax"},
        ...(ir.foncierSocialLevy>0?[{label:"Prél. sociaux",value:ir.foncierSocialLevy,color:"#f97316",type:"tax"}]:[]),
        ...(ir.totalPFU>0?[{label:"PFU placements",value:ir.totalPFU,color:"#f97316",type:"tax"}]:[]),
        ...(ir.avRachatImpot>0?[{label:"Fiscalité AV",value:ir.avRachatImpot,color:"#f97316",type:"tax"}]:[]),
        {label:"IR total dû",value:ir.finalIR,color:"#b91c1c",type:"result"},
      ];
      const maxVal=Math.max(...items.map(i=>i.value),1);
      const rowH=26; const lW=140; const bW=260; const svgH=items.length*rowH+8;
      return `<svg width="${lW+bW+90}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${items.map((item,i)=>{
        const bw=Math.max(2,item.value/maxVal*bW); const y=i*rowH+4;
        const isDed=item.type==="ded"; const isTax=item.type==="tax";
        return `<text x="${lW-6}" y="${y+13}" text-anchor="end" font-size="8" fill="${isDed?"#92400e":isTax?"#c2410c":"#555"}" font-family="Lato,sans-serif">${isDed?"− ":isTax?"+ ":""}${item.label}</text>
        <rect x="${lW}" y="${y+1}" width="${bw}" height="15" rx="3" fill="${item.color}" opacity="${isDed?0.55:0.9}"/>
        <text x="${lW+bw+6}" y="${y+13}" font-size="8" fill="${item.color}" font-family="Lato,sans-serif" font-weight="700">${euro(item.value)}</text>`;
      }).join("")}</svg>`;
    };

    // Jauge profil SVG
    const jaugeSvg = () => {
      const max=80; const pct=Math.min(1,pts/max);
      const cx=120; const cy=100; const r=80;
      const zones=[{c:"#22c55e",f:0,t:0.2},{c:"#84cc16",f:0.2,t:0.4},{c:"#E3AF64",f:0.4,t:0.6},{c:"#f97316",f:0.6,t:0.8},{c:"#dc2626",f:0.8,t:1}];
      const arcPath=(from:number,to:number)=>{
        const a1=Math.PI+from*Math.PI; const a2=Math.PI+to*Math.PI;
        const x1=cx+r*Math.cos(a1); const y1=cy+r*Math.sin(a1);
        const x2=cx+r*Math.cos(a2); const y2=cy+r*Math.sin(a2);
        return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`;
      };
      const angle=Math.PI+pct*Math.PI;
      const nx=cx+r*Math.cos(angle); const ny=cy+r*Math.sin(angle);
      return `<svg width="240" height="115" viewBox="0 0 240 115" xmlns="http://www.w3.org/2000/svg">
        ${zones.map(z=>`<path d="${arcPath(z.f,z.t)}" fill="none" stroke="${z.c}" stroke-width="18" stroke-linecap="butt"/>`).join("")}
        <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#101B3B" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="6" fill="#101B3B"/>
        <text x="${cx}" y="${cy-14}" text-anchor="middle" font-size="18" font-weight="900" fill="#101B3B" font-family="Lato,sans-serif">${pts}</text>
        <text x="${cx}" y="${cy-1}" text-anchor="middle" font-size="9" fill="${profilColor}" font-family="Lato,sans-serif" font-weight="700">${profil}</text>
        <text x="20" y="108" font-size="7" fill="#22c55e" font-family="Lato,sans-serif">Sécuritaire</text>
        <text x="175" y="108" font-size="7" fill="#dc2626" font-family="Lato,sans-serif">Offensif</text>
      </svg>`;
    };

    const heirRows=succession.results.map(r=>[
      r.name||"—",r.relation,
      euro(r.grossReceived+r.nueRawValue+r.avReceived),
      euro(r.successionTaxable),euro(r.avDuties>0?r.avDuties:0),
      euro(r.duties),`<strong>${euro(r.netReceived)}</strong>`,
    ]);

    const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Lato','Helvetica Neue',Arial,sans-serif;font-size:9pt;color:#333;background:#fff;}
    .cover{height:100vh;background:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:0;page-break-after:always;position:relative;overflow:hidden;}
    .cover-inner{padding:52px 58px;flex:1;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2;}
    .cover-logo{max-height:52px;max-width:180px;}
    .cover-body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:36px 0;}
    .cover-doc-type{font-size:9pt;font-weight:700;color:${cabinet.colorGold};letter-spacing:4px;text-transform:uppercase;margin-bottom:20px;}
    .cover-client{font-size:32pt;font-weight:900;color:${cabinet.colorNavy};line-height:1.05;margin-bottom:10px;}
    .cover-date{font-size:10pt;color:#888;margin-bottom:26px;}
    .cover-bar{width:52px;height:4px;background:${cabinet.colorGold};border-radius:2px;margin-bottom:20px;}
    .cover-tagline{font-size:9pt;color:#666;}
    .cover-footer{font-size:7.5pt;color:#aaa;border-top:1px solid #e5e7eb;padding-top:11px;}
    .cover-shape1{position:absolute;top:-60px;right:-60px;width:320px;height:320px;border-radius:50%;background:${cabinet.colorNavy};opacity:0.06;z-index:1;}
    .cover-shape2{position:absolute;top:40px;right:60px;width:140px;height:140px;border-radius:50%;background:${cabinet.colorGold};opacity:0.12;z-index:1;}
    .cover-shape3{position:absolute;bottom:80px;right:-30px;width:200px;height:200px;background:${cabinet.colorSky};opacity:0.07;transform:rotate(45deg);z-index:1;}
    .cover-shape4{position:absolute;bottom:-40px;left:220px;width:160px;height:160px;border-radius:50%;background:${cabinet.colorGold};opacity:0.08;z-index:1;}
    .cover-shape5{position:absolute;top:0;left:0;width:6px;height:100%;background:linear-gradient(180deg,${cabinet.colorNavy} 0%,${cabinet.colorGold} 100%);z-index:3;}
    .page{padding:32px 40px;page-break-after:always;}
    .page:last-child{page-break-after:auto;}
    .page-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${cabinet.colorGold};padding-bottom:8px;margin-bottom:18px;}
    .page-header-title{font-size:13pt;font-weight:700;color:${cabinet.colorNavy};}
    .page-header-client{font-size:8pt;color:${cabinet.colorSky};font-weight:600;}
    .page-footer{margin-top:18px;border-top:1px solid #e5e0d8;padding-top:7px;font-size:7pt;color:#aaa;display:flex;justify-content:space-between;}
    .section{margin-bottom:16px;}
    .section-title{font-size:9.5pt;font-weight:700;color:${cabinet.colorSky};border-left:3px solid ${cabinet.colorGold};padding-left:8px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.4px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
    .kpi-grid-3{grid-template-columns:repeat(3,1fr);}
    .kpi-grid-2{grid-template-columns:repeat(2,1fr);}
    .kpi{background:linear-gradient(160deg,${cabinet.colorCream} 0%,#fff8f0 100%);border:1px solid rgba(227,175,100,0.3);border-radius:8px;padding:8px 10px;}
    .kpi-label{font-size:6.5pt;color:${cabinet.colorSky};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
    .kpi-value{font-size:12pt;font-weight:700;color:#101B3B;line-height:1;}
    .kpi-sub{font-size:7pt;color:#777;margin-top:2px;}
    .kpi-accent{background:linear-gradient(160deg,${cabinet.colorNavy} 0%,${cabinet.colorSky} 100%);border-color:${cabinet.colorSky};}
    .kpi-accent .kpi-label{color:rgba(255,255,255,0.7);} .kpi-accent .kpi-value{color:${cabinet.colorGold};} .kpi-accent .kpi-sub{color:rgba(255,255,255,0.5);}
    table{width:100%;border-collapse:collapse;font-size:7.5pt;margin-bottom:4px;}
    th{background:linear-gradient(90deg,rgba(227,175,100,0.18) 0%,rgba(227,175,100,0.06) 100%);text-align:left;padding:5px 7px;font-weight:700;color:${cabinet.colorSky};border-bottom:2px solid rgba(227,175,100,0.35);font-size:7pt;text-transform:uppercase;}
    td{padding:4px 7px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:top;}
    .row-even{background:#fff;} .row-odd{background:rgba(251,236,215,0.14);}
    td.highlight{font-weight:700;color:#101B3B;}
    .graph-box{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:11px 13px;margin-bottom:7px;}
    .graph-title{font-size:7.5pt;font-weight:700;color:${cabinet.colorSky};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px;}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:9px;}
    .info-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:10px 13px;margin-bottom:7px;}
    .info-row{display:flex;justify-content:space-between;padding:2.5px 0;border-bottom:1px solid rgba(0,0,0,0.04);}
    .info-row:last-child{border-bottom:none;}
    .info-label{color:#666;font-size:8pt;} .info-value{font-weight:600;color:#101B3B;font-size:8pt;}
    .legal-block{background:#f8f7f6;border:1px solid rgba(227,175,100,0.18);border-radius:8px;padding:10px 13px;margin-bottom:10px;font-size:8.5pt;line-height:1.6;}
    .legal-title{font-weight:700;color:${cabinet.colorSky};margin-bottom:4px;font-size:9pt;}
    .legal-block ul{padding-left:15px;} .legal-block li{margin-bottom:2px;}
    .besoins-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;}
    .besoin-card{border:1.5px solid ${cabinet.colorNavy};border-radius:8px;padding:10px 12px;}
    .besoin-card-title{font-weight:700;font-size:8.5pt;text-align:center;margin-bottom:6px;color:${cabinet.colorNavy};}
    .besoin-item{margin-bottom:3px;font-size:8pt;line-height:1.4;display:flex;align-items:flex-start;gap:2px;}
    .profil-card{background:linear-gradient(135deg,${cabinet.colorNavy}08 0%,${cabinet.colorGold}12 100%);border:1px solid rgba(227,175,100,0.25);border-radius:10px;padding:13px;text-align:center;margin-bottom:10px;}
    .profil-badge{display:inline-block;padding:5px 16px;border-radius:20px;font-weight:900;font-size:12pt;color:#fff;margin:6px 0;}
    .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;}
    .sign-box{border:1px dashed #bbb;border-radius:8px;min-height:68px;padding:9px;background:#fafafa;}
    .sign-label{font-weight:700;font-size:8.5pt;margin-bottom:3px;color:${cabinet.colorSky};}
    .sign-check{display:flex;align-items:flex-start;gap:7px;font-size:8.5pt;line-height:1.5;margin-bottom:4px;}
    @media print{
      @page{margin:0.9cm 1.1cm;size:A4;}
      .cover,.besoin-card,.profil-card,.kpi,.graph-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }`;

    // Cover
    const cover = `<div class="cover">
  <div class="cover-shape1"></div><div class="cover-shape2"></div><div class="cover-shape3"></div><div class="cover-shape4"></div><div class="cover-shape5"></div>
  <div class="cover-inner">
    <div>${logoSrc3?`<img src="${logoSrc3}" class="cover-logo" alt="Logo"/>`:
      `<div style="font-size:17pt;font-weight:900;color:${cabinet.colorNavy}">${cabinet.cabinetName||"Ploutos"}</div>`}</div>
    <div class="cover-body">
      <div class="cover-doc-type">Lettre de mission & Fiche Conseil</div>
      <div class="cover-client">${clientName3}</div>
      <div class="cover-date">${dateStr}</div>
      <div class="cover-bar"></div>
      <div class="cover-tagline">En application des articles L.521-2 et R.521-2 du code des assurances</div>
    </div>
    <div class="cover-footer">${cabinet.cabinetName||"Ploutos"}${cabinet.orias?` · ORIAS n° ${cabinet.orias}`:""} · Document confidentiel</div>
  </div>
</div>`;

    // P-LEGAL
    const pageLegal = sections.legal ? `<div class="page">
  ${pH("Informations légales — Fiche de présentation")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:14px;">
    Madame, Monsieur, vous vous apprêtez à lire votre Fiche Information et Conseil, fournie conformément à l'article <strong>L.521-2 du Code des assurances</strong>. Elle contient les informations réglementaires inhérentes à notre qualité d'intermédiaire en assurances ainsi qu'à la nature de notre intervention, et formalise les exigences et besoins que vous nous avez communiqués.
  </p>
  <div class="two-col">
    <div>
      <div class="legal-block">
        <div class="legal-title">Qui sommes-nous ?</div>
        <p>${cabinet.cabinetName||"Le cabinet"}${cabinet.forme?`, ${cabinet.forme}`:""}, est immatriculé${cabinet.forme?.includes("SARL")||cabinet.forme?.includes("SAS")?"e":""} au RCS de ${cabinet.villeRcs||"—"} sous le n° ${cabinet.rcs||"—"} et a son siège social au ${cabinet.adresse||""} ${cabinet.codePostal||""} ${cabinet.ville||""}.</p>
        <p style="margin-top:6px"><strong>${cabinet.cabinetName||"Le cabinet"}</strong> est immatriculé à l'ORIAS (<a href="https://www.orias.fr">www.orias.fr</a>) sous le n° <strong>${cabinet.orias||"—"}</strong> en qualité de Courtier d'assurance.</p>
        <p style="margin-top:6px">L'autorité en charge du contrôle de nos opérations est l'<strong>ACPR</strong> (Autorité de Contrôle Prudentiel et de Résolution), 4 place de Budapest CS 92459, 75436 Paris Cedex 09.</p>
      </div>
      <div class="legal-block">
        <div class="legal-title">Nous contacter</div>
        <ul>
          ${cabinet.tel?`<li>Par téléphone : <strong>${cabinet.tel}</strong></li>`:""}
          ${cabinet.email?`<li>Par email : <strong>${cabinet.email}</strong></li>`:""}
          ${cabinet.adresse?`<li>Par courrier : ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</li>`:""}
        </ul>
      </div>
    </div>
    <div>
      <div class="legal-block">
        <div class="legal-title">Comment exerçons-nous ? (art. L521-2 II 1°b)</div>
        <p>Nous exerçons notre activité selon les dispositions prévues à l'article L521-2, II, 1°, b du Code des Assurances. En ce sens :</p>
        <ul style="margin-top:6px">
          <li>Nous ne sommes soumis à aucune obligation de travailler exclusivement avec une ou plusieurs entreprises d'assurances.</li>
          <li>Notre analyse porte sur les produits proposés par nos partenaires et non sur une analyse exhaustive de tous les produits du marché.</li>
          <li>Notre accompagnement repose sur un <em>contrôle de cohérence</em> : nous vérifions que les garanties et services correspondent aux exigences et besoins exprimés.</li>
        </ul>
        ${cabinet.partenaires?`<p style="margin-top:6px;font-size:7.5pt;color:#666">Partenaires sélectionnés (liste non exhaustive) : ${cabinet.partenaires}. Liste exhaustive disponible sur simple demande.</p>`:""}
      </div>
      <div class="legal-block">
        <div class="legal-title">Responsabilité Civile Professionnelle</div>
        <p>Conformément à la loi, nous disposons d'une RCP couvrant nos activités :</p>
        <ul style="margin-top:4px">
          ${cabinet.rcpAssureur?`<li>Assureur : <strong>${cabinet.rcpAssureur}</strong></li>`:""}
          ${cabinet.rcpContrat?`<li>N° contrat : ${cabinet.rcpContrat}</li>`:""}
        </ul>
        <p style="margin-top:6px;font-size:7.5pt;color:#666">Garanties minimales légales : 1 564 610 € par sinistre et 2 315 610 € par année (arrêté du 29 octobre 2024).</p>
      </div>
      <div class="legal-block">
        <div class="legal-title">Comment sommes-nous rémunérés ?</div>
        <p>Dans le cadre de la commercialisation des produits d'assurance, nous sommes rémunérés par :</p>
        <ul style="margin-top:4px">
          <li>${rb(true)} D'une commission (rémunération incluse dans la prime d'assurance)</li>
          <li>${rb(false)} D'un honoraire payé directement par le souscripteur</li>
          <li>${rb(false)} D'une combinaison des deux</li>
        </ul>
        <p style="margin-top:4px;font-size:7.5pt;color:#666">Notre société n'entretient pas de relation significative de nature capitalistique ou commerciale avec une entreprise d'assurance (art. R.521-1 II).</p>
      </div>
    </div>
  </div>
  ${pF("Lettre de mission — Informations légales")}
</div>` : "";

    // P-FAMILLE
    const pageFamilleMission = sections.famille ? `<div class="page">
  ${pH("Informations client — Composition familiale")}
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${p1n}</span></div>
      ${data.person1BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person1BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"?sec("Personne 2",`<div class="info-block">
      <div class="info-row"><span class="info-label">Identité</span><span class="info-value">${p2n}</span></div>
      ${data.person2BirthDate?`<div class="info-row"><span class="info-label">Naissance</span><span class="info-value">${new Date(data.person2BirthDate).toLocaleDateString("fr-FR")}</span></div>`:""}
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${sec("Situation & obligations fiscales",`<div class="info-block">
    <div class="info-row"><span class="info-label">Statut matrimonial</span><span class="info-value">${coupleLabel[data.coupleStatus]||data.coupleStatus}</span></div>
    ${data.coupleStatus==="married"?`<div class="info-row"><span class="info-label">Régime</span><span class="info-value">${{communaute_legale:"Communauté légale",separation_biens:"Séparation de biens",communaute_universelle:"Communauté universelle",participation_acquets:"Participation aux acquêts"}[data.matrimonialRegime]||data.matrimonialRegime}</span></div>`:""}
    <div class="info-row"><span class="info-label">Enfants</span><span class="info-value">${data.childrenData.length}</span></div>
    <div class="info-row"><span class="info-label">FATCA</span><span class="info-value">${mission.nationaliteUS?"Oui":"Non"}</span></div>
    <div class="info-row"><span class="info-label">PPE</span><span class="info-value">${mission.ppe?"Oui"+( mission.ppeDetails?` — ${mission.ppeDetails}`:""):"Non"}</span></div>
    <div class="info-row"><span class="info-label">Assujetti IFI</span><span class="info-value">${ifi.ifi>0?"Oui":"Non"}</span></div>
  </div>`)}
  ${pF("Lettre de mission")}
</div>` : "";

    // P-TRAVAIL
    const pageTravailMission = sections.travail ? `<div class="page">
  ${pH("Situation professionnelle & Fiscale")}
  <div class="kpi-grid kpi-grid-3">
    ${kpi("Rev. net imposable",euro(ir.revenuNetGlobal))}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("IR estimé",euro(ir.finalIR),"",true)}
  </div>
  <div class="two-col">
    <div>${sec("Personne 1",`<div class="info-block">
      ${data.person1JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person1JobTitle}</span></div>`:""}
      ${n(data.salary1)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary1))}</span></div>`:""}
      ${n(data.ca1)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca1))}</span></div>`:""}
      ${n(data.pensions)>0?`<div class="info-row"><span class="info-label">Pensions</span><span class="info-value">${euro(n(data.pensions))}</span></div>`:""}
    </div>`)}</div>
    <div>${data.coupleStatus!=="single"&&(n(data.salary2)>0||n(data.ca2)>0)?sec("Personne 2",`<div class="info-block">
      ${data.person2JobTitle?`<div class="info-row"><span class="info-label">Profession</span><span class="info-value">${data.person2JobTitle}</span></div>`:""}
      ${n(data.salary2)>0?`<div class="info-row"><span class="info-label">Salaire net</span><span class="info-value">${euro(n(data.salary2))}</span></div>`:""}
      ${n(data.ca2)>0?`<div class="info-row"><span class="info-label">CA / Bénéfices</span><span class="info-value">${euro(n(data.ca2))}</span></div>`:""}
    </div>`):""}</div>
  </div>
  ${pF("Lettre de mission")}
</div>` : "";

    // P-BESOINS
    const pageBesoins = sections.besoins ? `<div class="page">
  ${pH("Besoins & Objectifs patrimoniaux")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:12px;">
    Le recueil de vos besoins et exigences est réalisé dans votre intérêt, conformément à l'article <strong>L.521-4 du Code des assurances</strong>. Ces informations nous permettent de vous fournir un conseil approprié et de vous proposer le(s) produit(s) le(s) plus adapté(s) à votre situation. Les informations fournies doivent être <strong>exactes, sincères et complètes</strong>.
  </p>
  <div class="besoins-grid">
    <div class="besoin-card"><div class="besoin-card-title">Épargne & Investissement</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_valoriser)} Valoriser votre capital</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_projet)} Financer un projet</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_completer)} Compléter vos revenus</div>
      <div class="besoin-item">${cb(mission.besoinEpargne_transmettre)} Préparer la transmission</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Retraite</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_rente)} Rente complémentaire</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_capital)} Capital retraite</div>
      <div class="besoin-item">${cb(mission.besoinRetraite_moderniser)} Optimiser l'épargne retraite</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Prévoyance</div>
      <div class="besoin-item">${cb(mission.besoinPrev_deces)} Garantie décès</div>
      <div class="besoin-item">${cb(mission.besoinPrev_arret)} Arrêt de travail / invalidité</div>
      <div class="besoin-item">${cb(mission.besoinPrev_fraisGen)} Frais généraux pro</div>
    </div>
    <div class="besoin-card"><div class="besoin-card-title">Santé</div>
      <div class="besoin-item">${cb(mission.besoinSante_hospit)} Hospitalisation</div>
      <div class="besoin-item">${cb(mission.besoinSante_depasse)} Dépassements d'honoraires</div>
      <div class="besoin-item">${cb(mission.besoinSante_depenses)} Dépenses non remboursées</div>
      <div class="besoin-item">${cb(mission.besoinSante_surcompl)} Sur-complémentaire</div>
    </div>
  </div>
  ${sec("Horizon de placement",`<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:9pt;">
    <span>${rb(mission.horizon==="0-4")} 0 à 4 ans</span>
    <span>${rb(mission.horizon==="5-8")} 5 à 8 ans</span>
    <span>${rb(mission.horizon==="9-15")} 9 à 15 ans</span>
    <span>${rb(mission.horizon==="15+")} + de 15 ans</span>
  </div>`)}
  ${pF("Besoins & Objectifs")}
</div>` : "";

    // P-BILAN
    const pageBilanM = sections.bilan ? (() => {
      const patItems=[{label:"Immobilier net",value:immobilierNet,color:"#101B3B"},{label:"AV/PER",value:avTotal,color:"#26428B"},{label:"Autres",value:Math.max(0,placementsTotal-avTotal),color:"#E3AF64"}].filter(i=>i.value>0);
      let s2=0; let d2=0;
      for(const p of data.placements){
        const val=n(p.value);
        if(["Livret A","LDDS","LEP","Livret jeune","Compte courant","Compte épargne"].includes(p.type)){s2+=val;}
        else if(p.type==="Assurance-vie fonds euros"){s2+=val;}
        else if(p.type==="Assurance-vie unités de compte"||p.type==="Contrat de capitalisation"){const uc=Math.min(100,Math.max(0,n(p.ucRatio)||100));d2+=val*uc/100;s2+=val*(100-uc)/100;}
        else{d2+=val;}
      }
      const t2=s2+d2;
      return `<div class="page">
  ${pH("Bilan patrimonial")}
  <div class="kpi-grid">
    ${kpi("Patrimoine total",euro(patrimoineTotal),"",true)}
    ${kpi("Immobilier net",euro(immobilierNet))}
    ${kpi("Placements",euro(placementsTotal))}
    ${kpi("Passif",euro(data.properties.reduce((s,p)=>s+n(p.loanCapitalRemaining),0)))}
  </div>
  <div class="two-col">
    ${patItems.length>0?`<div>${sec("Répartition",`<div class="graph-box"><div class="graph-title">Par classe</div>${hbar(patItems,240)}</div>`)}</div>`:"<div></div>"}
    ${t2>0?`<div>${sec("Exposition",`<div class="graph-box"><div class="graph-title">Sécurisé vs Dynamique</div>${segB([{label:"Sécurisé",value:s2,color:"#101B3B"},{label:"Dynamique",value:d2,color:"#E3AF64"}],240)}</div>`)}</div>`:"<div></div>"}
  </div>
  ${data.properties.length>0?sec("Immobilier",tbl(["Bien","Type","Valeur","Cap. restant","Loyer/an"],data.properties.map(p=>[p.name||p.type,p.type,euro(n(p.value)),n(p.loanCapitalRemaining)>0?euro(n(p.loanCapitalRemaining)):"—",n(p.rentGrossAnnual)>0?euro(n(p.rentGrossAnnual)):"—"]))):""}
  ${pF("Bilan patrimonial")}
</div>`;
    })() : "";

    // P-IR
    const pageIRM = sections.ir ? `<div class="page">
  ${pH("Impôt sur le Revenu")}
  <div class="kpi-grid">
    ${kpi("IR total",euro(ir.finalIR),"",true)}
    ${kpi("Taux marginal",`${Math.round((ir.marginalRate||0)*100)}%`)}
    ${kpi("Taux moyen",`${((ir.averageRate||0)*100).toFixed(1)}%`)}
    ${kpi("Quotient familial",`${ir.parts} part(s)`)}
  </div>
  ${sec("Décomposition",`<div class="graph-box"><div class="graph-title">De vos revenus à l'impôt</div>${wfall()}</div>`)}
  ${pF("IR")}
</div>` : "";

    // P-IFI
    const pageIFIM = sections.ifi && showIFI ? `<div class="page">
  ${pH("IFI")}
  <div class="kpi-grid">
    ${kpi("Actif net taxable",euro(ifi.netTaxable),"",true)}
    ${kpi("IFI brut",euro(ifi.grossIfi))}
    ${kpi("Décote",euro(ifi.decote))}
    ${kpi("IFI net",euro(ifi.ifi),"",true)}
  </div>
  ${ifi.lines&&ifi.lines.length>0?sec("Biens",tbl(["Bien","Type","Valeur","Abatt.","Dette","Net taxable"],ifi.lines.map((l:any)=>[l.name,l.type,euro(l.grossValue),euro(l.residenceAbatement),euro(l.deductibleDebt),euro(l.taxableNet)]),5)):""}
  ${pF("IFI")}
</div>` : "";

    // P-SUCCESSION
    const pageSuccM = sections.succession ? `<div class="page">
  ${pH("Succession")}
  <div class="kpi-grid">
    ${kpi("Actif net",euro(succession.activeNet||0),"",true)}
    ${kpi("Droits totaux",euro(succession.totalRights||0),"",true)}
    ${kpi("Défunt",succession.deceasedKey==="person1"?p1n:p2n)}
    ${succession.pieData&&succession.pieData.length>0?kpi("Réserve légale",euro(succession.pieData[0]?.value||0)):kpi("Héritiers",`${succession.results.length}`)}
  </div>
  ${succession.receivedPieData&&succession.receivedPieData.length>0?sec("Répartition",`<div class="graph-box"><div class="graph-title">Par héritier</div>${hbar(succession.receivedPieData.map((d:any,i:number)=>({label:d.name||`H${i+1}`,value:d.value,color:["#101B3B","#26428B","#E3AF64","#8094D4","#C4A882"][i%5]})),420)}</div>`):""}
  ${succession.results.length>0?sec("Détail",tbl(["Héritier","Lien","Actif reçu","Base taxable","Droits AV","Droits succ.","Net estimé"],heirRows,6)):""}
  ${pF("Succession")}
</div>` : "";

    // P-PROFIL
    const pageProfil = sections.profil ? `<div class="page">
  ${pH("Profil investisseur")}
  <p style="font-size:8.5pt;color:#555;line-height:1.6;margin-bottom:12px;">
    Les questions suivantes permettent de déterminer votre profil investisseur afin que le(s) produit(s) que nous vous proposons soit(ent) adapté(s) à votre situation, conformément à la recommandation <strong>ACPR 2024-R-02</strong> relative au recueil des informations pour l'exercice du devoir de conseil (en vigueur au 31 décembre 2025).
  </p>
  <div class="two-col">
    <div>
      <div class="profil-card">
        <div style="font-size:7.5pt;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Score obtenu</div>
        ${jaugeSvg()}
        <div class="profil-badge" style="background:${profilColor}">${profil}</div>
        <div style="font-size:8pt;color:#666;margin-top:3px">Score : ${pts} / 80 pts</div>
      </div>
    </div>
    <div>
      ${sec("Connaissances",`<table>
        <thead><tr><th>Instrument</th><th>Connaît</th><th>A investi</th></tr></thead>
        <tbody>
          <tr class="row-even"><td>Fonds euros</td><td>${cb(mission.connaitFondsEuros)}</td><td>${cb(mission.investiFondsEuros)}</td></tr>
          <tr class="row-odd"><td>Actions</td><td>${cb(mission.connaitActions)}</td><td>${cb(mission.investiActions)}</td></tr>
          <tr class="row-even"><td>OPCVM</td><td>${cb(mission.connaitOPCVM)}</td><td>${cb(mission.investiOPCVM)}</td></tr>
          <tr class="row-odd"><td>Immobilier</td><td>${cb(mission.connaitImmo)}</td><td>${cb(mission.investiImmo)}</td></tr>
          <tr class="row-even"><td>ETF/Trackers</td><td>${cb(mission.connaitTrackers)}</td><td>${cb(mission.investiTrackers)}</td></tr>
          <tr class="row-odd"><td>Structurés</td><td>${cb(mission.connaitStructures)}</td><td>${cb(mission.investiStructures)}</td></tr>
        </tbody>
      </table>`)}
      ${sec("Mode de gestion",`<div style="display:flex;gap:14px;font-size:9pt;margin-top:3px;">
        <span>${rb(mission.modeGestion==="")} Conseillée</span>
        <span>${rb(mission.modeGestion==="pilote")} Pilotée</span>
        <span>${rb(mission.modeGestion==="libre")} Libre</span>
      </div>`)}
    </div>
  </div>
  ${pF("Profil investisseur")}
</div>` : "";

    // P-SIGNATURE
    const pageSign = sections.signature ? `<div class="page">
  ${pH("Signature & Engagements")}
  ${sec("En application de l'article R.521-2 du Code des assurances",`
    <p style="font-size:8.5pt;color:#555;margin-bottom:10px;">Je déclare et reconnais :</p>
    <div class="sign-check">${cb(true)} Avoir reçu et pris connaissance du contenu du présent document d'information et de conseil.</div>
    <div class="sign-check">${cb(true)} Que les renseignements fournis ci-dessus sont complets, sincères et exacts.</div>
    <div class="sign-check">${cb(true)} Avoir reçu une information claire sur les principales caractéristiques du(des) contrat(s) proposé(s) ainsi que sur l'étendue et la définition des risques et des garanties.</div>
    <div class="sign-check">${cb(true)} M'engager à informer ${cabinet.cabinetName||"le cabinet"} de toute modification concernant ma situation personnelle et patrimoniale.</div>
    <div class="sign-check">${cb(true)} Avoir été informé(e) que le refus de compléter tout ou partie du présent document peut limiter les services fournis.</div>
    <div class="sign-check">${cb(true)} Avoir été informé(e) qu'une fausse déclaration ou réticence peut entraîner la nullité du contrat (art. L113-8) ou la majoration de la cotisation (art. L113-9).</div>
    <div class="sign-check">${cb(true)} Avoir été informé(e) de mon droit de rétractation dans les conditions prévues par la réglementation en vigueur.</div>
  `)}
  ${sec("Réclamations, Médiation & RGPD",`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="info-block" style="font-size:8pt;line-height:1.6;">
      <strong style="color:#26428B">En cas de réclamation (art. R.521-1 I)</strong><br/>
      <p style="margin-top:4px">Si votre réclamation porte sur un contrat d'assurance, adressez-vous directement à la compagnie concernée.</p>
      <p style="margin-top:4px">Pour une réclamation relative à nos services :</p>
      ${cabinet.email?`<p>→ Email : ${cabinet.email}</p>`:""}
      ${cabinet.adresse?`<p>→ Courrier : ${cabinet.adresse} ${cabinet.codePostal} ${cabinet.ville}</p>`:""}
      <p style="margin-top:4px;font-size:7.5pt;color:#666">Accusé de réception sous 10 jours ouvrables. Réponse sous 2 mois maximum.</p>
    </div>
    <div class="info-block" style="font-size:8pt;line-height:1.6;">
      <strong style="color:#26428B">Médiation (art. L616-1 et R616-1)</strong><br/>
      ${cabinet.mediateur?`<p style="margin-top:4px">Médiateur retenu : <strong>${cabinet.mediateur}</strong></p>`:""}
      ${cabinet.mediateurUrl?`<p>${cabinet.mediateurUrl}</p>`:""}
      ${cabinet.mediateurAdresse?`<p style="font-size:7.5pt;color:#666">${cabinet.mediateurAdresse}</p>`:""}
      <br/><strong style="color:#26428B">RGPD & Bloctel</strong>
      <p style="margin-top:4px">Vous disposez d'un droit d'accès, rectification, effacement, opposition et portabilité. Contact : ${cabinet.email||"le cabinet"}</p>
      <p style="font-size:7.5pt;color:#666;margin-top:3px">Opposition prospection téléphonique : www.bloctel.gouv.fr</p>
    </div>
  </div>`)}
  ${sec("Suivi périodique de votre situation (art. L522-5 + arrêté juin 2024)",`
    <div class="info-block" style="font-size:8.5pt;line-height:1.6;">
      <p>Conformément à la réglementation en vigueur, votre conseiller s'engage à réviser votre situation et les recommandations formulées <strong>au moins tous les 4 ans</strong> (ou tous les 2 ans si un service de recommandation personnalisée est fourni) pour les contrats d'assurance vie et de capitalisation. Vous serez contacté(e) à cette échéance pour une mise à jour de votre profil et de vos besoins.</p>
    </div>
  `)}
  <div class="sign-grid">
    <div>
      <div class="sign-label">Le client — Lu et approuvé</div>
      <div class="sign-box"></div>
      <div style="font-size:8pt;color:#888;margin-top:3px">${p1n}${data.coupleStatus!=="single"&&p2n!=="—"?` & ${p2n}`:""}</div>
    </div>
    <div>
      <div class="sign-label">Le conseiller — Fait à ${mission.lieuSignature||"—"}</div>
      <div class="sign-box">${cabinet.signatureSrc?`<img src="${cabinet.signatureSrc}" style="max-height:55px;max-width:150px;" alt="Signature"/>`:""}</div>
      <div style="font-size:8pt;color:#888;margin-top:3px">${cabinet.conseiller||cabinet.cabinetName||""} · ${dateStr}</div>
    </div>
  </div>
  ${pF("Lettre de mission")}
</div>` : "";

    const pages = [
      cover, pageLegal, pageFamilleMission, pageTravailMission, pageBesoins,
      pageBilanM, pageIRM, pageIFIM, pageSuccM, pageProfil, pageSign,
    ].filter(Boolean).join("\n");

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Lettre de mission — ${clientName3}</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>${css}</style></head><body>${pages}</body></html>`;

    const popup = window.open("","_blank","width=900,height=700,scrollbars=yes");
    if(!popup){alert("Autorise les popups.");return;}
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(()=>{popup.print();},500);
  };

  
  // ── Export JSON ──
  const exportDataFile = async () => {
    try {
      setExportStatus("");
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const fileName = buildExportFileName(clientName);
      const pickerWindow = window as any;
      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "Fichier Ploutos", accept: { "application/json": [".json"] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setAutoSaveStatus("saved"); setTimeout(() => setAutoSaveStatus("idle"), 2500);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fileName; anchor.rel = "noopener noreferrer"; anchor.style.display = "none";
      document.body.appendChild(anchor); anchor.click();
      window.setTimeout(() => { anchor.parentNode?.removeChild(anchor); window.URL.revokeObjectURL(url); }, 500);
      setAutoSaveStatus("saved"); setTimeout(() => setAutoSaveStatus("idle"), 2500);
    } catch (error) {
      console.error("Export impossible", error);
      const payload = { version: 2, exportedAt: new Date().toISOString(), clientName, notes, data, successionData, irOptions, hypotheses, baseSnapshot };
      const fallbackJson = JSON.stringify(payload, null, 2);
      const fallbackFileName = buildExportFileName(clientName);
      setExportFallbackContent(fallbackJson); setExportFallbackFileName(fallbackFileName); setExportFallbackOpen(true);
      setExportStatus("L'aperçu bloque l'enregistrement direct. Utilise la fenêtre qui s'ouvre.");
    }
  };

  const copyExportFallback = async () => {
    try {
      await navigator.clipboard.writeText(exportFallbackContent);
      setExportStatus(`Contenu copié. Enregistre-le dans un fichier nommé ${exportFallbackFileName}.`);
    } catch { setExportStatus("Copie automatique impossible. Sélectionne le contenu manuellement."); }
  };

  // ── Import JSON ──
  const importDataFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (parsed.clientName !== undefined) setClientName(String(parsed.clientName || "Client"));
        if (parsed.notes !== undefined) setNotes(String(parsed.notes || ""));
        if (parsed.data) setData(parsed.data as PatrimonialData);
        if (parsed.successionData) setSuccessionData(parsed.successionData as SuccessionData);
        if (parsed.irOptions) setIrOptions(parsed.irOptions as IrOptions);
        if (Array.isArray(parsed.hypotheses)) setHypotheses(parsed.hypotheses as Hypothesis[]);
        if (parsed.baseSnapshot) setBaseSnapshot(parsed.baseSnapshot as BaseSnapshot);
      } catch (error) { console.error("Import impossible", error); }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // ── Dashboard admin ──────────────────────────────────────────────────────
  if (showAdmin && isAdmin) {
    return (
      <AdminDashboard
        colorNavy={cabinet.colorNavy || "#101B3B"}
        colorSky={cabinet.colorSky || "#26428B"}
        colorGold={cabinet.colorGold || "#E3AF64"}
        colorCream={cabinet.colorCream || "#FBECD7"}
        onClose={() => setShowAdmin(false)}
      />
    );
  }

  // ── Vérification licence ─────────────────────────────────────────────────
  if (!licence.loading && !licence.isValid && authState === "authenticated") {
    return (
      <LicenceGate
        licence={licence}
        userId={userId}
        onSignOut={onSignOut}
        colorNavy={cabinet.colorNavy || "#101B3B"}
        colorSky={cabinet.colorSky || "#26428B"}
        colorGold={cabinet.colorGold || "#E3AF64"}
        logoSrc={logoSrc}
      />
    );
  }

  // Guard — Client actif

  if (!activeClient) {
    return (
      <ClientManager
        clients={clients}
        syncStatus={syncStatus}
        syncNow={syncNow}
        onOpen={handleOpenClient}
        onCreate={handleCreateClient}
        onDelete={deleteClient}
        onDuplicate={(id) => { const c = duplicateClient(id); if (c) handleOpenClient(c) }}
        onRename={renameClient}
        logoSrc={logoSrc}
        cabinetName={cabinet.nom || cabinet.cabinetName || "Cabinet"}
        colorNavy={cabinet.colorNavy}
        colorGold={cabinet.colorGold}
        colorSky={cabinet.colorSky}
        colorCream={cabinet.colorCream}
        isInstallable={isInstallable}
        onInstall={handleInstallClick}
        onSignOut={onSignOut}
        onAdmin={() => setShowAdmin(true)}
        isAdmin={isAdmin}
        licence={licence}
        userId={userId}
      />
    )
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll" style={{ background: SURFACE.app, scrollbarWidth: "thin", scrollbarColor: "#26428B #e8e0d6", scrollbarGutter: "stable" }}>
      <LicenceBanner
        licence={licence}
        userId={userId}
        colorGold={cabinet.colorGold || "#E3AF64"}
        colorNavy={cabinet.colorNavy || "#101B3B"}
      />
      <div className="mx-auto max-w-7xl p-6 space-y-6">

        {/* ── Header ── */}
        <Card className="overflow-hidden rounded-[28px] border-0 shadow-2xl shadow-slate-300/40">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${CAB.gold} 0%, ${CAB.cream} 55%, #fff7ea 100%)` }} />
          <CardContent className="px-6 py-5 md:px-10 md:py-6" style={{ background: `linear-gradient(135deg, ${CAB.navy} 0%, ${CAB.sky} 38%, ${CAB.blue} 68%, ${CAB.gold} 100%)` }}>
            <div className="flex items-center">
              {/* ── Gauche : navigation ── */}
              <div className="flex flex-1 items-center gap-3">
                <button onClick={handleSaveAndClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  ← Dossiers
                </button>
                {isAdmin && (
                  <button onClick={() => setShowAdmin(true)} style={{ background: "rgba(227,175,100,0.25)", border: "1px solid rgba(227,175,100,0.5)", borderRadius: "10px", padding: "6px 14px", color: "#E3AF64", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    ⚙ Admin
                  </button>
                )}
                <button onClick={() => { handleSaveAndClose(); onSignOut(); }} style={{ background: "rgba(255,255,255,0.10)", border: "none", borderRadius: "10px", padding: "6px 14px", color: "rgba(255,255,255,0.7)", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Déconnexion
                </button>
              </div>

              {/* ── Centre : logo cabinet (ou Ploutos par défaut) ── */}
              <div className="flex flex-1 justify-center">
                <img
                  src={logoSrc || DEFAULT_LOGO_SRC}
                  alt="Logo cabinet"
                  className="h-16 w-auto object-contain drop-shadow-md"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LOGO_SRC; }}
                />
              </div>

              {/* ── Droite : client + actions ── */}
              <div className="flex flex-1 items-center justify-end gap-3">
                <HelpMenu
                  colorNavy={CAB.navy}
                  colorGold={CAB.gold}
                  colorSky={CAB.sky}
                  cabinetName={cabinet.cabinetName || "Conseiller"}
                  appVersion="web"
                />
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-9 w-48 rounded-xl border-0 bg-white/95 text-sm shadow-md shadow-slate-950/10"
                  placeholder="Dossier"
                />

                {/* Bouton Sauvegarder — icône seule avec indicateur superposé */}
                <div className="relative" title="Sauvegarder">
                  <button
                    onClick={() => { void exportDataFile(); }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-0 bg-white/90 shadow-sm hover:bg-white transition-colors"
                    style={{ color: "#101B3B" }}
                  >
                    {autoSaveStatus === "saving" ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : autoSaveStatus === "saved" ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Bouton Charger — icône seule */}
                <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-0 bg-white/90 shadow-sm hover:bg-white transition-colors" title="Charger" style={{ color: "#101B3B" }}>
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="application/json" className="hidden" onChange={importDataFile} />
                </label>

                <Button className="h-9 rounded-xl px-4 text-sm font-medium shadow-md" style={{ background: BRAND.gold, color: BRAND.navy }} onClick={() => setPdfModalOpen(true)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />PDF Rapport
                </Button>
                <Button className="h-9 rounded-xl px-4 text-sm font-medium shadow-md" style={{ background: BRAND.navy, color: "#fff" }} onClick={generateMissionPdf}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />PDF Mission
                </Button>
              </div>
            </div>
            {exportStatus && <div className="mt-2 text-xs text-white/70">{exportStatus}</div>}
          </CardContent>
        </Card>

        {/* ── Dialog détail charges professionnelles ── */}
        <Dialog open={chargesDialogOpen !== null} onOpenChange={(o) => { if (!o) setChargesDialogOpen(null); }}>
          <DialogContent className="max-w-lg rounded-2xl" style={{ background: SURFACE.card }}>
            <DialogHeader>
              <DialogTitle style={{ color: BRAND.navy }}>
                Charges professionnelles — {chargesDialogOpen === 1 ? person1 : person2}
              </DialogTitle>
            </DialogHeader>
            {chargesDialogOpen !== null && (() => {
              const who = chargesDialogOpen as 1 | 2;
              const detail: ChargesDetail = ((who === 1 ? data.chargesDetail1 : data.chargesDetail2) as ChargesDetail) || EMPTY_CHARGES_DETAIL;
              const total = sumChargesDetail(detail);
              const lignes: { key: keyof ChargesDetail; label: string; placeholder: string }[] = [
                { key: "loyer",        label: "Loyer / bureau",                  placeholder: "ex. 3 600" },
                { key: "materiel",     label: "Matériel & équipements",          placeholder: "ex. 2 500" },
                { key: "deplacements", label: "Déplacements (km, transport)",    placeholder: "ex. 1 800" },
                { key: "repas",        label: "Repas professionnels",            placeholder: "ex. 600" },
                { key: "tns",          label: "Cotisations TNS (URSSAF, retraite…)", placeholder: "ex. 8 000" },
                { key: "bancaires",    label: "Frais bancaires",                 placeholder: "ex. 250" },
                { key: "comptable",    label: "Honoraires comptable",            placeholder: "ex. 1 200" },
                { key: "autres",       label: "Autres charges",                  placeholder: "ex. 500" },
              ];
              return (
                <div className="space-y-4">
                  {/* Import PDF */}
                  <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "rgba(81,106,199,0.06)", border: "1px solid rgba(81,106,199,0.15)" }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: BRAND.navy }}>Importer un bilan / compte de résultat</div>
                      <div className="text-xs text-slate-400 mt-0.5">PDF — extraction automatique des charges par Claude</div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setChargesPdfLoading(true);
                          try {
                            // Lire le PDF en base64
                            const base64 = await new Promise<string>((res, rej) => {
                              const reader = new FileReader();
                              reader.onload = () => res((reader.result as string).split(",")[1]);
                              reader.onerror = rej;
                              reader.readAsDataURL(file);
                            });
                            // Appel API Claude — clé injectée par vite.config.ts
                            const apiKey = (typeof __ANTHROPIC_KEY__ !== "undefined" ? __ANTHROPIC_KEY__ : "") as string;
                            if (!apiKey) {
                              alert("Clé API Anthropic non configurée. Contactez l'administrateur.");
                              setChargesPdfLoading(false);
                              return;
                            }
                            const response = await fetch("https://api.anthropic.com/v1/messages", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "x-api-key": apiKey,
                                "anthropic-version": "2023-06-01",
                                "anthropic-dangerous-direct-browser-access": "true",
                              },
                              body: JSON.stringify({
                                model: "claude-haiku-4-5",
                                max_tokens: 1000,
                                messages: [{
                                  role: "user",
                                  content: [
                                    {
                                      type: "document",
                                      source: { type: "base64", media_type: "application/pdf", data: base64 }
                                    },
                                    {
                                      type: "text",
                                      text: `Tu es expert-comptable. Analyse ce document fiscal (bilan, compte de résultat, liasse 2035, 2031 ou relevé URSSAF) et extrais les charges professionnelles annuelles déductibles.

Mappe chaque poste dans ces 8 catégories. Réponds UNIQUEMENT avec un objet JSON valide, sans commentaire, sans markdown :
{
  "loyer": 0,
  "materiel": 0,
  "deplacements": 0,
  "repas": 0,
  "tns": 0,
  "bancaires": 0,
  "comptable": 0,
  "autres": 0
}

Règles de mapping :
- loyer : loyers, charges locatives, location bureaux/locaux (2035 case BT, BU)
- materiel : achats matériel, équipements, fournitures, amortissements, petit outillage (2035 case BN, BO, amort.)
- deplacements : frais kilométriques, transports, déplacements professionnels (2035 case BV, BW)
- repas : frais de repas, restauration professionnelle (2035 case BX)
- tns : cotisations URSSAF, retraite obligatoire, prévoyance TNS, charges sociales personnelles (2035 case BZ, ou ligne FG du CR)
- bancaires : frais bancaires, agios, commissions bancaires
- comptable : honoraires expert-comptable, avocat, conseil, AGA (2035 case BQ honoraires rétrocédés exclus)
- autres : toutes autres charges déductibles non classées ci-dessus (2035 case CA)

Si c'est une 2035 BNC : utilise les cases BQ à CA.
Si c'est un compte de résultat SARL : utilise les lignes FF (salaires → ignorer), FG (charges sociales → tns), FD (autres charges → ventiler).
Mets 0 si la catégorie n'est pas trouvée. Arrondis à l'euro. Ne jamais inclure les salaires versés à des employés.`
                                    }
                                  ]
                                }]
                              })
                            });
                            const data_resp = await response.json();
                            if (!response.ok) {
                              const apiError = data_resp.error?.message || JSON.stringify(data_resp);
                              throw new Error(`API ${response.status} : ${apiError}`);
                            }
                            const text = data_resp.content?.map((b: any) => b.text || "").join("") || "";
                            const clean = text.replace(/```json|```/g, "").trim();
                            const parsed = JSON.parse(clean) as Partial<ChargesDetail>;
                            // Appliquer les valeurs extraites
                            (Object.keys(parsed) as (keyof ChargesDetail)[]).forEach((k) => {
                              const v = (parsed[k] as any);
                              if (v && Number(v) > 0) setChargesDetailField(who, k, String(Math.round(Number(v))));
                            });
                          } catch (err) {
                            console.error("Extraction PDF échouée :", err);
                            const msg = err instanceof Error ? err.message : String(err);
                            alert(`Extraction échouée : ${msg}\n\nSaisissez les montants manuellement.`);
                          } finally {
                            setChargesPdfLoading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <div
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
                        style={{ background: chargesPdfLoading ? "#e2e8f0" : BRAND.navy, color: "#fff", cursor: chargesPdfLoading ? "wait" : "pointer" }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {chargesPdfLoading ? "Analyse en cours…" : "Importer PDF"}
                      </div>
                    </label>
                  </div>

                  {/* Lignes par nature */}
                  <div className="space-y-2">
                    {lignes.map(({ key, label, placeholder }) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="flex-1 text-xs text-slate-600" style={{ minWidth: 0 }}>{label}</label>
                        <div className="relative" style={{ width: 130 }}>
                          <Input
                            value={detail[key] || ""}
                            onChange={(e) => setChargesDetailField(who, key, e.target.value)}
                            placeholder={placeholder}
                            className="rounded-xl h-8 text-sm text-right pr-6"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.navy }}>
                    <span className="text-xs font-semibold text-white">Total charges déductibles</span>
                    <span className="text-sm font-bold text-white">{total.toLocaleString("fr-FR")} €</span>
                  </div>

                  {/* Bouton fermer */}
                  <button
                    onClick={() => setChargesDialogOpen(null)}
                    className="w-full rounded-xl py-2 text-sm font-medium transition-colors"
                    style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}
                  >
                    Fermer
                  </button>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ── Dialogue export fallback ── */}
        <Dialog open={exportFallbackOpen} onOpenChange={setExportFallbackOpen}>
          <DialogContent className="max-w-4xl rounded-2xl">
            <DialogHeader><DialogTitle style={{ color: BRAND.navy }}>Sauvegarde manuelle des données</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                L'aperçu bloque l'enregistrement direct. Copie le contenu ci-dessous et enregistre-le dans un fichier nommé <strong>{exportFallbackFileName}</strong>.
              </div>
              <Button className="rounded-xl" style={{ background: BRAND.navy }} onClick={() => { void copyExportFallback(); }}>Copier le contenu</Button>
              <Textarea value={exportFallbackContent} readOnly className="min-h-[420px] rounded-xl font-mono text-xs" />
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Navigation ── */}
        <Tabs defaultValue="collecte" className="space-y-6">
          <div className="flex gap-2" style={{ alignItems: "stretch" }}>
            <TabsList className="flex-1 grid grid-cols-6 rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              {(["collecte", "ir", "ifi", "succession", "hypotheses", "rapport"] as const).map((tab) => {
                const labels: Record<string, string> = { collecte: "Collecte patrimoniale", ir: "Impôt sur le revenu", ifi: "IFI", succession: "Succession", hypotheses: "Hypothèses", rapport: "Rapport client" };
                return (
                  <TabsTrigger key={tab} value={tab} className="flex items-center justify-center rounded-xl border border-transparent px-4 text-center text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                    {labels[tab]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="mission" className="flex items-center justify-center rounded-xl border border-transparent px-4 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                📋 Mission
              </TabsTrigger>
            </TabsList>
            <TabsList className="rounded-2xl p-1 shadow-lg" style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(10px)", height: "52px" }}>
              <TabsTrigger value="parametres" title="Paramètres cabinet" className="flex items-center justify-center rounded-xl border border-transparent px-3 text-slate-700 transition-all data-[state=active]:border-white/10 data-[state=active]:bg-[#26428B] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{ height: "100%" }}>
                <Settings className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ════ COLLECTE ════ */}
          <TabsContent value="collecte" className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={Database} title="Collecte patrimoniale" subtitle="Données familiales, travail, revenus, immobilier et placements." /></CardHeader>
              <CardContent>
                <Tabs defaultValue="famille" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-6 rounded-2xl p-1 shadow-sm" style={{ background: `linear-gradient(90deg, ${BRAND.cream} 0%, rgba(255,255,255,0.95) 100%)` }}>
                    {["famille", "travail", "revenus", "immobilier", "placements", "credits"].map((tab) => {
                      const labels: Record<string, string> = { famille: "Données familiales", travail: "Travail", revenus: "Revenus", immobilier: "Immobilier", placements: "Placements", credits: "Crédits" };
                      return <TabsTrigger key={tab} value={tab} className="rounded-xl border border-transparent px-3 py-2 text-slate-700 transition-all data-[state=active]:bg-[#516AC7] data-[state=active]:text-white data-[state=active]:shadow-md">{labels[tab]}</TabsTrigger>;
                    })}
                  </TabsList>
                  <TabFamiliale data={data} setField={setField} addChild={addChild} updateChild={updateChild} removeChild={removeChild} person1={person1} person2={person2} />
                  <TabTravail data={data} setField={setField} setChargesDetailField={setChargesDetailField} chargesDialogOpen={chargesDialogOpen} setChargesDialogOpen={setChargesDialogOpen} irOptions={irOptions} setIrOptions={setIrOptions} ir={ir} person1={person1} person2={person2} />
                  <TabRevenus data={data} setField={setField} setData={setData} setChargesDialogOpen={setChargesDialogOpen} irOptions={irOptions} setIrOptions={setIrOptions} ir={ir} person1={person1} person2={person2} />
                  <TabImmobilier data={data} setField={setField} addProperty={addProperty} updateProperty={updateProperty} removeProperty={removeProperty} addLoan={addLoan} updateLoan={updateLoan} removeLoan={removeLoan} loanModalIndex={loanModalIndex} setLoanModalIndex={setLoanModalIndex} ownerOptions={ownerOptions} person1={person1} person2={person2} />
                  <TabPlacements data={data} placementFamily={placementFamily} setPlacementFamily={setPlacementFamily} addPlacement={addPlacement} updatePlacementStr={updatePlacementStr} updatePlacementBool={updatePlacementBool} removePlacement={removePlacement} addPlacementBeneficiary={addPlacementBeneficiary} updatePlacementBeneficiary={updatePlacementBeneficiary} removePlacementBeneficiary={removePlacementBeneficiary} importFamilyBeneficiaries={importFamilyBeneficiaries} setField={setField} setData={setData} ownerOptions={ownerOptions} ir={ir} irOptions={irOptions} person1={person1} person2={person2} />
                  <TabCredits data={data} setField={setField} setData={setData} person1={person1} person2={person2} />
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ IR ════ */}
          <TabIR data={data} ir={ir} irOptions={irOptions} setIrOptions={setIrOptions} concubinPerson={concubinPerson} setConcubinPerson={setConcubinPerson} setChargesDialogOpen={setChargesDialogOpen} person1={person1} person2={person2} />

          {/* ════ IFI ════ */}
          <TabIFI data={data} ifi={ifi} person1={person1} person2={person2} />

          {/* ════ SUCCESSION ════ */}
          <TabSuccession
            data={data} successionData={successionData} setSuccessionData={setSuccessionData}
            succession={succession} syncCollectedHeirs={syncCollectedHeirs} getFamilyMembers={getFamilyMembers}
            importFamilyToTestament={importFamilyToTestament}
            addTestamentHeir={addTestamentHeir} updateTestamentHeir={updateTestamentHeir} removeTestamentHeir={removeTestamentHeir}
            addLegsPrecisItem={addLegsPrecisItem} addLegsPrecisItemFree={addLegsPrecisItemFree} addLegsPrecisItemResidual={addLegsPrecisItemResidual}
            updateLegsPrecisItem={updateLegsPrecisItem} removeLegsPrecisItem={removeLegsPrecisItem}
            addLegataire={addLegataire} updateLegataire={updateLegataire} removeLegataire={removeLegataire}
            addContrepartieLegataire={addContrepartieLegataire} updateContrepartieLegataire={updateContrepartieLegataire} removeContrepartieLegataire={removeContrepartieLegataire}
            addContrepartie={addContrepartie} updateContrepartie={updateContrepartie} removeContrepartie={removeContrepartie}
            addContrepartieGlobal={addContrepartieGlobal} updateContrepartieGlobal={updateContrepartieGlobal} removeContrepartieGlobal={removeContrepartieGlobal}
            addContrepartieWithBalance={addContrepartieWithBalance} removeContrepartieWithBalance={removeContrepartieWithBalance}
            legsPickerOpen={legsPickerOpen} setLegsPickerOpen={setLegsPickerOpen}
            addFamilyMemberToLegsGlobal={addFamilyMemberToLegsGlobal} addFamilyMemberToLegsPrecis={addFamilyMemberToLegsPrecis}
            loanModalIndex={loanModalIndex} setLoanModalIndex={setLoanModalIndex}
            addLoan={addLoan} updateLoan={updateLoan} removeLoan={removeLoan}
            effectiveSpouseOption={effectiveSpouseOption} spouseOptions={spouseOptions}
            person1={person1} person2={person2}
          />

          {/* ════ HYPOTHÈSES ════ */}
          <TabHypotheses
            data={data} irOptions={irOptions} successionData={successionData}
            hypotheses={hypotheses} baseSnapshot={baseSnapshot}
            ir={ir} ifi={ifi} succession={succession} baseReference={baseReference}
            renameHypothesis={renameHypothesis} updateHypothesisNotes={updateHypothesisNotes}
            updateHypothesisObjective={updateHypothesisObjective}
            saveBaseSnapshot={saveBaseSnapshot} restoreBaseSnapshot={restoreBaseSnapshot}
            saveHypothesis={saveHypothesis} loadHypothesis={loadHypothesis} clearHypothesis={clearHypothesis}
            person1={person1} person2={person2}
          />

          {/* ════ RAPPORT ════ */}
          <TabsContent value="rapport">
            <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
              <CardHeader><SectionTitle icon={FileText} title="Rapport client" subtitle="Synthèse exportable en PDF." /></CardHeader>
              <CardContent className="space-y-6">
                <Field label="Notes de synthèse">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl min-h-[160px]" />
                </Field>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="IR estimé" value={euro(ir.finalIR)} />
                  <MetricCard label="IFI estimé" value={euro(ifi.ifi)} />
                  <MetricCard label="Droits succession" value={euro(succession.totalRights)} />
                  <MetricCard label="Actif successoral net" value={euro(succession.activeNet)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ LETTRE DE MISSION ════ */}
          <TabMission data={data} mission={mission} updateMission={updateMission} cabinet={cabinet} logoSrc={logoSrc} signatureSrc={signatureSrc} showPdfMissionModal={() => setPdfMissionModalOpen(true)} person1={person1} person2={person2} />

          {/* ════ PARAMÈTRES CABINET ════ */}
          <TabParametres
            cabinet={cabinet} updateCabinet={updateCabinet}
            logoSrc={logoSrc} setLogoSrc={setLogoSrc}
            signatureSrc={signatureSrc} setSignatureSrc={setSignatureSrc}
            handleLogoUpload={handleLogoUpload} handleSignatureUpload={handleSignatureUpload}
          />
        </Tabs>
      </div>

      {/* ── Modal PDF Rapport ── */}
      <PdfModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        sections={pdfSections}
        setSections={setPdfSections}
        onPrint={buildAndPrintPdf}
        title="Rapport patrimonial"
        sectionLabels={[
          { key:"cabinet", label:"Présentation cabinet & démarche" },
          { key:"famille", label:"Composition familiale" },
          { key:"travail", label:"Situation professionnelle" },
          { key:"bilan", label:"Bilan patrimonial" },
          { key:"ir", label:"Impôt sur le Revenu (IR)" },
          { key:"ifi", label:`IFI${ifi.ifi <= 0 ? " (non assujetti — désactivé)" : ""}`, always: ifi.ifi <= 0 ? false : false },
          { key:"succession", label:"Succession" },
          { key:"hypos", label:"Scénarios d'optimisation" },
          { key:"mentions", label:"Notes & Mentions légales" },
        ]}
      />
      {/* ── Modal PDF Mission ── */}
      <PdfModal
        open={pdfMissionModalOpen}
        onClose={() => setPdfMissionModalOpen(false)}
        sections={pdfMissionSections}
        setSections={setPdfMissionSections}
        onPrint={buildAndPrintMission}
        title="Lettre de mission"
        sectionLabels={[
          { key:"legal", label:"Informations légales cabinet" },
          { key:"famille", label:"Composition familiale & obligations fiscales" },
          { key:"travail", label:"Situation professionnelle" },
          { key:"besoins", label:"Besoins & Objectifs" },
          { key:"bilan", label:"Bilan patrimonial" },
          { key:"ir", label:"IR — Décomposition fiscale" },
          { key:"ifi", label:`IFI${ifi.ifi <= 0 ? " (non assujetti)" : ""}` },
          { key:"succession", label:"Succession" },
          { key:"profil", label:"Profil investisseur" },
          { key:"signature", label:"Signature & Engagements" },
        ]}
      />
      <LoanModal
        loanModalIndex={loanModalIndex}
        setLoanModalIndex={setLoanModalIndex}
        data={data}
        addLoan={addLoan}
        updateLoan={updateLoan}
        removeLoan={removeLoan}
        person1={person1}
        person2={person2}
      />
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const [showTransition, setShowTransition] = useState(false);
  const [authExiting, setAuthExiting] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(true);
  const prevAuthState = React.useRef<string>("");

  useEffect(() => {
    if (prevAuthState.current !== "authenticated" && auth.authState === "authenticated") {
      setAuthExiting(true);
      setTimeout(() => {
        setAuthExiting(false);
        setShowAuthScreen(false);
        setShowTransition(true);
      }, 460);
    }
    if (auth.authState === "unauthenticated" || auth.authState === "expired" || auth.isPasswordRecovery) {
      setShowAuthScreen(true);
      setShowTransition(false);
      setAuthExiting(false);
    }
    prevAuthState.current = auth.authState;
  }, [auth.authState, auth.isPasswordRecovery]);

  // ── Migration Vision EcoPat → Ploutos (s'exécute une seule fois) ──
  useEffect(() => {
    // NOTE : migration cabinet déjà faite en synchrone au niveau module (migrateLegacyStorageSync)
    // Ici : migration des autres clés (clients, last_verified)

    // Clés clients
    Object.keys(localStorage)
      .filter(k => k.startsWith("ecopatrimoine_clients_"))
      .forEach(oldKey => {
        const newKey = oldKey.replace("ecopatrimoine_clients_", "ploutos_clients_");
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey)!);
          localStorage.removeItem(oldKey);
        }
      });
    // Clé last_verified
    const oldVerified = localStorage.getItem("ecopatrimoine_last_verified");
    if (oldVerified && !localStorage.getItem("ploutos_last_verified")) {
      localStorage.setItem("ploutos_last_verified", oldVerified);
      localStorage.removeItem("ecopatrimoine_last_verified");
    }
  }, []);

  // Cabinet raw lu tôt pour les couleurs de la transition (disponible avant userId)
  // Lecture anticipée pour les couleurs de transition — cherche dans toutes les clés cabinet
  const cabinetRawEarly = (() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("ploutos_cabinet_") && k.length > "ploutos_cabinet_".length);
      if (keys.length > 0) return JSON.parse(localStorage.getItem(keys[0]) || "{}");
      return JSON.parse(localStorage.getItem("ploutos_cabinet") || "{}");
    } catch { return {}; }
  })();

  // Écran de chargement pendant la vérification de session
  if (auth.authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#26428B] border-t-transparent animate-spin" />
          <div className="text-slate-400 text-sm">Vérification de la session...</div>
        </div>
      </div>
    );
  }

  if (showAuthScreen) {
    return (
      <div style={{
        opacity: authExiting ? 0 : 1,
        transform: authExiting ? "scale(1.06)" : "scale(1)",
        transition: authExiting
          ? "opacity 420ms cubic-bezier(0.4,0,0.2,1), transform 460ms cubic-bezier(0.4,0,0.2,1)"
          : "none",
      }}>
        <AuthGate
          authHook={auth}
          logoSrc={DEFAULT_LOGO_SRC}
          colorNavy={"#101B3B"}
          colorGold={"#E3AF64"}
          colorSky={"#26428B"}
          colorCream={"#FBECD7"}
        />
      </div>
    );
  }

  // Mode grace (hors-ligne mais session récente) ou authentifié → accès à l'app
  // En mode grace, auth.user est null → on récupère le userId depuis le localStorage
  const resolveUserId = (): string => {
    if (auth.user?.id) return auth.user.id;
    if (auth.authState === "grace") {
      // Chercher la clé clients la plus récente pour retrouver le userId
      try {
        const key = Object.keys(localStorage)
          .filter(k => k.startsWith("ploutos_clients_") && k.length > "ploutos_clients_".length)
          .sort((a, b) => {
            // Préférer la clé avec le plus de données
            return (localStorage.getItem(b) ?? "").length - (localStorage.getItem(a) ?? "").length;
          })[0];
        if (key) return key.replace("ploutos_clients_", "");
      } catch { /* ignore */ }
    }
    return "";
  };
  const userId = resolveUserId();

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#26428B] border-t-transparent animate-spin" />
          <div className="text-slate-400 text-sm">Chargement du profil...</div>
        </div>
      </div>
    );
  }

  const cabinetRaw = (() => { try { return JSON.parse(localStorage.getItem(getCabinetKey(userId)) || localStorage.getItem("ploutos_cabinet") || "{}"); } catch { return {}; } })();

  if (showTransition) {
    return (
      <LoginTransition
        onComplete={() => setShowTransition(false)}
        colorNavy={cabinetRaw.colorNavy || "#101B3B"}
        colorGold={cabinetRaw.colorGold || "#E3AF64"}
        colorSky={cabinetRaw.colorSky || "#26428B"}
        soundSrc="/sounds/login.mp3"
        logoSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUxIiBoZWlnaHQ9IjI3NiIgdmlld0JveD0iMCAwIDI1MSAyNzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xNjdfMTA0KSI+CjxwYXRoIGQ9Ik0xMDAuMjMgMjIwLjA4Qzg5LjAyMDEgMjIwLjA4IDc5LjYzMDEgMjE0Ljg3IDc0LjQ2MDEgMjA1Ljc5QzY1LjcxMDEgMTkwLjQxIDc0LjYzMDEgMTc3LjI4IDgxLjgwMDEgMTY2LjcyQzg2Ljk2MDEgMTU5LjEyIDkyLjgxMDEgMTUwLjUxIDk1LjkwMDEgMTM4LjU3Qzk3LjgwMDEgMTMxLjIyIDk3LjY0MDEgMTE3LjYxIDk2LjA4MDEgMTE5LjgyQzkzLjE0MDEgMTIzLjk4IDg3LjY2MDEgMTMxLjczIDc3LjMwMDEgMTMxLjczQzc0LjgzMDEgMTMxLjczIDcyLjM2MDEgMTMxLjI1IDY5Ljk1MDEgMTMwLjMxQzYyLjcyMDEgMTI3LjQ4IDU4Ljg0MDEgMTE5LjYxIDYwLjk4MDEgMTEyLjE2QzY0Ljc2MDEgOTkuMDIwMSA3NC44MDAxIDY0LjEyIDExMC43NyA2NC4wM0MxMTAuNzcgNjQuMDMgMjA2LjUgNjMuOCAyMDYuNTEgNjMuOEMyMTIuMjggNjMuOCAyMTcuNyA2Ny4xMTAxIDIyMC4yNCA3Mi42OTAxQzIyMS4yIDc0Ljc5MDEgMjIxLjU2IDc3LjEyMDEgMjIxLjU0IDc5LjQzTDIyMS4zNCA5OC4xN0MyMjEuMjUgMTA2LjMyIDIxNC42OSAxMTIuOTEgMjA2LjU0IDExMy4wNEwxOTAuMiAxMTMuMjlDMTg5Ljg0IDExMy4yOSAxODkuNTUgMTEzLjU3IDE4OS41MyAxMTMuOTNMMTg3LjAyIDE1Mi4xOEMxODYuNzQgMTU2LjUxIDE4OC45NiAxNjEuMTYgMTkwLjY3IDE1OC45OUMxOTMuODIgMTU0Ljk5IDE5OC43OSAxNTIuNiAyMDMuOTYgMTUyLjZDMjA5LjkyIDE1Mi42IDIxNS40IDE1NS42NyAyMTguNjEgMTYwLjgyQzIyNS4yMiAxNzEuNDEgMjE5LjYgMTg2LjA0IDIxMy45NiAxOTcuNjFDMjA3LjA1IDIxMS43NyAxOTMuMTMgMjIwLjIzIDE3Ni43MSAyMjAuMjNDMTc2LjcxIDIyMC4yMyAxMDIuMzkgMjIwLjEgMTAwLjI0IDIyMC4xTDEwMC4yMyAyMjAuMDhaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0xNTYuNDkgMTAxLjM1QzE0Ny4yNSA5OS41OSAxMzguOTUgMTAwLjUyIDEyOS42NCAxMDAuODVDMTI3LjYyIDEyNi41OSAxMjUuOTEgMTY4LjU1IDExNy4zNSAxOTAuOTFDMTE1LjIxIDE5Ni41IDExMC45NyAyMDAuNDUgMTA2LjMxIDIwMS4yNEMxMDAgMjAyLjMxIDkzLjcxIDIwMC45NiA5MC40NiAxOTUuMjVDODMuMTUgMTgyLjQxIDEwNC41NiAxNzEuNTggMTEyLjEzIDE0Mi4zMUMxMTUuNjUgMTI4LjcgMTE3LjIyIDExNS4zOSAxMTguMTIgMTAxLjI4Qzg2LjAzIDk1LjMyIDg4LjU3IDEyMS40NSA3OS4wMyAxMTcuNzJDODQuMDMgMTAwLjMzIDkxLjkxIDgyLjU3IDExMi40NiA4Mi41MkwyMDIuOSA4Mi4zTDIwMi43IDEwMC40MkwxNzMuNTcgMTAwLjg2TDE3MC4zIDE1MC42N0MxNjkuNzggMTU4LjUyIDE2OS44NiAxNjYuNSAxNzIuMTMgMTc0LjAyQzE3NC4wMyAxODAuMzIgMTgwLjQ2IDE4Mi4zNCAxODYuMyAxODEuODdDMTk3LjU0IDE4MC45NiAxOTguNjcgMTY2LjcyIDE5OC44OSAxNjcuNjNDMTk4LjI4IDE2NS4xMiAyMDkuNSAxNjMuMDIgMTk3LjE3IDE4OC4zMUMxOTIuNzQgMTk3LjM5IDE4NC4yMSAyMDEuODQgMTc0LjMgMjAxLjdDMTU5Ljk5IDIwMS41MSAxNTAuMzcgMTkxIDE1MC42NCAxNzYuNEMxNTEuMDkgMTUxLjY1IDE1NC41MSAxMjcuODcgMTU2LjUxIDEwMS4zNkwxNTYuNDkgMTAxLjM1WiIgZmlsbD0iI0Y4RjZGNyIvPgo8cGF0aCBkPSJNMTE0Ljk5IDI2Mi45OEM4NC4wNCAyNTcuMSA1Ni43NiAyNDAuMTkgMzcuNjggMjE0Ljg2QzE3LjM0IDE4Ny44NyA4LjczMDAyIDE1NC41NyAxMy40MyAxMjEuMUMxOC4xMyA4Ny42MyAzNS41OSA1OCA2Mi41OCAzNy42NUM4OC4zMSAxOC4yNiAxMTkuNzcgOS41Mzk5NiAxNTEuNjUgMTIuODRDMTUzLjIxIDEzIDE1NC43OCAxMy4xOCAxNTYuMzQgMTMuNEMxODkuODEgMTguMSAyMTkuNDQgMzUuNTYgMjM5Ljc5IDYyLjU1TDI0Ny43MiA1Ni41OEMyMjUuMDQgMjYuNDkgMTkyLjMxIDguNDI5OTYgMTU3LjczIDMuNTY5OTZDMTU2LjE3IDMuMzQ5OTYgMTU0LjYxIDMuMTY5OTYgMTUzLjA0IDIuOTk5OTZDMTE5Ljg2IC0wLjUwMDA0NSA4NS4zNCA4LjA2OTk2IDU2LjYgMjkuNzJDLTMuNTg5OTggNzUuMDggLTE1LjYxIDE2MC42NCAyOS43NCAyMjAuODNDNTEuMDcgMjQ5LjE0IDgxLjMxIDI2Ni43OCAxMTMuNjEgMjcyLjgyTDExNC45OCAyNjIuOThIMTE0Ljk5WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNNDAuNyAyMzYuODRDMzYuMTQgMjMyLjI4IDMxLjg4IDIyNy4zOCAyNy45NSAyMjIuMTdDNS42NjAwMSAxOTIuNTkgLTMuNzc5OTkgMTU2LjA5IDEuMzgwMDEgMTE5LjRDNi41MzAwMSA4Mi43MSAyNS42NyA1MC4yMyA1NS4yNSAyNy45M0M4My40MSA2LjcyMDAxIDExOC4yMSAtMi45Mjk5OSAxNTMuMjYgMC43ODAwMTRDMTU1LjA3IDAuOTcwMDE0IDE1Ni41OSAxLjE1MDAxIDE1OC4wMyAxLjM2MDAxQzE5NC43MiA2LjUyMDAxIDIyNy4yIDI1LjY1IDI0OS41IDU1LjI0TDI1MC44NSA1Ny4wM0wyMzkuMzUgNjUuN0wyMzggNjMuOTFDMjE4LjAyIDM3LjQgMTg4LjkxIDIwLjI1IDE1Ni4wMyAxNS42M0MxNTQuNjUgMTUuNDQgMTUzLjE0IDE1LjI1IDE1MS40MiAxNS4wOEMxMjAuMTUgMTEuODQgODkuMDggMjAuNSA2My45MyAzOS40NUMzNy40MiA1OS40MyAyMC4yNyA4OC41NCAxNS42NSAxMjEuNDJDMTEuMDMgMTU0LjMgMTkuNDkgMTg3LjAxIDM5LjQ3IDIxMy41MkM1OC4xIDIzOC4yNCA4NS4wNyAyNTUuMDMgMTE1LjQxIDI2MC43OUwxMTcuNTEgMjYxLjE5TDExNS41MiAyNzUuNDZMMTEzLjIxIDI3NS4wM0M4NS41MyAyNjkuODUgNjAuMzcgMjU2LjUxIDQwLjcxIDIzNi44Nkw0MC43IDIzNi44NFpNMjMzLjQ1IDQzLjU4QzIxMi45OSAyMy4xMiAxODYuNTcgOS44OTAwMSAxNTcuNCA1Ljc5MDAxQzE1Ni4wMSA1LjYwMDAxIDE1NC41NSA1LjQyMDAxIDE1Mi43OSA1LjIzMDAxQzExOC44NyAxLjY1MDAxIDg1LjE5IDEwLjk4IDU3Ljk1IDMxLjUxQzI5LjMyIDUzLjA5IDEwLjggODQuNTIgNS44MTAwMSAxMjAuMDJDMC44MjAwMDkgMTU1LjUyIDkuOTUwMDEgMTkwLjg0IDMxLjUzIDIxOS40N0M1MS4yNiAyNDUuNjUgNzkuNjYgMjYzLjU4IDExMS43MiAyNzAuMTVMMTEyLjQ3IDI2NC43NUM4MS44OCAyNTguNDIgNTQuNzUgMjQxLjIzIDM1Ljg4IDIxNi4xOUMxNS4xOCAxODguNzIgNi40MjAwMSAxNTQuODMgMTEuMiAxMjAuNzdDMTUuOTkgODYuNzEgMzMuNzUgNTYuNTUgNjEuMjIgMzUuODVDODcuMjggMTYuMjEgMTE5LjQ3IDcuMjUwMDEgMTUxLjg3IDEwLjZDMTUzLjY1IDEwLjc4IDE1NS4yMSAxMC45NyAxNTYuNjUgMTEuMTdDMTg5Ljk3IDE1Ljg1IDIxOS41NiAzMi45NSAyNDAuMjEgNTkuNDJMMjQ0LjU2IDU2LjE0QzI0MS4wOSA1MS42OSAyMzcuMzggNDcuNSAyMzMuNDYgNDMuNTdMMjMzLjQ1IDQzLjU4WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMjA2LjczIDQ5LjQ5OTlDMjE5LjI4OSA0OS40OTk5IDIyOS40NyAzOS4zMTg5IDIyOS40NyAyNi43NTk5QzIyOS40NyAxNC4yMDA5IDIxOS4yODkgNC4wMTk5IDIwNi43MyA0LjAxOTlDMTk0LjE3MSA0LjAxOTkgMTgzLjk5IDE0LjIwMDkgMTgzLjk5IDI2Ljc1OTlDMTgzLjk5IDM5LjMxODkgMTk0LjE3MSA0OS40OTk5IDIwNi43MyA0OS40OTk5WiIgZmlsbD0iI0UzQUY2NCIvPgo8cGF0aCBkPSJNMjI0LjI2IDkuMTk5OTVMMjE3LjkyIDE1LjUzOTlDMjIxLjQ4IDE5LjA5OTkgMjIzLjEyIDIzLjk4OTkgMjIyLjQyIDI4Ljk1OTlDMjIxLjIgMzcuNjA5OSAyMTMuMTcgNDMuNjYgMjA0LjUyIDQyLjQ1QzIwMS4wOCA0MS45NyAxOTcuOTggNDAuNDE5OSAxOTUuNTMgMzcuOTc5OUMxOTEuOTcgMzQuNDE5OSAxOTAuMzMgMjkuNTI5OSAxOTEuMDMgMjQuNTQ5OUMxOTIuMjUgMTUuODk5OSAyMDAuMjggOS44NDk5NSAyMDguOTMgMTEuMDU5OUMyMTIuMzcgMTEuNTM5OSAyMTUuNDcgMTMuMDg5OSAyMTcuOTIgMTUuNTI5OUwyMjQuMjYgOS4xODk5NU0yMjQuMjYgOS4xOTk5NUMyMjAuNTggNS41MTk5NSAyMTUuNzMgMi45Njk5NSAyMTAuMTggMi4xODk5NUMxOTYuNjEgMC4yNzk5NDkgMTg0LjA2IDkuNzM5OTUgMTgyLjE2IDIzLjMwOTlDMTgxLjAzIDMxLjMzOTkgMTgzLjg4IDM5IDE4OS4yIDQ0LjMyQzE5Mi44OCA0OCAxOTcuNzMgNTAuNTUgMjAzLjI4IDUxLjMzQzIxNi44NSA1My4yNCAyMjkuNCA0My43Nzk5IDIzMS4zIDMwLjIwOTlDMjMyLjQzIDIyLjE3OTkgMjI5LjU4IDE0LjUxOTkgMjI0LjI2IDkuMTk5OTVaIiBmaWxsPSIjMTAxQjNCIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTY3XzEwNCI+CjxyZWN0IHdpZHRoPSIyNTAuODUiIGhlaWdodD0iMjc1LjQ1IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo="
      />
    );
  }

  return <AppInner userId={userId} userEmail={auth.user?.email ?? ""} authState={auth.authState} onSignOut={auth.signOut} />;
}
