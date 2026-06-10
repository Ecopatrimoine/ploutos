// ─── LOT DONNEES TRANSPORTS — CCN 16 (CARCEPT-Prevoyance, TRM/auxiliaires) ────
//
// CCN MULTI-COLLEGES : garanties NON-CADRES uniquement, prevoyanceCadres null,
// PAS de collegeImpose (un cadre sur IDCC 16 retombe sur null -> aucune garantie,
// routage statutPro normal = comportement INVERSE du garde-fou BTP). Capital
// uniquement (ni rente conjoint ni rente education). PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import { computeRenteInvalCollective, projeterArretMaladie } from "../lib/prevoyance/projection";
import {
  computeSuccession,
  devolutionCapitalDecesBrancheCascade,
  resolveDevolutionCapitalDecesConfig,
} from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective, EntreePerso } from "../lib/prevoyance/types";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

// ── Capital DC : emulation du plafond par rangs ───────────────────────────────
describe("CCN 16 — capital deces situationFamiliale (plafonds par rangs)", () => {
  const cap = (famille: any, salaire = 30000) =>
    resolveCapitalDecesBranche("16", "nonCadres", salaire, PASS, referentiels, famille).capital;

  it("TRANS-A marie 2 enfants → (100 + 30 + 30)% x 30 000 = 48 000 EUR", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 2 })).toBeCloseTo(48000, 2);
  });

  it("celibataire 0 enfant → 50% x 30 000 = 15 000 EUR", () => {
    expect(cap({})).toBeCloseTo(15000, 2);
  });

  it("celibataire 2 enfants → (50 + 50 + 0)% = 100% = 30 000 EUR (2e enfant n'ajoute rien)", () => {
    expect(cap({ nbEnfantsACharge: 2 })).toBeCloseTo(30000, 2);
  });

  it("marie 5 enfants → (100 + 30 + 30 + 30 + 10 + 0)% = 200% = 60 000 EUR (saturation)", () => {
    expect(cap({ conjointPresent: true, nbEnfantsACharge: 5 })).toBeCloseTo(60000, 2);
  });
});

// ── Garde-fou INVERSE : un cadre sur IDCC 16 ne recoit RIEN ───────────────────
describe("CCN 16 — multi-colleges, aucun collegeImpose (cadre -> rien)", () => {
  it("categorieBranche route le cadre vers 'cadres' (pas de collegeImpose)", () => {
    expect(categorieBranche("16", "salarie_cadre", referentiels)).toBe("cadres");
    expect(categorieBranche("16", "salarie_non_cadre", referentiels)).toBe("nonCadres");
  });

  it("cadre sur IDCC 16 → prevoyanceCadres null → capital indisponible (aucune garantie)", () => {
    const cat = categorieBranche("16", "salarie_cadre", referentiels); // "cadres"
    const r = resolveCapitalDecesBranche("16", cat, 30000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.donneeIndisponible).toBe(true);
    expect(r.capital).toBeNull();
  });
});

// ── Devolution : concubin a un RANG PROPRE (rang 2) ───────────────────────────
describe("CCN 16 — devolution capital deces (concubin rang propre)", () => {
  const config = resolveDevolutionCapitalDecesConfig("16", referentiels);

  it("config posee : 5 rangs, concubin SEUL au rang 2", () => {
    expect(config).not.toBeNull();
    expect(config!.rangs).toHaveLength(5);
    expect(config!.rangs[1].qualites).toEqual(["concubin"]);
  });

  it("concubin survivant → 100% du capital au rang 2", () => {
    const rep = devolutionCapitalDecesBrancheCascade(
      50000,
      { partenaireNom: "Concubin", partenaireRelation: "autre", partenaireQualite: "concubin", enfants: [] },
      config
    );
    expect(rep).toHaveLength(1);
    expect(rep[0].beneficiaire).toBe("Concubin");
    expect(rep[0].montant).toBeCloseTo(50000, 2);
  });

  it("conjoint survivant → rang 1 (exclut enfants ET concubin)", () => {
    const rep = devolutionCapitalDecesBrancheCascade(
      50000,
      { partenaireNom: "Epoux", partenaireRelation: "conjoint", partenaireQualite: "conjoint", enfants: ["E1", "E2"] },
      config
    );
    expect(rep).toHaveLength(1);
    expect(rep[0].beneficiaire).toBe("Epoux");
  });
});

// ── Invalidite ADDITIVE (rente propre, base brut) ─────────────────────────────
describe("CCN 16 — invalidite additive (rente propre CARCEPT)", () => {
  const branche = resolveCouvertureBranche("16", "nonCadres", referentiels);
  const cov: CouvertureCollective = { invalidite: branche.invalidite };

  it("cat1 → +15% du brut, ADDITIF (pension Secu ignoree)", () => {
    // base brut = 5e arg ; pension (4e arg) ignoree en additif.
    expect(computeRenteInvalCollective(cov, "cat1", 30000, 10000, 30000, 2)).toBeCloseTo(30000 * 0.15, 2); // 4 500
  });
  it("cat2/cat3 → +20% du brut, ADDITIF", () => {
    expect(computeRenteInvalCollective(cov, "cat2", 30000, 10000, 30000, 0)).toBeCloseTo(30000 * 0.20, 2); // 6 000
    expect(computeRenteInvalCollective(cov, "cat3", 30000, 10000, 30000, 0)).toBeCloseTo(30000 * 0.20, 2);
  });
});

// ── Rentes conjoint / education ABSENTES (capital uniquement) ─────────────────
describe("CCN 16 — ni rente conjoint ni rente education", () => {
  it("rente conjoint indisponible (null, pas un TO_FILL)", () => {
    expect(resolveRenteConjointSubstitutiveBranche("16", "nonCadres", 30000, PASS, referentiels).donneeIndisponible).toBe(true);
  });
  it("rente education indisponible (null)", () => {
    expect(resolveRenteEducationBranche("16", "nonCadres", 30000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
  });
});

// ── Dossier TRANS-A (integration) ─────────────────────────────────────────────
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
      dateEmbauche: "2010-01-01", dateDebutActivite: "2010-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function childAge(firstName: string, age: number): PatrimonialData["childrenData"][number] {
  return {
    firstName, lastName: "TEST-TRANS", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Bruno", person1LastName: "TEST-TRANS", person1BirthDate: "1988-01-01", // defunt, 38 ans
    person1JobTitle: "", person1Csp: "64", person1PcsGroupe: "6",
    person2FirstName: "Nadia", person2LastName: "TEST-TRANS", person2BirthDate: "1990-01-01",
    person2JobTitle: "", person2Csp: "56", person2PcsGroupe: "5",
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

describe("CCN 16 — dossier TRANS-A (conducteur TRM, marie, 2 enfants, 30 000 EUR)", () => {
  const s = computeSuccession(
    baseSuccession(),
    baseData({
      coupleStatus: "married",
      childrenData: [childAge("Lila", 10), childAge("Sami", 14)],
      travail: travailDefunt("salarie_non_cadre", employeurCcn("16", "Transports routiers et activites auxiliaires du transport"), 30000),
    })
  );

  it("capital 48 000, AUCUNE rente conjoint NI rente education AFFICHEE", () => {
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(48000, 2);
    // Rente conjoint : 3c ne pousse que si disponible → liste vide.
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
    // Rente education : 3b pousse une ligne par enfant < 26, mais marquee
    // donneeIndisponible (renteEducation null pour CCN 16) → AUCUNE ligne AFFICHEE
    // (l'UI filtre sur !donneeIndisponible).
    expect(s.capitalDecesLines.renteEducationBranche.filter((l) => !l.donneeIndisponible)).toHaveLength(0);
  });

  it("IJ : pas de complement de branche avant J180, puis cible 75% du revenu de reference", () => {
    const entree: EntreePerso = {
      age: 38, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
      idccCCN: "16", ancienneteMois: 180, salaireBrutAnnuel: 30000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const r = projeterArretMaladie(entree, "cat2", referentiels);
    // Aucun complement collectif de branche avant la franchise 180 jours.
    for (let k = 0; k < r.axe.length; k++) {
      if (r.axe[k].phase === "am" && r.axe[k].jour < 180) {
        expect(r.series.ijComplementaireCollective[k]).toBe(0);
      }
    }
    // 1er jour indemnise par la branche >= 180, total porte a 75% du revenu de ref.
    const i = r.axe.findIndex((p, k) => p.phase === "am" && r.series.ijComplementaireCollective[k] > 0);
    expect(i).toBeGreaterThan(-1);
    expect(r.axe[i].jour).toBeGreaterThanOrEqual(180);
    const total = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i] + r.series.ijComplementaireCollective[i];
    expect(total).toBeCloseTo(0.75 * r.revenuReferenceMensuel, 0);
  });

  it("invalidite cat1 additive : +15% du brut au-dessus de la pension Secu", () => {
    const entree: EntreePerso = {
      age: 38, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
      idccCCN: "16", ancienneteMois: 180, salaireBrutAnnuel: 30000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const r = projeterArretMaladie(entree, "cat1", referentiels);
    const i = r.axe.findIndex((p) => p.phase === "invalidite");
    expect(r.series.renteInvalCollective[i]).toBeCloseTo((30000 / 12) * 0.15, 2); // 375/mois = 4 500/an
  });
});
