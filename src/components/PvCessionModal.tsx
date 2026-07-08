// ─── PvCessionModal — plus-value de cession d'un bien foncier NU (Lot 2quater) ──
//
// Fenetre de calcul AUTONOME (patron du projete, mais SANS projection : un calcul
// a date via computePvImmobiliere). AUCUN impact computeIR. Prix + annee
// d'acquisition persistes sur le bien (reutilisent anneeAcquisition / prixAcquisition
// du 2ter/1bis) ; prix de cession et amortissements a reintegrer restent locaux.

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { BRAND, SURFACE } from "../constants";
import { n, euro, pct } from "../lib/calculs/utils";
import { MoneyField, Field } from "./shared";
import { computePvImmobiliere } from "../lib/calculs/pvImmobiliere";
import refMeuble from "../data/location-meublee.json";
import type { Property } from "../types/patrimoine";

type Props = {
  property: Property;
  updateProperty: (id: any, field: string, value: unknown) => void;
  onClose: () => void;
};

export function PvCessionModal({ property, updateProperty, onClose }: Props) {
  const anneeCourante = refMeuble.millesime;
  const [prixCession, setPrixCession] = React.useState(property.value || "");
  const [amortReintegres, setAmortReintegres] = React.useState("");

  const anneeAcq = n(property.anneeAcquisition);
  const ageValide = anneeAcq >= 1950 && anneeAcq <= anneeCourante;
  const age = ageValide ? Math.max(0, anneeCourante - anneeAcq) : 0;
  const res = computePvImmobiliere({ prixCession: n(prixCession), prixAcquisition: n(property.prixAcquisition), age, amortissementsReintegres: n(amortReintegres) });
  const netVendeur = n(prixCession) - res.impotTotal;
  const jeanbrun = property.dispositifFiscal === "jeanbrunRelanceLogement";

  const ligne = (label: React.ReactNode, value: string, opts: { strong?: boolean; color?: string } = {}) => (
    <div className="flex justify-between gap-3">
      <span style={{ color: BRAND.muted }}>{label}</span>
      <span style={{ fontWeight: opts.strong ? 800 : 700, color: opts.color || BRAND.navy }}>{value}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl" style={{ background: SURFACE.card, maxHeight: "90vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.navy }}>Plus-value de cession — {property.name || property.type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            <MoneyField label="Prix d'acquisition" tooltip="Prix d'achat du bien (base de la plus-value)." value={property.prixAcquisition || ""} onChange={(e) => updateProperty(property.id, "prixAcquisition", e.target.value)} compact />
            <Field label="Année d'acquisition" tooltip="Détermine la durée de détention et les abattements (art. 150 VC).">
              <Input value={property.anneeAcquisition || ""} onChange={(e) => updateProperty(property.id, "anneeAcquisition", e.target.value)} placeholder={String(anneeCourante)} className="h-8 text-sm rounded-xl" style={{ fontWeight: 700 }} inputMode="numeric" />
            </Field>
            <MoneyField label="Prix de cession" tooltip="Préremplie depuis la valeur estimée ; modifiable (non persistée)." value={prixCession} onChange={(e) => setPrixCession(e.target.value)} compact />
            <MoneyField label="Amort. à réintégrer" tooltip="Amortissements déduits à réintégrer (Jeanbrun / ancien meublé), art. 150 VB III. Optionnel." value={amortReintegres} onChange={(e) => setAmortReintegres(e.target.value)} compact />
          </div>

          {!ageValide && (
            <div className="text-[11px] rounded-lg px-3 py-2 flex items-start gap-1.5" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" aria-hidden="true" /> Renseignez l'année d'acquisition pour appliquer les abattements de durée de détention (sinon l'impôt est calculé sans abattement).
            </div>
          )}
          {jeanbrun && (
            <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
              Dispositif Jeanbrun : amortissements à réintégrer à la cession (art. 150 VB III) — renseignez le cumul déduit dans « Amort. à réintégrer ».
            </div>
          )}

          <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "rgba(196,151,61,0.05)", border: `1px solid ${SURFACE.border}` }}>
            {ligne(<>Prix d'acquisition corrigé <span style={{ opacity: 0.7 }}>(forfaits 7,5 % + 15 % si &gt; 5 ans)</span></>, euro(res.prixAcquisitionCorrige))}
            {ligne("Plus-value brute", res.moinsValue ? "Moins-value — aucun impôt" : euro(res.pvBrute), { strong: true, color: res.moinsValue ? BRAND.success : BRAND.navy })}
            {!res.moinsValue && (
              <>
                {ligne(`Abattement IR ${pct(res.abattementIr, 0)} → base`, euro(res.baseIr))}
                {ligne("Impôt IR (19 %)", euro(res.impotIr), { color: BRAND.danger })}
                {ligne(`Abattement PS ${pct(res.abattementPs, 1)} → base`, euro(res.basePs))}
                {ligne("Prélèvements sociaux (17,2 %)", euro(res.impotPs), { color: BRAND.danger })}
                <div className="flex justify-between pt-1" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                  <span className="font-bold" style={{ color: BRAND.navy }}>Impôt total</span>
                  <strong style={{ color: BRAND.danger }}>{euro(res.impotTotal)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: BRAND.navy }}>Net vendeur indicatif</span>
                  <strong style={{ color: BRAND.success }}>{euro(netVendeur)}</strong>
                </div>
              </>
            )}
          </div>

          {res.alerteSurtaxe && (
            <div className="text-[11px] rounded-lg px-3 py-2 flex items-start gap-1.5" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" aria-hidden="true" /> Surtaxe sur les plus-values élevées (art. 1609 nonies G) non incluse (base IR &gt; 50 000 €).
            </div>
          )}

          <div className="text-[11px] rounded-lg px-3 py-2" style={{ background: BRAND.cream, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
            Hypothèses : forfaits d'acquisition 7,5 % et de travaux 15 % (détention &gt; 5 ans) appliqués ; frais réels et exonérations spécifiques non gérés en v1 ; une moins-value n'entraîne aucun impôt. Abattements pour durée de détention (art. 150 VC) — exonération IR à 22 ans, PS à 30 ans.
          </div>

          <button type="button" onClick={onClose} className="w-full rounded-xl py-2 text-sm font-medium" style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}>Fermer</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
