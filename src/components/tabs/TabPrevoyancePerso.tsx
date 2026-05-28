// ─── TabPrevoyancePerso — onglet Prévoyance personnelle (Lot 7) ────────
//
// Page principale du module Prévoyance individuelle. Pour chaque
// personne (P1 et P2 si applicable) :
//   - lecture seule : statut + caisse + employeur saisis dans Travail
//   - radio cat1/cat2/cat3 (catégorie d'invalidité projetée)
//   - graphique aires empilées Recharts (ProjectionChart)
//   - tableau des jalons clés (TableauJalons)
//   - saisie couverture collective (BlocCouvertureCollective)
//   - saisie contrats individuels (BlocContratsIndividuels)
//   - constats triés par sévérité (BlocConstats)
//
// Persistance : data.prevoyance.{p1|p2} (cf. spec §2.2). Les anciens
// dossiers sans data.prevoyance affichent un état vide invitant à
// saisir. Pas de DDL Supabase (jsonb).

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import type {
  PatrimonialData,
  PayloadPrevoyance,
  PayloadPrevoyancePerso,
  CategorieInvalidite,
  ScenarioArret,
} from "../../types/patrimoine";
import type {
  ContratIndividuel as MoteurContratIndividuel,
  CouvertureCollective as MoteurCouvertureCollective,
  EntreePerso,
} from "../../lib/prevoyance/types";
import { BRAND, SURFACE } from "../../constants";
import { CardAccentTop } from "../CardAccentTop";
import { SectionTitle } from "../shared";
import { buildEntreePerso } from "../../lib/prevoyance/mapping";
import { projeterArretMaladie } from "../../lib/prevoyance/projection";
import { WARNING_MICRO_TNS } from "../../lib/prevoyance/constants";
import { referentiels } from "../../data/prevoyance";
import { buildContexteRegle } from "../../lib/prevoyance/contexte";
import { evaluerToutesLesRegles } from "../../lib/prevoyance/regles";
import { ProjectionChart } from "../prevoyance/ProjectionChart";
import { TableauJalons } from "../prevoyance/TableauJalons";
import { BlocConstats } from "../prevoyance/BlocConstats";
import { BlocCouvertureCollective } from "../prevoyance/BlocCouvertureCollective";
import { BlocContratsIndividuels } from "../prevoyance/BlocContratsIndividuels";
import { BlocTpt } from "../prevoyance/BlocTpt";

function defaultPrevoyancePerso(): PayloadPrevoyancePerso {
  return {
    contratsIndividuels: [],
    couvertureCollective: null,
    categorieInvaliditeProjetee: "cat2",
    scenarioArret: "ald",
  };
}

function getPrevoyancePerso(
  data: PatrimonialData,
  which: "p1" | "p2"
): PayloadPrevoyancePerso {
  return data.prevoyance?.[which] ?? defaultPrevoyancePerso();
}

type Props = {
  data: PatrimonialData;
  setField: <K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) => void;
  person1: string;
  person2: string;
  onGoToTravail?: () => void;
};

const TabPrevoyancePerso = React.memo(function TabPrevoyancePerso({
  data,
  setField,
  person1,
  person2,
  onGoToTravail,
}: Props) {
  const entreeP1Base = React.useMemo(() => buildEntreePerso(data, "p1"), [data]);
  const entreeP2Base = React.useMemo(() => buildEntreePerso(data, "p2"), [data]);

  function patchPrevoyance(which: "p1" | "p2", patch: Partial<PayloadPrevoyancePerso>) {
    const current: PayloadPrevoyance = data.prevoyance ?? {
      version: 1,
      p1: defaultPrevoyancePerso(),
      p2: entreeP2Base ? defaultPrevoyancePerso() : null,
    };
    const next: PayloadPrevoyance = {
      version: 1,
      p1: which === "p1" ? { ...current.p1, ...patch } : current.p1,
      p2:
        which === "p2"
          ? { ...(current.p2 ?? defaultPrevoyancePerso()), ...patch }
          : current.p2,
    };
    setField("prevoyance", next);
  }

  const hasP2 = entreeP2Base !== null;

  return (
    <TabsContent value="prevoyance" className="space-y-4">
      <Card className="border-0 relative overflow-hidden">
        <CardAccentTop />
        <CardHeader>
          <SectionTitle
            icon={ShieldCheck}
            title="Prévoyance personnelle"
            subtitle="Projection de revenus en cas d'arrêt maladie puis invalidité, par personne du foyer."
          />
        </CardHeader>
        <CardContent>
          {!entreeP1Base ? (
            <EtatVide onGoToTravail={onGoToTravail} />
          ) : (
            <div className={hasP2 ? "grid gap-6 xl:grid-cols-2" : "max-w-3xl mx-auto"}>
              <ColonnePerso
                label={person1}
                entreeBase={entreeP1Base}
                prevoyancePerso={getPrevoyancePerso(data, "p1")}
                onChangePrevoyance={(patch) => patchPrevoyance("p1", patch)}
                cible="p1"
                data={data}
              />
              {hasP2 && entreeP2Base && (
                <ColonnePerso
                  label={person2}
                  entreeBase={entreeP2Base}
                  prevoyancePerso={getPrevoyancePerso(data, "p2")}
                  onChangePrevoyance={(patch) => patchPrevoyance("p2", patch)}
                  cible="p2"
                  data={data}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
});

TabPrevoyancePerso.displayName = "TabPrevoyancePerso";
export { TabPrevoyancePerso };

// ────────────────────────────────────────────────────────────────────
// État vide : aucun travail saisi
// ────────────────────────────────────────────────────────────────────

function EtatVide({ onGoToTravail }: { onGoToTravail?: () => void }) {
  return (
    <div
      className="rounded-xl p-6 text-sm"
      style={{
        background: SURFACE.cardSoft,
        border: `1px dashed ${SURFACE.border}`,
        color: BRAND.muted,
      }}
    >
      <div className="font-bold mb-2" style={{ color: BRAND.navy }}>
        Aucune situation professionnelle saisie
      </div>
      <p className="mb-3">
        Pour activer le module Prévoyance, renseignez d'abord la situation
        professionnelle dans l'onglet <strong>Collecte patrimoniale → Travail</strong> :
        statut, caisse d'affiliation, date d'embauche, salaire brut et
        (éventuellement) employeur avec SIRET. La projection s'actualisera
        automatiquement.
      </p>
      {onGoToTravail && (
        <button
          type="button"
          onClick={onGoToTravail}
          className="rounded-xl px-4 py-2 text-sm font-bold transition-all"
          style={{
            background: BRAND.navy,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          → Compléter l'onglet Travail
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Une colonne par personne (P1 ou P2)
// ────────────────────────────────────────────────────────────────────

type ColonneProps = {
  label: string;
  entreeBase: EntreePerso;
  prevoyancePerso: PayloadPrevoyancePerso;
  onChangePrevoyance: (patch: Partial<PayloadPrevoyancePerso>) => void;
  cible: "p1" | "p2";
  data: PatrimonialData;
};

function ColonnePerso({
  label,
  entreeBase,
  prevoyancePerso,
  onChangePrevoyance,
  cible,
  data,
}: ColonneProps) {
  // L'entree complete = mapping travail + saisies UI (contrats + couverture)
  const entree: EntreePerso = React.useMemo(
    () => ({
      ...entreeBase,
      // Les types PayloadContratIndividuel/PayloadCouvertureCollective et leurs
      // homologues moteur sont structurellement identiques (cf. note types/patrimoine.ts).
      contratsIndividuels: prevoyancePerso.contratsIndividuels as unknown as MoteurContratIndividuel[],
      couvertureCollective: prevoyancePerso.couvertureCollective as unknown as MoteurCouvertureCollective | null,
    }),
    [entreeBase, prevoyancePerso.contratsIndividuels, prevoyancePerso.couvertureCollective]
  );

  const categorie = prevoyancePerso.categorieInvaliditeProjetee;
  const scenarioArret: ScenarioArret = prevoyancePerso.scenarioArret ?? "ald";
  const tptConfig = prevoyancePerso.tpt;

  // Carence de la caisse (pour la validation UI du début de TPT) : lue du
  // référentiel, fallback 3 j (standard CPAM/SSI).
  const carenceJours: number =
    (referentiels.caisses as { caisses?: Record<string, { ij?: { carenceJours?: number } }> })
      .caisses?.[entree.caisse ?? ""]?.ij?.carenceJours ?? 3;

  const projection = React.useMemo(
    () => projeterArretMaladie(entree, categorie, referentiels, scenarioArret, tptConfig),
    [entree, categorie, scenarioArret, tptConfig]
  );

  const constats = React.useMemo(() => {
    const ctx = buildContexteRegle(data, entree, projection);
    return evaluerToutesLesRegles(ctx, cible);
  }, [data, entree, projection, cible]);

  return (
    <div className="space-y-4">
      {/* Récap statut */}
      <div
        className="rounded-xl p-4"
        style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div className="font-bold text-base" style={{ color: BRAND.navy }}>
            {label}
          </div>
          <div className="text-xs" style={{ color: BRAND.muted }}>
            {entree.age} ans · retraite à {entree.ageRetraite} ans
          </div>
        </div>
        <div className="text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ color: BRAND.muted }}>
          <span>
            <strong style={{ color: BRAND.navy }}>Statut :</strong> {libelleStatut(entreeBase.statutPro)}
          </span>
          {entree.caisse && (
            <span>
              <strong style={{ color: BRAND.navy }}>Caisse :</strong> {entree.caisse}
            </span>
          )}
          {entree.idccCCN && (
            <span>
              <strong style={{ color: BRAND.navy }}>IDCC :</strong> {entree.idccCCN}
            </span>
          )}
          <span>
            <strong style={{ color: BRAND.navy }}>Ancienneté :</strong>{" "}
            {Math.floor(entree.ancienneteMois / 12)} an
            {entree.ancienneteMois >= 24 ? "s" : ""} ({entree.ancienneteMois} mois)
          </span>
          <span>
            <strong style={{ color: BRAND.navy }}>Revenu réf. :</strong>{" "}
            {Math.round(projection.revenuReferenceMensuel).toLocaleString("fr-FR")} €/mois
          </span>
        </div>
      </div>

      {/* Sélecteur scénario d'arrêt */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Scénario d'arrêt
        </div>
        {(["maladie_ordinaire", "ald"] as const).map((sc) => (
          <label key={sc} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
            <input
              type="radio"
              name={`scenario-${cible}`}
              checked={scenarioArret === sc}
              onChange={() => onChangePrevoyance({ scenarioArret: sc })}
            />
            <span>{libelleScenario(sc)}</span>
          </label>
        ))}
      </div>

      {/* Mi-temps thérapeutique */}
      <BlocTpt
        value={tptConfig}
        carenceJours={carenceJours}
        onChange={(next) => onChangePrevoyance({ tpt: next })}
      />

      {/* Sélecteur catégorie invalidité */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Catégorie d'invalidité projetée
        </div>
        {(["cat1", "cat2", "cat3"] as const).map((cat) => (
          <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
            <input
              type="radio"
              name={`cat-${cible}`}
              checked={categorie === cat}
              onChange={() => onChangePrevoyance({ categorieInvaliditeProjetee: cat })}
            />
            <span>{libelleCategorie(cat)}</span>
          </label>
        ))}
      </div>

      {/* Warning micro-TNS : revenu de référence calé sur le CA */}
      {projection.revenuReferenceMicroTNS && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid #F59E0B", color: "#7C4A04" }}
        >
          {WARNING_MICRO_TNS}
        </div>
      )}

      {/* Graphique */}
      <div
        className="rounded-xl p-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
          Projection des revenus de remplacement
        </div>
        <ProjectionChart projection={projection} />
      </div>

      {/* Tableau jalons */}
      <div
        className="rounded-xl p-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
          Points clés
        </div>
        <TableauJalons projection={projection} />
      </div>

      {/* Saisies */}
      <BlocCouvertureCollective
        value={prevoyancePerso.couvertureCollective}
        onChange={(next) => onChangePrevoyance({ couvertureCollective: next })}
      />
      <BlocContratsIndividuels
        contrats={prevoyancePerso.contratsIndividuels}
        onChange={(next) => onChangePrevoyance({ contratsIndividuels: next })}
      />

      {/* Constats */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Constats et pistes
        </div>
        <BlocConstats constats={constats} />
      </div>
    </div>
  );
}

function libelleStatut(s: string): string {
  const map: Record<string, string> = {
    salarie_non_cadre: "Salarié non-cadre",
    salarie_cadre: "Salarié cadre",
    tns_liberal: "TNS — profession libérale",
    tns_commercant: "TNS — commerçant",
    tns_artisan: "TNS — artisan",
    gerant_majoritaire: "Gérant majoritaire",
    president_sas: "Président SAS / SASU",
    eurl_unique: "EURL gérant non majoritaire",
    fonctionnaire: "Fonctionnaire",
    retraite: "Retraité",
    sans_activite: "Sans activité",
  };
  return map[s] ?? "—";
}

function libelleCategorie(c: CategorieInvalidite): string {
  switch (c) {
    case "cat1":
      return "Cat 1 — activité réduite";
    case "cat2":
      return "Cat 2 — incapable";
    case "cat3":
      return "Cat 3 — + tierce personne";
  }
}

function libelleScenario(s: ScenarioArret): string {
  switch (s) {
    case "maladie_ordinaire":
      return "Maladie ordinaire (max 360 j)";
    case "ald":
      return "Affection longue durée (jusqu'à 3 ans)";
  }
}
