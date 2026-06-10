// ─── LOT DONNEES Commerce alimentaire — CCN 2216 (titre XIII, OCIRP/AG2R) ─────
//
// Regime NON-CADRES (multi-colleges, PAS de collegeImpose, prevoyanceCadres null).
// Capital + rente education (3 tranches d'age CONTIGUES) + invalidite ; ni rente
// conjoint ni IJ de branche. PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import { computeRenteInvalCollective } from "../lib/prevoyance/projection";
import {
  computeSuccession,
  devolutionCapitalDecesBrancheCascade,
  resolveDevolutionCapitalDecesConfig,
} from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective } from "../lib/prevoyance/types";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

// ── Capital DC : majoration enfant LINEAIRE (sans plafond) ────────────────────
describe("2216 — capital deces situationFamiliale (lineaire, sans plafond)", () => {
  const cap = (famille: any, salaire = 24000) =>
    resolveCapitalDecesBranche("2216", "nonCadres", salaire, PASS, referentiels, famille).capital;

  it("COM-A marie 2 enfants → (100 + 50 + 50)% x 24 000 = 48 000 EUR", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 2 })).toBeCloseTo(48000, 2);
  });
  it("celibataire 2 enfants → (50 + 50 + 50)% = 150% x 24 000 = 36 000 EUR (lineaire, pas de plafond)", () => {
    expect(cap({ nbEnfantsACharge: 2 })).toBeCloseTo(36000, 2);
  });
  it("celibataire 0 enfant → 50% x 24 000 = 12 000 EUR", () => {
    expect(cap({})).toBeCloseTo(12000, 2);
  });
  it("plafond 4 PASS : celibataire 0 enfant, salaire 250 000 → 50% x 192 240 = 96 120 EUR", () => {
    expect(cap({}, 250000)).toBeCloseTo(0.5 * 4 * PASS, 2); // 96 120
  });
});

// ── Garde-fou multi-colleges : cadre -> rien ──────────────────────────────────
describe("2216 — multi-colleges (cadre -> aucune garantie)", () => {
  it("cadre route vers prevoyanceCadres null → capital indisponible", () => {
    expect(categorieBranche("2216", "salarie_cadre", referentiels)).toBe("cadres");
    const r = resolveCapitalDecesBranche("2216", "cadres", 24000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.donneeIndisponible).toBe(true);
    expect(r.capital).toBeNull();
  });
});

// ── Rente education : 3 tranches CONTIGUES, AUCUN trou (pivots 10/17/25) ───────
describe("2216 — rente education (tranches evolutives contiguës)", () => {
  const re = (age: number, salaire = 24000) =>
    resolveRenteEducationBranche("2216", "nonCadres", salaire, PASS, age, referentiels).montantAnnuelCourant;

  it("COM-A : enfant 8 ans → 4% = 960 ; enfant 14 ans → 6% = 1 440 (tranches differentes)", () => {
    expect(re(8)).toBeCloseTo(960, 2);
    expect(re(14)).toBeCloseTo(1440, 2);
  });
  it("PIVOT 10 ans → 4% = 960 (couvert par {0,11}, pas de trou)", () => {
    expect(re(10)).toBeCloseTo(0.04 * 24000, 2);
  });
  it("PIVOT 17 ans → 6% = 1 440 (couvert par {11,18})", () => {
    expect(re(17)).toBeCloseTo(0.06 * 24000, 2);
  });
  it("PIVOT 25 ans → 9% = 2 160 (couvert par {18,26})", () => {
    expect(re(25)).toBeCloseTo(0.09 * 24000, 2);
  });
});

// ── Invalidite (mode cible, sous deduction Secu) ──────────────────────────────
describe("2216 — invalidite cible", () => {
  const branche = resolveCouvertureBranche("2216", "nonCadres", referentiels);
  const cov: CouvertureCollective = { invalidite: branche.invalidite };
  const cible = (cat: "cat1" | "cat2" | "cat3") => computeRenteInvalCollective(cov, cat, 24000, 0, 24000, 0);

  it("cat1 = 42% (avenant 69), cat2/cat3 = 65%", () => {
    expect(cible("cat1")).toBeCloseTo(24000 * 0.42, 2);
    expect(cible("cat2")).toBeCloseTo(24000 * 0.65, 2);
    expect(cible("cat3")).toBeCloseTo(24000 * 0.65, 2);
  });
});

// ── Ni rente conjoint ni IJ de branche ────────────────────────────────────────
describe("2216 — ni rente conjoint ni IJ de branche", () => {
  it("rente conjoint indisponible ; ij absente mais invalidite presente", () => {
    expect(resolveRenteConjointSubstitutiveBranche("2216", "nonCadres", 24000, PASS, referentiels).donneeIndisponible).toBe(true);
    const branche = resolveCouvertureBranche("2216", "nonCadres", referentiels);
    expect(branche.ij).toBeUndefined();        // pas d'IJ de branche
    expect(branche.invalidite).toBeDefined();  // invalidite presente
  });
});

// ── Devolution 6 rangs : PACS et concubin a des rangs PROPRES ─────────────────
describe("2216 — devolution (PACS rang 2, concubin rang 3, separes)", () => {
  const config = resolveDevolutionCapitalDecesConfig("2216", referentiels);

  it("6 rangs, PACS seul rang 2, concubin seul rang 3", () => {
    expect(config!.rangs).toHaveLength(6);
    expect(config!.rangs[0].qualites).toEqual(["conjoint"]);
    expect(config!.rangs[1].qualites).toEqual(["pacs"]);
    expect(config!.rangs[2].qualites).toEqual(["concubin"]);
  });
  it("PACS survivant → 100% au rang 2 ; concubin survivant → 100% au rang 3", () => {
    const repPacs = devolutionCapitalDecesBrancheCascade(40000, { partenaireNom: "Pacse", partenaireRelation: "pacs_partner", partenaireQualite: "pacs", enfants: [] }, config);
    expect(repPacs).toHaveLength(1);
    expect(repPacs[0].beneficiaire).toBe("Pacse");
    const repConcubin = devolutionCapitalDecesBrancheCascade(40000, { partenaireNom: "Concubin", partenaireRelation: "autre", partenaireQualite: "concubin", enfants: [] }, config);
    expect(repConcubin).toHaveLength(1);
    expect(repConcubin[0].beneficiaire).toBe("Concubin");
  });
});

// ── COM-A integration (computeSuccession) ─────────────────────────────────────
function employeurCcn(idcc: string, nom: string): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "TEST", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: nom, sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  } as unknown as EmployeurInfo;
}
function travailDefunt(statut: string, employeur: EmployeurInfo, brut: number): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: "CPAM", employeur,
      dateEmbauche: "2014-01-01", dateDebutActivite: "2014-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function childAge(firstName: string, age: number): PatrimonialData["childrenData"][number] {
  return {
    firstName, lastName: "TEST-COM", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Karima", person1LastName: "TEST-COM", person1BirthDate: "1991-01-01", // 35 ans
    person1JobTitle: "", person1Csp: "55", person1PcsGroupe: "5",
    person2FirstName: "Marc", person2LastName: "TEST-COM", person2BirthDate: "1989-01-01",
    person2JobTitle: "", person2Csp: "55", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [],
    salary1: "0", salary2: "0", pensions: "0",
    perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
    ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
    chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
    ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
    chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
    properties: [], placements: [], otherLoans: [],
    ...over,
  } as unknown as PatrimonialData;
}
function baseSuccession(): SuccessionData {
  return {
    deceasedPerson: "person1", spouseOption: "legal_quarter_full",
    heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: true,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

describe("2216 — dossier COM-A (employee supermarche, mariee, 2 enfants 8+14, 24 000 EUR)", () => {
  const s = computeSuccession(
    baseSuccession(),
    baseData({
      coupleStatus: "married",
      childrenData: [childAge("Lina", 8), childAge("Yanis", 14)],
      travail: travailDefunt("salarie_non_cadre", employeurCcn("2216", "Commerce de detail et de gros a predominance alimentaire"), 24000),
    })
  );

  it("capital 48 000 ; 2 rentes education DIFFERENTES (960 et 1 440) ; aucune rente conjoint", () => {
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(48000, 2);
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
    const re = s.capitalDecesLines.renteEducationBranche;
    expect(re).toHaveLength(2);
    const montants = re.map((l) => l.montantAnnuelCourant).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(montants[0]).toBeCloseTo(960, 2);  // enfant 8 ans, 4%
    expect(montants[1]).toBeCloseTo(1440, 2); // enfant 14 ans, 6%
  });
});
