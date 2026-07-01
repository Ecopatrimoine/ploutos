import { describe, it, expect } from "vitest";
import { parseDateFr, formatIsoVersFr } from "./dateFr";

describe("parseDateFr — JJ/MM/AAAA -> ISO", () => {
  it("dates valides courantes", () => {
    expect(parseDateFr("01/01/2000")).toBe("2000-01-01");
    expect(parseDateFr("31/12/1999")).toBe("1999-12-31");
    expect(parseDateFr("15/06/1985")).toBe("1985-06-15");
  });

  it("tolère les espaces autour", () => {
    expect(parseDateFr("  10/03/2010  ")).toBe("2010-03-10");
  });

  it("29/02 bissextile accepté, non-bissextile refusé", () => {
    expect(parseDateFr("29/02/2000")).toBe("2000-02-29"); // 2000 divisible par 400
    expect(parseDateFr("29/02/2004")).toBe("2004-02-29"); // divisible par 4
    expect(parseDateFr("29/02/2001")).toBeNull();         // non bissextile
    expect(parseDateFr("29/02/1900")).toBeNull();         // divisible par 100, pas 400
    expect(parseDateFr("29/02/2100")).toBeNull();         // divisible par 100, pas 400
  });

  it("jour hors du mois refusé (30/31)", () => {
    expect(parseDateFr("31/04/2000")).toBeNull(); // avril = 30 jours
    expect(parseDateFr("31/06/2000")).toBeNull(); // juin = 30 jours
    expect(parseDateFr("30/02/2000")).toBeNull(); // février
    expect(parseDateFr("31/03/2000")).toBe("2000-03-31"); // mars = 31 jours
  });

  it("mois et jour hors bornes refusés", () => {
    expect(parseDateFr("01/13/2000")).toBeNull(); // mois 13
    expect(parseDateFr("01/00/2000")).toBeNull(); // mois 0
    expect(parseDateFr("00/01/2000")).toBeNull(); // jour 0
    expect(parseDateFr("32/01/2000")).toBeNull(); // jour 32
  });

  it("année à 2 chiffres refusée", () => {
    expect(parseDateFr("01/01/99")).toBeNull();
    expect(parseDateFr("01/01/00")).toBeNull();
  });

  it("bornes d'année [1900, 2100]", () => {
    expect(parseDateFr("01/01/1900")).toBe("1900-01-01"); // borne incluse
    expect(parseDateFr("31/12/2100")).toBe("2100-12-31"); // borne incluse
    expect(parseDateFr("31/12/1899")).toBeNull();         // sous la borne
    expect(parseDateFr("01/01/2101")).toBeNull();         // au-dessus
  });

  it("formats incomplets ou mal séparés refusés", () => {
    expect(parseDateFr("")).toBeNull();
    expect(parseDateFr("01/01")).toBeNull();
    expect(parseDateFr("1/1/2000")).toBeNull();     // 1 chiffre
    expect(parseDateFr("01-01-2000")).toBeNull();   // mauvais séparateur
    expect(parseDateFr("2000-01-01")).toBeNull();   // ISO, pas FR
    expect(parseDateFr("aa/bb/cccc")).toBeNull();
  });
});

describe("formatIsoVersFr — ISO -> JJ/MM/AAAA", () => {
  it("ISO valides", () => {
    expect(formatIsoVersFr("2000-01-01")).toBe("01/01/2000");
    expect(formatIsoVersFr("1999-12-31")).toBe("31/12/1999");
    expect(formatIsoVersFr("1985-06-15")).toBe("15/06/1985");
  });

  it("entrées vides ou invalides -> chaîne vide", () => {
    expect(formatIsoVersFr("")).toBe("");
    expect(formatIsoVersFr("abc")).toBe("");
    expect(formatIsoVersFr("01/01/2000")).toBe("");        // FR, pas ISO
    expect(formatIsoVersFr("2000-13-01")).toBe("");        // mois 13
    expect(formatIsoVersFr("2000-02-30")).toBe("");        // 30 février
    expect(formatIsoVersFr("2000-01-01T00:00:00")).toBe(""); // datetime, pas date pure
  });
});

describe("aller-retour ISO <-> FR", () => {
  it("iso -> fr -> iso conserve la valeur", () => {
    for (const iso of ["2000-06-15", "1985-01-01", "2020-12-31", "2000-02-29"]) {
      expect(parseDateFr(formatIsoVersFr(iso))).toBe(iso);
    }
  });

  it("fr -> iso -> fr conserve la valeur", () => {
    for (const fr of ["15/06/2000", "01/01/1985", "31/12/2020", "29/02/2000"]) {
      expect(formatIsoVersFr(parseDateFr(fr) as string)).toBe(fr);
    }
  });
});
