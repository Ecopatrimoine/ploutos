// ─── LOT DONNEES RNPE — ETAM du BTP (IDCC 2609 / 2614) ────────────────────────
//
// 2609 (Batiment ETAM) et 2614 (Travaux publics ETAM) partagent LE MEME regime
// national (RNPE) : blocs identiques dupliques (decision Q6) + garde-fou d'egalite.
// PASS 2026 = 48 060. Capital situationFamiliale a UNITES DIFFERENTES par situation
// (1er usage reel : sansConjoint en euros, avecConjoint en pourcentage).

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeRenteInvalCollective, projeterArretMaladie } from "../lib/prevoyance/projection";
import { computeSuccession } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { CouvertureCollective, EntreePerso } from "../lib/prevoyance/types";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

// ── a. Coherence Q6 : egalite profonde des blocs des 2 IDCC ───────────────────
describe("RNPE — coherence Q6 (2609 / 2614 identiques)", () => {
  const ccn = referentiels.ccn as any;
  const c2609 = ccn.conventions["2609"];
  const c2614 = ccn.conventions["2614"];

  it("blocs prevoyance / devolution / maintien / college / plafond IDENTIQUES", () => {
    expect(c2614.prevoyanceNonCadres).toEqual(c2609.prevoyanceNonCadres);
    expect(c2614.devolutionCapitalDeces).toEqual(c2609.devolutionCapitalDeces);
    expect(c2614.maintienEmployeur).toEqual(c2609.maintienEmployeur);
    expect(c2614.plafondSalaireRefPass).toBe(c2609.plafondSalaireRefPass);
    for (const c of [c2609, c2614]) {
      expect(c.collegeImpose).toBe("nonCadres");
      expect(c.prevoyanceCadres).toBeNull();
      expect(c.plafondSalaireRefPass).toBe(3);
    }
  });

  it("metadonnees distinctes (2614 = Travaux publics)", () => {
    expect(c2609.nom).not.toBe(c2614.nom);
    expect(c2614.nom).toContain("Travaux publics");
  });
});

// ── b. Capital DC : blocs a unites differentes (euros vs pourcentage) ─────────
describe("RNPE — capital deces situationFamiliale (unites mixtes)", () => {
  it("celibataire 0 enfant → bloc euros = 6 000 EUR (independant du salaire)", () => {
    const r = resolveCapitalDecesBranche("2609", "nonCadres", 32000, PASS, referentiels, {});
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(6000, 2);
  });

  it("celibataire 2 enfants → 6 000 + 2 x (100% x 32 000) = 70 000 EUR", () => {
    const r = resolveCapitalDecesBranche("2609", "nonCadres", 32000, PASS, referentiels, { nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(70000, 2);
  });

  it("marie 2 enfants → 200% x 32 000 + 2 x (50% x 32 000) = 96 000 EUR", () => {
    const r = resolveCapitalDecesBranche("2609", "nonCadres", 32000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 });
    expect(r.capital).toBeCloseTo(96000, 2);
  });

  it("concubin (conjointInclutConcubin) → bloc avecConjoint = 200% x 32 000 = 64 000 EUR", () => {
    const r = resolveCapitalDecesBranche("2609", "nonCadres", 32000, PASS, referentiels, { concubinPresent: true });
    expect(r.capital).toBeCloseTo(64000, 2);
  });
});

// ── c. Rente education : PLANCHER minimumPass (assert cle du LOT 1bis) ─────────
describe("RNPE — rente education (plancher 12% PASS actif)", () => {
  it("1 enfant, salaire 32 000 → 15% x 32 000 = 4 800 < plancher 12% PASS = 5 767,20 → 5 767,20", () => {
    const r = resolveRenteEducationBranche("2609", "nonCadres", 32000, PASS, 10, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuelCourant).toBeCloseTo(0.12 * PASS, 2); // 5 767,20 (plancher mord)
  });

  it("salaire eleve 60 000 → 15% x salaireRef > plancher → taux applique", () => {
    // salaireRef plafonne a 3 PASS (144 180) ; 60 000 < 144 180 → 0,15 x 60 000 = 9 000 > 5 767,20.
    const r = resolveRenteEducationBranche("2609", "nonCadres", 60000, PASS, 10, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(0.15 * 60000, 2); // 9 000 (plancher inerte)
  });
});

// ── d. Invalidite : mode cible + forfait (3bis) + par enfant (3) ──────────────
describe("RNPE — invalidite cible (forfait cat1, par enfant cat2)", () => {
  const branche = resolveCouvertureBranche("2609", "nonCadres", referentiels);
  const cov: CouvertureCollective = { invalidite: branche.invalidite };
  // pension 0 → renteInvalCollective = cible = assiette x pct (mode cible, base revenuRef).
  const cible = (cat: "cat1" | "cat2" | "cat3", nbEnf: number) =>
    computeRenteInvalCollective(cov, cat, 32000, 0, 32000, nbEnf);

  it("cat1, 0 enfant → cible 40% (forfait NON declenche)", () => {
    expect(cible("cat1", 0)).toBeCloseTo(32000 * 0.40, 2);
  });
  it("cat1, 2 enfants → cible 45% (forfait UNIQUE +5%, pas +10%)", () => {
    expect(cible("cat1", 2)).toBeCloseTo(32000 * 0.45, 2);
  });
  it("cat2, 0 enfant → cible 75%", () => {
    expect(cible("cat2", 0)).toBeCloseTo(32000 * 0.75, 2);
  });
  it("cat2, 2 enfants → cible 87% (75% + 2x6%)", () => {
    expect(cible("cat2", 2)).toBeCloseTo(32000 * 0.87, 2);
  });
  it("cat3 → cible 85% (aucune majoration)", () => {
    expect(cible("cat3", 0)).toBeCloseTo(32000 * 0.85, 2);
    expect(cible("cat3", 3)).toBeCloseTo(32000 * 0.85, 2);
  });
});

// ── b/e. Dossier BTP-B (integration) : ETAM batiment celibataire 0 enfant ─────
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
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Karim", person1LastName: "TEST-ETAM", person1BirthDate: "1996-01-01", // defunt, 30 ans
    person1JobTitle: "", person1Csp: "46", person1PcsGroupe: "5",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
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
    heirs: [], testamentHeirs: [], legsPrecisItems: [], spousePresent: false,
    useTestament: false, legsMode: "global",
  } as unknown as SuccessionData;
}

describe("RNPE — dossier BTP-B (ETAM batiment IDCC 2609, celibataire, 0 enfant, 32 000 EUR)", () => {
  const s = computeSuccession(
    baseSuccession(),
    baseData({ coupleStatus: "single", travail: travailDefunt("salarie_non_cadre", employeurCcn("2609", "Batiment ETAM"), 32000) })
  );

  it("capital deces = 6 000 EUR (bloc euros), aucune rente conjoint, aucune rente education", () => {
    expect(s.capitalDecesLines.branche[0].capital).toBeCloseTo(6000, 2);
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0); // GAP RNPE
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(0); // 0 enfant
  });

  it("IJ : complement de branche porte le total a 84% du revenu de reference (des le 91e jour)", () => {
    const entree: EntreePerso = {
      age: 30, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
      idccCCN: "2609", ancienneteMois: 240, salaireBrutAnnuel: 32000,
      salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
    };
    const r = projeterArretMaladie(entree, "cat2", referentiels);
    const i = r.axe.findIndex((p, k) => p.phase === "am" && r.series.ijComplementaireCollective[k] > 0);
    expect(i).toBeGreaterThan(-1);
    expect(r.axe[i].jour).toBeGreaterThanOrEqual(90); // franchise 90
    const total = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i] + r.series.ijComplementaireCollective[i];
    expect(total).toBeCloseTo(0.84 * r.revenuReferenceMensuel, 0); // cible 84% SB (assiette revenu de ref)
  });
});
