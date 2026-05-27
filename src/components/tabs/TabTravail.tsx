import React from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Briefcase, ShieldCheck } from "lucide-react";
import { BRAND, SURFACE, PCS_GROUPES, PCS_CATEGORIES } from "../../constants";
import type { PayloadTravail, PayloadTravailPair } from "../../types/patrimoine";
import { isProfessionLiberale, isRetraite, isSansActivite, isFonctionnaire, isIndependant } from "../../lib/calculs/utils";
import { Field, SectionTitle } from "../shared";
import { BlocStatutEmployeur } from "../travail/BlocStatutEmployeur";
import { createEmptyTravail } from "../../lib/prevoyance/utils";


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
                onValueChange={(v) => setField(which === 1 ? "person1Csp" : "person2Csp", v)}
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
</TabsContent>

  );
});

TabTravail.displayName = "TabTravail";
export { TabTravail };
