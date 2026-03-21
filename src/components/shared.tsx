import React from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LabelList, Cell
} from "recharts";
import { BRAND, SURFACE, CHART_COLORS } from "../constants";
import { euro } from "../lib/calculs/utils";
import type { FilledBracket, DifferenceLine } from "../types/patrimoine";

export function HelpTooltip({ text }: { text: string }) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const show = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    }
  };
  const hide = () => setPos(null);

  return (
    <span className="inline-flex items-center" style={{ verticalAlign: "middle" }}>
      <button type="button" ref={btnRef}
        onMouseEnter={show} onMouseLeave={hide}
        onFocus={show} onBlur={hide}
        className="inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors ml-1"
        style={{ width: 15, height: 15, background: "rgba(38,66,139,0.13)", color: "#26428B", border: "1px solid rgba(38,66,139,0.25)", cursor: "help", flexShrink: 0 }}
        tabIndex={-1} aria-label="Aide">?</button>
      {pos && typeof document !== "undefined" && createPortal(
        <span style={{
          position: "fixed",
          left: pos.x,
          top: pos.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#1a2d6b",
          color: "#f0f4ff",
          padding: "8px 12px",
          borderRadius: 12,
          fontSize: 12,
          lineHeight: 1.5,
          minWidth: 200,
          maxWidth: 280,
          pointerEvents: "none",
          whiteSpace: "normal",
          zIndex: 99999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          {text}
          <span style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#1a2d6b", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
        </span>,
        document.body
      )}
    </span>
  );
}

export function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold tracking-wide flex items-center gap-0.5" style={{ color: BRAND.sky }}>
        {label}{tooltip && <HelpTooltip text={tooltip} />}
      </Label>
      {children}
    </div>
  );
}

export function MoneyField({ label, value, onChange, compact, tooltip }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; compact?: boolean; tooltip?: string }) {
  return (
    <Field label={label} tooltip={tooltip}>
      <Input value={value || ""} onChange={onChange}
        className={compact ? "rounded-xl h-8 text-sm border shadow-sm transition-all focus-visible:ring-2" : "rounded-2xl border shadow-sm transition-all focus-visible:ring-2"}
        style={{ background: SURFACE.input, borderColor: SURFACE.inputBorder }}
        inputMode="decimal" />
    </Field>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

export function BracketFillChart({ title, data, referenceValue, valueLabel }: {
  title: string; data: FilledBracket[]; referenceValue: number; valueLabel: string;
}) {
  const chartData = data.map((item, index) => ({
    label: item.label, filled: Math.round(item.filled), tax: Math.round(item.tax),
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
              <XAxis dataKey="label" /><YAxis />
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

export function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
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

export function DifferenceBadge({ impact }: { impact: DifferenceLine["impact"] }) {
  if (impact === "up") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Hausse</span>;
  if (impact === "down") return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Baisse</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Modification</span>;
}
