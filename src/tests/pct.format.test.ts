// LOT 5 — formateur FR unique pct() (C1) + duree d'arret naturelle formatDureeArret (C3).
import { describe, it, expect } from "vitest";
import { pct, formatDureeArret } from "../lib/calculs/utils";

// \s couvre les deux variantes d'espace insecable (U+00A0 et U+202F selon ICU) :
// on retire tous les espaces pour comparer le contenu, sans dependre de la variante.
const strip = (s: string) => s.replace(/\s/g, "");

describe("pct — pourcentage FR (C1)", () => {
  it("fraction -> pourcentage FR, virgule decimale", () => {
    expect(strip(pct(0.219))).toBe("21,9%");
    expect(strip(pct(0.211))).toBe("21,1%");
  });

  it("zeros decimaux superflus retires", () => {
    expect(strip(pct(0.5))).toBe("50%");
    expect(strip(pct(0.08))).toBe("8%");
    expect(strip(pct(1))).toBe("100%");
  });

  it("arrondi au nombre de decimales", () => {
    expect(strip(pct(0.216, 1))).toBe("21,6%");
    expect(strip(pct(0.1999, 1))).toBe("20%");
    expect(strip(pct(0.172, 0))).toBe("17%");
  });

  it("espace avant % insecable (jamais un espace normal)", () => {
    const s = pct(0.5);
    expect(/\s%/.test(s)).toBe(true);  // il y a bien un espace avant le %
    expect(/ %/.test(s)).toBe(false);  // ... mais PAS un espace normal -> insecable
  });
});

describe("formatDureeArret — duree d'arret naturelle (C3)", () => {
  it("annees pleines et demi-annees", () => {
    expect(formatDureeArret(365)).toBe("1 an");
    expect(formatDureeArret(547)).toBe("18 mois");  // 1,5 an
    expect(formatDureeArret(730)).toBe("2 ans");
    expect(formatDureeArret(912)).toBe("30 mois");  // 2,5 ans
    expect(formatDureeArret(1095)).toBe("3 ans");
  });

  it("aucun '.0 ans' anglais", () => {
    [365, 547, 730, 912, 1095, 1460].forEach((j) => {
      expect(formatDureeArret(j)).not.toMatch(/\d\.\d/);
    });
  });
});
