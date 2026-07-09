// LOT 10a — réconciliation à l'euro de la couche de présentation succession.
import { describe, it, expect } from "vitest";
import { buildSuccessionPresentation, type SuccessionLike } from "../lib/analysis/successionPresentation";

// Fixture : actif net 300 000, 2 héritiers (enfant A + conjoint B), 1 AV pour A,
// 1 AV pour un CONCUBIN non-héritier (invisible aujourd'hui). Distribution complète.
const S: SuccessionLike = {
  activeNet: 300_000,
  totalSuccessionRights: 10_000,
  totalAvRights: 20_000, // 8000 (A) + 12000 (concubin)
  results: [
    { name: "A", relation: "enfant", partRecueFiscale: 150_000, successionDuties: 10_000, compositionFiscale: "PP 150 000 €", grossReceived: 150_000, nueValue: 0, usufructFiscalValue: 0 },
    { name: "B", relation: "conjoint", partRecueFiscale: 150_000, successionDuties: 0, compositionFiscale: "PP 150 000 €", grossReceived: 150_000, nueValue: 0, usufructFiscalValue: 0 },
  ],
  avLines: [
    { beneficiary: "A", relation: "enfant", amount: 100_000, before70Tax: 8_000, after70Tax: 0 },
    { beneficiary: "Concubin X", relation: "concubin", amount: 80_000, before70Tax: 12_000, after70Tax: 0 },
  ],
  reserveChildrenCount: 1,
  legalReserveAmount: 150_000,
  legalDisposableAmount: 150_000,
  quotiteDisponible: 0.5,
  warnings: [],
};

describe("buildSuccessionPresentation — réconciliation à l'euro (Lot 10a)", () => {
  const p = buildSuccessionPresentation(S);

  it("KPI : brut = actif net + capitaux AV ; fiscalité = droits + fiscalité AV ; net = brut − fisc", () => {
    expect(p.kpis.brut).toBe(300_000 + 180_000);          // 480 000
    expect(p.kpis.fiscalite).toBe(10_000 + 20_000);       // 30 000
    expect(p.kpis.net).toBe(450_000);
  });

  it("Σ (net par personne) = net transmis (Acte 2 réconcilie Acte 1)", () => {
    const somme = p.persons.reduce((t, r) => t + r.net, 0);
    expect(Math.round(somme)).toBe(p.kpis.net);
  });

  it("les bénéficiaires AV NON-héritiers apparaissent (concubin)", () => {
    const concubin = p.persons.find((r) => r.name === "Concubin X");
    expect(concubin).toBeDefined();
    expect(concubin!.isHeir).toBe(false);
    expect(concubin!.succession).toBeNull();
    expect(concubin!.av).not.toBeNull();
    expect(concubin!.av!.net).toBe(68_000); // 80 000 − 12 000
  });

  it("un héritier avec AV décompose succession ET assurance-vie séparément", () => {
    const a = p.persons.find((r) => r.name === "A")!;
    expect(a.succession!.net).toBe(140_000); // 150 000 − 10 000
    expect(a.av!.net).toBe(92_000);          // 100 000 − 8 000
    expect(a.net).toBe(232_000);
  });

  it("camembert « cadre légal » = 100 % de l'actif civil (réserve/enfant + quotité)", () => {
    const total = p.cadreLegalPie.reduce((t, s) => t + s.value, 0);
    expect(total).toBe(300_000);
    expect(p.cadreLegalPie).toHaveLength(2); // 1 réserve enfant + quotité disponible
  });

  it("camembert « répartition simulée » = 100 % de l'actif civil (partRecueFiscale, AV exclue)", () => {
    const total = p.repartitionSimuleePie.reduce((t, s) => t + s.value, 0);
    expect(total).toBe(300_000);
  });

  it("aucune alerte réserve quand le moteur n'en émet pas", () => {
    expect(p.reserveWarning).toBeNull();
  });

  it("alerte réserve relayée UNIQUEMENT si le moteur la détecte", () => {
    const p2 = buildSuccessionPresentation({ ...S, warnings: ["Réserve héréditaire spoliée : les enfants devraient recevoir au moins 150 000 €."] });
    expect(p2.reserveWarning).toContain("Réserve héréditaire spoliée");
  });
});
