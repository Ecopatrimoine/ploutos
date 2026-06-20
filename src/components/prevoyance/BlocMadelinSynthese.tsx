// ─── BlocMadelinSynthese — synthèse Madelin dans l'onglet Revenus (Lot B4) ────
//
// Affiche, pour une personne TNS, les DEUX enveloppes Madelin :
//   - Prévoyance-santé (ACTIVE) : plafond art. 154 bis CGI, cotisations lues en
//     prévoyance + case « autre cotisation », déductible / dépassement.
//   - Retraite (PER) : POUR INFO uniquement (valeurs lues depuis le calcul IR,
//     JAMAIS recalculées ici).
// + toggle « bénéfice déjà net des cotisations Madelin ? » (écrit
//   data.travail.{p}.beneficeDejaDeduitMadelin via le pattern patchTravail).
//
// LECTURE / AFFICHAGE + saisie (autre cotisation + toggle). AUCUN calcul IR ici.
// Masqué (null) si la personne n'est pas TNS.

import React from "react";
import { Input } from "@/components/ui/input";
import { Field } from "../shared";
import { BRAND, SURFACE } from "../../constants";
import type { PatrimonialData, PayloadTravailPair } from "../../types/patrimoine";
import { createEmptyTravail } from "../../lib/prevoyance/utils";
import { referentiels } from "../../data/prevoyance";
import {
  estEligibleMadelin,
  sommeCotisationsMadelin,
  detailCotisationsMadelin,
  plafondMadelinPrevoyance,
  enveloppeMadelinPrevoyance,
} from "../../lib/prevoyance/madelin";

type Props = {
  data: PatrimonialData;
  which: 1 | 2;
  benefice: number;
  plafondPER: number;
  versementsPER: number;
  setField: (field: string, value: unknown) => void;
};

const eur = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} €`;

function Ligne({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: BRAND.muted }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export const BlocMadelinSynthese = React.memo(function BlocMadelinSynthese({
  data, which, benefice, plafondPER, versementsPER, setField,
}: Props) {
  // Masqué si la personne n'est pas TNS (cohérent avec la protection du calcul B2).
  if (!estEligibleMadelin(data, which)) return null;

  const persoKey = which === 1 ? "p1" : "p2";
  const detail = detailCotisationsMadelin(data, which);
  const autre = which === 1 ? data.madelinAutreCotisation1 : data.madelinAutreCotisation2;
  const total = sommeCotisationsMadelin(data, which); // = Σ détail + autre
  const plafond = plafondMadelinPrevoyance(benefice, referentiels.pass.pass.annuel);
  const env = enveloppeMadelinPrevoyance(total, plafond);
  const dejaDeduit = data.travail?.[persoKey]?.beneficeDejaDeduitMadelin === true;
  const perRestant = Math.max(0, plafondPER - versementsPER);

  // Écriture du toggle dans data.travail.{p} — pattern patchTravail (merge profond,
  // init createEmptyTravail si absent).
  function setToggle(next: boolean) {
    const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs" || data.coupleStatus === "cohab";
    const currentPair: PayloadTravailPair = data.travail ?? {
      p1: createEmptyTravail(),
      p2: isCouple ? createEmptyTravail() : null,
    };
    const nextPair: PayloadTravailPair =
      which === 1
        ? { ...currentPair, p1: { ...currentPair.p1, beneficeDejaDeduitMadelin: next } }
        : { ...currentPair, p2: { ...(currentPair.p2 ?? createEmptyTravail()), beneficeDejaDeduitMadelin: next } };
    setField("travail", nextPair);
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: "rgba(227,175,100,0.06)", border: `1px solid ${SURFACE.border}` }}>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Madelin — déduction prévoyance{which === 2 ? " (personne 2)" : ""}
      </div>

      {/* Cotisations prises en compte (lecture seule) + « autre cotisation » */}
      <div className="space-y-1.5">
        {detail.length === 0 && (
          <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
            Aucune cotisation Madelin marquée sur les contrats de prévoyance.
          </div>
        )}
        {detail.map((l, i) => (
          <Ligne key={i} label={l.libelle} value={eur(l.montant)} />
        ))}
        <Field label="Autre cotisation Madelin (€)">
          <Input
            type="number"
            min={0}
            value={autre ?? ""}
            onChange={(e) => setField("madelinAutreCotisation" + which, Number(e.target.value) || 0)}
            className="rounded-xl"
            placeholder="ex. 600"
          />
        </Field>
        <div className="flex items-center justify-between text-xs font-semibold" style={{ color: BRAND.navy }}>
          <span>Total cotisations prévoyance-santé</span>
          <span>{eur(total)}</span>
        </div>
      </div>

      {/* Deux enveloppes côte à côte */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Prévoyance-santé (active) */}
        <div className="rounded-xl p-2.5 space-y-1" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="text-xs font-bold" style={{ color: BRAND.navy }}>Prévoyance-santé</div>
          <Ligne label="Disponible (plafond)" value={eur(plafond)} />
          <Ligne label="Consommé (cotisations)" value={eur(total)} />
          <Ligne label="Déductible" value={eur(env.deductible)} />
          {env.depasse && (
            <div className="rounded-lg px-2 py-1.5 text-xs" style={{ background: BRAND.warningBg, color: BRAND.warning, border: `1px solid ${BRAND.warningBorder}` }}>
              Dépassement de {eur(env.depassement)} : la part au-delà du plafond n'est pas déductible.
            </div>
          )}
        </div>

        {/* Retraite (PER) — pour info */}
        <div className="rounded-xl p-2.5 space-y-1" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold" style={{ color: BRAND.navy }}>Retraite (PER)</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(81,106,199,0.1)", color: BRAND.sky }}>pour info</span>
          </div>
          <Ligne label="Disponible (plafond)" value={eur(plafondPER)} />
          <Ligne label="Consommé (versements)" value={eur(versementsPER)} />
          <Ligne label="Restant" value={eur(perRestant)} />
        </div>
      </div>

      {/* Toggle bénéfice avant/après déduction */}
      <label className="flex items-start gap-2 cursor-pointer select-none text-xs" style={{ color: BRAND.navy }}>
        <input type="checkbox" checked={dejaDeduit} onChange={(e) => setToggle(e.target.checked)} />
        <span>
          <span className="font-medium">Le bénéfice saisi est déjà net des cotisations Madelin.</span>{" "}
          Cochez seulement si vous avez déjà déduit ces cotisations du bénéfice renseigné — sinon Ploutos applique la déduction.
        </span>
      </label>

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Enveloppe commune prévoyance-santé (art. 154 bis CGI) : 7 % du PASS + 3,75 % du bénéfice imposable, plafonnée à 3 % de 8 PASS. Distincte de l'enveloppe retraite (PER).
      </div>
    </div>
  );
});

BlocMadelinSynthese.displayName = "BlocMadelinSynthese";
