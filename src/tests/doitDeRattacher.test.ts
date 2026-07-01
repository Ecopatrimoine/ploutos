// @vitest-environment jsdom
//
// B1 — de-rattachement auto au-dela de 25 ans (fonction de decision PURE extraite
// de TabFamiliale). Sens unique (jamais true pour <= 25), seuil STRICT (> 25),
// null-safe (date vide/invalide -> false).

import { describe, it, expect } from "vitest";
import { doitDeRattacher } from "../components/tabs/TabFamiliale";

// Dates calculees depuis l'annee courante -> deterministe quel que soit le jour
// du run (naissance au 1er janvier => age = annee_courante - annee_naissance).
const y = new Date().getFullYear();
const isoPourAge = (age: number) => `${y - age}-01-01`;

describe("doitDeRattacher — barriere douce > 25 ans", () => {
  it("age > 25 -> true (26, 30, 80)", () => {
    expect(doitDeRattacher(isoPourAge(26))).toBe(true);
    expect(doitDeRattacher(isoPourAge(30))).toBe(true);
    expect(doitDeRattacher(isoPourAge(80))).toBe(true);
  });

  it("age === 25 -> false (seuil STRICT : 25 pile ne declenche rien)", () => {
    expect(doitDeRattacher(isoPourAge(25))).toBe(false);
  });

  it("age < 25 -> false (aucun re-rattachement force)", () => {
    expect(doitDeRattacher(isoPourAge(24))).toBe(false);
    expect(doitDeRattacher(isoPourAge(10))).toBe(false);
    expect(doitDeRattacher(isoPourAge(0))).toBe(false);
  });

  it("date vide ou invalide -> false", () => {
    expect(doitDeRattacher("")).toBe(false);
    expect(doitDeRattacher("pas-une-date")).toBe(false);
  });
});
