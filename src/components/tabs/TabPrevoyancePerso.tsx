// ─── TabPrevoyancePerso — onglet Prévoyance personnelle (Lot 7 · refonte 10c) ──
//
// Grammaire d'analyse en 3 actes, par personne :
//   EN-TÊTE  : sélecteur de personne (shell) + bande d'infos + contrôles de scénario
//   ACTE 1   : besoin de couverture minimum (carte-roi) + date critique + vigilance
//   ACTE 2   : « qui verse quoi » (frise INCHANGÉE) avec bascule Graphique | Tableau €,
//              puis constats compressés (une ligne dépliable)
//   ACTE 3   : accordéons (mécanismes pédagogiques · détail des contrats · régime
//              obligatoire)
// ZÉRO moteur : les KPI sont des dérivations de présentation (lib/presentation).
// Persistance : data.prevoyance.{p1|p2}. Dossiers sans travail saisi → état vide.

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, AlertTriangle, BarChart3, Table, ArrowRight } from "lucide-react";
import type {
  PatrimonialData,
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
import { SectionTitle, HelpTooltip } from "../shared";
import { KpiRoiCard, SectionAccordion, type KpiRoiLine } from "../analysis";
import { buildEntreePerso } from "../../lib/prevoyance/mapping";
import { projeterArretMaladie } from "../../lib/prevoyance/projection";
import { WARNING_MICRO_TNS } from "../../lib/prevoyance/constants";
import { referentiels } from "../../data/prevoyance";
import { buildContexteRegle } from "../../lib/prevoyance/contexte";
import { evaluerToutesLesRegles } from "../../lib/prevoyance/regles";
import {
  resolveSeuilsPrevoyance, buildBesoinCouverture, buildDateCritique,
  buildVigilance, pireRisques, type VigilanceRow,
} from "../../lib/presentation/prevoyancePerso";
import { ProjectionChart } from "../prevoyance/ProjectionChart";
import { TableauEuroPayeurs } from "../prevoyance/TableauEuroPayeurs";
import { BlocConstatsCompacts } from "../prevoyance/BlocConstatsCompacts";
import { COULEURS_SEVERITE, LIBELLE_AXE } from "../prevoyance/constatsSeverite";
import { BlocCouvertureCollective } from "../prevoyance/BlocCouvertureCollective";
import { BlocContratsIndividuels } from "../prevoyance/BlocContratsIndividuels";
import { BlocTransmissionDeces } from "../prevoyance/BlocTransmissionDeces";
import { RentesSurvivants } from "../prevoyance/RentesSurvivants";
import { BlocTpt } from "../prevoyance/BlocTpt";
import { defaultCarmf } from "../prevoyance/BlocCarmf";
import { defaultCipav } from "../prevoyance/BlocCipav";
import { defaultCarpimko } from "../prevoyance/BlocCarpimko";
import { BlocPedagogie } from "../prevoyance/BlocPedagogie";
import { AlerteAncienneteNonFiable } from "../prevoyance/AlerteAncienneteNonFiable";
import { getContratsTransmissionDeces, getPrevoyancePerso, patchPrevoyancePair } from "../../lib/prevoyance/utils";

type Props = {
  data: PatrimonialData;
  setField: <K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) => void;
  person1: string;
  person2: string;
  onGoToTravail?: () => void;
};

const fmtEuroMois = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €/mois`;
const pctInt = (frac: number) => `${Math.round(frac * 100)} %`;

type Vue = "p1" | "p2" | "les_deux";

// A1-bis — placement EXPLICITE des rangées (≥900px) : chaque section d'une colonne va
// dans SA piste (row-start N) et SA colonne (col-start C). Deux colonnes -> rangées
// homologues partagées -> alignées. Classes LITTÉRALES (le scanner Tailwind les voit ;
// pas d'interpolation). Sous 900px : inactives -> empilement DOM (P1 puis P2).
const ROW_START = [
  "min-[900px]:row-start-1", "min-[900px]:row-start-2", "min-[900px]:row-start-3",
  "min-[900px]:row-start-4", "min-[900px]:row-start-5", "min-[900px]:row-start-6",
  "min-[900px]:row-start-7",
];
const COL_START: Record<1 | 2, string> = { 1: "min-[900px]:col-start-1", 2: "min-[900px]:col-start-2" };

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
    setField("prevoyance", patchPrevoyancePair(data.prevoyance, which, patch, entreeP2Base !== null));
  }

  const hasP2 = entreeP2Base !== null;
  // Sélecteur de personne (remplace le toggle 1/2 colonnes). Défaut « Les deux »
  // (comparaison en colonnes, comportement historique) ; focus par personne au clic.
  // Sans P2, vue forcée p1 (pas de sélecteur).
  const [vue, setVue] = React.useState<Vue>("les_deux");
  const vueEff: Vue = hasP2 ? vue : "p1";

  const renderColonne = (which: "p1" | "p2", entree: EntreePerso, col?: 1 | 2) => (
    <ColonnePerso
      key={which}
      label={which === "p1" ? person1 : person2}
      entreeBase={entree}
      prevoyancePerso={getPrevoyancePerso(data, which)}
      onChangePrevoyance={(patch) => patchPrevoyance(which, patch)}
      cible={which}
      data={data}
      col={col}
    />
  );

  return (
    <TabsContent value="prevoyance" className="space-y-4">
      <Card className="border-0 relative overflow-hidden">
        <CardAccentTop />
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              icon={ShieldCheck}
              title="Prévoyance personnelle"
              subtitle="Projection de revenus en cas d'arrêt maladie puis invalidité, par personne du foyer."
            />
            {/* Sélecteur segmenté de personne — visible seulement en foyer à 2 personnes. */}
            {hasP2 && (
              <div className="shrink-0 inline-flex rounded-xl p-1" role="tablist" aria-label="Personne affichée" style={{ background: "rgba(15,23,42,0.06)" }}>
                {([["p1", person1], ["p2", person2], ["les_deux", "Les deux"]] as const).map(([v, txt]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={vue === v}
                    onClick={() => setVue(v)}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A67F32]"
                    style={{ background: vue === v ? BRAND.navy : "transparent", color: vue === v ? "#fff" : BRAND.navy, border: "none", cursor: "pointer", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!entreeP1Base ? (
            <EtatVide onGoToTravail={onGoToTravail} />
          ) : vueEff === "les_deux" && entreeP2Base ? (
            // A1-bis : chaque section reçoit un placement de grille EXPLICITE (row-start/
            // col-start) -> les rangées homologues des 2 colonnes partagent la même piste
            // et s'alignent quelle que soit la hauteur. Sous 900px : empilement P1 puis P2.
            <div className="grid gap-x-6 gap-y-4 min-[900px]:grid-cols-2 items-start">
              {renderColonne("p1", entreeP1Base, 1)}
              {renderColonne("p2", entreeP2Base, 2)}
            </div>
          ) : vueEff === "p2" && entreeP2Base ? (
            <div className="max-w-5xl mx-auto">{renderColonne("p2", entreeP2Base)}</div>
          ) : (
            <div className="max-w-5xl mx-auto">{renderColonne("p1", entreeP1Base)}</div>
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
    <div className="rounded-xl p-6 text-sm" style={{ background: SURFACE.cardSoft, border: `1px dashed ${SURFACE.border}`, color: BRAND.muted }}>
      <div className="font-bold mb-2" style={{ color: BRAND.navy }}>Aucune situation professionnelle saisie</div>
      <p className="mb-3">
        Pour activer le module Prévoyance, renseignez d'abord la situation professionnelle dans l'onglet{" "}
        <strong>Collecte patrimoniale → Travail</strong> : statut, caisse d'affiliation, date d'embauche, salaire
        brut et (éventuellement) employeur avec SIRET. La projection s'actualisera automatiquement.
      </p>
      {onGoToTravail && (
        <button
          type="button"
          onClick={onGoToTravail}
          className="rounded-xl px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32]"
          style={{ background: BRAND.navy, color: "#fff", border: "none", cursor: "pointer" }}
        >
          → Compléter l'onglet Travail
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Une colonne par personne (P1 ou P2) — en-tête + 3 actes
// ────────────────────────────────────────────────────────────────────

type ColonneProps = {
  label: string;
  entreeBase: EntreePerso;
  prevoyancePerso: PayloadPrevoyancePerso;
  onChangePrevoyance: (patch: Partial<PayloadPrevoyancePerso>) => void;
  cible: "p1" | "p2";
  data: PatrimonialData;
  // Défini en vue « Les deux » (1 = colonne gauche, 2 = droite) : chaque section reçoit
  // un placement de grille explicite (row-start i, col-start col) pour aligner les
  // rangées homologues. Absent en vue simple -> empilement classique.
  col?: 1 | 2;
};

function ColonnePerso({ label, entreeBase, prevoyancePerso, onChangePrevoyance, cible, data, col }: ColonneProps) {
  // ── Configs caisse (identique à l'existant) : config persistée + situation
  // familiale VIVANTE injectée depuis le foyer, mémoïsées pour l'identité de réf. ──
  const estCarmf = entreeBase.caisse === "CARMF";
  const carmfConfig = React.useMemo(
    () => estCarmf ? { ...(prevoyancePerso.carmf ?? defaultCarmf(entreeBase)), marie: entreeBase.marie ?? false, anneesMariage: entreeBase.anneesMariage ?? 0, ressourcesConjoint: entreeBase.ressourcesConjointAnnuelles ?? 0 } : undefined,
    [estCarmf, prevoyancePerso.carmf, entreeBase]
  );
  const estCipav = entreeBase.caisse === "CIPAV";
  const cipavConfig = React.useMemo(
    () => estCipav ? { ...(prevoyancePerso.cipav ?? defaultCipav(entreeBase)), marie: entreeBase.marie ?? false, nbEnfants: entreeBase.nbEnfantsACharge ?? 0 } : undefined,
    [estCipav, prevoyancePerso.cipav, entreeBase]
  );
  const estCarpimko = entreeBase.caisse === "CARPIMKO";
  const carpimkoConfig = React.useMemo(
    () => estCarpimko ? { ...(prevoyancePerso.carpimko ?? defaultCarpimko(entreeBase)), marie: entreeBase.marie ?? false, nbEnfants: entreeBase.nbEnfantsACharge ?? 0 } : undefined,
    [estCarpimko, prevoyancePerso.carpimko, entreeBase]
  );

  const entree: EntreePerso = React.useMemo(
    () => ({
      ...entreeBase,
      contratsIndividuels: prevoyancePerso.contratsIndividuels as unknown as MoteurContratIndividuel[],
      couvertureCollective: prevoyancePerso.couvertureCollective as unknown as MoteurCouvertureCollective | null,
      carmf: carmfConfig, cipav: cipavConfig, carpimko: carpimkoConfig,
    }),
    [entreeBase, prevoyancePerso.contratsIndividuels, prevoyancePerso.couvertureCollective, carmfConfig, cipavConfig, carpimkoConfig]
  );

  const categorie = prevoyancePerso.categorieInvaliditeProjetee;
  const scenarioArret: ScenarioArret = prevoyancePerso.scenarioArret ?? "ald";
  const tptConfig = prevoyancePerso.tpt;

  const caisseRefInvalidite =
    (referentiels.caisses as { caisses?: Record<string, { invalidite?: { modeTaux?: string } }> }).caisses?.[entree.caisse ?? ""]?.invalidite;
  const utiliseTauxInvalidite = caisseRefInvalidite?.modeTaux != null;
  const tauxInvaliditeProjete = prevoyancePerso.forfait?.tauxInvalidite ?? 100;
  const carenceJours: number =
    (referentiels.caisses as { caisses?: Record<string, { ij?: { carenceJours?: number } }> }).caisses?.[entree.caisse ?? ""]?.ij?.carenceJours ?? 3;
  const publicCaisse = entree.caisse
    ? (referentiels.caisses as { caisses?: Record<string, { publicConcerne?: string }> }).caisses?.[entree.caisse]?.publicConcerne ?? null
    : null;

  const projection = React.useMemo(
    () => projeterArretMaladie(entree, categorie, referentiels, scenarioArret, tptConfig),
    [entree, categorie, scenarioArret, tptConfig]
  );

  const constats = React.useMemo(() => {
    const ctx = buildContexteRegle(data, entree, projection, cible);
    return evaluerToutesLesRegles(ctx, cible);
  }, [data, entree, projection, cible]);

  // ── Dérivations de présentation (ZÉRO moteur) ──
  const { cible: cibleCouv, seuilCritique } = resolveSeuilsPrevoyance(data);
  const besoin = React.useMemo(() => buildBesoinCouverture(projection, cibleCouv), [projection, cibleCouv]);
  const dateCritique = React.useMemo(() => buildDateCritique(projection, seuilCritique), [projection, seuilCritique]);
  const vigilance = React.useMemo(() => pireRisques(buildVigilance(constats)), [constats]);

  const [vueGraphe, setVueGraphe] = React.useState<"graphique" | "tableau">("graphique");

  const roiLines: KpiRoiLine[] = [
    { label: "Cible", value: fmtEuroMois(besoin.cibleMontant), detail: `${pctInt(besoin.cible)} du revenu de référence` },
    { label: "Couverture au palier durable", value: fmtEuroMois(besoin.couvertureDurable), detail: `dès le ${besoin.durableMois}e mois · ${pctInt(besoin.couvertureDurablePct)}`, negative: true },
  ];

  const sections: React.ReactNode[] = [
    /* ══ EN-TÊTE ══ bande d'infos + contrôles de scénario/invalidité/TPT */
    (
      <div className="rounded-xl p-4 space-y-3" style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-bold text-base" style={{ color: BRAND.navy }}>{label}</div>
          <div className="text-xs" style={{ color: BRAND.muted }}>{entree.age} ans · retraite à {entree.ageRetraite} ans</div>
        </div>
        {/* C1 — bande d'infos en GRILLE FIXE (4 cellules, toujours rendues) : les deux
             colonnes de la vue « Les deux » se replient aux mêmes points, jamais selon
             la longueur des chiffres. Cellule vide -> « — ». */}
        <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: BRAND.muted }}>
          <span><strong style={{ color: BRAND.navy }}>Statut :</strong> {libelleStatut(entreeBase.statutPro)}</span>
          <span><strong style={{ color: BRAND.navy }}>Caisse :</strong> {entree.caisse ?? "—"}{entree.idccCCN ? ` · IDCC ${entree.idccCCN}` : ""}</span>
          <span><strong style={{ color: BRAND.navy }}>Ancienneté :</strong> {Math.floor(entree.ancienneteMois / 12)} an{entree.ancienneteMois >= 24 ? "s" : ""} ({entree.ancienneteMois} mois)</span>
          <span><strong style={{ color: BRAND.navy }}>Revenu réf. :</strong> {Math.round(projection.revenuReferenceMensuel).toLocaleString("fr-FR")} €/mois</span>
        </div>
        <AlerteAncienneteNonFiable statutPro={entree.statutPro} idccCCN={entree.idccCCN} dateEmbauche={data.travail?.[cible]?.dateEmbauche ?? null} className="mt-1" />

        {/* Contrôles de projection : scénario · invalidité */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t" style={{ borderColor: SURFACE.border }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Scénario</span>
            {(["maladie_ordinaire", "ald"] as const).map((sc) => (
              <label key={sc} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
                <input type="radio" name={`scenario-${cible}`} checked={scenarioArret === sc} onChange={() => onChangePrevoyance({ scenarioArret: sc })} />
                <span>{libelleScenario(sc)}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>{utiliseTauxInvalidite ? "Taux d'invalidité (%)" : "Invalidité"}</span>
            {utiliseTauxInvalidite ? (
              <input
                type="number" min={0} max={100} value={tauxInvaliditeProjete}
                onChange={(e) => onChangePrevoyance({ forfait: { ...(prevoyancePerso.forfait ?? { tauxInvalidite: 100 }), tauxInvalidite: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
                className="w-20 rounded-xl border px-2 py-1 text-sm" style={{ borderColor: SURFACE.border, color: BRAND.navy }}
              />
            ) : (
              (["cat1", "cat2", "cat3"] as const).map((cat) => (
                <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
                  <input type="radio" name={`cat-${cible}`} checked={categorie === cat} onChange={() => onChangePrevoyance({ categorieInvaliditeProjetee: cat })} />
                  <span>{libelleCategorie(cat)}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <BlocTpt value={tptConfig} carenceJours={carenceJours} onChange={(next) => onChangePrevoyance({ tpt: next })} />
        {projection.revenuReferenceMicroTNS && (
          <div className="rounded-xl p-3 text-sm" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}>
            <AlertTriangle className="inline-block h-4 w-4 shrink-0 mr-1.5 align-text-bottom" aria-hidden="true" />{WARNING_MICRO_TNS}
          </div>
        )}
      </div>
    ),
    /* ══ ACTE 1 — L'ESSENTIEL ══ besoin (carte-roi) + date critique + vigilance */
    (
      <div className="grid gap-4 min-[900px]:grid-cols-[1.4fr_1fr] items-stretch">
        <KpiRoiCard
          title={`Besoin de couverture minimum — ${label}`}
          amount={fmtEuroMois(besoin.besoin)}
          lines={roiLines}
          tooltip="Écart entre votre cible de revenu de remplacement et la couverture sur laquelle vous « atterrissez » (palier durable de la 1re année d'arrêt). Réglable dans Hypothèses."
          note={besoin.besoin <= 0 ? "Couverture au palier durable suffisante au regard de la cible." : undefined}
        />
        <div className="flex flex-col gap-3">
          <DateCritiqueCard dateCritique={dateCritique} />
          <VigilanceCard rows={vigilance} />
        </div>
      </div>
    ),
    /* ══ ACTE 2 — QUI VERSE QUOI ══ frise (inchangée) + bascule Graphique | Tableau € */
    (
      <div className="rounded-xl p-4" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Qui verse quoi, et jusqu'à quand — {label}</div>
          <div className="inline-flex rounded-xl p-1" style={{ background: "rgba(15,23,42,0.06)" }}>
            {([["graphique", "Graphique", BarChart3], ["tableau", "Tableau €", Table]] as const).map(([v, txt, Icone]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vueGraphe === v}
                onClick={() => setVueGraphe(v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A67F32]"
                style={{ background: vueGraphe === v ? BRAND.navy : "transparent", color: vueGraphe === v ? "#fff" : BRAND.navy, border: "none", cursor: "pointer" }}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" />{txt}
              </button>
            ))}
          </div>
        </div>
        {vueGraphe === "tableau"
          ? <TableauEuroPayeurs projection={projection} />
          : <ProjectionChart projection={projection} codeCaisse={entree.caisse} publicCaisse={publicCaisse} />}
      </div>
    ),
    /* Constats compressés (une ligne dépliable) */
    (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>Constats et pistes</div>
        <BlocConstatsCompacts constats={constats} />
      </div>
    ),
    /* ══ ACTE 3 — POUR ALLER PLUS LOIN ══ (accordéons fermés) */
    (
      <SectionAccordion title="Comprendre les mécanismes" summary="Lecture pédagogique du RDV : légende, jauge, ruptures, encarts (carence, maintien…)">
        <BlocPedagogie projection={projection} />
      </SectionAccordion>
    ),
    (
      <SectionAccordion title="Détail des contrats" summary="Couverture collective, contrats individuels et capitaux / rentes décès">
        <div className="space-y-4">
          <div className="flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs" style={{ background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}`, color: BRAND.muted }}>
            <HelpTooltip text="Indemnitaire : la prestation est plafonnée à votre revenu réel (cas le plus fréquent). Forfaitaire : le montant souscrit est versé intégralement. Vérifiez vos conditions générales." label="Indemnitaire / forfaitaire" />
            <span><strong style={{ color: BRAND.navy }}>Indemnitaire vs forfaitaire :</strong> l'indemnitaire plafonne la prestation à votre revenu réel ; le forfaitaire verse le montant souscrit en intégralité.</span>
          </div>
          <BlocCouvertureCollective value={prevoyancePerso.couvertureCollective} onChange={(next) => onChangePrevoyance({ couvertureCollective: next })} />
          <BlocContratsIndividuels contrats={prevoyancePerso.contratsIndividuels} onChange={(next) => onChangePrevoyance({ contratsIndividuels: next })} data={data} which={cible === "p1" ? 1 : 2} />
          <div className="space-y-3">
            <div className="text-sm font-bold" style={{ color: BRAND.navy }}>Décès</div>
            <BlocTransmissionDeces contrats={getContratsTransmissionDeces(prevoyancePerso)} onChange={(next) => onChangePrevoyance({ contratsTransmissionDeces: next })} data={data} whichDefunt={cible === "p1" ? 1 : 2} />
            <RentesSurvivants contrats={prevoyancePerso.contratsIndividuels} onChange={(next) => onChangePrevoyance({ contratsIndividuels: next })} />
          </div>
        </div>
      </SectionAccordion>
    ),
    (
      <SectionAccordion title="Régime obligatoire de la caisse" summary={entree.caisse ? `${entree.caisse}${publicCaisse ? ` · ${publicCaisse}` : ""}` : "Régime non précisé"}>
        <div className="text-sm space-y-1.5" style={{ color: BRAND.muted }}>
          <div className="flex justify-between"><span>Caisse d'affiliation</span><strong style={{ color: BRAND.navy }}>{entree.caisse ?? "—"}</strong></div>
          {publicCaisse && <div className="flex justify-between"><span>Public concerné</span><strong style={{ color: BRAND.navy }}>{publicCaisse}</strong></div>}
          <div className="flex justify-between"><span>Carence indemnités journalières</span><strong style={{ color: BRAND.navy }}>{carenceJours} jour{carenceJours > 1 ? "s" : ""}</strong></div>
          <p className="pt-1">Le régime obligatoire constitue le socle de la couverture (bas de la frise) ; les indemnités journalières puis la pension d'invalidité en dépendent. Les paliers exacts figurent dans la projection ci-dessus.</p>
          {entree.caisse === "FONCTION_PUBLIQUE" && (
            <p style={{ fontStyle: "italic" }}>Fonctionnaire titulaire : maintien statutaire 90 % du revenu pendant 3 mois puis 50 % pendant 9 mois (modèle conservateur territorial/hospitalier).</p>
          )}
        </div>
      </SectionAccordion>
    ),
  ];

  // Vue « Les deux » : placement de grille explicite (rangées homologues alignées).
  if (col) {
    return (
      <>
        {sections.map((s, i) => (
          <div key={i} className={`${COL_START[col]} ${ROW_START[i]}`}>{s}</div>
        ))}
      </>
    );
  }
  // Vue simple : empilement classique.
  return <div className="space-y-4">{sections.map((s, i) => <React.Fragment key={i}>{s}</React.Fragment>)}</div>;
}

// ── Cartes contextuelles de l'acte 1 ─────────────────────────────────────────

function DateCritiqueCard({ dateCritique }: { dateCritique: ReturnType<typeof buildDateCritique> }) {
  const seuilTxt = pctInt(dateCritique.seuil);
  // Vert : jamais franchie, OU franchissement dû au seul passage retraite (A2).
  if (dateCritique.statut === "jamais" || dateCritique.statut === "retraite") {
    const sousTexte = dateCritique.statut === "retraite"
      ? `Franchissement uniquement au passage retraite (fin de la pension d'invalidité) — pas un trou de la vie active.`
      : `Couverture ≥ ${seuilTxt} sur toute la période projetée.`;
    return (
      <div className="rounded-2xl px-4 py-3 flex-1 flex flex-col justify-center" style={{ background: BRAND.successBg, border: `1px solid ${BRAND.successBorder}` }}>
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.success }}>Date critique — couverture &lt; {seuilTxt}</div>
        <div className="font-black mt-1" style={{ color: BRAND.success, fontSize: 18, lineHeight: 1.1 }}>{dateCritique.statut === "retraite" ? `Couverture ≥ ${seuilTxt} jusqu'à la retraite` : "Jamais franchie"}</div>
        <div className="text-[11px] mt-0.5" style={{ color: BRAND.muted }}>{sousTexte}</div>
      </div>
    );
  }
  const valeur = dateCritique.statut === "des_le_debut" ? "dès le 1er jour" : dateCritique.libelle;
  const dateTooltip = dateCritique.statut === "critique" ? `Jour exact : J${dateCritique.jour} (${dateCritique.date}).` : "Couverture insuffisante dès le début de l'arrêt.";
  return (
    <div className="rounded-2xl px-4 py-3 flex-1 flex flex-col justify-center" style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wider flex items-center" style={{ color: BRAND.warning }}>
        Date critique — couverture &lt; {seuilTxt}
        <HelpTooltip text={dateTooltip} label="Date critique" />
      </div>
      <div className="font-black mt-1" style={{ color: BRAND.navy, fontSize: 20, lineHeight: 1.1 }}>{valeur}</div>
      <div className="text-[11px] mt-0.5" style={{ color: BRAND.muted }}>couverture ramenée à {pctInt(dateCritique.pct)} du revenu de référence</div>
    </div>
  );
}

function VigilanceCard({ rows }: { rows: VigilanceRow[] }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: SURFACE.cardShadow }}>
      <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND.muted }}>Points de vigilance</div>
      {rows.length === 0 ? (
        <div className="text-xs" style={{ color: BRAND.muted }}>Aucun risque majeur signalé sur la couverture en place.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const coul = COULEURS_SEVERITE[r.severite];
            const Icone = coul.icone;
            return (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <Icone className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: coul.texte }} aria-hidden="true" />
                <span className="min-w-0 flex-1" style={{ color: BRAND.navy }}>
                  {r.titre}
                  <span style={{ color: BRAND.muted }}> · {LIBELLE_AXE[r.axe] ?? r.axe}</span>
                </span>
                {r.montant != null && <span className="shrink-0 font-bold" style={{ color: coul.texte }}>{Math.round(r.montant).toLocaleString("fr-FR")} €</span>}
              </li>
            );
          })}
        </ul>
      )}
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
    case "cat1": return "Cat 1 — activité réduite";
    case "cat2": return "Cat 2 — incapable";
    case "cat3": return "Cat 3 — + tierce personne";
  }
}

function libelleScenario(s: ScenarioArret): string {
  switch (s) {
    case "maladie_ordinaire": return "Maladie ordinaire (max 360 j)";
    case "ald": return "Affection longue durée (jusqu'à 3 ans)";
  }
}
