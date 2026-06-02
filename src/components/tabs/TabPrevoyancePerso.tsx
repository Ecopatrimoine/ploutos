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
import { BlocTransmissionDeces } from "../prevoyance/BlocTransmissionDeces";
import { BlocTpt } from "../prevoyance/BlocTpt";
// defaultCarmf/Cipav/Carpimko restent importés : ils seedent les configs
// injectées dans l'entrée de projection. La SAISIE des blocs caisse a été
// déplacée dans l'onglet Travail (cf. BlocStatutEmployeur voisin).
import { defaultCarmf } from "../prevoyance/BlocCarmf";
import { defaultCipav } from "../prevoyance/BlocCipav";
import { defaultCarpimko } from "../prevoyance/BlocCarpimko";
import { BandeauResumeClient, BlocPedagogie } from "../prevoyance/BlocPedagogie";
import { getContratsTransmissionDeces, getPrevoyancePerso, patchPrevoyancePair } from "../../lib/prevoyance/utils";

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
    setField("prevoyance", patchPrevoyancePair(data.prevoyance, which, patch, entreeP2Base !== null));
  }

  const hasP2 = entreeP2Base !== null;

  // Affichage côte à côte sur écran intermédiaire (tablette). Sur grand écran
  // (xl+) la grille est déjà en 2 colonnes nativement et le toggle est masqué ;
  // ce drapeau ne sert qu'à forcer 2 colonnes EN DESSOUS de xl, à la demande.
  // État de session uniquement (pas de persistance) : préférence d'affichage
  // transitoire, qui dépend de l'orientation tablette du moment.
  const [forceWide, setForceWide] = React.useState(false);

  return (
    <TabsContent value="prevoyance" className="space-y-4">
      <Card className="border-0 relative overflow-hidden">
        <CardAccentTop />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              icon={ShieldCheck}
              title="Prévoyance personnelle"
              subtitle="Projection de revenus en cas d'arrêt maladie puis invalidité, par personne du foyer."
            />
            {/* Toggle d'affichage — utile seulement en mode 2 personnes et sur
                écran intermédiaire (tablette). Masqué sur grand écran (xl:hidden,
                déjà 2 colonnes) et inexistant en mode 1 personne. */}
            {hasP2 && (
              <button
                type="button"
                onClick={() => setForceWide((w) => !w)}
                aria-pressed={forceWide}
                className="xl:hidden shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32]"
                style={{
                  background: forceWide ? BRAND.navy : SURFACE.card,
                  color: forceWide ? "#fff" : BRAND.navy,
                  border: `1px solid ${forceWide ? BRAND.navy : SURFACE.border}`,
                  cursor: "pointer",
                }}
              >
                {forceWide ? "↕ 1 colonne" : "↔ 2 colonnes"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!entreeP1Base ? (
            <EtatVide onGoToTravail={onGoToTravail} />
          ) : (
            <div
              className={
                hasP2
                  ? forceWide
                    ? "grid gap-6 grid-cols-2 xl:grid-rows-[auto_1fr]"
                    : "grid gap-6 xl:grid-cols-2 xl:grid-rows-[auto_1fr]"
                  : "max-w-3xl mx-auto"
              }
            >
              <ColonnePerso
                label={person1}
                entreeBase={entreeP1Base}
                prevoyancePerso={getPrevoyancePerso(data, "p1")}
                onChangePrevoyance={(patch) => patchPrevoyance("p1", patch)}
                cible="p1"
                data={data}
                aligned={hasP2}
              />
              {hasP2 && entreeP2Base && (
                <ColonnePerso
                  label={person2}
                  entreeBase={entreeP2Base}
                  prevoyancePerso={getPrevoyancePerso(data, "p2")}
                  onChangePrevoyance={(patch) => patchPrevoyance("p2", patch)}
                  cible="p2"
                  data={data}
                  aligned={hasP2}
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
          className="rounded-xl px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#A67F32]"
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
  // true en mode 2 personnes (colonnes côte à côte) → réserve une hauteur
  // minimale au récap pour aligner les 2 colonnes. Inactif en mode 1 personne.
  aligned: boolean;
};

function ColonnePerso({
  label,
  entreeBase,
  prevoyancePerso,
  onChangePrevoyance,
  cible,
  data,
  aligned,
}: ColonneProps) {
  // Pour un médecin affilié CARMF, le moteur a besoin du sous-objet carmf
  // (architecture 2 étages + invalidité CARMF). À défaut de saisie, on
  // applique une configuration par défaut pour activer la projection CARMF.
  // Pour chaque caisse à config dédiée, on part de la config persistée (ou du
  // défaut) PUIS on injecte EN LIVE les champs « situation familiale » dérivés
  // du foyer (marié, années de mariage, ressources du conjoint, enfants). Le
  // foyer (onglet Famille + revenus) est ainsi la source VIVANTE : aucune
  // double saisie, et la config persistée ne peut pas dériver du dossier.
  // Mémoïsé pour préserver l'identité de référence (sinon la projection se
  // recalculerait à chaque rendu).
  const estCarmf = entreeBase.caisse === "CARMF";
  const carmfConfig = React.useMemo(
    () =>
      estCarmf
        ? {
            ...(prevoyancePerso.carmf ?? defaultCarmf(entreeBase)),
            marie: entreeBase.marie ?? false,
            anneesMariage: entreeBase.anneesMariage ?? 0,
            ressourcesConjoint: entreeBase.ressourcesConjointAnnuelles ?? 0,
          }
        : undefined,
    [estCarmf, prevoyancePerso.carmf, entreeBase]
  );
  const estCipav = entreeBase.caisse === "CIPAV";
  const cipavConfig = React.useMemo(
    () =>
      estCipav
        ? {
            ...(prevoyancePerso.cipav ?? defaultCipav(entreeBase)),
            marie: entreeBase.marie ?? false,
            nbEnfants: entreeBase.nbEnfantsACharge ?? 0,
          }
        : undefined,
    [estCipav, prevoyancePerso.cipav, entreeBase]
  );
  const estCarpimko = entreeBase.caisse === "CARPIMKO";
  const carpimkoConfig = React.useMemo(
    () =>
      estCarpimko
        ? {
            ...(prevoyancePerso.carpimko ?? defaultCarpimko(entreeBase)),
            marie: entreeBase.marie ?? false,
            nbEnfants: entreeBase.nbEnfantsACharge ?? 0,
          }
        : undefined,
    [estCarpimko, prevoyancePerso.carpimko, entreeBase]
  );

  // L'entree complete = mapping travail + saisies UI (contrats + couverture)
  const entree: EntreePerso = React.useMemo(
    () => ({
      ...entreeBase,
      // Les types PayloadContratIndividuel/PayloadCouvertureCollective et leurs
      // homologues moteur sont structurellement identiques (cf. note types/patrimoine.ts).
      contratsIndividuels: prevoyancePerso.contratsIndividuels as unknown as MoteurContratIndividuel[],
      couvertureCollective: prevoyancePerso.couvertureCollective as unknown as MoteurCouvertureCollective | null,
      carmf: carmfConfig,
      cipav: cipavConfig,
      carpimko: carpimkoConfig,
    }),
    [entreeBase, prevoyancePerso.contratsIndividuels, prevoyancePerso.couvertureCollective, carmfConfig, cipavConfig, carpimkoConfig]
  );

  const categorie = prevoyancePerso.categorieInvaliditeProjetee;
  const scenarioArret: ScenarioArret = prevoyancePerso.scenarioArret ?? "ald";
  const tptConfig = prevoyancePerso.tpt;

  // Référence JSON de la caisse (caisseRef) : pilote la bascule taux% / radios
  // cat1-3. Critère = la DONNÉE (caisseRef.invalidite.modeTaux ∈ {binaire,
  // proportionnel}), PAS une liste de codes en dur (cf. SPEC §5.3).
  const caisseRefInvalidite =
    (referentiels.caisses as { caisses?: Record<string, { invalidite?: { modeTaux?: string } }> })
      .caisses?.[entree.caisse ?? ""]?.invalidite;
  const utiliseTauxInvalidite = caisseRefInvalidite?.modeTaux != null;
  const tauxInvaliditeProjete = prevoyancePerso.forfait?.tauxInvalidite ?? 100;

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
    const ctx = buildContexteRegle(data, entree, projection, cible);
    return evaluerToutesLesRegles(ctx, cible);
  }, [data, entree, projection, cible]);

  // Natures des contrats complémentaires (indemnitaire / forfaitaire) pour
  // le bandeau résumé — lecture passive des saisies, aucun recalcul.
  const naturesContrats = React.useMemo(
    () =>
      Array.from(
        new Set(prevoyancePerso.contratsIndividuels.map((c) => c.nature ?? "indemnitaire"))
      ),
    [prevoyancePerso.contratsIndividuels]
  );

  return (
    <div
      className={
        aligned
          ? "space-y-4 xl:space-y-0 xl:grid xl:row-span-2 xl:[grid-template-rows:subgrid] xl:gap-4"
          : "space-y-4"
      }
    >
      {/* Récap statut — en mode 2 personnes, la colonne est un subgrid sur 2
          lignes : le récap occupe la 1ʳᵉ piste (auto = hauteur du plus grand des
          deux), et xl:h-full fait remplir cette hauteur aux deux cartes. Pas de
          valeur fixe : l'alignement s'adapte au contenu (P1 3 lignes / P2 2). */}
      <div
        className={`rounded-xl p-4 ${aligned ? "xl:h-full" : ""}`}
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

      {/* Corps de colonne — un seul conteneur, pour occuper la 2e piste du
          subgrid en mode 2 personnes (empilement normal sinon). */}
      <div className="space-y-4">

      {/* La SAISIE des blocs caisse (CARMF/CIPAV/CARPIMKO) est désormais dans
          l'onglet Travail, sous « Statut professionnel & employeur ». Ici, on
          LIT seulement la config (carmfConfig/… injectés dans l'entrée) pour la
          projection — cet onglet redevient lecture/projection pure. */}

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

      {/* Invalidité projetée : pour les caisses à MODE TAUX (forfaitaires —
          caisseRef.invalidite.modeTaux défini), saisie d'un taux % (pattern
          CIPAV/CARPIMKO) à la place des radios cat1/2/3. Sinon (CPAM/SSI, mode
          catégorie) : radios cat1/2/3. Critère porté par la donnée caisse, pas
          un code en dur (cf. SPEC §5.3). */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          {utiliseTauxInvalidite ? "Taux d'invalidité projeté (%)" : "Catégorie d'invalidité projetée"}
        </div>
        {utiliseTauxInvalidite ? (
          <input
            type="number"
            min={0}
            max={100}
            value={tauxInvaliditeProjete}
            onChange={(e) =>
              onChangePrevoyance({
                forfait: {
                  ...(prevoyancePerso.forfait ?? { tauxInvalidite: 100 }),
                  tauxInvalidite: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                },
              })
            }
            className="w-24 rounded-xl border px-2 py-1 text-sm"
            style={{ borderColor: SURFACE.border, color: BRAND.navy }}
          />
        ) : (
          (["cat1", "cat2", "cat3"] as const).map((cat) => (
            <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: BRAND.navy }}>
              <input
                type="radio"
                name={`cat-${cible}`}
                checked={categorie === cat}
                onChange={() => onChangePrevoyance({ categorieInvaliditeProjetee: cat })}
              />
              <span>{libelleCategorie(cat)}</span>
            </label>
          ))
        )}
      </div>

      {/* Warning micro-TNS : revenu de référence calé sur le CA */}
      {projection.revenuReferenceMicroTNS && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}
        >
          {WARNING_MICRO_TNS}
        </div>
      )}

      {/* Bandeau résumé client (ÉL. 1) — lecture passive au-dessus du graphe */}
      <BandeauResumeClient
        profil={libelleStatut(entreeBase.statutPro)}
        caisse={entree.caisse}
        revenuRefMensuel={projection.revenuReferenceMensuel}
        scenarioLibelle={libelleScenario(scenarioArret)}
        naturesContrats={naturesContrats}
      />

      {/* Graphique */}
      <div
        className="rounded-xl p-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND.sky }}>
          Projection des revenus de remplacement
        </div>
        <ProjectionChart
          projection={projection}
          codeCaisse={entree.caisse}
          publicCaisse={
            entree.caisse
              ? (referentiels.caisses as { caisses?: Record<string, { publicConcerne?: string }> })
                  .caisses?.[entree.caisse]?.publicConcerne ?? null
              : null
          }
        />
      </div>

      {/* Couche pédagogique RDV (ÉL. 2 à 6) — carte dédiée, montage explicite */}
      <div
        className="rounded-xl p-4"
        style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND.sky }}>
          Lecture pédagogique (RDV client)
        </div>
        <BlocPedagogie projection={projection} />
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

      {/* Transmission décès — contrats privés versant un capital aux
          bénéficiaires (hors 9 séries ; lus par la succession au Lot 3). */}
      <BlocTransmissionDeces
        contrats={getContratsTransmissionDeces(prevoyancePerso)}
        onChange={(next) => onChangePrevoyance({ contratsTransmissionDeces: next })}
      />

      {/* Constats */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Constats et pistes
        </div>
        <BlocConstats constats={constats} />
      </div>
      </div>{/* fin corps de colonne */}
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
