// LOT 2quater — plus-values immobilieres des particuliers (fonction pure partagee,
// ecran seul). Golden T14 verifie en Python le 07/07/2026. On force pvBrute via
// prixAcquisition 0 / prixCession = PV pour isoler les abattements et impots.
import { describe, it, expect } from "vitest";
import { computePvImmobiliere, abattementIrDetention, abattementPsDetention } from "../lib/calculs/pvImmobiliere";

const pv = (montant: number, age: number) => computePvImmobiliere({ prixCession: montant, prixAcquisition: 0, age });

describe("computePvImmobiliere — T14 abattements duree de detention (art. 150 VC)", () => {
  it("PV 40000 / age 10 : baseIr 28000, impotIr 5320, basePs 36700, impotPs 6312.40, total 11632.40", () => {
    const r = pv(40000, 10);
    expect(r.pvBrute).toBeCloseTo(40000, 2);
    expect(r.baseIr).toBeCloseTo(28000, 2);   // 40000 x (1 - 0.30)
    expect(r.impotIr).toBeCloseTo(5320, 2);   // 28000 x 0.19
    expect(r.basePs).toBeCloseTo(36700, 2);   // 40000 x (1 - 0.0825)
    expect(r.impotPs).toBeCloseTo(6312.4, 2); // 36700 x 0.172
    expect(r.impotTotal).toBeCloseTo(11632.4, 2);
  });
  it("PV 40000 / age 3 : aucun abattement -> total 14480", () => {
    const r = pv(40000, 3);
    expect(r.impotTotal).toBeCloseTo(14480, 2); // 40000 x (0.19 + 0.172)
  });
  it("PV 40000 / age 22 : impotIr 0 (exonere IR), basePs 28800, impotPs 4953.60", () => {
    const r = pv(40000, 22);
    expect(r.impotIr).toBeCloseTo(0, 2);
    expect(r.basePs).toBeCloseTo(28800, 2);   // 40000 x (1 - 0.28)
    expect(r.impotPs).toBeCloseTo(4953.6, 2);
  });
  it("PV 40000 / age 25 : impotIr 0, impotPs 3096", () => {
    const r = pv(40000, 25);
    expect(r.impotIr).toBeCloseTo(0, 2);
    expect(r.impotPs).toBeCloseTo(3096, 2);   // 40000 x (1 - 0.55) x 0.172
  });
  it("exonerations : abattementIr(22)=1 ; abattementPs(30)=1 ; abattementPs(22)=0.28", () => {
    expect(abattementIrDetention(22)).toBeCloseTo(1, 6);
    expect(abattementPsDetention(30)).toBeCloseTo(1, 6);
    expect(abattementPsDetention(22)).toBeCloseTo(0.28, 6);
  });
});

describe("computePvImmobiliere — divers", () => {
  it("moins-value : pvBrute 0, impots 0", () => {
    const r = computePvImmobiliere({ prixCession: 250000, prixAcquisition: 300000, age: 10 });
    expect(r.moinsValue).toBe(true);
    expect(r.pvBrute).toBe(0);
    expect(r.impotTotal).toBe(0);
  });
  it("alerteSurtaxe si baseIr > 50000", () => {
    const r = pv(200000, 3); // baseIr = 200000 (aucun abattement) > 50000
    expect(r.alerteSurtaxe).toBe(true);
  });
});
