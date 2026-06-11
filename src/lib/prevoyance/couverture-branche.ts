// ─── Résolveur des garanties IJ + INVALIDITÉ de PRÉVOYANCE COLLECTIVE DE BRANCHE
//     (CCN) → objet CouvertureCollective partiel ───────────────────────────────
//
// Module PUR (LOT IJ-INV-i) : produit, pour UNE personne salariée, les minima
// conventionnels d'incapacité (IJ) et d'invalidité de sa convention collective,
// AU FORMAT CouvertureCollective (champs ij/invalidite uniquement) — directement
// consommable par le moteur de projection (computeIJCollective /
// computeRenteInvalCollective) SANS adaptation. AUCUN branchement ici : on
// fabrique l'objet, on ne l'injecte pas (ce sera LOT IJ-INV-ii).
//
// Garanties du VIVANT (revenus de remplacement) — DISTINCTES des garanties décès
// (capital / rente éducation, cf. capitaux-deces-branche.ts), d'où ce fichier
// dédié. Même discipline défensive : aucune valeur en dur, aucun `as any` nu
// (cast Record + safeNum + typeof object). Toute donnée absente / "TO_VERIFY" /
// mode inconnu / valeur aberrante → champ OMIS (jamais un 0 trompeur) ; si NI IJ
// NI invalidité exploitables → donneeIndisponible + objet vide. JAMAIS d'exception.

import type { Referentiels } from "../../data/prevoyance";
import type { CouvertureCollective } from "./types";
import { safeNum } from "./projection";

export type CouvertureBranche = {
  ij?: CouvertureCollective["ij"];                 // format CouvertureCollective.ij
  invalidite?: CouvertureCollective["invalidite"]; // format CouvertureCollective.invalidite
  donneeIndisponible: boolean;
  source: string;                                  // libellé de la CCN (traçabilité)
  categorie: "cadres" | "nonCadres";
};

// Formes attendues dans le référentiel (champs `unknown` tant que les CCN ne
// sont pas toutes remplies). BlocPrevoyanceCouverture ne déclare QUE les champs
// lus ici → indépendant des blocs capital/rente, qu'on ne touche pas.
type GarantieIJ = { mode?: unknown; pctSalaire?: unknown; franchise?: unknown; plafondJours?: unknown; baseCalcul?: unknown; majorationParEnfantPct?: unknown; modeComplement?: unknown; paliers?: unknown };
type SegmentIJ = { deJour?: unknown; aJour?: unknown; pctSalaire?: unknown; modeComplement?: unknown };

// LOT AUTO-0bis — mode de combinaison du complément IJ (axe `modeComplement`).
//   undefined : champ ABSENT → hérite du défaut (bloc puis "cible")
//   null      : champ PRÉSENT mais hors {"cible","additif"} → l'appelant OMET l'IJ
//   "cible" / "additif" : valide
function mapModeComplementIJ(raw: unknown): "cible" | "additif" | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === "cible" || raw === "additif") return raw;
  return null;
}
type CategorieInval = { pctSalaire?: unknown; majorationParEnfantPct?: unknown; majorationSiAuMoinsUnEnfantPct?: unknown };
type GarantieInvalidite = { mode?: unknown; base?: unknown; cat1?: unknown; cat2?: unknown; cat3?: unknown };
type BlocPrevoyanceCouverture = { garantiesMinimum?: { ij?: unknown; invalidite?: unknown } | null } | null;

// LOT ASSUR-0 — paliers temporels d'IJ. Trois retours distincts :
//   undefined : champ `paliers` ABSENT → mode mono-taux historique (rien à valider)
//   null      : champ PRÉSENT mais MALFORMÉ → l'appelant OMET l'IJ (échec explicite ;
//               jamais de dégradation silencieuse vers un taux ou une fenêtre faux)
//   tableau   : segments validés — ordonnés, contigus (aJour[n] == deJour[n+1]),
//               non vides (aJour > deJour), pctSalaire en FRACTION dans ]0, 1].
// Bornes en jours depuis le début de l'arrêt (même axe que franchise + plafondJours).
type PalierIJResolu = { deJour: number; aJour: number; pctSalaire: number; modeComplement?: "cible" | "additif" };
function mapPaliersIJ(raw: unknown): PalierIJResolu[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PalierIJResolu[] = [];
  let bornePrecedente: number | null = null;
  for (const item of raw) {
    if (item == null || typeof item !== "object") return null;
    const s = item as SegmentIJ;
    const deJour = safeNum(s.deJour);
    const aJour = safeNum(s.aJour);
    const pct = safeNum(s.pctSalaire);
    if (deJour === null || aJour === null || pct === null) return null;
    if (deJour < 0 || aJour <= deJour) return null;            // bornes valides, segment non vide
    if (pct <= 0 || pct > 1) return null;                      // fraction ]0,1] (rejette un entier 85)
    if (bornePrecedente !== null && deJour !== bornePrecedente) return null; // contigu
    const modeC = mapModeComplementIJ(s.modeComplement);
    if (modeC === null) return null;                           // mode de palier invalide → IJ omise
    const seg: PalierIJResolu = { deJour, aJour, pctSalaire: pct };
    if (modeC !== undefined) seg.modeComplement = modeC;
    out.push(seg);
    bornePrecedente = aJour;
  }
  return out;
}

// IJ : mode "complementSecu" attendu. safeNum + garde de cohérence (pctSalaire
// dans [0,1], franchise >= 0, plafondJours > 0, baseCalcul parmi les valeurs du
// type). Tout écart → undefined (champ omis). LOT ASSUR-0 : si `paliers` est
// présent, il REMPLACE pctSalaire/plafondJours (taux par segment temporel) ;
// franchise/baseCalcul/majorationParEnfantPct restent communs.
function mapIJ(raw: unknown): CouvertureCollective["ij"] | undefined {
  if (raw == null || typeof raw !== "object") return undefined; // "TO_VERIFY" (string) / absent
  const g = raw as GarantieIJ;
  if (g.mode !== "complementSecu") return undefined;
  const franchise = safeNum(g.franchise);
  const baseCalcul = g.baseCalcul;
  if (franchise === null || franchise < 0) return undefined;
  if (baseCalcul !== "T1_T2" && baseCalcul !== "T1_seul" && baseCalcul !== "brut_total") return undefined;

  // LOT AUTO-0bis — mode de combinaison par défaut du bloc. Présent mais invalide → IJ omise.
  const modeBloc = mapModeComplementIJ(g.modeComplement);
  if (modeBloc === null) return undefined;

  // Mode PALIERS (prioritaire). Présent mais malformé → IJ omise (échec explicite).
  const paliers = mapPaliersIJ(g.paliers);
  if (paliers === null) return undefined;
  if (paliers !== undefined) {
    // `paliers` porte le taux servi ; on renseigne aussi pctSalaire (1er segment,
    // ≤ 1 par validation) et plafondJours (= dernier aJour − franchise, soit fin
    // servie = dernier aJour) pour garder la forme du type cohérente.
    const dernierAJour = paliers[paliers.length - 1].aJour;
    const out: NonNullable<CouvertureCollective["ij"]> = {
      pctSalaire: paliers[0].pctSalaire,
      franchise,
      plafondJours: dernierAJour - franchise,
      baseCalcul,
      paliers,
    };
    if (modeBloc !== undefined) out.modeComplement = modeBloc;
    const majo = safeNum(g.majorationParEnfantPct);
    if (majo !== null && majo >= 0) out.majorationParEnfantPct = majo;
    return out;
  }

  // Mode MONO-TAUX historique (inchangé) : pctSalaire + plafondJours requis.
  const pctSalaire = safeNum(g.pctSalaire);
  const plafondJours = safeNum(g.plafondJours);
  if (pctSalaire === null || plafondJours === null) return undefined;
  if (pctSalaire < 0 || pctSalaire > 1 || plafondJours <= 0) return undefined;
  const out: NonNullable<CouvertureCollective["ij"]> = { pctSalaire, franchise, plafondJours, baseCalcul };
  if (modeBloc !== undefined) out.modeComplement = modeBloc;
  // LOT BTP-3 — majoration par enfant : numérique >= 0 → portée ; sinon IGNORÉE
  // (champ omis), la garantie IJ principale reste servie. Clé absente → omise (iso).
  const majo = safeNum(g.majorationParEnfantPct);
  if (majo !== null && majo >= 0) out.majorationParEnfantPct = majo;
  return out;
}

// Une catégorie d'invalidité : { pctSalaire } dans [0,1]. safeNum + clamp.
// majorationParEnfantPct (LOT BTP-3, linéaire) et majorationSiAuMoinsUnEnfantPct
// (LOT BTP-3bis, forfait unique) : numériques >= 0 → portées ; sinon IGNORÉES (clé
// omise), la catégorie principale reste servie.
function mapCategorieInval(raw: unknown): { pctSalaire: number; majorationParEnfantPct?: number; majorationSiAuMoinsUnEnfantPct?: number } | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as CategorieInval;
  const pct = safeNum(r.pctSalaire);
  if (pct === null || pct < 0 || pct > 1) return null;
  const out: { pctSalaire: number; majorationParEnfantPct?: number; majorationSiAuMoinsUnEnfantPct?: number } = { pctSalaire: pct };
  const majo = safeNum(r.majorationParEnfantPct);
  if (majo !== null && majo >= 0) out.majorationParEnfantPct = majo;
  const majoForfait = safeNum(r.majorationSiAuMoinsUnEnfantPct);
  if (majoForfait !== null && majoForfait >= 0) out.majorationSiAuMoinsUnEnfantPct = majoForfait;
  return out;
}

// Invalidité : les 3 catégories doivent être lisibles, sinon undefined (champ omis).
// mode / base (LOT BTP-2) : ABSENTS → défauts historiques (cibleInclSecu /
// revenuReference) ET clés OMISES du résultat (forme inchangée pour les CCN sans
// additif → iso). PRÉSENTS mais inconnus → garantie OMISE (jamais de fallback
// silencieux sur la cible, jamais d'exception).
function mapInvalidite(raw: unknown): CouvertureCollective["invalidite"] | undefined {
  if (raw == null || typeof raw !== "object") return undefined; // "TO_VERIFY" (string) / absent
  const g = raw as GarantieInvalidite;
  const cat1 = mapCategorieInval(g.cat1);
  const cat2 = mapCategorieInval(g.cat2);
  const cat3 = mapCategorieInval(g.cat3);
  if (cat1 === null || cat2 === null || cat3 === null) return undefined;

  const out: NonNullable<CouvertureCollective["invalidite"]> = { cat1, cat2, cat3 };
  if (g.mode !== undefined) {
    if (g.mode !== "cibleInclSecu" && g.mode !== "additif") return undefined;
    out.mode = g.mode;
  }
  if (g.base !== undefined) {
    if (g.base !== "revenuReference" && g.base !== "brut") return undefined;
    out.base = g.base;
  }
  return out;
}

export function resolveCouvertureBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  ref: Referentiels
): CouvertureBranche {
  const vide = (src: string): CouvertureBranche => ({
    donneeIndisponible: true,
    source: src,
    categorie,
  });

  if (!idcc) return vide("");

  const conventions = ref.ccn.conventions as Record<
    string,
    {
      nom?: string;
      prevoyanceCadres?: BlocPrevoyanceCouverture;
      prevoyanceNonCadres?: BlocPrevoyanceCouverture;
    } | undefined
  >;
  const conv = conventions?.[idcc];
  if (!conv) return vide("");
  const source = String(conv.nom ?? idcc);

  const bloc = categorie === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  const gm = bloc?.garantiesMinimum;

  const ij = mapIJ(gm?.ij);
  const invalidite = mapInvalidite(gm?.invalidite);

  // NI IJ NI invalidité exploitable → indisponible, objet vide.
  if (!ij && !invalidite) return vide(source);

  const out: CouvertureBranche = { donneeIndisponible: false, source, categorie };
  if (ij) out.ij = ij;
  if (invalidite) out.invalidite = invalidite;
  return out;
}
