// ─── Migration v1.4.0 — initialisation du champ `travail` ────────────────
//
// Les anciens dossiers (≤ v1.3.x) n'ont pas le champ `data.travail`.
// Ce module ajoute, au chargement d'un payload existant, une structure
// PayloadTravailPair initiale vide pour P1 (et P2 si couple).
//
// IMPORTANT — ne pas dupliquer les champs existants :
//   - `data.salary1` / `data.salary2` sont des revenus NETS imposables
//     (utilisés par computeIR). `salaireBrutAnnuel` est une donnée
//     DISTINCTE (brut annuel) qui doit être saisie séparément. Pas de
//     fusion automatique pour ne pas introduire de valeur fausse.
//   - `person1Csp` / `person2Csp` (CSP INSEE) restent intacts. Le
//     champ `statutPro` est un axe séparé (prévoyance), distinct du
//     PCS (collecte fiscale).
//
// La migration est idempotente : si `data.travail` existe déjà,
// elle ne le modifie pas.

import type { PatrimonialData, PayloadTravailPair } from "../../types/patrimoine";
import { createEmptyTravail } from "../prevoyance/utils";

export function migrateV140Travail(data: PatrimonialData): PatrimonialData {
  if (data.travail) return data;

  const isCouple =
    data.coupleStatus === "married" ||
    data.coupleStatus === "pacs" ||
    data.coupleStatus === "cohab";

  const travail: PayloadTravailPair = {
    p1: createEmptyTravail(),
    p2: isCouple ? createEmptyTravail() : null,
  };

  return { ...data, travail };
}
