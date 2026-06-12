import React from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Briefcase, ShieldCheck, Stethoscope } from "lucide-react";
import { BRAND, SURFACE, PCS_GROUPES, PCS_CATEGORIES } from "../../constants";
import type { PayloadTravail, PayloadTravailPair, PayloadPrevoyancePerso } from "../../types/patrimoine";
import { isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, isIndependant } from "../../lib/calculs/utils";
import { Field, SectionTitle } from "../shared";
import { BlocStatutEmployeur } from "../travail/BlocStatutEmployeur";
import { createEmptyTravail, getPrevoyancePerso, patchPrevoyancePair, suggestStatutFromCsp } from "../../lib/prevoyance/utils";
import { buildEntreePerso } from "../../lib/prevoyance/mapping";
import { BlocCarmf, defaultCarmf } from "../prevoyance/BlocCarmf";
import { BlocCipav, defaultCipav } from "../prevoyance/BlocCipav";
import { BlocCarpimko, defaultCarpimko } from "../prevoyance/BlocCarpimko";
import { BlocForfait, defaultForfait } from "../prevoyance/BlocForfait";
import { referentiels } from "../../data/prevoyance";

// Référence JSON d'une caisse (caisseRef) depuis le référentiel. null si
// inconnue. Utilisée pour aiguiller les caisses FORFAITAIRES par la DONNÉE
// (caisseRef.moteur === "forfaitaire"), pas par une liste de codes en dur.
function lookupCaisseRef(code: string | null): any {
  if (!code) return null;
  return (referentiels.caisses as { caisses?: Record<string, any> }).caisses?.[code] ?? null;
}


// ── TabTravail ─────────────────────────────────────────────────────────────────────
const TabTravail = React.memo(function TabTravail(props: any) {
  // Destructure props (toutes les valeurs viennent du parent AppInner)
  const { data, setField, person1, person2 } = props;

  const isCouple =
    data.coupleStatus === "married" ||
    data.coupleStatus === "pacs" ||
    data.coupleStatus === "cohab";

  function getTravail(which: 1 | 2): PayloadTravail {
    if (which === 1) return data.travail?.p1 ?? createEmptyTravail();
    return data.travail?.p2 ?? createEmptyTravail();
  }

  function patchTravail(which: 1 | 2, patch: Partial<PayloadTravail>) {
    const currentPair: PayloadTravailPair = data.travail ?? {
      p1: createEmptyTravail(),
      p2: isCouple ? createEmptyTravail() : null,
    };
    const nextPair: PayloadTravailPair =
      which === 1
        ? { ...currentPair, p1: { ...currentPair.p1, ...patch } }
        : {
            ...currentPair,
            p2: { ...(currentPair.p2 ?? createEmptyTravail()), ...patch },
          };
    setField("travail", nextPair);
  }

  // Pré-remplissage du statut prévoyance (data.travail.{p1|p2}.statutPro) à partir
  // de la PCS/CSP — SUGGESTION uniquement (Option 2). On ne pose le statut QUE s'il
  // est encore vide : jamais d'écrasement d'une saisie manuelle. "" = pas de
  // suggestion (cas ambigu) → on ne touche à rien.
  function maybeSuggestStatut(which: 1 | 2, pcsGroupe: string, csp: string) {
    const current = (which === 1 ? data.travail?.p1 : data.travail?.p2)?.statutPro ?? "";
    if (current !== "") return;
    const suggestion = suggestStatutFromCsp(pcsGroupe, csp);
    if (suggestion) patchTravail(which, { statutPro: suggestion });
  }

  // Saisie « activité caisse » (prévoyance) — écrit dans data.prevoyance.{p1|p2}
  // via le util partagé (même logique que l'onglet Prévoyance). Le stockage
  // reste data.prevoyance ; seule la saisie est ici, à côté du statut/employeur.
  function patchPrev(which: "p1" | "p2", patch: Partial<PayloadPrevoyancePerso>) {
    setField("prevoyance", patchPrevoyancePair(data.prevoyance, which, patch, isCouple));
  }

  // Bloc caisse d'une personne, conditionné à sa caisse libérale ; null sinon
  // (aucune carte vide). entreeBase seede les défauts (revenu, ancienneté, foyer).
  function caisseBloc(which: 1 | 2): React.ReactNode {
    const w = which === 1 ? "p1" : "p2";
    const entreeBase = buildEntreePerso(data, w);
    if (!entreeBase) return null;
    const pp = getPrevoyancePerso(data, w);
    switch (entreeBase.caisse) {
      case "CARMF":
        return <BlocCarmf value={pp.carmf ?? defaultCarmf(entreeBase)} onChange={(next) => patchPrev(w, { carmf: next })} />;
      case "CIPAV":
        return <BlocCipav value={pp.cipav ?? defaultCipav(entreeBase)} onChange={(next) => patchPrev(w, { cipav: next })} />;
      case "CARPIMKO":
        return <BlocCarpimko value={pp.carpimko ?? defaultCarpimko(entreeBase)} onChange={(next) => patchPrev(w, { carpimko: next })} />;
      default: {
        // Caisses FORFAITAIRES (CNBF, CARCDSF, CAVEC…) : aiguillage par la
        // DONNÉE (caisseRef.moteur === "forfaitaire"), pas un code en dur →
        // ajouter une caisse = ajouter un JSON, zéro code ici.
        const caisseRef = lookupCaisseRef(entreeBase.caisse);
        if (caisseRef?.moteur === "forfaitaire") {
          const jobTitle = which === 1 ? data.person1JobTitle : data.person2JobTitle;
          return (
            <BlocForfait
              value={pp.forfait ?? defaultForfait(entreeBase, jobTitle)}
              onChange={(next) => patchPrev(w, { forfait: next })}
              caisseRef={caisseRef}
              revenuTNSAnnuel={entreeBase.revenuTNSAnnuel}
            />
          );
        }
        return null;
      }
    }
  }

  const blocCaisseP1 = caisseBloc(1);
  const blocCaisseP2 = isCouple ? caisseBloc(2) : null;

  return (
<TabsContent value="travail" className="space-y-4">
  <Card className="border-0" style={{ borderRadius: 20 }}>
    <CardHeader><SectionTitle icon={Briefcase} title="Situation professionnelle" subtitle="Statut, catégorie socioprofessionnelle et régime fiscal" /></CardHeader>
    <CardContent className="space-y-4">
  <div className="grid gap-4 md:grid-cols-2">
    {([1, 2] as const).map((which) => {
      const groupe = which === 1 ? data.person1PcsGroupe : data.person2PcsGroupe;
      const categorie = which === 1 ? data.person1Csp : data.person2Csp;
      const categories = groupe ? PCS_CATEGORIES[groupe] ?? [] : [];
      return (
        <div key={which} className="border p-4 space-y-3" style={{ borderColor: SURFACE.border, background: SURFACE.card, borderRadius: 14, boxShadow: SURFACE.cardShadow }}>
          <div className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND.navy }}>{which === 1 ? person1 : person2}</div>

          {/* Intitulé du poste */}
          <Field label="Intitulé du poste">
            <Input
              value={which === 1 ? data.person1JobTitle : data.person2JobTitle}
              onChange={(e) => setField(which === 1 ? "person1JobTitle" : "person2JobTitle", e.target.value)}
              className="rounded-xl"
            />
          </Field>

          {/* Sélecteur 1 — Groupe PCS */}
          <Field label="Groupe socioprofessionnel (PCS)">
            <Select
              value={groupe}
              onValueChange={(v) => {
                setField(which === 1 ? "person1PcsGroupe" : "person2PcsGroupe", v);
                setField(which === 1 ? "person1Csp" : "person2Csp", "");
                maybeSuggestStatut(which, v, "");
              }}
            >
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner un groupe…" /></SelectTrigger>
              <SelectContent>
                {PCS_GROUPES.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    <span className="font-medium">{g.code}</span> — {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Sélecteur 2 — Catégorie PCS (affiché seulement si groupe choisi) */}
          {groupe && categories.length > 0 && (
            <Field label="Catégorie socioprofessionnelle">
              <Select
                value={categorie}
                onValueChange={(v) => {
                  setField(which === 1 ? "person1Csp" : "person2Csp", v);
                  maybeSuggestStatut(which, groupe, v);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner une catégorie…">
                    {categorie ? (() => { const found = categories.find(c => c.code === categorie); return found ? `${found.code} — ${found.label}` : categorie; })() : "Sélectionner une catégorie…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-medium">{c.code}</span> — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Badge récapitulatif fiscal */}
          {groupe && (
            <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{
              background: isIndependant(groupe) ? "rgba(227,175,100,0.15)" : "rgba(81,106,199,0.1)",
              color: isIndependant(groupe) ? BRAND.gold : BRAND.sky,
              border: `1px solid ${isIndependant(groupe) ? "rgba(227,175,100,0.3)" : "rgba(81,106,199,0.2)"}`,
            }}>
              {isRetraite(groupe) && "🔵 Retraité — revenus de pension"}
              {isSansActivite(groupe) && "⚪ Sans activité professionnelle"}
              {groupe === "1" && "🟡 Indépendant — Bénéfices Agricoles (BA)"}
              {groupe === "2" && !isProfessionLiberale(categorie) && "🟡 Indépendant — BIC (artisan / commerçant)"}
              {isProfessionLiberale(categorie) && "🟡 Indépendant — BNC (profession libérale)"}
              {["3","4","5","6"].includes(groupe) && !isProfessionLiberale(categorie) && isFonctionnaire(categorie) && "🟢 Fonctionnaire — salarié du secteur public (IR identique, retraite spécifique)"}
              {["3","4","5","6"].includes(groupe) && !isProfessionLiberale(categorie) && !isFonctionnaire(categorie) && "🔵 Salarié — revenus traitement & salaires"}
            </div>
          )}
        </div>
      );
    })}
  </div>
    </CardContent>
  </Card>

  {/* ── Statut professionnel détaillé + Employeur (module Prévoyance) ── */}
  <Card className="border-0" style={{ borderRadius: 20 }}>
    <CardHeader>
      <SectionTitle
        icon={ShieldCheck}
        title="Statut professionnel & employeur"
        subtitle="Saisie utilisée par le module Prévoyance : caisse d'affiliation, employeur, IDCC, salaire brut."
      />
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <BlocStatutEmployeur
          personLabel={person1}
          value={getTravail(1)}
          onChange={(patch) => patchTravail(1, patch)}
        />
        {isCouple && (
          <BlocStatutEmployeur
            personLabel={person2}
            value={getTravail(2)}
            onChange={(patch) => patchTravail(2, patch)}
          />
        )}
      </div>
    </CardContent>
  </Card>

  {/* ── Activité caisse (prévoyance) — saisie propre aux caisses libérales,
        affichée seulement si la personne est affiliée CARMF/CIPAV/CARPIMKO ── */}
  {(blocCaisseP1 || blocCaisseP2) && (
    <Card className="border-0" style={{ borderRadius: 20 }}>
      <CardHeader>
        <SectionTitle
          icon={Stethoscope}
          title="Activité caisse (prévoyance)"
          subtitle="Paramètres propres à la caisse libérale (CARMF / CIPAV / CARPIMKO) utilisés par la projection prévoyance."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 items-start">
          {blocCaisseP1}
          {blocCaisseP2}
        </div>
      </CardContent>
    </Card>
  )}
</TabsContent>

  );
});

TabTravail.displayName = "TabTravail";
export { TabTravail };
