// LOT 10c — Acte 2 : constats COMPRESSÉS. Une ligne par constat (pastille sévérité +
// titre + montant) ; clic -> dépliage de la piste détaillée (detail + action +
// référence conservés intégralement, mêmes textes que BlocConstats).
import React, { useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import type { Constat } from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";
import { COULEURS_SEVERITE, LIBELLE_AXE, renderDetail } from "./constatsSeverite";

const fmtEuro = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;

function LigneConstat({ c }: { c: Constat }) {
  const [open, setOpen] = useState(false);
  const coul = COULEURS_SEVERITE[c.severite];
  const Icone = coul.icone;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${coul.border}`, background: SURFACE.card }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A67F32]"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <Icone className="h-4 w-4 shrink-0" style={{ color: coul.texte }} aria-hidden="true" />
        <span className="text-sm font-semibold min-w-0 flex-1" style={{ color: BRAND.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titre}</span>
        {c.impactChiffre && <span className="text-xs font-bold shrink-0" style={{ color: coul.texte }}>{fmtEuro(c.impactChiffre.montant)}</span>}
        <span className="shrink-0" style={{ color: BRAND.muted }} aria-hidden="true">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t text-sm" style={{ borderColor: SURFACE.border }}>
          <div className="text-xs mb-1.5" style={{ color: BRAND.muted }}>{LIBELLE_AXE[c.axe] ?? c.axe} · {coul.label}</div>
          <div className="leading-relaxed mb-2" style={{ color: BRAND.navy }}>{renderDetail(c.detail)}</div>
          <div className="flex items-start gap-1" style={{ color: BRAND.sky, fontWeight: 600 }}>
            <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" /> {c.action}
          </div>
          {c.impactChiffre && (
            <div className="mt-2 inline-block rounded-lg px-2 py-1 text-xs font-bold" style={{ background: coul.bg, color: coul.texte }}>
              {c.impactChiffre.libelle} : {fmtEuro(c.impactChiffre.montant)}
            </div>
          )}
          {c.reference && (
            <div className="text-xs mt-2" style={{ color: BRAND.muted, fontStyle: "italic" }}>Référence : {c.reference}</div>
          )}
        </div>
      )}
    </div>
  );
}

export const BlocConstatsCompacts = React.memo(function BlocConstatsCompacts({ constats }: { constats: Constat[] }) {
  if (constats.length === 0) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}`, color: BRAND.muted }}>
        Aucun constat à signaler à ce stade — la couverture en place semble cohérente avec la situation déclarée.
      </div>
    );
  }
  return <div className="space-y-2">{constats.map((c) => <LigneConstat key={c.id} c={c} />)}</div>;
});

BlocConstatsCompacts.displayName = "BlocConstatsCompacts";
