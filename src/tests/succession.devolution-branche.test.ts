// LOT DECES-A bis — Dévolution du capital décès de BRANCHE (clause type Syntec,
// art. 3.3 accord prévoyance 27/03/1997). Cascade EXCLUSIVE : conjoint, à défaut
// PACS/concubin notoire, à défaut enfants (parts égales), à défaut ascendants,
// à défaut héritiers. Surcharge manuelle prioritaire, lue au read-time.

import { describe, it, expect } from "vitest";
import {
  computeSuccession,
  devolutionCapitalDecesBranche,
  devolutionCapitalDecesBrancheCascade,
  resolveDevolutionCapitalDecesConfig,
} from "../lib/calculs/succession";
import type { CapitalDecesBrancheDevolutionContexte, DevolutionConfig } from "../lib/calculs/succession";
import { referentiels } from "../data/prevoyance";
import type { Referentiels } from "../data/prevoyance";
import type {
  EmployeurInfo,
  PatrimonialData,
  PayloadTravail,
  SuccessionData,
} from "../types/patrimoine";
import { EMPTY_CHARGES_DETAIL } from "../constants";

// ─── Couche 1 : dévolution depuis le dossier (rangs 1-2 + surcharge) ─────────

function child(firstName: string, parentLink = "common_child") {
  return { firstName, lastName: "Martin", birthDate: "2010-01-01", parentLink, custody: "full", rattached: true, handicap: false };
}

// data minimal : la fonction ne lit que coupleStatus, childrenData, les noms et
// data.prevoyance. Le défunt est person1 → le survivant (rang 1) est person2.
function data(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin",
    person2FirstName: "Marie", person2LastName: "Martin",
    coupleStatus: "married",
    childrenData: [],
    ...over,
  } as unknown as PatrimonialData;
}

describe("devolutionCapitalDecesBranche — clause type Syntec (cascade exclusive)", () => {
  it("conjoint seul (marié, sans enfant) → 100 % au conjoint survivant", () => {
    const r = devolutionCapitalDecesBranche(100000, data(), "p1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: 100000, origine: "capital_principal", source: "auto" });
    expect(r[0].beneficiaire).toContain("Marie");
  });

  it("conjoint + enfants → 100 % au conjoint (EXCLUSIF : les enfants n'ont rien)", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ childrenData: [child("Léa"), child("Tom")] as PatrimonialData["childrenData"] }), "p1");
    expect(r).toHaveLength(1);
    expect(r[0].relation).toBe("conjoint");
    expect(r[0].montant).toBe(100000);
    expect(r.some((l) => l.relation === "enfant")).toBe(false);
  });

  it("PACS → 1er rang au partenaire avec relation pacs_partner", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "pacs" }), "p1");
    expect(r).toHaveLength(1);
    expect(r[0].relation).toBe("pacs_partner");
    expect(r[0].montant).toBe(100000);
  });

  it("concubin notoire (cohab) → 1er rang admis (relation autre), 100 %", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "cohab" }), "p1");
    expect(r).toHaveLength(1);
    expect(r[0].relation).toBe("autre");
    expect(r[0].montant).toBe(100000);
    expect(r[0].beneficiaire).toContain("Marie");
  });

  it("pas de conjoint (célibataire) + 2 enfants → 50 / 50 entre les enfants", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "single", childrenData: [child("Léa"), child("Tom")] as PatrimonialData["childrenData"] }), "p1");
    expect(r).toHaveLength(2);
    expect(r.every((l) => l.relation === "enfant" && l.montant === 50000 && l.origine === "capital_principal")).toBe(true);
  });

  it("divorcé sans enfant → aucun bénéficiaire automatique (désignation requise)", () => {
    const r = devolutionCapitalDecesBranche(100000, data({ coupleStatus: "divorced" }), "p1");
    expect(r).toEqual([]);
  });

  it("surcharge persistée (read-time) → remplace la cascade, sans muter le dossier", () => {
    const d = data({
      coupleStatus: "married",
      prevoyance: {
        version: 1,
        p1: {
          contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2",
          capitalDecesBrancheSurcharge: { beneficiaires: [{ name: "Association X", relation: "autre", montant: 100000 }] },
        },
        p2: null,
      } as unknown as PatrimonialData["prevoyance"],
    });
    const snapshot = JSON.stringify(d.prevoyance);
    const r = devolutionCapitalDecesBranche(100000, d, "p1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Association X", relation: "autre", source: "manuel" });
    // Lecture read-time : le dossier n'est pas modifié par le calcul.
    expect(JSON.stringify(d.prevoyance)).toBe(snapshot);
  });
});

// ─── Couche 2 : cascade pure (rangs 3-4, non portés par le modèle de données) ─

function ctx(over: Partial<CapitalDecesBrancheDevolutionContexte> = {}): CapitalDecesBrancheDevolutionContexte {
  return { enfants: [], ...over };
}

describe("devolutionCapitalDecesBrancheCascade — rangs ascendants / héritiers", () => {
  it("ni conjoint ni enfants, ascendants présents → ascendants (parts égales)", () => {
    const r = devolutionCapitalDecesBrancheCascade(3000, ctx({ ascendants: ["Père", "Mère"] }));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ relation: "ascendant", montant: 1500 });
    expect(r[1]).toMatchObject({ relation: "ascendant", montant: 1500 });
  });

  it("rien de tout cela → héritiers selon dévolution successorale (relation autre)", () => {
    const r = devolutionCapitalDecesBrancheCascade(4000, ctx({ heritiers: ["Frère", "Sœur"] }));
    expect(r).toHaveLength(2);
    expect(r.every((l) => l.relation === "autre" && l.montant === 2000)).toBe(true);
  });

  it("EXCLUSIF : partenaire présent → ascendants/héritiers ignorés", () => {
    const r = devolutionCapitalDecesBrancheCascade(5000, ctx({
      partenaireNom: "Marie", partenaireRelation: "conjoint",
      ascendants: ["Père"], heritiers: ["Frère"],
    }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Marie", relation: "conjoint", montant: 5000 });
  });

  it("capital null → aucune ligne (rien à répartir)", () => {
    expect(devolutionCapitalDecesBrancheCascade(null, ctx({ enfants: ["A"] }))).toEqual([]);
  });

  it("aucune donnée de rang → [] (bénéficiaire à déterminer)", () => {
    expect(devolutionCapitalDecesBrancheCascade(1000, ctx())).toEqual([]);
  });
});

// ─── Couche 3 : intégration computeSuccession (wiring + non-régression) ──────

const PASS = 48060;

function employeurSyntec(idcc: string | null): EmployeurInfo {
  return {
    siret: null, siren: null, nom: "ACME", formeJuridique: null, codeNAF: null,
    idccCCN: idcc, nomCCN: "Syntec", sourceCCN: "manuel", effectif: null,
    adresseEtablissement: null, dateCreation: null,
  };
}

function travailDefunt(statut: string, employeur: EmployeurInfo | null): { p1: PayloadTravail; p2: null } {
  return {
    p1: {
      statutPro: statut, caisseAffiliation: "CPAM", employeur,
      dateEmbauche: "2000-01-01", dateDebutActivite: "2000-01-01",
      tempsTravail: { type: "plein" }, salaireBrutAnnuel: 60000,
      primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
    } as unknown as PayloadTravail,
    p2: null,
  };
}

function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Pierre", person1LastName: "Martin", person1BirthDate: "1950-01-01",
    person1JobTitle: "", person1Csp: "47", person1PcsGroupe: "5",
    person2FirstName: "Marie", person2LastName: "Martin", person2BirthDate: "1955-01-01",
    person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
    coupleStatus: "married", matrimonialRegime: "communaute_legale", singleParent: false,
    person1Handicap: false, person2Handicap: false,
    childrenData: [
      { firstName: "Léa", lastName: "Martin", birthDate: "2010-01-01", parentLink: "common_child", custody: "full", rattached: true, handicap: false },
    ],
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

describe("computeSuccession — répartition du capital de branche (Syntec)", () => {
  it("défunt cadre Syntec marié → 100 % du capital (163 404) au conjoint, exonéré, source auto", () => {
    void PASS;
    const s = computeSuccession(baseSuccession(), baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1486")) }));
    const rep = s.capitalDecesLines.branche[0].repartition;
    expect(rep).toHaveLength(1);
    expect(rep[0]).toMatchObject({ relation: "conjoint", source: "auto" });
    expect(rep[0].montant).toBeCloseTo(163404, 2);
    expect(rep[0].beneficiaire).toContain("Marie");
  });

  it("surcharge de branche persistée → prime sur la cascade (source manuel)", () => {
    const data = baseData({
      travail: travailDefunt("salarie_cadre", employeurSyntec("1486")),
      prevoyance: {
        version: 1,
        p1: {
          contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2",
          capitalDecesBrancheSurcharge: { beneficiaires: [{ name: "Fondation Y", relation: "autre", montant: 163404 }] },
        },
        p2: null,
      } as unknown as PatrimonialData["prevoyance"],
    });
    const rep = computeSuccession(baseSuccession(), data).capitalDecesLines.branche[0].repartition;
    expect(rep).toHaveLength(1);
    expect(rep[0]).toMatchObject({ beneficiaire: "Fondation Y", source: "manuel" });
  });

  it("NON-RÉGRESSION : la dévolution branche n'altère ni les masses ni la dévolution CAISSE", () => {
    const dataAvec = baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec("1486")) });
    const dataSans = baseData({ travail: travailDefunt("salarie_cadre", employeurSyntec(null)) });
    const sAvec = computeSuccession(baseSuccession(), dataAvec);
    const sSans = computeSuccession(baseSuccession(), dataSans);
    // Masses et droits strictement identiques (sortie additive, hors actif).
    expect(sAvec.activeNet).toBeCloseTo(sSans.activeNet, 2);
    expect(sAvec.totalRights).toBeCloseTo(sSans.totalRights, 2);
    expect(sAvec.totalSuccessionRights).toBeCloseTo(sSans.totalSuccessionRights, 2);
    expect(sAvec.totalAvRights).toBeCloseTo(sSans.totalAvRights, 2);
    // Dévolution CAISSE (L361-4 CSS) inchangée par la présence d'une branche.
    expect(JSON.stringify(sAvec.capitalDecesLines.caisses.map((c) => c.repartition)))
      .toBe(JSON.stringify(sSans.capitalDecesLines.caisses.map((c) => c.repartition)));
    // ... alors que la branche, elle, porte désormais une répartition non vide.
    expect(sAvec.capitalDecesLines.branche[0].repartition.length).toBeGreaterThan(0);
  });
});

// ─── LOT DEVOL-1 : dévolution data-driven (iso-comportement Syntec) ──────────

// VERROU ISO-COMPORTEMENT : la résolution via la config CCN 1486 doit produire
// EXACTEMENT la dévolution d'avant (chaîne de `if` codée en dur, v1.12.0).
describe("DEVOL-1 — Syntec (1486) via config CCN : iso-comportement", () => {
  const cap = 10000;
  it("marié → 1 ligne conjoint, 100 % du capital", () => {
    const r = devolutionCapitalDecesBranche(cap, data({ coupleStatus: "married" }), "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: cap, origine: "capital_principal", source: "auto" });
    expect(r[0].beneficiaire).toContain("Marie");
  });

  it("PACS → 1 ligne pacs_partner, 100 %", () => {
    const r = devolutionCapitalDecesBranche(cap, data({ coupleStatus: "pacs" }), "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "pacs_partner", montant: cap });
  });

  it("concubin (cohab) → 1 ligne relation autre, 100 % (concubin admis rang 1 Syntec)", () => {
    const r = devolutionCapitalDecesBranche(cap, data({ coupleStatus: "cohab" }), "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "autre", montant: cap });
  });

  it("célibataire + 2 enfants du défunt → 2 lignes à 5000 chacune", () => {
    const r = devolutionCapitalDecesBranche(
      cap,
      data({ coupleStatus: "single", childrenData: [child("Léa"), child("Tom")] as PatrimonialData["childrenData"] }),
      "p1", "1486", referentiels
    );
    expect(r).toHaveLength(2);
    expect(r.every((l) => l.relation === "enfant" && l.montant === 5000 && l.source === "auto")).toBe(true);
  });

  it("célibataire + 0 enfant → [] (à déterminer)", () => {
    const r = devolutionCapitalDecesBranche(cap, data({ coupleStatus: "single" }), "p1", "1486", referentiels);
    expect(r).toEqual([]);
  });

  it("surcharge présente → répartition = surcharge (source manuel), cascade auto ignorée", () => {
    const d = data({
      coupleStatus: "married",
      prevoyance: {
        version: 1,
        p1: {
          contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2",
          capitalDecesBrancheSurcharge: { beneficiaires: [{ name: "Association X", relation: "autre", montant: cap }] },
        },
        p2: null,
      } as unknown as PatrimonialData["prevoyance"],
    });
    const r = devolutionCapitalDecesBranche(cap, d, "p1", "1486", referentiels);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Association X", relation: "autre", source: "manuel" });
  });
});

// ORDRE HCR (étape 3) simulé par une config INLINE SANS concubin — le HCR JSON
// reste vide dans ce lot. Seul axe de variation : le 1er rang n'admet pas le
// concubin notoire.
const HCR_CONFIG: DevolutionConfig = {
  mode: "cascadeExclusive",
  rangs: [
    { qualites: ["conjoint", "pacs"] },
    { qualites: ["enfants"] },
    { qualites: ["ascendants"] },
    { qualites: ["devolutionSuccessorale"] },
  ],
};

describe("DEVOL-1 — ordre HCR (config inline sans concubin)", () => {
  const cap = 10000;
  it("marié → partenaire 100 %", () => {
    const r = devolutionCapitalDecesBrancheCascade(cap, ctx({
      partenaireNom: "Marie", partenaireRelation: "conjoint", partenaireQualite: "conjoint",
    }), HCR_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Marie", relation: "conjoint", montant: cap });
  });

  it("PACS → partenaire 100 %", () => {
    const r = devolutionCapitalDecesBrancheCascade(cap, ctx({
      partenaireNom: "Marie", partenaireRelation: "pacs_partner", partenaireQualite: "pacs",
    }), HCR_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "pacs_partner", montant: cap });
  });

  it("concubin (non admis) + 1 enfant → retombe sur l'enfant (1 ligne enfant 100 %)", () => {
    const r = devolutionCapitalDecesBrancheCascade(cap, ctx({
      partenaireNom: "Marie", partenaireRelation: "autre", partenaireQualite: "concubin",
      enfants: ["Léa"],
    }), HCR_CONFIG);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ beneficiaire: "Léa", relation: "enfant", montant: cap });
  });

  it("concubin (non admis) sans enfant → [] (à déterminer)", () => {
    const r = devolutionCapitalDecesBrancheCascade(cap, ctx({
      partenaireNom: "Marie", partenaireRelation: "autre", partenaireQualite: "concubin",
    }), HCR_CONFIG);
    expect(r).toEqual([]);
  });
});

// REPLI (filet de sécurité) : config absente OU malformée → ordre Syntec par
// défaut (les rangs codés en dur). On rejoue quelques cas du verrou.
describe("DEVOL-1 — repli sur l'ordre Syntec par défaut", () => {
  function stubRef(devolutionCapitalDeces: unknown): Referentiels {
    return { ccn: { conventions: { "0001": { nom: "Test", devolutionCapitalDeces } } } } as unknown as Referentiels;
  }

  it("idcc sans clé devolutionCapitalDeces (témoin 9999) → comportement = ordre Syntec", () => {
    // Témoin de test 9999 (branche sans clé devolutionCapitalDeces) pour tester le
    // VRAI repli sur l'ordre défaut (1996 Pharmacie porte désormais sa propre cascade).
    const marie = devolutionCapitalDecesBranche(10000, data({ coupleStatus: "married" }), "p1", "9999", referentiels);
    expect(marie).toHaveLength(1);
    expect(marie[0]).toMatchObject({ relation: "conjoint", montant: 10000 });
    const enfants = devolutionCapitalDecesBranche(
      10000,
      data({ coupleStatus: "single", childrenData: [child("Léa"), child("Tom")] as PatrimonialData["childrenData"] }),
      "p1", "9999", referentiels
    );
    expect(enfants).toHaveLength(2);
    expect(enfants.every((l) => l.relation === "enfant" && l.montant === 5000)).toBe(true);
  });

  it("config malformée (mode inconnu) → repli Syntec (concubin admis rang 1)", () => {
    const ref = stubRef({ mode: "autreChose", rangs: [{ qualites: ["conjoint"] }] });
    const r = devolutionCapitalDecesBranche(10000, data({ coupleStatus: "cohab" }), "p1", "0001", ref);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "autre", montant: 10000 });
  });

  it("config malformée (rangs non tableau) → repli Syntec", () => {
    const ref = stubRef({ mode: "cascadeExclusive", rangs: "TO_FILL" });
    const r = devolutionCapitalDecesBranche(10000, data({ coupleStatus: "married" }), "p1", "0001", ref);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ relation: "conjoint", montant: 10000 });
  });
});

// Lecteur défensif : la résolution de la config CCN, isolée.
describe("DEVOL-1 — resolveDevolutionCapitalDecesConfig (lecteur défensif)", () => {
  it("1486 → config cascadeExclusive à 4 rangs, rang 1 admet le concubin", () => {
    const cfg = resolveDevolutionCapitalDecesConfig("1486", referentiels);
    expect(cfg).not.toBeNull();
    expect(cfg?.mode).toBe("cascadeExclusive");
    expect(cfg?.rangs).toHaveLength(4);
    expect(cfg?.rangs[0].qualites).toEqual(["conjoint", "pacs", "concubin"]);
    expect(cfg?.rangs[1].qualites).toEqual(["enfants"]);
    expect(cfg?.rangs[1].representation).toBe(true);
  });

  it("idcc null / inconnu / sans clé → null (déclenche le repli)", () => {
    expect(resolveDevolutionCapitalDecesConfig(null, referentiels)).toBeNull();
    // 9999 = témoin de test : existe mais SANS clé devolutionCapitalDeces → null (repli
    // par défaut). 1996 Pharmacie, jadis l'exemple « sans clé », porte désormais sa cascade.
    expect(resolveDevolutionCapitalDecesConfig("9999", referentiels)).toBeNull();
  });

  it("qualités inconnues filtrées ; rang conservé (vide) sera sauté à l'exécution", () => {
    const ref = {
      ccn: { conventions: { "0001": { nom: "Test", devolutionCapitalDeces: {
        mode: "cascadeExclusive",
        rangs: [{ qualites: ["conjoint", "extraterrestre"] }, { qualites: ["enfants"] }],
      } } } },
    } as unknown as Referentiels;
    const cfg = resolveDevolutionCapitalDecesConfig("0001", ref);
    expect(cfg?.rangs[0].qualites).toEqual(["conjoint"]);
    expect(cfg?.rangs[1].qualites).toEqual(["enfants"]);
  });
});
