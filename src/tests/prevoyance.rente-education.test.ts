// VOIE A — R3 Volet 2 : constat « pas de rente éducation prévue » (câblage de
// deces_rente_educ, jusqu'ici code mort).

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { evaluerToutesLesRegles, regleDcPasDeRenteEducation } from "../lib/prevoyance/regles";
import { referentiels } from "../data/prevoyance";
import type { ContexteRegle, ContratIndividuel, EntreePerso } from "../lib/prevoyance/types";

const entree: EntreePerso = {
  age: 40,
  ageRetraite: 64,
  statutPro: "salarie_cadre",
  caisse: "CPAM",
  idccCCN: "1486",
  ancienneteMois: 60,
  salaireBrutAnnuel: 55000,
  salaireNetMensuel: 3575,
  contratsIndividuels: [],
  couvertureCollective: null,
};

function renteEduc(montant: number): ContratIndividuel {
  return { id: "re_1", type: "deces_rente_educ", capitalOuMontant: montant };
}

function makeCtx(over: Partial<ContexteRegle> = {}): ContexteRegle {
  const e = over.entree ?? entree;
  return {
    entree: e,
    projection: projeterArretMaladie(e, "cat2", referentiels),
    dettesImmobilieres: 0,
    conjointACharge: false,
    enfantsMineurs: 0,
    revenuP1Mensuel: 4583,
    revenuP2Mensuel: 0,
    ...over,
  };
}

describe("regleDcPasDeRenteEducation", () => {
  it("(d) enfants à charge + aucune rente éducation → constat émis (attention, axe deces)", () => {
    const constat = regleDcPasDeRenteEducation(makeCtx({ enfantsMineurs: 2 }), "p1");
    expect(constat).not.toBeNull();
    expect(constat?.id).toBe("dc_pas_de_rente_education_p1");
    expect(constat?.severite).toBe("attention");
    expect(constat?.axe).toBe("deces");
  });

  it("(e) aucun enfant à charge → constat NON émis", () => {
    expect(regleDcPasDeRenteEducation(makeCtx({ enfantsMineurs: 0 }), "p1")).toBeNull();
  });

  it("(f) une rente éducation saisie → constat NON émis", () => {
    const ctx = makeCtx({ enfantsMineurs: 2, entree: { ...entree, contratsIndividuels: [renteEduc(500)] } });
    expect(regleDcPasDeRenteEducation(ctx, "p1")).toBeNull();
  });

  it("est intégré au pipeline evaluerToutesLesRegles", () => {
    const ids = evaluerToutesLesRegles(makeCtx({ enfantsMineurs: 1 }), "p1").map((c) => c.id);
    expect(ids).toContain("dc_pas_de_rente_education_p1");
  });

  it("(g) non-régression : sans enfant, le nouvel id n'apparaît pas", () => {
    const ids = evaluerToutesLesRegles(makeCtx({ enfantsMineurs: 0 }), "p1").map((c) => c.id);
    expect(ids).not.toContain("dc_pas_de_rente_education_p1");
  });

  it("DDA : l'action ne nomme aucun assureur ni produit", () => {
    const constat = regleDcPasDeRenteEducation(makeCtx({ enfantsMineurs: 2 }), "p1");
    const interdits = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut|gan|mma|macif/i;
    expect(interdits.test(constat?.action ?? "")).toBe(false);
  });
});
