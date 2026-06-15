// ─── BlocEntreprise — saisie/résolution SIRET + déclarations couverture
//
// Saisie pour l'audit conformité collective :
//   - SIRET + nom + forme juridique + NAF + IDCC + effectif (résolus
//     via l'API recherche-entreprises, modifiables)
//   - santé collective en place + participation employeur
//   - prévoyance cadres en place + taux T1
//   - prévoyance non-cadres en place
//   - catégorie objective déclarée (texte libre)
//   - retraite supplémentaire en place

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BRAND, SURFACE } from "../../constants";
import { Field } from "../shared";
import {
  resolveSiret,
  validateSiret,
  lookupCCNName,
} from "../../lib/prevoyance/utils";
import type { EntrepriseAudit, GarantiesSouscrites, GarantiesSouscritesCollege } from "../../types/patrimoine";

type Props = {
  value: EntrepriseAudit;
  onChange: (next: EntrepriseAudit) => void;
};

// ─── Conversion saisie % naturel <-> stockage FRACTION (Lot SOUSCRIT) ─────────
// L'écran saisit en % naturel (200 pour 200 %) ; le stockage est en FRACTION (2.0,
// mêmes unités que les obligations de branche). Champ vide -> undefined (JAMAIS 0).
export function pctSaisieVersFraction(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n / 100 : undefined;
}
export function fractionVersPctSaisie(f: number | undefined): string {
  if (f == null) return "";
  const p = f * 100;
  return String(Number.isInteger(p) ? p : Number(p.toFixed(6)));
}
// Franchise en JOURS : entier brut, AUCUNE conversion. Vide -> undefined.
export function joursSaisie(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function emptyEntrepriseAudit(): EntrepriseAudit {
  return {
    siret: null,
    nom: null,
    formeJuridique: null,
    effectif: null,
    idccCCN: null,
    nomCCN: null,
    codeNAF: null,
    santeCollectiveEnPlace: false,
    participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false,
    tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false,
    categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
  };
}

export const BlocEntreprise = React.memo(function BlocEntreprise({ value, onChange }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  function patch(p: Partial<EntrepriseAudit>) {
    onChange({ ...value, ...p });
  }

  // Met à jour un champ imbriqué de garantiesSouscrites. val undefined -> on RETIRE
  // le champ (puis la garantie / le collège / la structure si devenus vides) :
  // champ vide = "non renseigné", JAMAIS 0.
  function setSouscrit(
    college: "cadres" | "nonCadres",
    garantie: keyof GarantiesSouscritesCollege,
    champ: string,
    val: number | undefined
  ) {
    const gs = { ...(value.garantiesSouscrites ?? {}) } as Record<string, Record<string, Record<string, number>>>;
    const col = { ...(gs[college] ?? {}) };
    const g = { ...(col[garantie] ?? {}) };
    if (val === undefined) delete g[champ];
    else g[champ] = val;
    if (Object.keys(g).length === 0) delete col[garantie];
    else col[garantie] = g;
    if (Object.keys(col).length === 0) delete gs[college];
    else gs[college] = col;
    patch({ garantiesSouscrites: (Object.keys(gs).length === 0 ? undefined : gs) as GarantiesSouscrites | undefined });
  }
  function valSouscrit(college: "cadres" | "nonCadres", garantie: string, champ: string): number | undefined {
    const col = value.garantiesSouscrites?.[college] as Record<string, Record<string, number>> | undefined;
    return col?.[garantie]?.[champ];
  }
  const inputPct = (college: "cadres" | "nonCadres", garantie: keyof GarantiesSouscritesCollege, champ: string, label: string) => (
    <Field label={label}>
      <Input
        type="number"
        value={fractionVersPctSaisie(valSouscrit(college, garantie, champ))}
        onChange={(e) => setSouscrit(college, garantie, champ, pctSaisieVersFraction(e.target.value))}
        className="rounded-xl"
        placeholder="ex. 200"
      />
    </Field>
  );
  const inputJours = (college: "cadres" | "nonCadres", garantie: keyof GarantiesSouscritesCollege, champ: string, label: string) => {
    const cur = valSouscrit(college, garantie, champ);
    return (
      <Field label={label}>
        <Input
          type="number"
          value={cur == null ? "" : String(cur)}
          onChange={(e) => setSouscrit(college, garantie, champ, joursSaisie(e.target.value))}
          className="rounded-xl"
          placeholder="ex. 90"
        />
      </Field>
    );
  };

  async function handleResolveSiret() {
    const siret = (value.siret ?? "").replace(/\s+/g, "");
    setErreur(null);
    if (!validateSiret(siret)) {
      setErreur("SIRET invalide (14 chiffres attendus).");
      return;
    }
    setLoading(true);
    try {
      const r = await resolveSiret(siret);
      if (r.ok === true) {
        patch({
          siret: r.data.siret,
          nom: r.data.nom,
          formeJuridique: r.data.formeJuridique,
          codeNAF: r.data.codeNAF,
          effectif: r.data.effectif,
          idccCCN: r.data.idccCCN,
          nomCCN: r.data.nomCCN ?? (r.data.idccCCN ? lookupCCNName(r.data.idccCCN) : null),
          idccListe: r.data.idccListe,
        });
      } else if (r.ok === false && r.reason === "not_found") {
        setErreur("SIRET non trouvé dans la base entreprises.");
      } else if (r.ok === false && r.reason === "invalid_format") {
        setErreur("SIRET invalide (14 chiffres attendus).");
      } else {
        setErreur("Réponse réseau indisponible — réessayez dans un instant.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="border rounded-xl p-4 space-y-4"
      style={{ borderColor: SURFACE.border, background: SURFACE.card }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
        Entreprise auditée
      </div>

      {/* Ligne 1 : SIRET + Effectif */}
      <div className="grid gap-3 md:grid-cols-3 items-start">
        <div className="md:col-span-2">
          <Field label="SIRET (14 chiffres)">
            <div className="flex gap-2">
              <Input
                value={value.siret ?? ""}
                onChange={(e) => patch({ siret: e.target.value.replace(/\s+/g, "") })}
                className="rounded-xl flex-1"
                inputMode="numeric"
                placeholder="ex. 78404636300040"
                maxLength={14}
              />
              <Button
                type="button"
                onClick={handleResolveSiret}
                disabled={loading || !validateSiret(value.siret)}
                className="rounded-xl whitespace-nowrap"
                style={{ background: BRAND.navy }}
              >
                {loading ? "…" : "Résoudre"}
              </Button>
            </div>
            {erreur && <div className="text-xs mt-1" style={{ color: "#B0413E" }}>{erreur}</div>}
          </Field>
        </div>
        <Field label="Effectif (salariés)">
          <Input
            type="number"
            min={0}
            value={value.effectif ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const n = v === "" ? null : Number(v);
              patch({ effectif: Number.isFinite(n as number) ? (n as number) : null });
            }}
            className="rounded-xl"
            placeholder="—"
          />
        </Field>
      </div>

      {/* Ligne 2 : Nom + Forme juridique */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Raison sociale">
          <Input
            value={value.nom ?? ""}
            onChange={(e) => patch({ nom: e.target.value || null })}
            className="rounded-xl"
          />
        </Field>
        <Field label="Forme juridique">
          <Input
            value={value.formeJuridique ?? ""}
            onChange={(e) => patch({ formeJuridique: e.target.value || null })}
            className="rounded-xl"
            placeholder="SARL, SAS, SCI…"
          />
        </Field>
      </div>

      {/* Ligne 3 : NAF + IDCC */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Code NAF / APE">
          <Input
            value={value.codeNAF ?? ""}
            onChange={(e) => patch({ codeNAF: e.target.value || null })}
            className="rounded-xl"
            placeholder="ex. 6201Z"
          />
        </Field>
        <Field label="IDCC (convention collective)">
          <div className="space-y-1">
            <Input
              value={value.idccCCN ?? ""}
              onChange={(e) => {
                const next = e.target.value.trim() || null;
                patch({ idccCCN: next, nomCCN: next ? lookupCCNName(next) : null });
              }}
              className="rounded-xl"
              placeholder="ex. 1486"
              inputMode="numeric"
            />
            {value.idccCCN && value.nomCCN && (
              <div className="text-xs" style={{ color: BRAND.muted }}>
                {value.nomCCN}
              </div>
            )}
            {value.idccListe && value.idccListe.length > 1 && (
              <div className="text-xs" style={{ color: BRAND.warning }}>
                ⚠ Plusieurs conventions détectées pour ce SIRET : {value.idccListe.join(", ")}. Vérifiez la convention applicable.
              </div>
            )}
          </div>
        </Field>
      </div>

      {/* Déclarations couverture */}
      <div
        className="rounded-xl p-3 space-y-3"
        style={{ background: "rgba(81,106,199,0.04)", border: `1px solid ${SURFACE.border}` }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.sky }}>
          Déclarations de couverture en place
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm" style={{ color: BRAND.navy }}>
            <input
              type="checkbox"
              checked={value.santeCollectiveEnPlace}
              onChange={(e) => patch({ santeCollectiveEnPlace: e.target.checked })}
            />
            <span>Santé collective en place</span>
          </label>
          {value.santeCollectiveEnPlace && (
            <Field label="Participation employeur (0-1)">
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={value.participationEmployeurSante}
                onChange={(e) => patch({ participationEmployeurSante: Number(e.target.value) || 0 })}
                className="rounded-xl"
              />
            </Field>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm" style={{ color: BRAND.navy }}>
            <input
              type="checkbox"
              checked={value.prevoyanceCadresEnPlace}
              onChange={(e) => patch({ prevoyanceCadresEnPlace: e.target.checked })}
            />
            <span>Prévoyance cadres en place</span>
          </label>
          {value.prevoyanceCadresEnPlace && (
            <Field label="Taux T1 cadres (%)">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={value.tauxT1Cadres}
                onChange={(e) => patch({ tauxT1Cadres: Number(e.target.value) || 0 })}
                className="rounded-xl"
                placeholder="1.50"
              />
            </Field>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={value.prevoyanceNonCadresEnPlace}
            onChange={(e) => patch({ prevoyanceNonCadresEnPlace: e.target.checked })}
          />
          <span>Prévoyance non-cadres en place</span>
        </label>

        <Field label="Catégorie objective déclarée">
          <Input
            value={value.categoriesObjectivesDeclarees}
            onChange={(e) => patch({ categoriesObjectivesDeclarees: e.target.value })}
            className="rounded-xl"
            placeholder='ex. "Cadres au sens art. 4 conv. collective"'
          />
        </Field>

        {value.categoriesObjectivesDeclarees.trim() !== "" && (
          <label className="flex items-center gap-2 text-sm" style={{ color: BRAND.navy }}>
            <input
              type="checkbox"
              checked={!!value.categoriesObjectivesValidees}
              onChange={(e) => patch({ categoriesObjectivesValidees: e.target.checked })}
            />
            <span>Catégories validées contractuellement (lecture du contrat et des actes de mise en place faite)</span>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm" style={{ color: BRAND.navy }}>
          <input
            type="checkbox"
            checked={value.retraiteSuppEnPlace}
            onChange={(e) => patch({ retraiteSuppEnPlace: e.target.checked })}
          />
          <span>Retraite supplémentaire en place (PERO / Art. 83 / Art. 39)</span>
        </label>
      </div>

      {/* Détail optionnel des garanties souscrites (Lot SOUSCRIT) — saisie nue,
          repliable ; la passe vendeur (design) viendra plus tard. Saisie en %
          naturel (200 = 200 %), stockée en fraction. */}
      <details className="rounded-xl p-3" style={{ border: `1px solid ${SURFACE.border}` }}>
        <summary className="text-xs font-semibold uppercase tracking-widest cursor-pointer" style={{ color: BRAND.sky }}>
          Détail des garanties souscrites (optionnel)
        </summary>
        <div className="mt-3 space-y-4">
          {(["cadres", "nonCadres"] as const).map((col) => (
            <div key={col} className="space-y-2">
              <div className="text-xs font-bold" style={{ color: BRAND.navy }}>
                {col === "cadres" ? "Collège cadres" : "Collège non-cadres"}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {inputPct(col, "capitalDC", "tauxSalaireRef", "Capital décès (% salaire réf)")}
                {inputPct(col, "renteEducation", "tauxSalaireRefParEnfant", "Rente éducation (% / enfant)")}
                {inputPct(col, "renteConjoint", "tauxSalaireRef", "Rente conjoint (% salaire réf)")}
                {inputPct(col, "ij", "pctSalaire", "IJ (% salaire)")}
                {inputJours(col, "ij", "franchiseJours", "IJ franchise (jours)")}
                {inputPct(col, "invalidite", "cat1", "Invalidité cat1 (%)")}
                {inputPct(col, "invalidite", "cat2", "Invalidité cat2 (%)")}
                {inputPct(col, "invalidite", "cat3", "Invalidité cat3 (%)")}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
});

BlocEntreprise.displayName = "BlocEntreprise";
