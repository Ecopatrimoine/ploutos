// ─── Résolveur du CAPITAL DÉCÈS de PRÉVOYANCE COLLECTIVE DE BRANCHE (CCN) ────
//
// Module PUR (LOT DECES-A) : résout, pour UNE personne salariée, le capital
// décès minimum garanti par sa convention collective (idccCCN + catégorie
// cadre/non-cadre). Donnée de RÉFÉRENCE destinée au module succession —
// EXONÉRÉE (contrat de groupe professionnel, art. 998 CGI, hors 990 I).
// N'alimente PAS les 9 séries de projection (comme capitaux-deces.ts).
//
// Aucune valeur en dur : tout vient de ccn-2026.json + du PASS du référentiel.
// Toute donnée absente / null (prévoyanceNonCadres non documentée) /
// "TO_VERIFY" / mode inconnu → capital null + donneeIndisponible. JAMAIS une
// valeur inventée, JAMAIS d'exception.

import type { Referentiels } from "../../data/prevoyance";
import { safeNum } from "./projection";

export type CapitalDecesBranche = {
  capital: number | null;
  donneeIndisponible: boolean;
  source: string;                       // libellé de la CCN (traçabilité)
  categorie: "cadres" | "nonCadres";
};

// Formes attendues dans le référentiel (lecture TYPÉE via cast Record, pas de
// `as any` nu — modèle du cast de getMaintienParams). Données volontairement
// polymorphes tant que les CCN ne sont pas remplies → champs `unknown`.
type GarantieCapitalDC = { mode?: unknown; tauxSalaireRef?: unknown; minimumPass?: unknown };
type BlocPrevoyanceBranche = { garantiesMinimum?: { capitalDC?: unknown } | null } | null;

export function resolveCapitalDecesBranche(
  idcc: string | null,
  categorie: "cadres" | "nonCadres",
  salaireBrutAnnuel: number,
  pass: number,
  ref: Referentiels
): CapitalDecesBranche {
  const indispo = (src: string): CapitalDecesBranche => ({
    capital: null,
    donneeIndisponible: true,
    source: src,
    categorie,
  });

  if (!idcc) return indispo("");

  const conventions = ref.ccn.conventions as Record<
    string,
    {
      nom?: string;
      prevoyanceCadres?: BlocPrevoyanceBranche;
      prevoyanceNonCadres?: BlocPrevoyanceBranche;
    } | undefined
  >;
  const conv = conventions?.[idcc];
  if (!conv) return indispo("");
  const source = String(conv.nom ?? idcc);

  // null (ex. prévoyanceNonCadres non documentée des autres CCN) → indispo.
  const bloc = categorie === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  const capitalDC = bloc?.garantiesMinimum?.capitalDC;
  // "TO_VERIFY" (string) / absent / non-objet → indispo.
  if (capitalDC == null || typeof capitalDC !== "object") return indispo(source);

  const g = capitalDC as GarantieCapitalDC;
  if (g.mode !== "pourcentageSalaireRef") return indispo(source);

  const taux = safeNum(g.tauxSalaireRef);
  const minPass = safeNum(g.minimumPass);
  const passNum = safeNum(pass);
  const brut = safeNum(salaireBrutAnnuel);
  if (taux === null || minPass === null || passNum === null || brut === null) {
    return indispo(source);
  }

  // Salaire de référence plafonné à 8 PASS ; capital = max(taux × salaireRef,
  // minimumPass × PASS). Le plancher PASS garantit une couverture minimale.
  const salaireRef = Math.min(brut, 8 * passNum);
  const capital = Math.max(taux * salaireRef, minPass * passNum);
  return { capital, donneeIndisponible: false, source, categorie };
}
