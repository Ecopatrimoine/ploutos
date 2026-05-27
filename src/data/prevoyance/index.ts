// ─── Référentiels Prévoyance — point d'entrée millésimé ──────────────────
//
// Charge les trois fichiers JSON du millésime courant (PASS, caisses,
// CCN) et les expose au reste du code via `referentiels`. La mise à
// jour annuelle consiste à :
//   1. dupliquer les 3 fichiers en *-{N+1}.json puis ajuster les valeurs
//   2. bumper CURRENT_YEAR et les imports ci-dessous
//   3. relancer la suite Vitest (les cas d'or doivent rester verts)
//
// Un warning console se déclenche au démarrage si l'application tourne
// plus d'un an après le millésime — garde-fou pour ne pas oublier la
// mise à jour annuelle.

import pass from "./pass-2026.json";
import caisses from "./caisses-2026.json";
import ccn from "./ccn-2026.json";

export const CURRENT_YEAR = 2026;

export type PassReferentiel = typeof pass;
export type CaissesReferentiel = typeof caisses;
export type CcnReferentiel = typeof ccn;

export const referentiels = { pass, caisses, ccn };
export type Referentiels = typeof referentiels;

if (typeof window !== "undefined" && new Date().getFullYear() > CURRENT_YEAR + 1) {
  // eslint-disable-next-line no-console
  console.warn(
    `[prevoyance] Référentiels datés de ${CURRENT_YEAR}. ` +
    `Vérifier les mises à jour annuelles (PASS, IJSS, CCN).`
  );
}
