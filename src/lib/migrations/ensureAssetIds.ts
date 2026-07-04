// ─── Migration : identifiants stables des placements / biens ────────────────
//
// Fonction PURE et NON DESTRUCTIVE. Elle :
//   a. pose un id stable (newId) sur chaque placement / property / enfant qui n'en a pas ;
//   b. convertit les 4 références « par index » en références « par id », en
//      résolvant contre l'ORDRE des tableaux du MÊME payload, en sémantique
//      LECTURE (liste complète, index tel quel — on fige ce que l'écran affiche
//      aujourd'hui, y compris un legs désaligné par le bug d'index filtré) :
//        - Loan.pledgedPlacementIndex            -> Loan.pledgedPlacementId
//        - Property.loanPledgedPlacementIndex    -> Property.loanPledgedPlacementId
//        - LegsPrecisItem.propertyIndex          -> LegsPrecisItem.assetId
//        - DonationItem.assetIndex               -> DonationItem.assetId
//   c. est idempotente : un payload déjà migré ressort identique (en valeur) ;
//   d. ne touche à rien d'autre.
//
// NOTE (écart au design, voir rapport) : la signature reçoit le bundle
// { data, successionData, hypotheses } et non le seul `data`, car deux des
// quatre références vivent HORS de PatrimonialData — les legs précis dans
// successionData, les donations dans hypotheses[].donations — tout en se
// résolvant contre data.properties / data.placements (la donnée principale).

import type {
  PatrimonialData,
  SuccessionData,
  Hypothesis,
  Property,
  Loan,
} from "../../types/patrimoine";
import { newId } from "../id";

export interface AssetIdsBundle {
  data: PatrimonialData;
  successionData?: SuccessionData | null;
  hypotheses?: Hypothesis[] | null;
}

export interface AssetIdsResult {
  data: PatrimonialData;
  successionData: SuccessionData | null;
  hypotheses: Hypothesis[];
  // Journal des références dont l'index était hors bornes (déjà cassées avant
  // migration) : on ne pose PAS d'id cible et on n'invente rien.
  unresolved: string[];
}

// Résout un index (chaîne ou nombre) vers l'id de l'élément à cette position.
// "-1" / vide / négatif / non numérique -> aucune cible (pas de log). Index hors
// bornes -> aucune cible + entrée dans `unresolved`. Les ids sont déjà posés.
function idAt(
  arr: ReadonlyArray<{ id?: string }>,
  raw: unknown,
  label: string,
  unresolved: string[],
): string | undefined {
  const i = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(i) || i < 0) return undefined;
  if (i >= arr.length) {
    unresolved.push(`${label}: index ${i} hors bornes (taille ${arr.length})`);
    return undefined;
  }
  return arr[i].id;
}

export function ensureAssetIds(
  bundle: AssetIdsBundle,
  makeId: () => string = newId,
): AssetIdsResult {
  const unresolved: string[] = [];
  const srcData = bundle.data;

  // a. Clonage superficiel + pose des ids manquants (non destructif : l'entrée
  //    n'est jamais mutée, on construit de nouveaux objets).
  const placements = (srcData.placements ?? []).map((pl) =>
    pl.id ? { ...pl } : { ...pl, id: makeId() },
  );
  const properties = (srcData.properties ?? []).map((p) => {
    const np: Property = p.id ? { ...p } : { ...p, id: makeId() };

    // b1. Property.loanPledgedPlacementIndex (legacy mono-crédit) -> id
    if (np.loanPledgedPlacementId === undefined) {
      const id = idAt(
        placements,
        np.loanPledgedPlacementIndex,
        "Property.loanPledgedPlacementIndex",
        unresolved,
      );
      if (id) np.loanPledgedPlacementId = id;
    }

    // b2. Loan.pledgedPlacementIndex (multi-crédits) -> id
    if (Array.isArray(np.loans)) {
      np.loans = np.loans.map((l): Loan => {
        if (l.pledgedPlacementId !== undefined) return { ...l };
        const nl: Loan = { ...l };
        const id = idAt(
          placements,
          nl.pledgedPlacementIndex,
          "Loan.pledgedPlacementIndex",
          unresolved,
        );
        if (id) nl.pledgedPlacementId = id;
        return nl;
      });
    }
    return np;
  });

  // a-bis. id stable sur chaque enfant (Lot 0 donations-famille) — meme patron,
  //        non destructif, idempotent. Aucune reference index->id a convertir ici
  //        (les lecteurs enfants existants restent par index, hors perimetre).
  const childrenData = (srcData.childrenData ?? []).map((c) =>
    c.id ? { ...c } : { ...c, id: makeId() },
  );

  const data: PatrimonialData = { ...srcData, placements, properties, childrenData };

  // b3. successionData.legsPrecisItems.propertyIndex -> assetId
  let successionData: SuccessionData | null = bundle.successionData ?? null;
  if (successionData) {
    const legsPrecisItems = (successionData.legsPrecisItems ?? []).map((it) => {
      if (it.assetId !== undefined || it.assetType === "free") return { ...it };
      const arr =
        it.assetType === "property"
          ? properties
          : it.assetType === "placement"
            ? placements
            : null;
      if (!arr) return { ...it };
      const id = idAt(arr, it.propertyIndex, `LegsPrecisItem(${it.assetType})`, unresolved);
      return id ? { ...it, assetId: id } : { ...it };
    });
    successionData = { ...successionData, legsPrecisItems };
  }

  // b4. hypotheses[].donations[].assetIndex -> assetId (résolu contre la data principale)
  const hypotheses = (bundle.hypotheses ?? []).map((h) => {
    if (!Array.isArray(h.donations)) return { ...h };
    const donations = h.donations.map((d) => {
      if (d.assetId !== undefined || d.assetType === "free") return { ...d };
      const arr =
        d.assetType === "property"
          ? properties
          : d.assetType === "placement"
            ? placements
            : null;
      if (!arr) return { ...d };
      const id = idAt(arr, d.assetIndex, `DonationItem(${d.assetType})`, unresolved);
      return id ? { ...d, assetId: id } : { ...d };
    });
    return { ...h, donations };
  });

  return { data, successionData, hypotheses, unresolved };
}
