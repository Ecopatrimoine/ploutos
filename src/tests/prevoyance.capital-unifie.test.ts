// VOIE A — R1 : pont constats du capital décès unifié (legacy deces_capital +
// ContratTransmissionDeces). Vérifie que les 2 règles « décès » reconnaissent
// désormais un capital saisi côté Transmission, sans rupture du legacy.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { buildContexteRegle } from "../lib/prevoyance/contexte";
import {
  capitalDecesUnifie,
  regleDcTnsSansCapital,
  regleDcCapitalInsuffisantDettes,
} from "../lib/prevoyance/regles";
import { referentiels } from "../data/prevoyance";
import type { ContexteRegle, ContratIndividuel, EntreePerso } from "../lib/prevoyance/types";
import type { ContratTransmissionDeces, PatrimonialData } from "../types/patrimoine";

const entreeTNS: EntreePerso = {
  age: 48,
  ageRetraite: 64,
  statutPro: "tns_liberal",
  caisse: "CIPAV",
  idccCCN: null,
  ancienneteMois: 0,
  salaireBrutAnnuel: 0,
  salaireNetMensuel: 0,
  revenuTNSAnnuel: 95000,
  contratsIndividuels: [],
  couvertureCollective: null,
};

function legacyCapital(montant: number): ContratIndividuel {
  return { id: "ci_1", type: "deces_capital", capitalOuMontant: montant };
}

function transmission(capitalTransmis: number): ContratTransmissionDeces {
  return {
    id: "td_1", libelle: "Temporaire décès", natureAssiette: "capital",
    capitalTransmis, beneficiaires: [],
  };
}

function makeCtx(over: Partial<ContexteRegle> = {}): ContexteRegle {
  const entree = over.entree ?? entreeTNS;
  return {
    entree,
    projection: projeterArretMaladie(entree, "cat2", referentiels),
    dettesImmobilieres: 0,
    conjointACharge: false,
    enfantsMineurs: 0,
    revenuP1Mensuel: 7917,
    revenuP2Mensuel: 0,
    ...over,
  };
}

// ─── Helper unifié ───────────────────────────────────────────────────────────

describe("capitalDecesUnifie", () => {
  it("retient le MAX des deux sources (anti sur-comptage : même police saisie deux fois)", () => {
    // legacy 80000 vs transmission 120000 → 120000 (pas la somme 200000).
    expect(capitalDecesUnifie([legacyCapital(80000)], [transmission(120000)])).toBe(120000);
    // legacy plus grand → legacy.
    expect(capitalDecesUnifie([legacyCapital(150000)], [transmission(90000)])).toBe(150000);
  });

  it("transmission undefined → seul le legacy compte (rétro-compat)", () => {
    expect(capitalDecesUnifie([legacyCapital(80000)], undefined)).toBe(80000);
  });

  it("ignore les montants non finis", () => {
    const bad = { id: "x", type: "deces_capital", capitalOuMontant: NaN } as ContratIndividuel;
    expect(capitalDecesUnifie([bad], [transmission(50000)])).toBe(50000);
  });
});

// ─── Règle 1 : présence (TNS sans capital) ───────────────────────────────────

describe("regleDcTnsSansCapital — reconnaît le capital de transmission", () => {
  it("NE se déclenche PLUS si un ContratTransmissionDeces porte un capital (sans legacy)", () => {
    const ctx = makeCtx({ conjointACharge: true, contratsTransmissionDeces: [transmission(200000)] });
    expect(regleDcTnsSansCapital(ctx, "p1")).toBeNull();
  });

  it("se déclenche toujours quand aucune source ne porte de capital (non-régression)", () => {
    const ctx = makeCtx({ conjointACharge: true, contratsTransmissionDeces: [] });
    const constat = regleDcTnsSansCapital(ctx, "p1");
    expect(constat?.id).toBe("dc_tns_sans_capital_p1");
  });
});

// ─── Règle 2 : montant vs dettes ─────────────────────────────────────────────

describe("regleDcCapitalInsuffisantDettes — prend en compte la transmission", () => {
  it("capital de transmission >= dettes → pas de constat", () => {
    const ctx = makeCtx({ dettesImmobilieres: 100000, contratsTransmissionDeces: [transmission(150000)] });
    expect(regleDcCapitalInsuffisantDettes(ctx, "p1")).toBeNull();
  });

  it("capital de transmission < dettes → constat avec le déficit résiduel", () => {
    const ctx = makeCtx({ dettesImmobilieres: 100000, contratsTransmissionDeces: [transmission(60000)] });
    const constat = regleDcCapitalInsuffisantDettes(ctx, "p1");
    expect(constat?.id).toBe("dc_capital_insuffisant_dettes_p1");
    expect(constat?.impactChiffre?.montant).toBe(40000); // 100000 - 60000
  });

  it("legacy seul, sans transmission → comportement inchangé (non-régression)", () => {
    const ctx = makeCtx({ dettesImmobilieres: 100000, entree: { ...entreeTNS, contratsIndividuels: [legacyCapital(150000)] } });
    expect(regleDcCapitalInsuffisantDettes(ctx, "p1")).toBeNull();
  });
});

// ─── Plomberie buildContexteRegle ────────────────────────────────────────────

describe("buildContexteRegle — branche les contrats de transmission via `which`", () => {
  const data = {
    coupleStatus: "single", childrenData: [], properties: [], placements: [],
    salary1: "0", salary2: "0",
    prevoyance: {
      version: 1,
      p1: { contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2", contratsTransmissionDeces: [transmission(75000)] },
      p2: null,
    },
  } as unknown as PatrimonialData;

  it("which='p1' → expose data.prevoyance.p1.contratsTransmissionDeces", () => {
    const projection = projeterArretMaladie(entreeTNS, "cat2", referentiels);
    const ctx = buildContexteRegle(data, entreeTNS, projection, "p1");
    expect(ctx.contratsTransmissionDeces).toHaveLength(1);
    expect(ctx.contratsTransmissionDeces?.[0].capitalTransmis).toBe(75000);
  });

  it("which omis → [] (rétro-compat, comportement inchangé)", () => {
    const projection = projeterArretMaladie(entreeTNS, "cat2", referentiels);
    const ctx = buildContexteRegle(data, entreeTNS, projection);
    expect(ctx.contratsTransmissionDeces).toEqual([]);
  });
});
