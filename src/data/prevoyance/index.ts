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
import carmf from "./carmf-2026.json";
import cipav from "./cipav-2026.json";

export const CURRENT_YEAR = 2026;

export type PassReferentiel = typeof pass;
export type CaissesReferentiel = typeof caisses;
export type CcnReferentiel = typeof ccn;

// Bloc CARMF (médecins libéraux) : structure dédiée, distincte du schéma
// générique des caisses (architecture 2 étages CPAM→CARMF, barèmes par
// tranche d'âge, majorations invalidité). Consommé par la branche CARMF
// du moteur (cf. projection.ts). Source : carmf.fr, vérifié 2026-05-28.
//
// Bloc CIPAV (professions libérales non réglementées) : architecture
// DIFFÉRENTE (phase 1 IJ libéraux J4-J90 → trou J91 → invalidité par
// points). Consommé par la branche CIPAV du moteur (cf. cipav.ts).
// Source : lacipav.fr + ameli.fr, vérifié 2026-05-29.
export const referentiels = { pass, caisses, ccn, carmf, cipav };
export type Referentiels = typeof referentiels;

if (typeof window !== "undefined" && new Date().getFullYear() > CURRENT_YEAR + 1) {
  // eslint-disable-next-line no-console
  console.warn(
    `[prevoyance] Référentiels datés de ${CURRENT_YEAR}. ` +
    `Vérifier les mises à jour annuelles (PASS, IJSS, CCN).`
  );
}
