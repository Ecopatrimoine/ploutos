// LOT 6 — helper de pluriel FR plur() (C3) + conversion %/fraction (C4).
import { describe, it, expect } from "vitest";
import { plur, fractionEnPct, pctEnFraction } from "../lib/calculs/utils";

describe("plur — pluriel FR au nombre connu (C3)", () => {
  it("singulier pour 0 et 1, pluriel au-dela", () => {
    expect(plur(0, "part")).toBe("0 part");
    expect(plur(1, "part")).toBe("1 part");
    expect(plur(2, "part")).toBe("2 parts");
    expect(plur(23, "feuille")).toBe("23 feuilles");
  });

  it("pluriel explicite pour accords composes / irreguliers", () => {
    expect(plur(17, "élément sélectionné", "éléments sélectionnés")).toBe("17 éléments sélectionnés");
    expect(plur(1, "champ manquant", "champs manquants")).toBe("1 champ manquant");
    expect(plur(3, "champ manquant", "champs manquants")).toBe("3 champs manquants");
  });
});

describe("conversion %/fraction — affichage en % d'un modele stocke en 0-1 (C4)", () => {
  it("fractionEnPct : 0-1 -> pourcentage, sans bruit flottant", () => {
    expect(fractionEnPct(0.5)).toBe(50);
    expect(fractionEnPct(0.335)).toBe(33.5);
    expect(fractionEnPct(0.3)).toBe(30);   // 0.3 * 100 = 30.000000000000004 sans arrondi
    expect(fractionEnPct(0)).toBe(0);
    expect(fractionEnPct(1)).toBe(100);
  });

  it("pctEnFraction : pourcentage saisi -> fraction 0-1", () => {
    expect(pctEnFraction(50)).toBe(0.5);
    expect(pctEnFraction(0)).toBe(0);
    expect(pctEnFraction(100)).toBe(1);
  });

  it("entrees vides / non numeriques -> 0 (jamais NaN a l'ecran ni au modele)", () => {
    expect(fractionEnPct(NaN)).toBe(0);
    expect(pctEnFraction(NaN)).toBe(0);
    expect(pctEnFraction(Number(""))).toBe(0);
  });

  it("aller-retour stable : le modele (fraction) ne derive pas", () => {
    expect(pctEnFraction(fractionEnPct(0.3))).toBe(0.3);
    expect(pctEnFraction(fractionEnPct(0.5))).toBe(0.5);
    expect(fractionEnPct(pctEnFraction(50))).toBe(50);
    expect(fractionEnPct(pctEnFraction(33.5))).toBe(33.5);
  });
});
