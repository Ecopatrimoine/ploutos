// Debug ponctuel : projection du cas A (Mathieu Syntec) — spec §7.1.
// Force temporairement les valeurs CPAM TO_VERIFY à des valeurs
// raisonnables hardcodées (sans modifier le référentiel JSON livré)
// pour voir les étages obligatoires fonctionner.
//
// Lancement : npx tsx scripts/runCasA.ts

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { projeterArretMaladie } from "../src/lib/prevoyance/projection";
import { referentiels as refOriginal } from "../src/data/prevoyance";
import type { EntreePerso } from "../src/lib/prevoyance/types";

// Deep clone : on patche en mémoire, le JSON livré reste intact.
const ref: typeof refOriginal = JSON.parse(JSON.stringify(refOriginal));
const cpam = (ref.caisses as { caisses: any }).caisses.CPAM;

// Patch CPAM TO_VERIFY → valeurs raisonnables (démonstration uniquement).
cpam.ij.plafondJournalier = 41.95;                                  // IJSS max 2026 (1,4 SMIC)
cpam.invalidite.categories.cat2.plafondMensuel = 1100;              // ordre de grandeur cat 2
// tauxBase cat2 = 0.5 est déjà dans le référentiel.

const casA: EntreePerso = {
  age: 35,
  ageRetraite: 64,
  statutPro: "salarie_cadre",
  caisse: "CPAM",
  idccCCN: "1486",
  ancienneteMois: 48,
  salaireBrutAnnuel: 55000,
  salaireNetMensuel: 3575,
  contratsIndividuels: [],
  couvertureCollective: {
    ij: { pctSalaire: 0.80, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
    invalidite: {
      cat1: { pctSalaire: 0.40 },
      cat2: { pctSalaire: 0.80 },
      cat3: { pctSalaire: 1.00 },
    },
    capitalDeces: { montant: 55000, baseFormule: "100% T1+T2" },
  },
};

const result = projeterArretMaladie(casA, "cat2", ref);
const out = JSON.stringify(result, null, 2);
console.log(out);

const outPath = path.join(os.tmpdir(), "sample.json");
fs.writeFileSync(outPath, out, "utf8");
console.log(`\n→ Échantillon écrit dans : ${outPath}`);
