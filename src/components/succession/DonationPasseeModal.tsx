// ─── DonationPasseeModal — saisie d'une donation PASSEE (registre, Lot E2) ────
//
// Meme patron visuel que DonationModal (Hypotheses), MAIS : mono-beneficiaire,
// MONTANT LIBRE (l'actif a deja quitte le patrimoine — aucune designation d'actif
// assetType/assetId), aucune simulation (before15/after15/notaire). Cible de
// persistance : DonationPassee (data.donations). Edition LIVE via `upd` (pas de
// brouillon/save). Picker famille CORRIGE (E1) : childId de la puce cliquee,
// relation mappee vis-a-vis du DONATEUR.

import { Input } from "@/components/ui/input";
import { DateFr } from "@/components/ui/DateFr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, MoneyField } from "../shared";
import { BRAND, SURFACE, DONATION_RELATIONS } from "../../constants";
import { euro } from "../../lib/calculs/utils";
import { membresFamille } from "../../lib/prevoyance/membres-famille";
import { mapMembreToDonationRelation, getDonationTaxProfile } from "../../lib/calculs/donation";
import type { PatrimonialData, DonationPassee } from "../../types/patrimoine";

type Props = {
  open: boolean;
  donation: DonationPassee | null;
  data: PatrimonialData;
  person1: string;
  person2: string;
  upd: (patch: Partial<DonationPassee>) => void;
  onClose: () => void;
};

export function DonationPasseeModal({ open, donation, data, person1, person2, upd, onClose }: Props) {
  if (!open || !donation) return null;
  const don = donation;
  // Relation deduite vis-a-vis du DONATEUR (E1) : N = donateur, PAS le deces simule.
  const whichDonor: 1 | 2 = don.donorPersonKey === "person2" ? 2 : 1;
  const membres = membresFamille(data, whichDonor);
  const pick = (m: any) => upd({
    beneficiaireType: m.source === "enfant" ? "child" : "conjoint",
    beneficiaireChildId: m.source === "enfant" ? m.childId : undefined,
    beneficiaireNom: m.name,
    beneficiaireRelation: mapMembreToDonationRelation(m.relation),
  });
  const rel = don.beneficiaireRelation || "enfant";
  const prof = getDonationTaxProfile(rel);
  const relLabel = rel === "enfant" ? "Enfant" : rel === "conjoint" ? "Conjoint / partenaire" : rel === "tiers" ? "Tiers (enfant du conjoint / non-parent)" : rel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,27,59,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" style={{ background: SURFACE.card, boxShadow: "0 24px 64px rgba(16,27,59,0.35)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 22px", background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.sky} 100%)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>🎁 Donation antérieure — rappel fiscal</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "#fff", width: "30px", height: "30px", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-3 overflow-y-auto">
          <Field label="Donateur">
            <Select value={don.donorPersonKey} onValueChange={(v: string) => upd({ donorPersonKey: v as "person1" | "person2" })}>
              <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="person1">{person1}</SelectItem><SelectItem value="person2">{person2 || "Personne 2"}</SelectItem></SelectContent>
            </Select>
          </Field>

          <div>
            <div className="text-xs text-slate-500 mb-1">Bénéficiaire</div>
            <div className="flex flex-wrap items-center gap-1">
              {membres.map((m: any, mi: number) => {
                const active = m.source === "enfant"
                  ? (don.beneficiaireType === "child" && !!m.childId && don.beneficiaireChildId === m.childId)
                  : don.beneficiaireType === "conjoint";
                return <button key={mi} onClick={() => pick(m)} className="text-xs rounded-full px-2.5 py-1 transition-colors" style={{ background: active ? BRAND.navy : "rgba(81,106,199,0.1)", color: active ? "#fff" : BRAND.sky, border: active ? "none" : "1px solid rgba(81,106,199,0.2)" }}>{m.name}</button>;
              })}
              <button onClick={() => upd({ beneficiaireType: "autre", beneficiaireChildId: undefined })} className="text-xs rounded-full px-2.5 py-1 transition-colors" style={{ background: don.beneficiaireType === "autre" ? BRAND.gold : "rgba(227,175,100,0.12)", color: don.beneficiaireType === "autre" ? "#fff" : BRAND.gold, border: "1px solid rgba(227,175,100,0.3)" }}>Autre…</button>
            </div>
            {/* Info de controle (E1) : relation vs donateur + abattement donation */}
            {(don.beneficiaireType === "child" || don.beneficiaireType === "conjoint") && (
              <div className="text-xs mt-1.5" style={{ color: BRAND.muted }}>{don.beneficiaireNom} — <strong>{relLabel}</strong> · abatt. donation {euro(prof.allowance)}{prof.allowance === 0 ? " · taxe 60 %" : ""}</div>
            )}
            {don.beneficiaireType === "autre" && (
              <div className="grid gap-2 grid-cols-2 mt-1.5">
                <Input value={don.beneficiaireNom || ""} onChange={(e) => upd({ beneficiaireNom: e.target.value })} placeholder="Nom du bénéficiaire" className="rounded-xl h-9 text-sm" />
                <Select value={don.beneficiaireRelation || "enfant"} onValueChange={(v: string) => upd({ beneficiaireRelation: v })}>
                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DONATION_RELATIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date de la donation"><DateFr value={don.date} onChange={(iso: string | null) => upd({ date: iso || "" })} className="rounded-xl h-9 text-sm" /></Field>
            <MoneyField label="Montant transmis (€)" tooltip="Valeur transmise retenue (rappelable). Pour une donation démembrée, saisir la valeur de la nue-propriété effectivement transmise." value={don.montant} onChange={(e: any) => upd({ montant: e.target.value })} />
          </div>

          <Field label="Type de donation" tooltip="Donation simple : rapportable (rappel des 15 ans, art. 784). Don familial 790 G / 790 A bis / présent d'usage : HORS rappel (ignorés du calcul).">
            <Select value={don.type} onValueChange={(v: string) => upd({ type: v as DonationPassee["type"] })}>
              <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Donation simple (rappelable 15 ans)</SelectItem>
                <SelectItem value="don_familial_790G">Don familial 790 G (hors rappel)</SelectItem>
                <SelectItem value="don_790A_bis">Don 790 A bis (hors rappel)</SelectItem>
                <SelectItem value="present_usage">Présent d'usage (hors rappel)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: SURFACE.border, flexShrink: 0 }}>
          <button onClick={onClose} className="rounded-xl px-5 py-2 text-sm font-medium" style={{ background: BRAND.navy, color: "#fff" }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
