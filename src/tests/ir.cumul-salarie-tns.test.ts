// ─── Tests IR — cumul salarie + TNS sur une meme personne (Lot A, foyer commun) ─
//
// Verrouille le nouveau champ opt-in `activiteSecondaire{1,2}` et les gardes A / C /
// D de computeIR. Chemin FOYER COMMUN uniquement (concubins = Lot B, hors scope).
//
// Deux exigences :
//   1. RETRO-COMPAT : champ absent => comportement historique SOIT/SOIT strictement
//      inchange (invariants I1, I2).
//   2. CUMUL : champ present => salaire ET benefice TNS entrent tous deux dans le
//      revenu imposable, avec l'abattement 10% sur le SEUL salaire (cas C1..C4).
//
// Toutes les valeurs attendues sont derivees ligne a ligne en commentaire.
// Bareme revenus 2025 (LF 2026) : 0-11600 @0 | 11600-29579 @0,11 | 29579-84577 @0,3
//   | 84577-181917 @0,41 | >181917 @0,45. Decote celibataire : 897 - 0,4525*bareme
//   si bareme < 1982. computeTaxFromBrackets ne fait AUCUN arrondi (=> toBeCloseTo).
// PASS 2026 = 48060 (pass-2026.json).

import { describe, it, expect } from "vitest";
import { computeIR, computeBeneficeImposable } from "../lib/calculs/ir";
import { computeTauxEndettement } from "../lib/calculs/endettement";
import { computeBudget } from "../lib/calculs/budget";
import { EMPTY_CHARGES_DETAIL } from "../constants";

// Base celibataire, 1 part, aucun revenu par defaut. person1Csp/PcsGroupe surcharges
// par cas. person2 vide (PcsGroupe "5" => non-indep, salary2/benefice2 = 0).
const BASE_DATA = {
  person1FirstName: "Test", person1LastName: "Cumul", person1BirthDate: "1980-01-01",
  person1JobTitle: "Sujet", person1Csp: "37", person1PcsGroupe: "3",
  person2FirstName: "", person2LastName: "", person2BirthDate: "",
  person2JobTitle: "", person2Csp: "47", person2PcsGroupe: "5",
  coupleStatus: "single", matrimonialRegime: "communaute_legale", singleParent: false,
  person1Handicap: false, person2Handicap: false,
  childrenData: [],
  salary1: "0", salary2: "0", pensions: "0",
  perDeduction: "0", pensionDeductible: "0", otherDeductible: "0", perRentes: [],
  ca1: "", bicType1: "services", microRegime1: true, chargesReelles1: "", baRevenue1: "",
  chargesDetail1: { ...EMPTY_CHARGES_DETAIL },
  ca2: "", bicType2: "services", microRegime2: true, chargesReelles2: "", baRevenue2: "",
  chargesDetail2: { ...EMPTY_CHARGES_DETAIL },
  properties: [], placements: [], otherLoans: [],
};

const STD_OPTIONS = {
  expenseMode1: "standard" as const, expenseMode2: "standard" as const,
  km1: "0", cv1: "5", mealCount1: "0", mealUnit1: "4.9",
  km2: "0", cv2: "5", mealCount2: "0", mealUnit2: "4.9",
  foncierRegime: "micro",
  other1: "0", other2: "0",
};

const mk = (over: Record<string, unknown>) => ({ ...BASE_DATA, ...over });

// ─── RETRO-COMPAT : champ absent => zero changement ──────────────────────────
describe("cumul salarie+TNS — invariants retro-compat (champ absent)", () => {
  it("I1 : TNS pur (PCS groupe 2) avec salary1 residuel 25000 sans activiteSecondaire == meme dossier a salary1=0", () => {
    // isIndep1=true (PCS groupe 2). activiteSecondaire1 absent => salaireMasque1 =
    // isIndep1 && "" !== "salariat" = true => salary1 force a 0 (garde C historique).
    // benefice1 (BIC micro services, ca=60000) = 60000 - max(305, 60000*0.5=30000) = 30000.
    // salaries = 0 + 30000 = 30000 dans les DEUX dossiers => IR identique.
    const residuel = mk({ person1PcsGroupe: "2", person1Csp: "21", ca1: "60000", salary1: "25000" });
    const zero = mk({ person1PcsGroupe: "2", person1Csp: "21", ca1: "60000", salary1: "0" });
    const rR = computeIR(residuel as any, STD_OPTIONS);
    const rZ = computeIR(zero as any, STD_OPTIONS);
    expect(rR.salaries).toBe(30000);
    expect(rR.salaries).toBe(rZ.salaries);
    expect(rR.revenuNetGlobal).toBe(rZ.revenuNetGlobal);
    expect(rR.finalIR).toBe(rZ.finalIR);
  });

  it("I2 : salarie pur (PCS groupe 3) avec ca1 residuel 15000 sans activiteSecondaire == meme dossier a ca1=0", () => {
    // isIndep1=false (PCS groupe 3) et activiteSecondaire1 absent => secTns=false =>
    // resolveBeneficeTns renvoie 0 quel que soit ca1 (garde A historique).
    // salaries = 45000 (salaire seul) dans les DEUX dossiers => IR identique.
    const residuel = mk({ salary1: "45000", ca1: "15000" });
    const zero = mk({ salary1: "45000", ca1: "0" });
    const rR = computeIR(residuel as any, STD_OPTIONS);
    const rZ = computeIR(zero as any, STD_OPTIONS);
    expect(rR.salaries).toBe(45000);
    expect(rR.salaries).toBe(rZ.salaries);
    expect(rR.revenuNetGlobal).toBe(rZ.revenuNetGlobal);
    expect(rR.finalIR).toBe(rZ.finalIR);
  });
});

// ─── CUMUL : champ present => salaire ET benefice additionnes ─────────────────
describe("cumul salarie+TNS — cas nominaux (foyer commun, 1 part)", () => {
  it("C1 : salarie (groupe 3) + activite secondaire BNC micro => salaire + benefice", () => {
    // salary1 = 40000 ; activiteSecondaire1 = 'bnc' ; ca1 = 20000 ; micro.
    // benefice1 (BNC micro) = 20000 - max(305, 20000*0.34=6800) = 13200.
    expect(computeBeneficeImposable(20000, "services", true, false, true, 0, 0)).toBe(13200);
    // isIndep1=false (groupe 3) => salaireMasque1=false => salary1 = 40000 retenu.
    // salaries = 40000 + 13200 = 53200.
    // abattement 10% salaire = max(509, min(40000*0.1=4000, 14555)) = 4000 (base = SALAIRE seul).
    // RNG = 53200 - 4000 = 49200 ; quotient = 49200 (1 part).
    // bareme = (29579-11600)*0.11=1977.69 + (49200-29579)*0.30=5886.30 = 7863.99.
    // decote : 7863.99 >= 1982 => 0 ; finalIR = 7863.99.
    const r = computeIR(mk({ salary1: "40000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true }) as any, STD_OPTIONS);
    expect(r.salaries).toBe(53200);
    expect(r.retainedExpenses).toBe(4000);
    expect(r.revenuNetGlobal).toBe(49200);
    expect(r.finalIR).toBeCloseTo(7863.99, 2);
  });

  it("C2 : TNS BIC (groupe 2) + activite secondaire salariat => benefice + salaire", () => {
    // ca1 = 50000 (micro services) ; activiteSecondaire1 = 'salariat' ; salary1 = 30000.
    // benefice1 (BIC services micro) = 50000 - max(305, 50000*0.5=25000) = 25000 (inchange).
    expect(computeBeneficeImposable(50000, "services", false, false, true, 0, 0)).toBe(25000);
    // isIndep1=true (groupe 2) MAIS sec1='salariat' => salaireMasque1=false => salary1=30000 retenu.
    // salaries = 30000 + 25000 = 55000.
    // abattement 10% salaire = max(509, min(30000*0.1=3000, 14555)) = 3000.
    // RNG = 55000 - 3000 = 52000 ; quotient = 52000.
    // bareme = 1977.69 + (52000-29579)*0.30=6726.30 = 8703.99 ; decote 0 ; finalIR = 8703.99.
    const r = computeIR(mk({ person1PcsGroupe: "2", person1Csp: "21", ca1: "50000", microRegime1: true, activiteSecondaire1: "salariat", salary1: "30000" }) as any, STD_OPTIONS);
    expect(r.salaries).toBe(55000);
    expect(r.retainedExpenses).toBe(3000);
    expect(r.revenuNetGlobal).toBe(52000);
    expect(r.finalIR).toBeCloseTo(8703.99, 2);
  });

  it("C3 : borne plancher abattement — cumulant a salary1=4000 => abattement 509", () => {
    // salarie (groupe 3) + BNC micro (benefice 13200) ; salary1 = 4000.
    // abattement = max(509, min(4000*0.1=400, 14555)) = 509 (plancher).
    // salaries = 4000 + 13200 = 17200 ; RNG = 17200 - 509 = 16691.
    // bareme = (16691-11600)*0.11 = 560.01 ; decote = max(0, 897 - 0.4525*560.01=643.60)
    //   => bareme - decote < 0 => Math.max(0, ...) = 0 ; finalIR = 0.
    const r = computeIR(mk({ salary1: "4000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true }) as any, STD_OPTIONS);
    expect(r.retainedExpenses).toBe(509);
    expect(r.revenuNetGlobal).toBe(16691);
    expect(r.finalIR).toBe(0);
  });

  it("C4 : borne plafond abattement — cumulant a salary1=160000 => abattement 14555", () => {
    // salarie (groupe 3) + BNC micro (benefice 13200) ; salary1 = 160000.
    // abattement = max(509, min(160000*0.1=16000, 14555)) = 14555 (plafond).
    // salaries = 160000 + 13200 = 173200 ; RNG = 173200 - 14555 = 158645.
    // bareme = 1977.69 + (84577-29579)*0.30=16499.40 + (158645-84577)*0.41=30367.88 = 48844.97.
    // decote 0 ; finalIR = 48844.97.
    const r = computeIR(mk({ salary1: "160000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true }) as any, STD_OPTIONS);
    expect(r.retainedExpenses).toBe(14555);
    expect(r.revenuNetGlobal).toBe(158645);
    expect(r.finalIR).toBeCloseTo(48844.97, 2);
  });
});

// ─── Garde E (plafond PER) HORS perimetre Lot A : doit rester au statu quo ─────
describe("cumul salarie+TNS — garde E (plafond PER) intouchee", () => {
  it("C5 : plafond PER cumul (garde E levee) = 10% x (salaire + benefice), micro => pas de 15%", () => {
    // MISE A JOUR DELIBEREE Lot E2 (4806 -> 5500) : la garde E est levee, l'assiette
    // 163 quatervicies cumule desormais salaire + benefice.
    // salaireBase = salary1 30000 ; benefice1 = 25000 (BIC micro services) ;
    // micro => beneficeAuReel = false => sup15 = 0 (pas de majoration 154 bis).
    // base10 = max(0.10 x min(30000+25000=55000, 8 PASS), 4806) = 5500 => plafondPER1 = 5500.
    // (Ancien code garde E : 4806, sur le seul benefice.)
    const r = computeIR(mk({ person1PcsGroupe: "2", person1Csp: "21", ca1: "50000", microRegime1: true, activiteSecondaire1: "salariat", salary1: "30000" }) as any, STD_OPTIONS);
    expect(r.plafondPER1).toBeCloseTo(5500, 2);
  });
});

// ─── Garde A propagee aux appelants endettement / budget (sans garde locale) ──
describe("cumul salarie+TNS — appelants de resolveBeneficeTns (garde A)", () => {
  const c1 = mk({ salary1: "40000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true });

  it("C6a : computeTauxEndettement additionne salaire 40000 + benefice 13200 = 53200", () => {
    // denominateur = salaires(40000) + pensions(0) + loyers(0) + beneficeTns(13200) = 53200.
    const taux = computeTauxEndettement(c1 as any);
    expect(taux.denominateurAnnuel).toBe(53200);
  });

  it("C6b : computeBudget expose le benefice TNS mensuel = 13200/12 = 1100", () => {
    const ir = computeIR(c1 as any, STD_OPTIONS);
    const b = computeBudget(c1 as any, ir);
    expect(b.detail.beneficeTns).toBeCloseTo(1100, 2);
  });
});

// ─── Chemin CONCUBINS (garde F, Lot B) ────────────────────────────────────────
// 2 foyers fiscaux de 1 part chacun (aucun enfant). Chaque concubin est un
// celibataire fiscal : decote 897 - 0,4525*bareme si bareme < 1982. La garde F
// somme desormais salary + benefice (au lieu du ternaire exclusif). Champs
// exposes : ir1/ir2 (bareme apres decote par foyer), rev1/rev2 (revenu net par
// foyer), finalIR (somme des deux). salary/retained proviennent des gardes C/D
// (memes variables de portee fonction, verifie par lecture).
describe("cumul salarie+TNS — chemin concubins (garde F)", () => {
  const concubins = (over: Record<string, unknown>) =>
    mk({ coupleStatus: "cohab", person2FirstName: "P2", ...over });

  it("IB1 invariant : P1 salarie pur + P2 TNS pur (salary2 residuel, champ absent) == meme dossier a salary2=0", () => {
    // P1 (groupe 3, cat 37) salaire 40000 : isIndep1=false => salary1=40000, benefice1=0,
    //   retained1 = max(509, min(4000,14555)) = 4000. rev1 = 40000 + 0 - 4000 = 36000.
    //   bareme = 17979*0.11(1977.69) + (36000-29579)*0.30(1926.30) = 3903.99 ; decote 0 => ir1 = 3903.99.
    // P2 (groupe 3, cat 31 = BNC) ca2 20000 micro, salary2 residuel 25000, activiteSecondaire2 ABSENT :
    //   isIndep2=true => salaireMasque2=true => salary2=0 (garde C), retained2=0 (garde D) ;
    //   benefice2 = 20000 - max(305, 6800) = 13200. rev2 = 0 + 13200 - 0 = 13200.
    //   bareme = (13200-11600)*0.11 = 176 ; decote = 897 - 0.4525*176 = 817.36 => ir2 = max(0, 176-817.36) = 0.
    // finalIR = 3903.99 + 0 = 3903.99. Le salaire residuel de P2 est ignore (garde C) => identique a salary2=0.
    const residuel = concubins({ salary1: "40000", person2PcsGroupe: "3", person2Csp: "31", ca2: "20000", microRegime2: true, salary2: "25000" });
    const zero = concubins({ salary1: "40000", person2PcsGroupe: "3", person2Csp: "31", ca2: "20000", microRegime2: true, salary2: "0" });
    const rR = computeIR(residuel as any, STD_OPTIONS);
    const rZ = computeIR(zero as any, STD_OPTIONS);
    expect(rR.ir1).toBeCloseTo(3903.99, 2);
    expect(rR.ir2).toBe(0);
    expect(rR.finalIR).toBeCloseTo(3903.99, 2);
    // Invariance : le salaire residuel de P2 (TNS pur, champ absent) n'a aucun effet.
    expect(rR.ir1).toBe(rZ.ir1);
    expect(rR.ir2).toBe(rZ.ir2);
    expect(rR.finalIR).toBe(rZ.finalIR);
  });

  it("CB1 cumul : P1 = C1 (salarie 40000 + BNC micro 20000), P2 salarie 30000", () => {
    // P1 : isIndep1=false => salary1=40000 retenu ; benefice1 = 13200 ; retained1 = 4000.
    //   rev1 = 40000 + 13200 - 4000 = 49200 (= RNG de C1 en individuel, 1 part).
    //   ir1 = 1977.69 + (49200-29579)*0.30(5886.30) = 7863.99 (== C1 finalIR).
    // P2 (groupe 4) salaire 30000 : retained2 = 3000 ; rev2 = 30000 - 3000 = 27000.
    //   bareme = (27000-11600)*0.11 = 1694 ; decote = 897 - 0.4525*1694 = 130.465 => ir2 = 1563.535.
    // finalIR = 7863.99 + 1563.535 = 9427.525.
    const d = concubins({ salary1: "40000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true, person2PcsGroupe: "4", person2Csp: "47", salary2: "30000" });
    const r = computeIR(d as any, STD_OPTIONS);
    expect(r.rev1).toBe(49200);
    expect(r.rev2).toBe(27000);
    expect(r.ir1).toBeCloseTo(7863.99, 2);
    expect(r.ir2).toBeCloseTo(1563.535, 2);
    expect(r.finalIR).toBeCloseTo(9427.525, 2);
  });

  it("CB2 cumul inverse : P1 = C2 (TNS BIC 50000 micro + salariat 30000), P2 salarie 30000", () => {
    // P1 : isIndep1=true, sec1='salariat' => salaireMasque1=false => salary1=30000 retenu ;
    //   benefice1 = 25000 ; retained1 = 3000. rev1 = 30000 + 25000 - 3000 = 52000 (= RNG de C2).
    //   ir1 = 1977.69 + (52000-29579)*0.30(6726.30) = 8703.99.
    // P2 (groupe 4) salaire 30000 : rev2 = 27000 ; ir2 = 1563.535 (idem CB1).
    // finalIR = 8703.99 + 1563.535 = 10267.525.
    const d = concubins({ person1PcsGroupe: "2", person1Csp: "21", ca1: "50000", microRegime1: true, activiteSecondaire1: "salariat", salary1: "30000", person2PcsGroupe: "4", person2Csp: "47", salary2: "30000" });
    const r = computeIR(d as any, STD_OPTIONS);
    expect(r.rev1).toBe(52000);
    expect(r.ir1).toBeCloseTo(8703.99, 2);
    expect(r.ir2).toBeCloseTo(1563.535, 2);
    expect(r.finalIR).toBeCloseTo(10267.525, 2);
  });

  it("CB3 : sur CB1, l'abattement de P1 porte sur le SEUL salaire (4000), pas sur salaire+benefice", () => {
    // retained1 = max(509, min(salary1*0.1=4000, 14555)) = 4000 (base = salaire 40000 SEUL).
    // rev1 = 40000 + 13200 - 4000 = 49200. Si l'abattement portait sur salaire+benefice
    //   (53200*0.1=5320), on aurait rev1 = 47880. rev1===49200 prouve l'abattement sur le seul salaire.
    const d = concubins({ salary1: "40000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true, person2PcsGroupe: "4", person2Csp: "47", salary2: "30000" });
    const r = computeIR(d as any, STD_OPTIONS);
    expect(r.rev1).toBe(49200);
    expect(r.rev1).not.toBe(47880);
  });
});

// ─── Lot C2 : alignement budget/endettement sur l'opt-in salaire ──────────────
// resolveSalaireRetenu (predicat unique) est desormais consomme par computeIR ET
// par computeTauxEndettement / computeBudget : un salaire dormant d'un TNS sans
// opt-in est ignore partout ; avec opt-in 'salariat', il compte partout.
describe("cumul salarie+TNS — alignement moteurs budget/endettement (Lot C2)", () => {
  // TNS BIC (groupe 2) micro services, ca=50000 => benefice 25000 ; salary1=30000.
  const tnsBase = { person1PcsGroupe: "2", person1Csp: "21", ca1: "50000", microRegime1: true, bicType1: "services", salary1: "30000" };

  it("T1 : salaire dormant d'un TNS SANS opt-in -> ignore par budget ET endettement", () => {
    // activiteSecondaire1 absent => resolveSalaireRetenu(1) = 0 (masque). benefice1 = 25000.
    // endettement : denominateur = salaires(0) + pensions(0) + loyers(0) + benefice(25000) = 25000.
    // budget : salairesPensions = 0 ; beneficeTns = 25000/12 = 2083,33.
    const t1 = mk(tnsBase);
    expect(computeTauxEndettement(t1 as any).denominateurAnnuel).toBe(25000);
    const ir1 = computeIR(t1 as any, STD_OPTIONS);
    const bud1 = computeBudget(t1 as any, ir1);
    expect(bud1.detail.salairesPensions).toBe(0);
    expect(bud1.detail.beneficeTns).toBeCloseTo(2083.33, 2);
  });

  it("T2 : meme dossier avec activiteSecondaire='salariat' -> le salaire compte partout (coherence IR/budget/endettement)", () => {
    // opt-in => resolveSalaireRetenu(1) = 30000 ; benefice1 = 25000 inchange.
    // IR : salaries = 55000 ; finalIR = 8703,99 (== C2 du Lot A).
    // endettement : denominateur = 30000 + 25000 = 55000 (== IR salaries, pensions/loyers nuls).
    // budget : salairesPensions = 30000/12 = 2500 ; beneficeTns = 2083,33.
    const t2 = mk({ ...tnsBase, activiteSecondaire1: "salariat" });
    const ir2 = computeIR(t2 as any, STD_OPTIONS);
    expect(ir2.salaries).toBe(55000);
    expect(ir2.finalIR).toBeCloseTo(8703.99, 2);
    const end2 = computeTauxEndettement(t2 as any);
    expect(end2.denominateurAnnuel).toBe(55000);
    expect(end2.denominateurAnnuel).toBe(ir2.salaries); // coherence cross-moteur
    const bud2 = computeBudget(t2 as any, ir2);
    expect(bud2.detail.salairesPensions).toBeCloseTo(2500, 2);
    expect(bud2.detail.beneficeTns).toBeCloseTo(2083.33, 2);
  });

  it("T3 : iso IR — C1 et C2 du Lot A inchanges au centime apres extraction de resolveSalaireRetenu", () => {
    const c1 = mk({ salary1: "40000", activiteSecondaire1: "bnc", ca1: "20000", microRegime1: true });
    const c2 = mk({ person1PcsGroupe: "2", person1Csp: "21", ca1: "50000", microRegime1: true, activiteSecondaire1: "salariat", salary1: "30000" });
    expect(computeIR(c1 as any, STD_OPTIONS).finalIR).toBeCloseTo(7863.99, 2);
    expect(computeIR(c2 as any, STD_OPTIONS).finalIR).toBeCloseTo(8703.99, 2);
  });
});
