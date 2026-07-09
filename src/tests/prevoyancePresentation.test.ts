// LOT 10c — dérivations de présentation prévoyance (ZÉRO moteur) sur fixtures de frise.
import { describe, it, expect } from "vitest";
import type { ProjectionResult, SerieEmpilee, Constat } from "../lib/prevoyance/types";
import {
  buildBesoinCouverture, buildDateCritique, buildTableauEuro, buildVigilance, pireRisques,
  couvertureAtIdx, resolveSeuilsPrevoyance, SEUILS_DEFAUT, bornesPalier,
} from "../lib/presentation/prevoyancePerso";

const ZERO8 = () => [0, 0, 0, 0, 0, 0, 0, 0];
// Frise fixture : ref 4000 €/mois ; jalons J0/J3/J7/J30/J90/J180/J365/3ans.
// Total couverture : 0 / 4000 / 4000 / 4000 / 3000 / 2000 / 2000 / 1600 (carence J0,
// maintien 100 % 3 sem., IJ régime 2000 + coll. 1000 à J90, plateau 2000 dès J180,
// invalidité 1600 à 3 ans).
function friseFixture(): ProjectionResult {
  const series: SerieEmpilee = {
    salaire: ZERO8(),
    maintienEmployeur: [0, 4000, 4000, 4000, 0, 0, 0, 0],
    ijObligatoire: [0, 0, 0, 0, 2000, 2000, 2000, 0],
    ijComplementaireCollective: [0, 0, 0, 0, 1000, 0, 0, 0],
    ijComplementaireIndividuelle: ZERO8(),
    pensionInvalObligatoire: [0, 0, 0, 0, 0, 0, 0, 1600],
    renteInvalCollective: ZERO8(),
    renteInvalIndividuelle: ZERO8(),
    renteInvalEnfants: ZERO8(),
  };
  const jours = [0, 3, 7, 30, 90, 180, 365, 1095];
  const axe = jours.map((j) => ({ jour: j, date: `2026-${String(1 + (j % 12)).padStart(2, "0")}-01`, phase: (j >= 1095 ? "invalidite" : "am") as "am" | "invalidite" }));
  return { axe, series, revenuReferenceMensuel: 4000, basculeInvaliditeJour: 1095, finProjectionJour: 7300 } as unknown as ProjectionResult;
}

// Frise uniforme (chaque total identique sur tout l'axe) pour les cas seuil.
function friseUniforme(totalParPoint: number): ProjectionResult {
  const arr = () => [0, 0, 0, 0, 0, 0, 0, 0];
  const series = {
    salaire: arr(), maintienEmployeur: [totalParPoint, totalParPoint, totalParPoint, totalParPoint, totalParPoint, totalParPoint, totalParPoint, totalParPoint],
    ijObligatoire: arr(), ijComplementaireCollective: arr(), ijComplementaireIndividuelle: arr(),
    pensionInvalObligatoire: arr(), renteInvalCollective: arr(), renteInvalIndividuelle: arr(), renteInvalEnfants: arr(),
  } as SerieEmpilee;
  const jours = [0, 3, 7, 30, 90, 180, 365, 1095];
  const axe = jours.map((j) => ({ jour: j, date: "2026-01-01", phase: "am" as const }));
  return { axe, series, revenuReferenceMensuel: 4000, basculeInvaliditeJour: 1095, finProjectionJour: 7300 } as unknown as ProjectionResult;
}

describe("prevoyancePerso — besoin de couverture minimum (palier durable)", () => {
  it("palier durable = plateau de fin de 1re année ; besoin = cible − plateau", () => {
    const b = buildBesoinCouverture(friseFixture(), 0.9);
    expect(b.revenuRef).toBe(4000);
    expect(b.cibleMontant).toBe(3600);           // 0,9 × 4000
    expect(b.couvertureDurable).toBe(2000);      // plateau J180→J365
    expect(b.couvertureDurablePct).toBeCloseTo(0.5, 6);
    expect(b.besoin).toBe(1600);                 // 3600 − 2000
    expect(b.durableJour).toBe(180);             // début du plateau contigu
    expect(b.durableMois).toBe(6);
  });

  it("besoin nul si le plateau couvre déjà la cible", () => {
    const b = buildBesoinCouverture(friseUniforme(4000), 0.9);
    expect(b.besoin).toBe(0); // 3600 − 4000 borné à 0
  });
});

describe("prevoyancePerso — date critique (franchissement descendant)", () => {
  it("ignore la carence initiale, détecte le franchissement à J90 (seuil 80 %)", () => {
    const d = buildDateCritique(friseFixture(), 0.8);
    expect(d.statut).toBe("critique");
    if (d.statut === "critique") { expect(d.jour).toBe(90); expect(d.libelle).toBe("3e mois d'arrêt"); }
  });

  it("franchissement À la bascule invalidité (seuil 50 %) reste critique", () => {
    const d = buildDateCritique(friseFixture(), 0.5);
    expect(d.statut).toBe("critique");
    if (d.statut === "critique") expect(d.jour).toBe(1095);
  });

  it("A2 — franchissement APRÈS la bascule (coupure pension à la retraite) -> statut retraite (vert)", () => {
    // Bien couvert : plateau invalidité 2000 (50 %) de J1095 à J6570, puis 0 à la coupure
    // retraite (age 62, jour 6570 > bascule). Seuil 50 % franchi seulement à la retraite.
    const arr = () => [0, 0, 0, 0, 0, 0];
    const series = {
      salaire: arr(), maintienEmployeur: [0, 4000, 4000, 0, 0, 0], ijObligatoire: arr(),
      ijComplementaireCollective: arr(), ijComplementaireIndividuelle: arr(),
      pensionInvalObligatoire: [0, 0, 0, 2500, 2500, 0], renteInvalCollective: arr(),
      renteInvalIndividuelle: arr(), renteInvalEnfants: arr(),
    } as unknown as SerieEmpilee;
    const jours = [0, 30, 180, 1095, 6205, 6570];
    const axe = jours.map((j) => ({ jour: j, date: "2026-01-01", phase: (j >= 1095 ? "invalidite" : "am") as "am" | "invalidite" }));
    const proj = { axe, series, revenuReferenceMensuel: 4000, basculeInvaliditeJour: 1095, finProjectionJour: 7300 } as unknown as ProjectionResult;
    const d = buildDateCritique(proj, 0.5);
    expect(d.statut).toBe("retraite");
    if (d.statut === "retraite") expect(d.jour).toBe(6570);
  });

  it("jamais sous le seuil -> statut jamais", () => {
    expect(buildDateCritique(friseUniforme(4000), 0.5).statut).toBe("jamais");
  });

  it("toujours sous le seuil -> des_le_debut (dès le 1er jour)", () => {
    expect(buildDateCritique(friseUniforme(1000), 0.5).statut).toBe("des_le_debut");
  });
});

describe("prevoyancePerso — bornes de palier (A3, constats en paliers)", () => {
  it("palier plat contenant J180 : bornes exactes J180→J365 (frise fixture)", () => {
    const b = bornesPalier(friseFixture(), 180)!;
    expect(b.startJour).toBe(180);   // J90 (3000) ≠ 2000 -> le palier démarre à J180
    expect(b.endJour).toBe(365);     // J1095 (1600) ≠ 2000 -> se termine à J365
    expect(b.total).toBe(2000);
  });
  it("jour hors axe -> null", () => {
    expect(bornesPalier(friseFixture(), 999)).toBeNull();
  });
});

describe("prevoyancePerso — Tableau € payeur × jalon (cohérence graphe)", () => {
  const t = buildTableauEuro(friseFixture());
  it("Σ cellules d'un jalon = couverture totale (réconciliation à l'euro)", () => {
    t.cols.forEach((_, c) => {
      const somme = t.rows.reduce((s, r) => s + r.cells[c], 0);
      expect(somme).toBe(t.totals[c]);
    });
  });
  it("totaux = couvertureAtIdx du graphe, % = total/référence", () => {
    const fx = friseFixture();
    // colonne J90 (index 4 dans l'axe) : total 3000, 75 %
    const cJ90 = t.cols.findIndex((c) => c.jour === 90);
    expect(t.totals[cJ90]).toBe(3000);
    expect(t.totals[cJ90]).toBe(Math.round(couvertureAtIdx(fx.series, 4)));
    expect(t.pcts[cJ90]).toBe(75);
  });
  it("ne montre que les payeurs présents (maintien, régime oblig., collective)", () => {
    const familles = t.rows.map((r) => r.famille).sort();
    expect(familles).toEqual(["collective", "maintien", "obligatoire"]);
  });
});

describe("prevoyancePerso — vigilance (invalidité toujours dans les pires risques)", () => {
  const constats: Constat[] = [
    { id: "inval-1", severite: "info", axe: "invalidite", cible: "p1", titre: "Rente invalidité faible", detail: "d", action: "a", impactChiffre: { montant: 800, libelle: "manque/mois" } },
    { id: "inc-1", severite: "alerte", axe: "incapacite", cible: "p1", titre: "Trou de couverture", detail: "d", action: "a" },
    { id: "info-1", severite: "info", axe: "sante", cible: "p1", titre: "Info santé", detail: "d", action: "a" },
  ];
  it("tri par sévérité décroissante, montant repris", () => {
    const rows = buildVigilance(constats);
    expect(rows[0].severite).toBe("alerte");
    expect(rows.find((r) => r.id === "inval-1")!.montant).toBe(800);
  });
  it("pireRisques garde l'invalidité même en sévérité info (le pire risque reste visible)", () => {
    const pires = pireRisques(buildVigilance(constats));
    expect(pires.some((r) => r.id === "inval-1")).toBe(true); // invalidité info conservée
    expect(pires.some((r) => r.id === "info-1")).toBe(false); // info santé écartée
  });
});

describe("prevoyancePerso — seuils réglables", () => {
  it("défauts sûrs quand le dossier n'a pas de valeurs", () => {
    expect(resolveSeuilsPrevoyance({})).toEqual({ cible: SEUILS_DEFAUT.cible, seuilCritique: SEUILS_DEFAUT.seuilCritique });
  });
  it("lit les valeurs du dossier (fractions)", () => {
    const s = resolveSeuilsPrevoyance({ prevoyance: { cibleCouverture: 1.0, seuilCritique: 0.4 } });
    expect(s).toEqual({ cible: 1.0, seuilCritique: 0.4 });
  });
});
