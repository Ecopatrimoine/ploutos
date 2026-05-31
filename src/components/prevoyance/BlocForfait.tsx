// ─── BlocForfait — saisie des caisses FORFAITAIRES (CNBF, CARCDSF, CAVEC) ──
//
// Bloc unique aiguillé par caisse (case "CNBF" | "CARCDSF" | "CAVEC" dans
// caisseBloc), sur le modèle de BlocCarmf / BlocCipav / BlocCarpimko. Au lieu
// d'une branche de code par caisse, ce bloc lit le `discriminant` de la caisse
// (donnée JSON, caisseRef) pour décider quels champs afficher :
//   - discriminant.type === "profession" → Select sous-profession (CARCDSF)
//   - discriminant.type === "classe"     → classe déduite du revenu + Select
//     d'option classe supérieure (CAVEC)
//   - discriminant.type === "anciennete" / "aucun" → rien de spécifique (CNBF)
//
// Le taux d'invalidité (pattern CIPAV/CARPIMKO) est saisi ici quand la caisse
// a un mode taux (caisseRef.invalidite.modeTaux défini). UI pure — aucune
// logique métier ; le calcul lit forfait.{tauxInvalidite,sousProfession,
// classeOption} (cf. resolveDiscriminant / forfaitaireInvalMensuel du moteur).
// Cf. SPEC_PREVOYANCE_CAISSES_FORFAITAIRES §5.

import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import { resolveDiscriminant } from "../../lib/prevoyance/projection";
import type { ForfaitConfig, EntreePerso } from "../../lib/prevoyance/types";

// Config forfaitaire par défaut (revenu N-2 repris du revenu TNS de l'onglet
// Travail, invalidité totale par défaut — le cas le plus parlant en RDV ;
// sous-profession et classeOption laissés vides → la caisse pré-remplit /
// déduit, le CGP ajuste).
export function defaultForfait(entreeBase: EntreePerso, jobTitle?: string): ForfaitConfig {
  return {
    revenuBNC_N2: entreeBase.revenuTNSAnnuel ?? 0,
    tauxInvalidite: 100,
    sousProfession: prefillSousProfession(jobTitle),
  };
}

// Pré-remplissage best-effort de la sous-profession CARCDSF depuis l'intitulé
// de poste. Le CALCUL s'appuie sur le Select (forfait.sousProfession), jamais
// sur le texte libre — c'est juste une présélection de confort.
export function prefillSousProfession(jobTitle?: string): ForfaitConfig["sousProfession"] {
  const t = (jobTitle ?? "").toLowerCase();
  if (/sage[-\s]?femme/.test(t)) return "sage_femme";
  if (t.includes("dentiste")) return "dentiste";
  return undefined;
}

type Props = {
  value: ForfaitConfig;
  onChange: (next: ForfaitConfig) => void;
  // Référence JSON de la caisse (caisseRef) : pilote l'affichage des champs
  // (discriminant) et le mode taux d'invalidité. Donnée brute du référentiel.
  caisseRef: any;
  // Revenu TNS annuel courant : sert à l'AFFICHAGE de la classe CAVEC déduite
  // (le moteur la recalcule à partir de la même grille).
  revenuTNSAnnuel?: number;
};

// Seuils de garde-fous (alertes douces, non bloquantes).
const SEUIL_TAUX_INVALIDITE = 66;

function SousSection({ titre }: { titre: string }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: BRAND.muted }}>
      {titre}
    </div>
  );
}

function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-1.5 rounded-lg px-2.5 py-1.5 text-xs"
      style={{ background: BRAND.warningBg, border: `1px solid ${BRAND.warningBorder}`, color: BRAND.warning }}
    >
      {children}
    </div>
  );
}

// Déduit la classe CAVEC depuis le revenu via la grille du référentiel (même
// règle que resolveDiscriminant côté moteur — affichage seulement).
function classeDeduite(caisseRef: any, revenu: number): string | null {
  const grille = Array.isArray(caisseRef?.discriminant?.grilleRevenuClasse)
    ? caisseRef.discriminant.grilleRevenuClasse
    : [];
  for (const row of grille) {
    const revenuMax = row?.revenuMax;
    if (revenuMax === null || revenuMax === undefined || revenu <= revenuMax) {
      return row?.classe != null ? String(row.classe) : null;
    }
  }
  return grille.length > 0 ? String(grille[grille.length - 1].classe) : null;
}

// Classe RETENUE pour l'affichage (helper PUR, sans effet ni setState). Réutilise
// la résolution du MOTEUR (resolveDiscriminant) pour garantir l'alignement strict
// avec le calcul : choix explicite (forfait.classeOption) > défaut déclaré en DATA
// (caisseRef.classeParDefaut, ex. CAVOM "C") > grille revenu (CAVEC) > null
// (placeholder). Aucune mutation : la simple consultation ne modifie pas le dossier.
function classeRetenue(caisseRef: any, forfait: ForfaitConfig, revenu: number): string | null {
  return resolveDiscriminant(caisseRef, {
    revenuTNSAnnuel: revenu,
    forfait,
  } as any);
}

// Helper PUR conservé pour compatibilité (NE sert PLUS à seeder — aucun effet de
// bord). Priorité explicite > classeParDefaut > "" (grille/placeholder côté
// affichage). Doit rester aligné avec resolveDiscriminant (sans la branche grille,
// laissée à classeDeduite/au moteur). Aucun code de caisse en dur.
export function classeInitiale(caisseRef: any, forfait: ForfaitConfig): string {
  if (forfait.classeOption && forfait.classeOption !== "") return forfait.classeOption;
  if (caisseRef?.classeParDefaut != null && String(caisseRef.classeParDefaut) !== "") {
    return String(caisseRef.classeParDefaut);
  }
  return ""; // empty = non choisie → grille (CAVEC) ou placeholder (beta)
}

export const BlocForfait = React.memo(function BlocForfait({ value, onChange, caisseRef, revenuTNSAnnuel }: Props) {
  const v = value;
  function patch(p: Partial<ForfaitConfig>) {
    onChange({ ...v, ...p });
  }

  const discType: string | undefined = caisseRef?.discriminant?.type;
  const hasModeTaux = caisseRef?.invalidite?.modeTaux != null; // binaire | proportionnel
  const tauxSousSeuil = v.tauxInvalidite > 0 && v.tauxInvalidite < SEUIL_TAUX_INVALIDITE;

  // Champ "Commissions brutes" affiché UNIQUEMENT si la caisse calcule une
  // prestation en % du revenu (mode "pourcentageRevenu") sur l'invalidité ou le
  // capital décès. Critère DATA (pas de "if caisse === CAVAMAC") : CAVEC / CAVOM
  // (uniforme / parDiscriminant) ne voient jamais ce champ.
  const usesPourcentageRevenu =
    caisseRef?.invalidite?.montantAnnuel100?.mode === "pourcentageRevenu" ||
    caisseRef?.capitalDeces?.mode === "pourcentageRevenu";

  // Classe CAVEC : déduite du revenu via la grille (affichage de l'item "auto").
  const revenu = revenuTNSAnnuel ?? v.revenuBNC_N2 ?? 0;
  const classeAuto = classeDeduite(caisseRef, revenu);
  // Classe RETENUE (alignée moteur, pure) : explicite > classeParDefaut > grille >
  // null. Sert au libellé "classe retenue" et à piloter la valeur du Select.
  const classeEffective = classeRetenue(caisseRef, v, revenu);

  // Options de classe DÉRIVÉES de la donnée (clés de invalidite.montantAnnuel100).
  // CAVEC → ["1","2","3","4"] ; CAVOM → ["A","B","C","D"]. Fallback 1/2/3/4 si
  // la donnée est vide (ne casse aucun comportement existant).
  const classeKeysData = Object.keys(caisseRef?.invalidite?.montantAnnuel100?.valeurs ?? {});
  const classeKeys = classeKeysData.length > 0 ? classeKeysData : ["1", "2", "3", "4"];

  // Caisse "classe" avec une grille revenu (CAVEC) → option "auto" + déduction.
  // Sans grille (CAVOM) → pas d'"auto" ; la classe est choisie (ou seedée par
  // classeParDefaut), sinon placeholder anti-zéro silencieux.
  const hasGrille =
    Array.isArray(caisseRef?.discriminant?.grilleRevenuClasse) &&
    caisseRef.discriminant.grilleRevenuClasse.length > 0;

  // PAS de useEffect de seeding : la classe par défaut (CAVOM "C") est résolue À
  // LA LECTURE par le moteur (resolveDiscriminant) et reflétée ci-dessous dans le
  // Select. La simple consultation d'un dossier ne déclenche AUCUN onChange et ne
  // marque donc jamais le dossier comme modifié.

  // Valeur sélectionnée du Select, alignée sur la résolution moteur :
  //   classeOption explicite → classeOption ;
  //   sinon grille (CAVEC)   → "auto" (item déduit) ;
  //   sinon classeParDefaut  → String(classeParDefaut) (CAVOM "C") ;
  //   sinon                  → "" → placeholder "— Sélectionnez une classe —".
  const classeOptionSet = !!v.classeOption && v.classeOption !== "";
  const selectValue = classeOptionSet
    ? v.classeOption!
    : hasGrille
    ? "auto"
    : caisseRef?.classeParDefaut != null && String(caisseRef.classeParDefaut) !== ""
    ? String(caisseRef.classeParDefaut)
    : "";

  return (
    <div
      className="rounded-xl p-3 space-y-4"
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Paramètres {caisseRef?.nom ?? "caisse forfaitaire"}
      </div>

      {/* ── Section 1 : Activité caisse ────────────────────────────── */}
      <div className="space-y-3">
        <SousSection titre="Activité caisse" />

        <div className="grid gap-3 md:grid-cols-12 items-start">
          <div className="md:col-span-4">
            <Field
              label="Revenu BNC 2024 (déclaration 2042 C-PRO)"
              tooltip="Revenu retenu pour vos IJ des 90 premiers jours (phase CPAM) et, pour la CAVEC, pour déterminer votre classe."
              reserveLabel
            >
              <Input
                type="number" min={0} value={v.revenuBNC_N2 ?? 0}
                onChange={(e) => patch({ revenuBNC_N2: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded-xl"
              />
            </Field>
          </div>

          {/* Sous-profession CARCDSF (discriminant === "profession") */}
          {discType === "profession" && (
            <div className="md:col-span-4">
              <Field
                label="Profession (CARCDSF)"
                tooltip="Le barème CARCDSF (IJ, invalidité, capital décès) dépend de la profession. C'est cette valeur, et non l'intitulé de poste, qui pilote le calcul."
                reserveLabel
              >
                <Select
                  value={v.sousProfession ?? ""}
                  onValueChange={(s) => patch({ sousProfession: s as ForfaitConfig["sousProfession"] })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dentiste">Chirurgien-dentiste</SelectItem>
                    <SelectItem value="sage_femme">Sage-femme</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* Classe de cotisation (discriminant === "classe") : déduite via
              grille (CAVEC) ou choisie / par défaut (CAVOM). Options et logique
              dérivées de la DATA — aucun code de caisse en dur. */}
          {discType === "classe" && (
            <div className="md:col-span-4">
              <Field
                label={`Classe de cotisation${classeAuto ? ` (déduite : classe ${classeAuto})` : ""}`}
                tooltip="Classe déduite de votre revenu TNS. Modifiable si vous avez opté pour la classe immédiatement supérieure (option de cotisation)."
                reserveLabel
              >
                <Select
                  value={selectValue}
                  onValueChange={(s) => patch({ classeOption: s === "auto" ? "" : s })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hasGrille && (
                      <SelectItem value="auto">{classeAuto ? `Classe déduite (${classeAuto})` : "Classe déduite"}</SelectItem>
                    )}
                    {!hasGrille && !classeOptionSet && (
                      <SelectItem value="">— Sélectionnez une classe —</SelectItem>
                    )}
                    {classeKeys.map((k) => (
                      <SelectItem key={k} value={k}>{`Classe ${k}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* Taux d'invalidité projeté (caisses à mode taux : binaire / proportionnel) */}
          {hasModeTaux && (
            <div className="md:col-span-4">
              <Field
                label="Taux d'invalidité projeté (%)"
                tooltip="Taux d'invalidité retenu pour la projection. Sous 66 % : pas de pension. En mode proportionnel (CAVEC), la pension est proratisée au taux."
                reserveLabel
              >
                <Input
                  type="number" min={0} max={100} value={v.tauxInvalidite}
                  onChange={(e) =>
                    patch({ tauxInvalidite: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                  }
                  className="rounded-xl"
                />
              </Field>
              {tauxSousSeuil && (
                <InlineAlert>Sous 66 % : aucune pension d'invalidité de la caisse.</InlineAlert>
              )}
            </div>
          )}

          {/* Commissions brutes annuelles (caisses en mode pourcentageRevenu,
              ex. CAVAMAC). Assiette des prestations invalidité / capital décès. */}
          {usesPourcentageRevenu && (
            <div className="md:col-span-4">
              <Field
                label="Commissions brutes annuelles"
                tooltip="Assiette de vos prestations invalidité et décès pour cette caisse : un pourcentage de vos commissions brutes annuelles, plafonné."
                reserveLabel
              >
                <Input
                  type="number" min={0} value={v.commissionsBrutes ?? 0}
                  onChange={(e) => patch({ commissionsBrutes: Math.max(0, Number(e.target.value) || 0) })}
                  className="rounded-xl"
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* Situation familiale (marié/PACS, enfants à charge) : dérivée du
          dossier (onglet Famille), plus de saisie ici. */}

      <div className="text-xs" style={{ color: BRAND.muted, fontStyle: "italic" }}>
        Caisse forfaitaire : IJ servies du 91ᵉ jour à 3 ans (forfait par jour),
        puis pension d'invalidité forfaitaire. Le capital décès est conservé pour
        le module succession (hors courbe de revenus). La phase des 90 premiers
        jours est couverte par la CPAM (ou, pour les avocats, par la prévoyance
        de branche LPA/AON, hors caisse){classeEffective ? ` — classe retenue : ${classeEffective}` : ""}.
      </div>
    </div>
  );
});

BlocForfait.displayName = "BlocForfait";
