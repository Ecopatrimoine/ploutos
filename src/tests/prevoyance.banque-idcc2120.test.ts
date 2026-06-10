// ─── MICRO-LOT CCN Banque (IDCC 2120) — entree DOCUMENTAIRE ───────────────────
//
// CCN du 10/01/2000 (AFB) : aucun regime de prevoyance assure de branche. Entree
// posee pour DOCUMENTER l'absence (les garanties relevent des accords d'entreprise)
// et ne PAS la confondre avec un TO_FILL. Aucune garantie servie, cadre comme
// non-cadre (pas de collegeImpose, les deux colleges sont null).

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { categorieBranche } from "../lib/prevoyance/categorie-branche";
import { projeterArretMaladie, getMaintienParams } from "../lib/prevoyance/projection";
import { computeSuccession } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { EntreePerso } from "../lib/prevoyance/types";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

describe("CCN Banque (IDCC 2120) — entree documentaire, aucune garantie de branche", () => {
  it("entree presente, sans collegeImpose, les deux colleges null", () => {
    const conv = (referentiels.ccn as any).conventions["2120"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("Banque");
    expect(conv.collegeImpose).toBeUndefined();
    expect(conv.prevoyanceCadres).toBeNull();
    expect(conv.prevoyanceNonCadres).toBeNull();
  });

  it("aucune garantie servie — cadre COMME non-cadre", () => {
    for (const statut of ["salarie_cadre", "salarie_non_cadre"] as const) {
      const cat = categorieBranche("2120", statut, referentiels); // routage statutPro normal
      // Capital deces : indisponible (bloc null).
      expect(resolveCapitalDecesBranche("2120", cat, 50000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).donneeIndisponible).toBe(true);
      // IJ + invalidite : indisponibles.
      expect(resolveCouvertureBranche("2120", cat, referentiels).donneeIndisponible).toBe(true);
      // Rentes : indisponibles.
      expect(resolveRenteConjointSubstitutiveBranche("2120", cat, 50000, PASS, referentiels).donneeIndisponible).toBe(true);
      expect(resolveRenteEducationBranche("2120", cat, 50000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
    }
  });
});

// ─── Maintien conventionnel plancher art. 54 (LOT 2120-MAINTIEN) ──────────────
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
      dateEmbauche: "2024-01-01", dateDebutActivite: "2024-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: brut,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Sofia", person1LastName: "TEST-BANQ", person1BirthDate: "1991-01-01", // 35 ans
    person1JobTitle: "", person1Csp: "37", person1PcsGroupe: "3",
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
// Charge de clientele, IDCC 2120, 40 000 EUR, anciennete 24 mois (plancher palier 1).
function entreeBanque(statut: EntreePerso["statutPro"]): EntreePerso {
  return {
    age: 35, ageRetraite: 64, statutPro: statut, caisse: "CPAM",
    idccCCN: "2120", ancienneteMois: 24, salaireBrutAnnuel: 40000,
    salaireNetMensuel: 0, contratsIndividuels: [], couvertureCollective: null,
  };
}

describe("CCN Banque (IDCC 2120) — maintien conventionnel plancher (art. 54, BANQ-A)", () => {
  it("non-cadre 40 000 : 100% (M1-2), 50% (M3-4, > IJSS), puis IJSS seules", () => {
    const r = projeterArretMaladie(entreeBanque("salarie_non_cadre"), "cat2", referentiels);
    const ref = r.revenuReferenceMensuel;
    let v100 = false, v50 = false, vSeul = false;
    for (let i = 0; i < r.axe.length; i++) {
      if (r.axe[i].phase !== "am") continue;
      const j = r.axe[i].jour;
      const total = r.series.maintienEmployeur[i] + r.series.ijObligatoire[i];
      if (j >= 8 && j <= 55) {
        expect(total).toBeCloseTo(ref, 0); // 100% du net de reference
        v100 = true;
      } else if (j >= 65 && j <= 115) {
        expect(total).toBeCloseTo(0.5 * ref, 0); // 50% (CCN domine, legal termine)
        expect(r.series.maintienEmployeur[i]).toBeGreaterThan(0); // complement employeur actif
        v50 = true;
      } else if (j >= 125 && j <= 900) {
        expect(r.series.maintienEmployeur[i]).toBe(0); // plus de maintien -> IJSS seules
        vSeul = true;
      }
    }
    expect(v100 && v50 && vSeul).toBe(true);
  });

  it("cadre : meme maintien plancher (art. 54 couvre tous les salaries)", () => {
    const r = projeterArretMaladie(entreeBanque("salarie_cadre"), "cat2", referentiels);
    const ref = r.revenuReferenceMensuel;
    // Segment 1 (100%) : maintien employeur actif, total porte au net plein.
    const i = r.axe.findIndex((p, k) => p.phase === "am" && p.jour >= 8 && p.jour <= 55 && r.series.maintienEmployeur[k] > 0);
    expect(i).toBeGreaterThan(-1);
    expect(r.series.maintienEmployeur[i] + r.series.ijObligatoire[i]).toBeCloseTo(ref, 0);
  });

  it("succession (celibataire) : maintien pose mais TOUJOURS aucun capital ni rente de branche", () => {
    const s = computeSuccession(
      baseSuccession(),
      baseData({ coupleStatus: "single", travail: travailDefunt("salarie_non_cadre", employeurCcn("2120", "Banque (AFB)"), 40000) })
    );
    expect(s.capitalDecesBrancheExonere).toBe(0);
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(0);
  });
});

// ─── MICRO-LOT CCN Industries chimiques (IDCC 44, CCNIC) ──────────────────────
// Miroir structurel de l'entree Banque 2120 : aucun regime de prevoyance assure
// de branche (accord de methode du 24/04/2018 jamais concretise), maintien
// employeur PLANCHER etendu (cadres 4+4 mois, ouvriers/collaborateurs 2+2 mois,
// carence 0). Pure donnee, zero modification moteur.

describe("CCN Industries chimiques (IDCC 44) — entree documentaire, aucune garantie de branche", () => {
  it("entree presente, nom correct, sans collegeImpose, les deux colleges null", () => {
    const conv = (referentiels.ccn as any).conventions["44"];
    expect(conv).toBeDefined();
    expect(conv.nom).toContain("Industries chimiques");
    expect(conv.collegeImpose).toBeUndefined();
    expect(conv.prevoyanceCadres).toBeNull();
    expect(conv.prevoyanceNonCadres).toBeNull();
  });

  it("aucune garantie assuree de branche — cadre COMME non-cadre", () => {
    for (const statut of ["salarie_cadre", "salarie_non_cadre"] as const) {
      const cat = categorieBranche("44", statut, referentiels);
      // Capital deces : indisponible (bloc prevoyance null).
      expect(resolveCapitalDecesBranche("44", cat, 50000, PASS, referentiels, { conjointPresent: true, nbEnfantsACharge: 2 }).donneeIndisponible).toBe(true);
      // IJ + invalidite : indisponibles -> AUCUNE injection dans la projection.
      expect(resolveCouvertureBranche("44", cat, referentiels).donneeIndisponible).toBe(true);
      // Rentes : indisponibles.
      expect(resolveRenteConjointSubstitutiveBranche("44", cat, 50000, PASS, referentiels).donneeIndisponible).toBe(true);
      expect(resolveRenteEducationBranche("44", cat, 50000, PASS, 10, referentiels).donneeIndisponible).toBe(true);
    }
  });
});

describe("CCN Industries chimiques (IDCC 44) — maintien employeur plancher etendu", () => {
  it("cadre : carence 0, a 12 mois 120 j a 100% puis 120 j a 50% (pct ENTIERS)", () => {
    const m = getMaintienParams("44", referentiels, "cadres");
    expect(m.source).toBe("ccn");
    expect(m.carenceJours).toBe(0);
    const palier = m.paliers.find((p) => p.ancienneteMois === 12);
    expect(palier).toBeDefined();
    expect(palier!.segments).toEqual([
      { jours: 120, pct: 100 },
      { jours: 120, pct: 50 },
    ]);
    // pct lu comme POURCENTAGE ENTIER (jamais une fraction 1 / 0,5).
    expect(palier!.segments[0].pct).toBe(100);
    expect(Number.isInteger(palier!.segments[0].pct)).toBe(true);
  });

  it("non-cadre : carence 0, a 12 mois 60 j a 100% puis 60 j a 50%", () => {
    const m = getMaintienParams("44", referentiels, "nonCadres");
    expect(m.source).toBe("ccn");
    expect(m.carenceJours).toBe(0);
    const palier = m.paliers.find((p) => p.ancienneteMois === 12);
    expect(palier).toBeDefined();
    expect(palier!.segments).toEqual([
      { jours: 60, pct: 100 },
      { jours: 60, pct: 50 },
    ]);
    expect(palier!.segments[0].pct).toBe(100);
  });
});
