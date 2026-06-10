// ─── LOT DONNEES RNPC — Cadres du BTP (IDCC 2420 / 3212) ──────────────────────
//
// 2420 (Batiment cadres) et 3212 (Travaux publics cadres) partagent LE MEME
// regime national (RNPC) : blocs identiques dupliques (Q6) + garde-fou d'egalite.
// STRUCTURE INVERSEE vs RNPO/RNPE : garanties dans prevoyanceCadres,
// prevoyanceNonCadres null, collegeImpose "cadres" (absorbe l'incoherence
// statutPro/IDCC : un non-cadre rattache a 2420 est traite en cadre, BTP-0).
// PASS 2026 = 48 060.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import { computeRenteInvalCollective, projeterArretMaladie } from "../lib/prevoyance/projection";
import { computeSuccession } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective, EntreePerso } from "../lib/prevoyance/types";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

// ── a. Coherence Q6 ───────────────────────────────────────────────────────────
describe("RNPC — coherence Q6 (2420 / 3212 identiques)", () => {
  const ccn = referentiels.ccn as any;
  const c2420 = ccn.conventions["2420"];
  const c3212 = ccn.conventions["3212"];

  it("blocs prevoyanceCadres / devolution / maintien / plafond / college IDENTIQUES", () => {
    expect(c3212.prevoyanceCadres).toEqual(c2420.prevoyanceCadres);
    expect(c3212.devolutionCapitalDeces).toEqual(c2420.devolutionCapitalDeces);
    expect(c3212.maintienEmployeur).toEqual(c2420.maintienEmployeur);
    expect(c3212.plafondSalaireRefPass).toBe(c2420.plafondSalaireRefPass);
    for (const c of [c2420, c3212]) {
      expect(c.collegeImpose).toBe("cadres");
      expect(c.prevoyanceNonCadres).toBeNull(); // garanties cote cadres uniquement
      expect(c.plafondSalaireRefPass).toBe(4);
      expect(c.devolutionCapitalDeces.rangs).toHaveLength(4); // cloture devolutionSuccessorale
    }
  });

  it("metadonnees distinctes (3212 = Travaux publics)", () => {
    expect(c2420.nom).not.toBe(c3212.nom);
    expect(c3212.nom).toContain("Travaux publics");
  });
});

// ── b. Capital DC : vraie majoration PAR enfant (rangs 1-2 a 40, rang 3+ a 60) ─
describe("RNPC — capital deces situationFamiliale", () => {
  it("BTP-C marie 1 enfant, 60 000 → (250% + 40%) x 60 000 = 174 000 EUR", () => {
    const r = resolveCapitalDecesBranche("2420", "cadres", 60000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(174000, 2);
  });

  it("celibataire 0 enfant, 60 000 → 200% x 60 000 = 120 000 EUR", () => {
    const r = resolveCapitalDecesBranche("2420", "cadres", 60000, PASS, referentiels, {});
    expect(r.capital).toBeCloseTo(120000, 2);
  });

  it("marie 3 enfants → (250 + 40 + 40 + 60)% x 60 000 = 234 000 EUR (rang 3 a 60)", () => {
    const r = resolveCapitalDecesBranche("2420", "cadres", 60000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 3 });
    expect(r.capital).toBeCloseTo(234000, 2);
  });

  it("plafond 4 PSS : celibataire, salaire 250 000 → assiette 192 240 → 384 480 EUR (pas 500 000)", () => {
    const r = resolveCapitalDecesBranche("2420", "cadres", 250000, PASS, referentiels, {});
    expect(r.capital).toBeCloseTo(2.0 * 4 * PASS, 2); // 200% x 4 PASS = 384 480
  });

  it("plancher 1,3 PMSS : celibataire, salaire 2 000 → base 4 000 < plancher → ~5 206,50 EUR", () => {
    const r = resolveCapitalDecesBranche("2420", "cadres", 2000, PASS, referentiels, {});
    expect(r.capital).toBeCloseTo(0.1083333333 * PASS, 1); // ~5 206,50 (plancher AVANT majo)
  });
});

// ── c. Garde-fou college : incoherence statutPro/IDCC ABSORBEE (jamais silencieuse)
describe("RNPC — garde-fou college (collegeImpose cadres absorbe l'incoherence)", () => {
  it("statutPro non-cadre sur 2420 → categorieBranche force 'cadres'", () => {
    expect(categorieBranche("2420", "salarie_non_cadre", referentiels)).toBe("cadres");
  });

  it("non-cadre sur 2420 → garanties CADRES servies (174 000), PAS d'indisponibilite", () => {
    const cat = categorieBranche("2420", "salarie_non_cadre", referentiels);
    const r = resolveCapitalDecesBranche("2420", cat, 60000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 1 });
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(174000, 2); // absorbe, jamais 0/silencieux
  });
});

// ── d. Rente education ────────────────────────────────────────────────────────
describe("RNPC — rente education", () => {
  it("1 enfant, salaire 60 000 → 10% x 60 000 = 6 000 EUR (plancher 4 806 inerte)", () => {
    const r = resolveRenteEducationBranche("2420", "cadres", 60000, PASS, 10, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(6000, 2);
  });

  it("salaire faible 30 000 → 10% x 30 000 = 3 000 < plancher 10% PASS = 4 806 → 4 806", () => {
    const r = resolveRenteEducationBranche("2420", "cadres", 30000, PASS, 10, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(0.10 * PASS, 2); // 4 806 (plancher mord)
  });
});

// ── e. Invalidite (mode cible) : forfait cat1, par enfant cat2 ─────────────────
describe("RNPC — invalidite cible", () => {
  const branche = resolveCouvertureBranche("2420", "cadres", referentiels);
  const cov: CouvertureCollective = { invalidite: branche.invalidite };
  const cible = (cat: "cat1" | "cat2" | "cat3", nbEnf: number) =>
    computeRenteInvalCollective(cov, cat, 60000, 0, 60000, nbEnf);

  it("cat1, 0 enfant → 39% ; 1 enfant → 44% (forfait UNIQUE +5%)", () => {
    expect(cible("cat1", 0)).toBeCloseTo(60000 * 0.39, 2);
    expect(cible("cat1", 1)).toBeCloseTo(60000 * 0.44, 2);
  });
  it("cat2, 0 enfant → 65% ; 1 enfant → 70% (+5% PAR enfant) ; 2 enfants → 75%", () => {
    expect(cible("cat2", 0)).toBeCloseTo(60000 * 0.65, 2);
    expect(cible("cat2", 1)).toBeCloseTo(60000 * 0.70, 2);
    expect(cible("cat2", 2)).toBeCloseTo(60000 * 0.75, 2);
  });
  it("cat3 → 85% (aucune majoration)", () => {
    expect(cible("cat3", 3)).toBeCloseTo(60000 * 0.85, 2);
  });
});

// ── b/f. Dossier BTP-C (integration) : cadre batiment marie 1 enfant ──────────
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
      dateEmbauche: "2006-01-01", dateDebutActivite: "2006-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function childAge(firstName: string, age: number): PatrimonialData["childrenData"][number] {
  return {
    firstName, lastName: "TEST-CADRE", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Jean", person1LastName: "TEST-CADRE", person1BirthDate: "1981-01-01", // defunt, 45 ans
    person1JobTitle: "", person1Csp: "38", person1PcsGroupe: "3",
    person2FirstName: "Marie", person2LastName: "TEST-CADRE", person2BirthDate: "1984-01-01",
    person2JobTitle: "", person2Csp: "38", person2PcsGroupe: "4",
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

describe("RNPC — dossier BTP-C (cadre batiment IDCC 2420, marie, 1 enfant, 60 000 EUR)", () => {
  const s = computeSuccession(
    baseSuccession(),
    baseData({
      coupleStatus: "married",
      childrenData: [childAge("Lou", 10)],
      travail: travailDefunt("salarie_cadre", employeurCcn("2420", "Batiment cadres"), 60000),
    })
  );

  it("capital 174 000, aucune rente conjoint, 1 rente education 6 000", () => {
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(174000, 2);
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0); // GAP RNPC
    const re = s.capitalDecesLines.renteEducationBranche;
    expect(re).toHaveLength(1);
    expect(re[0].montantAnnuelCourant).toBeCloseTo(6000, 2);
  });

  it("IJ : cible 70% + 3,333% = 73,33% du revenu de reference (1 enfant, des le 91e jour)", () => {
    const entree: EntreePerso = {
      age: 45, ageRetraite: 64, statutPro: "salarie_cadre", caisse: "CPAM",
      idccCCN: "2420", ancienneteMois: 240, salaireBrutAnnuel: 60000,
      salaireNetMensuel: 0, nbEnfantsACharge: 1, contratsIndividuels: [], couvertureCollective: null,
    };
    const r = projeterArretMaladie(entree, "cat2", referentiels);
    const i = r.axe.findIndex((p, k) => p.phase === "am" && r.series.ijComplementaireCollective[k] > 0);
    expect(i).toBeGreaterThan(-1);
    expect(r.axe[i].jour).toBeGreaterThanOrEqual(90);
    const total = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i] + r.series.ijComplementaireCollective[i];
    expect(total).toBeCloseTo((0.70 + 0.033333) * r.revenuReferenceMensuel, 0); // cible 73,33% SB
  });
});
