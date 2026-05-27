// ─── Tests migration v140 — initialisation du champ travail ──────────────

import { describe, expect, it } from "vitest";
import type { PatrimonialData } from "../types/patrimoine";
import { migrateV140Travail } from "../lib/migrations/v140_travail";

function makeData(partial: Partial<PatrimonialData>): PatrimonialData {
  return {
    person1FirstName: "Mathieu",
    person1LastName: "Dupont",
    person1BirthDate: "1990-01-01",
    person1JobTitle: "",
    person1Csp: "",
    person1PcsGroupe: "",
    person2FirstName: "",
    person2LastName: "",
    person2BirthDate: "",
    person2JobTitle: "",
    person2Csp: "",
    person2PcsGroupe: "",
    coupleStatus: "single",
    matrimonialRegime: "",
    singleParent: false,
    person1Handicap: false,
    person2Handicap: false,
    childrenData: [],
    salary1: "0",
    salary2: "0",
    pensions: "0",
    perDeduction: "0",
    pensionDeductible: "0",
    otherDeductible: "0",
    ca1: "0",
    bicType1: "",
    microRegime1: true,
    chargesReelles1: "0",
    baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0",
    bicType2: "",
    microRegime2: true,
    chargesReelles2: "0",
    baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [],
    placements: [],
    perRentes: [],
    otherLoans: [],
    ...partial,
  };
}

describe("migrateV140Travail", () => {
  it("ajoute un travail.p1 vide à un dossier célibataire sans travail", () => {
    const data = makeData({ coupleStatus: "single" });
    const migrated = migrateV140Travail(data);
    expect(migrated.travail).toBeDefined();
    expect(migrated.travail?.p1).toBeDefined();
    expect(migrated.travail?.p1.statutPro).toBe("");
    expect(migrated.travail?.p2).toBeNull();
  });

  it("ajoute p1 + p2 pour un couple marié sans travail", () => {
    const data = makeData({ coupleStatus: "married" });
    const migrated = migrateV140Travail(data);
    expect(migrated.travail?.p1).toBeDefined();
    expect(migrated.travail?.p2).not.toBeNull();
    expect(migrated.travail?.p2?.statutPro).toBe("");
  });

  it("ajoute p1 + p2 pour un PACS sans travail", () => {
    const data = makeData({ coupleStatus: "pacs" });
    const migrated = migrateV140Travail(data);
    expect(migrated.travail?.p2).not.toBeNull();
  });

  it("ajoute p1 + p2 pour des concubins (cohab) sans travail", () => {
    const data = makeData({ coupleStatus: "cohab" });
    const migrated = migrateV140Travail(data);
    expect(migrated.travail?.p2).not.toBeNull();
  });

  it("est idempotente : ne touche pas un dossier déjà migré", () => {
    const data = makeData({ coupleStatus: "married" });
    const once = migrateV140Travail(data);
    // simulons une saisie : modifions un champ
    if (once.travail) once.travail.p1.salaireBrutAnnuel = 55000;
    const twice = migrateV140Travail(once);
    expect(twice).toBe(once); // référence inchangée
    expect(twice.travail?.p1.salaireBrutAnnuel).toBe(55000);
  });

  it("ne modifie aucun champ existant du PatrimonialData", () => {
    const data = makeData({ person1FirstName: "Léa", salary1: "28000" });
    const migrated = migrateV140Travail(data);
    expect(migrated.person1FirstName).toBe("Léa");
    expect(migrated.salary1).toBe("28000");
  });
});
