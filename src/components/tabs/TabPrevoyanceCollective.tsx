// ─── TabPrevoyanceCollective — onglet Prévoyance collective (Lot 8) ────
//
// Mode dirigeant : actif automatiquement si data.travail.{p1|p2}.statutPro
// ∈ {gerant_majoritaire, president_sas, eurl_unique}. L'entreprise
// auditée est celle de la personne dirigeante (employeur.siret +
// employeur.idccCCN viennent du payload Travail).
//
// Mode analyse externe : pour les non-dirigeants, toggle d'activation
// explicite (cf. spec §10.3) — utile pour les missions RH ou les audits
// commandés par un tiers.
//
// Le bloc déclarations couverture (santé, prévoyance cadres, etc.) et
// les contrôles d'audit s'appliquent dans les deux modes.

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Building2 } from "lucide-react";
import type {
  PatrimonialData,
  PayloadPrevoyance,
  PayloadPrevoyanceCollective,
  PrevoyanceCollectiveSource,
  EntrepriseAudit,
} from "../../types/patrimoine";
import { BRAND, SURFACE } from "../../constants";
import { CardAccentTop } from "../CardAccentTop";
import { SectionTitle } from "../shared";
import { BlocEntreprise, emptyEntrepriseAudit } from "../prevoyance/BlocEntreprise";
import { BlocAuditConformite } from "../prevoyance/BlocAuditConformite";
import { BlocObligationsBranche } from "../prevoyance/BlocObligationsBranche";
import { BlocConstats } from "../prevoyance/BlocConstats";
import { runAuditConformite } from "../../lib/prevoyance/audit-collectif";
import { mapAuditEnConstats } from "../../lib/prevoyance/regles";
import { resolveComparaisonBranche, mapBrancheEnVue } from "../../lib/prevoyance/comparaison-branche-vue";
import { referentiels } from "../../data/prevoyance";

const STATUTS_DIRIGEANT = ["gerant_majoritaire", "president_sas", "eurl_unique"];

function detectDirigeant(data: PatrimonialData): PrevoyanceCollectiveSource | null {
  if (STATUTS_DIRIGEANT.includes(data.travail?.p1?.statutPro ?? "")) return "dirigeant_p1";
  if (STATUTS_DIRIGEANT.includes(data.travail?.p2?.statutPro ?? "")) return "dirigeant_p2";
  return null;
}

function entrepriseDepuisTravail(data: PatrimonialData, source: PrevoyanceCollectiveSource): EntrepriseAudit {
  const t =
    source === "dirigeant_p1"
      ? data.travail?.p1
      : source === "dirigeant_p2"
      ? data.travail?.p2 ?? null
      : null;
  const employeur = t?.employeur ?? null;
  const base = emptyEntrepriseAudit();
  if (!employeur) return base;
  return {
    ...base,
    siret: employeur.siret,
    nom: employeur.nom,
    formeJuridique: employeur.formeJuridique,
    effectif: employeur.effectif,
    idccCCN: employeur.idccCCN,
    nomCCN: employeur.nomCCN,
    codeNAF: employeur.codeNAF,
  };
}

type Props = {
  data: PatrimonialData;
  setField: <K extends keyof PatrimonialData>(key: K, value: PatrimonialData[K]) => void;
  person1: string;
  person2: string;
};

const TabPrevoyanceCollective = React.memo(function TabPrevoyanceCollective({
  data,
  setField,
  person1,
  person2,
}: Props) {
  const dirigeantSource = detectDirigeant(data);
  const collective: PayloadPrevoyanceCollective | null = data.prevoyance?.collective ?? null;

  // Si dirigeant détecté et pas encore de collective enregistrée,
  // on auto-active avec l'entreprise du dirigeant pré-remplie.
  const autoActive = dirigeantSource !== null;

  function patchCollective(next: PayloadPrevoyanceCollective | null) {
    const current: PayloadPrevoyance = data.prevoyance ?? {
      version: 1,
      p1: { contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2" },
      p2: null,
      collective: null,
    };
    setField("prevoyance", { ...current, collective: next });
  }

  // Lit la valeur effective de collective (peut être null) en
  // appliquant l'auto-activation si dirigeant détecté.
  const effective: PayloadPrevoyanceCollective = React.useMemo(() => {
    if (collective && collective.active) return collective;
    if (autoActive && dirigeantSource) {
      return (
        collective ?? {
          active: true,
          source: dirigeantSource,
          entreprise: entrepriseDepuisTravail(data, dirigeantSource),
        }
      );
    }
    return (
      collective ?? {
        active: false,
        source: "analyse_externe",
        entreprise: emptyEntrepriseAudit(),
      }
    );
  }, [collective, autoActive, dirigeantSource, data]);

  const audit = React.useMemo(
    () => (effective.active ? runAuditConformite(effective.entreprise, referentiels) : null),
    [effective.active, effective.entreprise]
  );
  const constats = React.useMemo(() => (audit ? mapAuditEnConstats(audit) : []), [audit]);

  // Vue obligations de branche + gap-analysis (calque du pattern audit ci-dessus,
  // memes dependances). Composant purement presentationnel en aval.
  const comparaisonVue = React.useMemo(
    () =>
      effective.active
        ? mapBrancheEnVue(resolveComparaisonBranche(effective.entreprise, referentiels))
        : null,
    [effective.active, effective.entreprise]
  );

  function setEntreprise(next: EntrepriseAudit) {
    patchCollective({ ...effective, entreprise: next });
  }

  function toggleActivation(active: boolean) {
    patchCollective({ ...effective, active });
  }

  const personneDirigeante =
    dirigeantSource === "dirigeant_p1" ? person1 : dirigeantSource === "dirigeant_p2" ? person2 : null;

  return (
    <TabsContent value="prevoyance-coll" className="space-y-4">
      <Card className="border-0 relative overflow-hidden">
        <CardAccentTop />
        <CardHeader>
          <SectionTitle
            icon={Building2}
            title="Prévoyance collective"
            subtitle={
              personneDirigeante
                ? `Dirigeant analysé : ${personneDirigeante}`
                : "Audit conformité de la couverture collective en place"
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {!autoActive && (
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid #F59E0B",
                color: "#7C4A04",
              }}
            >
              <div className="font-bold mb-1">⚠ Mode analyse externe</div>
              <p className="text-sm mb-3">
                Aucun dirigeant n'est détecté dans le foyer (statuts gérant
                majoritaire / président SAS / EURL unique). Activez l'analyse
                externe ci-dessous si vous souhaitez auditer la couverture
                collective d'un tiers (mission RH, audit conseil, conformité).
              </p>
              <label className="flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.navy }}>
                <input
                  type="checkbox"
                  checked={effective.active}
                  onChange={(e) => toggleActivation(e.target.checked)}
                />
                <span>Activer (analyse externe RH / audit)</span>
              </label>
            </div>
          )}

          {effective.active && (
            <>
              <BlocEntreprise value={effective.entreprise} onChange={setEntreprise} />

              {audit && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
                >
                  <BlocAuditConformite audit={audit} />
                </div>
              )}

              {comparaisonVue && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
                >
                  <BlocObligationsBranche vue={comparaisonVue} />
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
                  Constats et pistes (entreprise)
                </div>
                <BlocConstats constats={constats} />
              </div>
            </>
          )}

          {!effective.active && autoActive && (
            // cas improbable mais protégé
            <div className="text-sm" style={{ color: BRAND.muted }}>
              Audit désactivé. Activez-le pour relancer l'analyse.
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
});

TabPrevoyanceCollective.displayName = "TabPrevoyanceCollective";
export { TabPrevoyanceCollective };
