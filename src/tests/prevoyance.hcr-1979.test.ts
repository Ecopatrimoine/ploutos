// ─── LOT HCR-3.3a — Données prévoyance HCR (IDCC 1979) ──────────────────────
//
// Garanties HCR (art. 18 accord prévoyance 02/11/2004) : capital décès 150 % du
// salaire de référence (plafonné à 1 PASS), rente éducation 12 % (<8 ans) / 18 %
// (8-26 ans), IJ 70 % (base T1_seul, franchise 90 j, plafond 1005 j), invalidité
// cat1 45 % / cat2-3 70 %, IDENTIQUES cadres et non-cadres. Dévolution : conjoint
// OU PACS au rang 1 (PAS de concubin, contrairement à Syntec). PASS 2026 = 48 060.
// Pur DATA : ce lot ne touche aucun .ts moteur, il valide les formes posées.

import { describe, it, expect } from "vitest";
import {
  resolveCapitalDecesBranche,
  resolveRenteEducationBranche,
  resolveRenteConjointSubstitutiveBranche,
} from "../lib/prevoyance/capitaux-deces-branche";
import { resolveCouvertureBranche } from "../lib/prevoyance/couverture-branche";
import { computeSuccession, devolutionCapitalDecesBranche } from "../lib/calculs/succession";
import { getMaintienParams } from "../lib/prevoyance/projection";
import { referentiels } from "../data/prevoyance";
import type { EmployeurInfo, PatrimonialData, PayloadTravail, SuccessionData } from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

const PASS = 48060;

// data minimal pour la dévolution (lit coupleStatus, childrenData, noms, prevoyance).
function child(firstName: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate: "2014-01-01", parentLink, custody: "full", rattached: true, handicap: false };
}
function data(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin",
    person2FirstName: "Marie", person2LastName: "Martin",
    coupleStatus: "married",
    childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

describe("HCR (1979) — capital décès (plafond 1 PASS, 150 % salaire réf.)", () => {
  it("non-cadre, brut 30 000 (< 1 PASS) → 1,50 × 30 000 = 45 000", () => {
    const r = resolveCapitalDecesBranche("1979", "nonCadres", 30000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(45000, 2);
  });

  it("cadre, brut 60 000 (> 1 PASS) → salaireRef plafonné 48 060 → 1,50 × 48 060 = 72 090", () => {
    const r = resolveCapitalDecesBranche("1979", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.capital).toBeCloseTo(1.5 * 1 * PASS, 2); // 72 090 (prouve plafond 1 PASS HCR)
  });

  it("cadre ET non-cadre → MÊME capital à brut égal (garanties identiques)", () => {
    const cadre = resolveCapitalDecesBranche("1979", "cadres", 30000, PASS, referentiels);
    const nonCadre = resolveCapitalDecesBranche("1979", "nonCadres", 30000, PASS, referentiels);
    expect(cadre.capital).toBeCloseTo(45000, 2);
    expect(nonCadre.capital).toBeCloseTo(45000, 2);
    expect(cadre.capital).toBe(nonCadre.capital);
  });
});

describe("HCR (1979) — dévolution (conjoint/PACS rang 1, PAS de concubin)", () => {
  it("marié, capital 45 000 → 1 ligne conjoint 45 000", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "married" }), "p1", "1979", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: 45000, source: "auto" });
  });

  it("PACS → 1 ligne pacs_partner 45 000", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "pacs" }), "p1", "1979", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "pacs_partner", montant: 45000 });
  });

  it("concubin (cohab) + 1 enfant → 1 ligne ENFANT 45 000 (concubin NON admis rang 1)", () => {
    const r = devolutionCapitalDecesBranche(
      45000,
      data({ coupleStatus: "cohab", childrenData: [child("Léa")] as PatrimonialData["childrenData"] }),
      "p1", "1979", referentiels
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "enfant", montant: 45000 });
    expect(r[0].beneficiaire).toContain("Léa");
  });

  it("concubin (cohab) + 0 enfant → [] (à déterminer)", () => {
    const r = devolutionCapitalDecesBranche(45000, data({ coupleStatus: "cohab" }), "p1", "1979", referentiels);
    expect(r).toEqual([]);
  });
});

describe("HCR (1979) — rente éducation (12 % < 8 ans, 18 % de 8 à 26 ans)", () => {
  it("enfant 5 ans → 0,12 × 30 000 = 3 600 /an", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 5, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuelCourant).toBeCloseTo(3600, 2);
  });

  it("enfant 12 ans → 0,18 × 30 000 = 5 400 /an", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 12, referentiels);
    expect(r.montantAnnuelCourant).toBeCloseTo(5400, 2);
  });

  it("enfant 26 ans → 0 (hors borne, plus à charge)", () => {
    const r = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 26, referentiels);
    expect(r.montantAnnuelCourant).toBe(0);
  });

  it("source = nom de CCN dynamique (LOT LABEL-CCN) : 1979 → HCR, 1486 → Syntec", () => {
    const hcr = resolveRenteEducationBranche("1979", "nonCadres", 30000, PASS, 5, referentiels);
    expect(hcr.source).toContain("Hôtels");
    expect(hcr.source).not.toContain("Syntec");
    const syntec = resolveRenteEducationBranche("1486", "cadres", 60000, PASS, 10, referentiels);
    expect(syntec.source).toContain("Syntec");
  });
});

describe("HCR (1979) — IJ / invalidité (resolveCouvertureBranche)", () => {
  it("IJ : 70 %, franchise 90, plafond 1005, base T1_seul", () => {
    const r = resolveCouvertureBranche("1979", "cadres", referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.ij).toEqual({ pctSalaire: 0.70, franchise: 90, plafondJours: 1005, baseCalcul: "T1_seul" });
  });

  it("invalidité : cat1 45 %, cat2/cat3 70 %", () => {
    const r = resolveCouvertureBranche("1979", "cadres", referentiels);
    expect(r.invalidite).toEqual({
      cat1: { pctSalaire: 0.45 }, cat2: { pctSalaire: 0.70 }, cat3: { pctSalaire: 0.70 },
    });
  });

  it("non-cadre identique au cadre (garanties non différenciées)", () => {
    const cadre = resolveCouvertureBranche("1979", "cadres", referentiels);
    const nonCadre = resolveCouvertureBranche("1979", "nonCadres", referentiels);
    expect(nonCadre.ij).toEqual(cadre.ij);
    expect(nonCadre.invalidite).toEqual(cadre.invalidite);
  });
});

describe("HCR (1979) — NON-RÉGRESSION : Syntec (1486) inchangé", () => {
  it("capital Syntec cadre 60 000 → 144 180 (plancher 3,00 PASS, plafond 8 PASS)", () => {
    const r = resolveCapitalDecesBranche("1486", "cadres", 60000, PASS, referentiels);
    expect(r.capital).toBeCloseTo(144180, 2);
  });

  it("dévolution Syntec concubin (cohab) → relation autre 100 % (concubin admis rang 1)", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "cohab" }), "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "autre", montant: 100000 });
  });
});

// ─── LOT HCR-3.4 — maintien employeur HCR = plancher légal (Option A) ────────
//
// HCR (1979) ne documente pas de maintien conventionnel plus favorable
// (maintienEmployeur.cadres = nonCadres = null, cf. note JSON). getMaintienParams
// retombe donc sur le maintien LÉGAL de mensualisation, appliqué génériquement
// par le moteur. Aucune touche moteur dans ce lot : on VERROUILLE la résolution.

describe("HCR (1979) — maintien employeur = plancher légal (Option A)", () => {
  it("non-cadre → retombe sur le légal (source legal, carence 7, table légale)", () => {
    const p = getMaintienParams("1979", referentiels, "nonCadres");
    expect(p.source).toBe("legal");
    expect(p.carenceJours).toBe(7);
    // 1er palier légal : ancienneté 12 mois, segments 30 j à 90 % puis 30 j à 66,67 %.
    const palier12 = p.paliers.find((x) => x.ancienneteMois === 12);
    expect(palier12).toBeDefined();
    expect(palier12!.segments[0]).toEqual({ jours: 30, pct: 90 });
    expect(palier12!.segments[1].jours).toBe(30);
    expect(palier12!.segments[1].pct).toBeCloseTo(66.6667, 3);
  });

  it("cadre → retombe aussi sur le légal", () => {
    const p = getMaintienParams("1979", referentiels, "cadres");
    expect(p.source).toBe("legal");
    expect(p.carenceJours).toBe(7);
  });

  it("NON-RÉGRESSION Syntec (1486) non-cadre → source ccn, carence 0 (inchangé)", () => {
    const p = getMaintienParams("1486", referentiels, "nonCadres");
    expect(p.source).toBe("ccn");
    expect(p.carenceJours).toBe(0);
  });
});

// VERROU TAUX PAR JOUR. `tauxMaintienJour` n'est PAS exporté (fonction moteur
// privée, projection.ts:363-372) et ce lot interdit toute touche moteur : on
// reproduit donc À L'IDENTIQUE sa logique dans ce helper local, ALIMENTÉ par les
// params LÉGAUX RÉELS résolus par getMaintienParams("1979") — aucune valeur en
// dur. Verrou de la courbe HCR (palier 12 mois : carence 7, 90 % puis 66,67 %).
function tauxJour(
  params: ReturnType<typeof getMaintienParams>,
  ancienneteMois: number,
  t: number
): number {
  const palier = params.paliers
    .filter((p) => ancienneteMois >= p.ancienneteMois)
    .sort((a, b) => b.ancienneteMois - a.ancienneteMois)[0] ?? null;
  if (!palier || t < params.carenceJours) return 0;
  let debut = 0;
  const tEff = t - params.carenceJours;
  for (const seg of palier.segments) {
    if (tEff < debut + seg.jours) return seg.pct / 100;
    debut += seg.jours;
  }
  return 0;
}

describe("HCR (1979) — taux de maintien par jour (palier 12 mois, fenêtre 30/30)", () => {
  const params = getMaintienParams("1979", referentiels, "nonCadres");
  const ANC = 12; // 1 an d'ancienneté → palier légal 30 j / 30 j

  it("jour 3 (< carence 7) → 0", () => {
    expect(tauxJour(params, ANC, 3)).toBe(0);
  });
  it("jour 10 (fenêtre 90 %) → 0,90", () => {
    expect(tauxJour(params, ANC, 10)).toBeCloseTo(0.90, 4);
  });
  it("jour 40 (fenêtre 66,67 %) → ~0,6667", () => {
    expect(tauxJour(params, ANC, 40)).toBeCloseTo(0.6667, 3);
  });
  it("jour 70 (au-delà de 7 + 30 + 30 = 67) → 0 (fin du maintien légal faible ancienneté)", () => {
    expect(tauxJour(params, ANC, 70)).toBe(0);
  });
});

// GARDE TNS (documentée, non testable en isolation sans toucher le moteur) :
// computeMaintienEmployeur (projection.ts:407 `if (!isSalarie) return 0;`) et
// marchesMaintienEffectif (projection.ts:335 `if (!isSalarie) return []`) annulent
// tout maintien pour un statut TNS. Ces fonctions ne sont pas exportées ; les
// tests d'isolement nécessiteraient un export moteur, hors périmètre de ce lot.

// ─── LOT HCR-3.5 — rente conjoint substitutive de branche (art 18.2.4bis) ────

describe("HCR (1979) — rente conjoint substitutive (résolveur)", () => {
  it("non-cadre brut 30 000 → 0,05 × 30 000 = 1 500 ; durée 5 ans ; bénéf [conjoint,pacs,concubin]", () => {
    const r = resolveRenteConjointSubstitutiveBranche("1979", "nonCadres", 30000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(false);
    expect(r.montantAnnuel).toBeCloseTo(1500, 2);
    expect(r.dureeMaxAnnees).toBe(5);
    expect(r.beneficiairesQualites).toEqual(["conjoint", "pacs", "concubin"]);
  });

  it("cadre brut 60 000 (> 1 PASS) → 0,05 × 48 060 = 2 403 (plafond 1 PASS mord)", () => {
    const r = resolveRenteConjointSubstitutiveBranche("1979", "cadres", 60000, PASS, referentiels);
    expect(r.montantAnnuel).toBeCloseTo(0.05 * PASS, 2); // 2 403
  });

  it("Syntec (1486) renteConjoint null → non prévu (donneeIndisponible, montant null)", () => {
    const r = resolveRenteConjointSubstitutiveBranche("1486", "cadres", 60000, PASS, referentiels);
    expect(r.donneeIndisponible).toBe(true);
    expect(r.montantAnnuel).toBeNull();
  });
});

// Builders computeSuccession (calqués sur succession.devolution-branche.test.ts).
function employeurCcn(idcc: string | null, nom: string): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "TEST", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: nom, sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  } as unknown as EmployeurInfo;
}
function travailDefunt(statut: string, employeur: EmployeurInfo | null, brut: number): { p1: PayloadTravail; p2: null } {
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
  // birthDate calé au 1er janvier pour donner `age` ans révolus en 2026.
  return {
    firstName, lastName: "Martin", birthDate: `${2026 - age}-01-01`,
    parentLink: "common_child", custody: "full", rattached: true, handicap: false,
  } as unknown as PatrimonialData["childrenData"][number];
}
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1980-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1982-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
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
const HCR = () => employeurCcn("1979", "HCR");

describe("HCR (1979) — rente conjoint substitutive (computeSuccession, conditions)", () => {
  it("marié, 0 enfant, brut 30 000 → 1 ligne 1 500/an au conjoint (5 ans) ; 0 rente éducation", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "married", travail: travailDefunt("salarie_non_cadre", HCR(), 30000) }));
    const rc = s.capitalDecesLines.renteConjointBranche;
    expect(rc).toHaveLength(1);
    expect(rc[0].montantAnnuel).toBeCloseTo(1500, 2);
    expect(rc[0].dureeMaxAnnees).toBe(5);
    expect(rc[0].beneficiaireNom).toContain("Marie");
    expect(s.capitalDecesLines.renteEducationBranche).toHaveLength(0);
  });

  it("concubin (cohab), 0 enfant → 1 ligne au CONCUBIN (concubin ADMIS pour la substitutive)", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "cohab", travail: travailDefunt("salarie_non_cadre", HCR(), 30000) }));
    const rc = s.capitalDecesLines.renteConjointBranche;
    expect(rc).toHaveLength(1);
    expect(rc[0].montantAnnuel).toBeCloseTo(1500, 2);
    expect(rc[0].beneficiaireNom).toContain("Marie");
  });

  it("marié, 1 enfant 10 ans (ouvre droit) → AUCUNE rente conjoint substitutive ; rente éducation présente", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "married", childrenData: [childAge("Lea", 10)], travail: travailDefunt("salarie_non_cadre", HCR(), 30000) }));
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
    expect(s.capitalDecesLines.renteEducationBranche.length).toBeGreaterThan(0);
  });

  it("marié, 1 enfant 30 ans (≥ 26, n'ouvre pas droit) → rente conjoint substitutive PRÉSENTE", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "married", childrenData: [childAge("Max", 30)], travail: travailDefunt("salarie_non_cadre", HCR(), 30000) }));
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(1);
  });

  it("célibataire, 0 enfant → aucune rente conjoint substitutive (pas de bénéficiaire)", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "single", travail: travailDefunt("salarie_non_cadre", HCR(), 30000) }));
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
  });

  it("NON-RÉGRESSION Syntec (1486) → aucune rente conjoint substitutive", () => {
    const s = computeSuccession(baseSuccession(), baseData({ coupleStatus: "married", travail: travailDefunt("salarie_cadre", employeurCcn("1486", "Syntec"), 60000) }));
    expect(s.capitalDecesLines.renteConjointBranche).toHaveLength(0);
  });
});
