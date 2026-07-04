// ─── ChargesModal — detail des charges courantes du foyer (Lot B) ────────────
//
// Modale de saisie des 6 postes MENSUELS de charges courantes du foyer, patron
// shadcn Dialog (analogue a la modale charges pro TNS). UI PURE : ecrit
// data.chargesCourantesDetail via le setter existant setField (aucun setter
// dedie, aucune cle renommee). Le total detaille est calcule live pour
// l'affichage ; le calcul budget reel reste dans budget.ts (computeBudget).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyField } from "./shared";
import { BRAND, SURFACE, EMPTY_CHARGES_COURANTES_DETAIL } from "../constants";
import { n, euro } from "../lib/calculs/utils";
import type { PatrimonialData, ChargesCourantesDetail } from "../types/patrimoine";

type Props = {
  open: boolean;
  onClose: () => void;
  data: PatrimonialData;
  setField: (field: string, value: unknown) => void;
};

const POSTES: { key: keyof ChargesCourantesDetail; label: string }[] = [
  { key: "loyerRP",         label: "Loyer résidence principale" },
  { key: "energie",         label: "Énergie / logement" },
  { key: "assurancesPerso", label: "Assurances personnelles" },
  { key: "scolarite",       label: "Scolarité / garde" },
  { key: "transport",       label: "Transport" },
  { key: "autres",          label: "Autres" },
];

export function ChargesModal({ open, onClose, data, setField }: Props) {
  const detail: ChargesCourantesDetail = (data.chargesCourantesDetail as ChargesCourantesDetail) || EMPTY_CHARGES_COURANTES_DETAIL;
  const total = POSTES.reduce((s, p) => s + n(detail[p.key]), 0);

  const setPoste = (key: keyof ChargesCourantesDetail, value: string) =>
    setField("chargesCourantesDetail", { ...detail, [key]: value });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl" style={{ background: SURFACE.card }}>
        <DialogHeader>
          <DialogTitle style={{ color: BRAND.navy }}>Charges courantes du foyer — détail mensuel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Postes mensuels */}
          <div className="grid gap-3 md:grid-cols-2">
            {POSTES.map(({ key, label }) => (
              <MoneyField
                key={key}
                label={`${label} (€/mois)`}
                value={detail[key] || ""}
                onChange={(e) => setPoste(key, e.target.value)}
                compact
              />
            ))}
          </div>

          {/* Total détaillé (live) */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: BRAND.navy }}>
            <span className="text-xs font-semibold text-white">Total détaillé</span>
            <span className="text-sm font-bold text-white">{euro(total)}/mois</span>
          </div>

          {/* Note barrière douce */}
          <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
            Sans détail saisi, le montant global reste libre — aucune valeur n'est écrasée.
          </div>

          {/* Fermer */}
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2 text-sm font-medium transition-colors"
            style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
