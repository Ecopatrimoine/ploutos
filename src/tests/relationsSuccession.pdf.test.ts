// LOT 11 G5-D — un SEUL mapping partagé des liens de parenté succession/AV (écran + PDF).
// Avant : chaque adaptateur PDF avait sa copie locale `relationLabel`, l'une oubliant
// `enfant_conjoint` (clé brute « enfant_conjoint » imprimée page 12). Ici : source unique
// `labelRelationSuccession`, clés alignées sur le vocabulaire du select écran.
import { describe, it, expect } from "vitest";
import { labelRelationSuccession, RELATIONS_ECRAN } from "../lib/presentation/relationsSuccession";
import { buildSuccessionAData } from "../lib/pdf/v2/adapters/buildSuccessionAData";
import { buildSuccessionBData } from "../lib/pdf/v2/adapters/buildSuccessionBData";

describe("Relations succession — libellé partagé (plus de clé brute)", () => {
  it("enfant_conjoint → « Enfant du conjoint » (plus jamais la clé brute)", () => {
    expect(labelRelationSuccession("enfant_conjoint")).toBe("Enfant du conjoint");
    expect(labelRelationSuccession("enfant_conjoint")).not.toContain("_");
  });

  it("couvre TOUT le vocabulaire du select écran (aucune valeur ne retombe sur la clé brute)", () => {
    for (const v of RELATIONS_ECRAN) {
      const lib = labelRelationSuccession(v);
      expect(lib, `relation « ${v} » sans libellé humain`).not.toBe(v);
      expect(lib).not.toMatch(/[_]/);
    }
  });

  it("relations moteur hors select (pacs_partner, ascendant) ont un libellé", () => {
    expect(labelRelationSuccession("pacs_partner")).toBe("Partenaire de PACS");
    expect(labelRelationSuccession("ascendant")).toBe("Ascendant");
  });

  it("fallback contextuel pour valeur vide ; clé inconnue non masquée", () => {
    expect(labelRelationSuccession("", "Héritier")).toBe("Héritier");
    expect(labelRelationSuccession(undefined, "Bénéficiaire")).toBe("Bénéficiaire");
    expect(labelRelationSuccession("relation_inconnue")).toBe("relation_inconnue"); // dernier recours : brut, jamais caché
  });
});

describe("Adaptateurs PDF — la colonne Lien passe par le mapping partagé", () => {
  it("page A (héritiers) : un héritier enfant_conjoint affiche « Enfant du conjoint »", () => {
    const d = buildSuccessionAData({
      succession: {
        activeNet: 300_000,
        results: [
          { name: "meme", relation: "enfant", partRecueFiscale: 200_000, successionDuties: 0, allowance: 100_000 },
          { name: "riri", relation: "enfant_conjoint", partRecueFiscale: 100_000, successionDuties: 60_000, allowance: 1_594 },
        ],
      },
      data: { person1FirstName: "David", person1LastName: "Perry", coupleStatus: "married" },
      cabinet: { cabinetName: "C" },
    });
    const riri = d.heritiers.find((h) => h.nom === "riri");
    expect(riri?.lien).toBe("Enfant du conjoint");
  });

  it("page B (bénéficiaires AV) : un bénéficiaire enfant_conjoint affiche « Enfant du conjoint »", () => {
    const d = buildSuccessionBData({
      succession: {
        avLines: [
          { beneficiary: "riri", relation: "enfant_conjoint", amount: 50_000, amountBefore70Capital: 50_000, before70Tax: 0, after70Tax: 0 },
        ],
      },
      data: { person1FirstName: "David", coupleStatus: "married" },
      cabinet: { cabinetName: "C" },
    });
    const riri = (d.beneficiaires || []).find((b: any) => /riri/i.test(b.nom || ""));
    expect(riri?.lien).toBe("Enfant du conjoint");
  });
});
