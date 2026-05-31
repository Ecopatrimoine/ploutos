// ─── Fixture de test : caisse cobaye TO_FILL fictive (_TEST_TOFILL) ─────────
//
// Le moteur lève donneesCaisseIndisponibles + une rupture "donnees_indisponibles"
// pour toute caisse au schéma minimal { ij/invalidite/capitalDeces: {TO_FILL:true} }.
// Pour exercer cette branche SANS occuper une vraie caisse du référentiel (qui
// finira encodée), on injecte une caisse fictive `_TEST_TOFILL` dans un
// référentiel DÉRIVÉ (copie immuable — l'objet `referentiels` d'origine n'est
// jamais muté, donc aucune pollution entre tests).
//
// `_TEST_TOFILL` n'existe QUE dans les tests : aucun fichier de prod ne le
// connaît (le cast `as CodeCaisse` est donc cantonné aux tests).

import { referentiels } from "../../data/prevoyance";

export const CAISSE_COBAYE = "_TEST_TOFILL";

const COBAYE_ENTREE = {
  nom: "Caisse fictive de test (cobaye TO_FILL)",
  publicConcerne: "test",
  ij: { TO_FILL: true },
  invalidite: { TO_FILL: true },
  capitalDeces: { TO_FILL: true },
};

// Référentiel dérivé = copie de `referentiels` + entrée cobaye. Copie shallow à
// chaque niveau touché (referentiels → caisses → caisses.caisses) : l'original
// reste intact.
export function makeRefAvecCobaye(): typeof referentiels {
  return {
    ...referentiels,
    caisses: {
      ...(referentiels.caisses as any),
      caisses: {
        ...(referentiels.caisses as any).caisses,
        [CAISSE_COBAYE]: COBAYE_ENTREE,
      },
    },
  } as typeof referentiels;
}
