// Calcul IR — barème, QF, PFU, foncier, PER, concubinage
import type { PatrimonialData, IrOptions, TaxBracket } from '../../types/patrimoine';
import { n, computeTaxFromBrackets, isAV, isPERType, fractionRVTO, getHandicapAbattement,
  getChildrenFiscalParts, getBaseFiscalParts, computeIRConcubin, getQuotientCapPerHalfPart,
  isProfessionLiberale, computeKilometricAllowance } from './utils';
import { resolveLoanValuesMulti } from './credit';

// ─── CALCUL IR ────────────────────────────────────────────────────────────────

// ─── Calcul bénéfice imposable indépendant ────────────────────────────────────
// Abattements micro 2025 (source impots.gouv.fr) :
//   BIC vente/achat-revente : 71% (seuil 188 700€)
//   BIC prestations de services : 50% (seuil 77 700€)
//   BNC professions libérales : 34% (seuil 77 700€)
//   Abattement minimum : 305€
// Seuils micro 2025
export const SEUIL_MICRO_BA           = 120000; // moyenne triennale 2024-2025
export const SEUIL_MICRO_BNC          = 77700;
export const SEUIL_MICRO_BIC_SERVICES = 77700;
export const SEUIL_MICRO_BIC_VENTE    = 188700;

export function computeBeneficeImposable(
  ca: number,
  bicType: string,         // "vente" | "services"
  isBNC: boolean,          // true = BNC (profession libérale)
  isBA: boolean,           // true = bénéfice agricole
  microRegime: boolean,    // true = micro, false = réel
  chargesReelles: number,  // charges réelles si régime réel
  baRevenue: number,       // bénéfice agricole net si BA réel
): number {
  if (isBA) {
    if (microRegime) {
      // Micro-BA : abattement 87% sur recettes brutes
      if (ca <= 0) return 0;
      const abattement = Math.max(305, ca * 0.87);
      return Math.max(0, ca - abattement);
    }
    // Réel : ca contient le bénéfice net (même champ, label différent)
    return ca;
  }
  if (ca <= 0) return 0;
  if (microRegime) {
    const abattementRate = isBNC ? 0.34 : (bicType === "vente" ? 0.71 : 0.50);
    const abattement = Math.max(305, ca * abattementRate);
    return Math.max(0, ca - abattement);
  }
  // Régime réel : CA - charges réelles
  return Math.max(0, ca - chargesReelles);
}

export function computeIR(data: PatrimonialData, irOptions: IrOptions, activeConcubinPerson: 1 | 2 = 1) {
  // ── Revenus selon PCS ──
  const g1 = data.person1PcsGroupe;
  const g2 = data.person2PcsGroupe;
  const cat1 = data.person1Csp;
  const cat2 = data.person2Csp;

  const isIndep1 = g1 === "1" || g1 === "2" || isProfessionLiberale(cat1);
  const isIndep2 = g2 === "1" || g2 === "2" || isProfessionLiberale(cat2);
  const isBA1 = g1 === "1";
  const isBA2 = g2 === "1";
  const isBNC1 = isProfessionLiberale(cat1);
  const isBNC2 = isProfessionLiberale(cat2);

  // Bénéfice imposable indépendants
  const benefice1 = isIndep1
    ? computeBeneficeImposable(n(data.ca1), data.bicType1, isBNC1, isBA1, data.microRegime1, n(data.chargesReelles1), n(data.baRevenue1))
    : 0;
  const benefice2 = isIndep2
    ? computeBeneficeImposable(n(data.ca2), data.bicType2, isBNC2, isBA2, data.microRegime2, n(data.chargesReelles2), n(data.baRevenue2))
    : 0;

  // Salaires (uniquement pour les non-indépendants)
  const salary1 = isIndep1 ? 0 : n(data.salary1);
  const salary2 = isIndep2 ? 0 : n(data.salary2);
  // Retraites / pensions nominatives par personne (rétrocompatibilité si champ global)
  const pensionP1 = n(data.pensions1 || "");
  const pensionP2 = n(data.pensions2 || "");
  // Si les champs nominatifs ne sont pas renseignés, fallback sur le champ global (données migrées)
  const pensions = pensionP1 + pensionP2 > 0 ? pensionP1 + pensionP2 : n(data.pensions);
  // Pour le plafond PER par personne : pensions attribuées nominativement
  const pensionForP2 = pensionP2 > 0 ? pensionP2 : (pensionP1 === 0 && pensionP2 === 0 ? n(data.pensions) : 0);
  const salaries = salary1 + salary2 + pensions + benefice1 + benefice2;

  const kmAllowance1 = irOptions.expenseMode1 === "actual" ? computeKilometricAllowance(n(irOptions.km1), n(irOptions.cv1)) : 0;
  const kmAllowance2 = irOptions.expenseMode2 === "actual" ? computeKilometricAllowance(n(irOptions.km2), n(irOptions.cv2)) : 0;
  const mealExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.mealCount1) * n(irOptions.mealUnit1) : 0;
  const mealExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.mealCount2) * n(irOptions.mealUnit2) : 0;
  const otherExpenses1 = irOptions.expenseMode1 === "actual" ? n(irOptions.other1) : 0;
  const otherExpenses2 = irOptions.expenseMode2 === "actual" ? n(irOptions.other2) : 0;

  // Frais déductibles : uniquement pour les salariés (les indépendants déduisent via charges réelles)
  const retained1 = isIndep1 ? 0 : (irOptions.expenseMode1 === "actual"
    ? kmAllowance1 + mealExpenses1 + otherExpenses1
    : salary1 * 0.1);
  const retained2 = isIndep2 ? 0 : (irOptions.expenseMode2 === "actual"
    ? kmAllowance2 + mealExpenses2 + otherExpenses2
    : salary2 * 0.1);
  const retainedExpenses = retained1 + retained2 + pensions * 0.1;

  // Enfants non rattachés → leur ownership exclut leurs biens de l'IR/IFI du foyer
  const nonRattachedChildIndexes = new Set(
    data.childrenData
      .map((c, i) => c.rattached === false ? `child_${i}` : null)
      .filter(Boolean)
  );
  const isOwnedByNonRattached = (ownership: string) => nonRattachedChildIndexes.has(ownership);

  let foncierBrut = 0;
  let foncierCharges = 0;
  let foncierInterests = 0;
  for (const property of data.properties) {
    if (isOwnedByNonRattached(property.ownership)) continue; // exclu : appartient à un enfant non rattaché
    if (["Location nue", "SCI IR", "SCI IS", "LMNP", "LMP", "Local professionnel", "Autre"].includes(property.type)) {
      const ltype = property.loanType || "amortissable";
      const isLocatif = ["Location nue", "SCI IR", "SCI IS", "LMNP", "LMP", "Local professionnel"].includes(property.type);
      // Charges communes à tous régimes
      foncierBrut += n(property.rentGrossAnnual);
      // Multi-crédits : agréger primes assurance de tous les crédits
      const lv = resolveLoanValuesMulti(property);
      foncierCharges += n(property.propertyTaxAnnual) + n(property.insuranceAnnual) + n(property.worksAnnual) + n(property.otherChargesAnnual)
        + lv.insurancePremiumAnnual;
      if (isLocatif && irOptions.foncierRegime === "real") {
        // Intérêts déductibles : somme de tous les crédits (hors PTZ)
        if (property.loans && property.loans.length > 0) {
          for (const r of lv.loans) {
            if (r.loan.type !== "ptz") foncierInterests += r.interestAnnual;
          }
        } else {
          const ltypeLegacy = property.loanType || "amortissable";
          if (ltypeLegacy !== "ptz") {
            foncierInterests += lv.interestAnnual > 0 ? lv.interestAnnual : n(property.loanInterestAnnual);
          }
        }
      } else if (!isLocatif || ltype === "ptz") {
        // Non déductible
      } else {
        foncierInterests += n(property.loanInterestAnnual);
      }
    }
  }

  const taxableFonciers = irOptions.foncierRegime === "real"
    ? Math.max(0, foncierBrut - foncierCharges - foncierInterests)
    : Math.max(0, foncierBrut * 0.7);
  const foncierSocialLevy = taxableFonciers * 0.172;

  let taxablePlacements = 0;
  let pfuBase = 0;
  let avRachatImpot = 0; // Fiscalité AV rachat (PFU + prélèvements sociaux)
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";

  for (const placement of data.placements) {
    if (isOwnedByNonRattached(placement.ownership)) continue; // exclu : appartient à un enfant non rattaché
    if (!isAV(placement.type)) {
      taxablePlacements += n(placement.taxableIncome);
      // PFU : seulement si éligible ET pas d'option barème
      if (placement.pfuEligible && !placement.pfuOptOut) pfuBase += n(placement.taxableIncome);
      // Option barème : les revenus vont dans le revenu net global
      if (placement.pfuEligible && placement.pfuOptOut) taxablePlacements += n(placement.taxableIncome);
    } else {
      const retrait = n(placement.annualWithdrawal || "");
      if (retrait > 0) {
        const valeur = n(placement.value);
        const primesNettes = n(placement.totalPremiumsNet);
        const plusValues = Math.max(0, valeur - primesNettes);
        const ratioGain = valeur > 0 ? plusValues / valeur : 0;
        const gainBrut = retrait * ratioGain;
        const dateOuv = placement.openDate ? new Date(placement.openDate) : null;
        const ageAns = dateOuv ? (Date.now() - dateOuv.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 0;
        const over8 = ageAns >= 8;
        const abattement = over8 ? (isCouple ? 9200 : 4600) : 0;
        const gainNetAbatt = Math.max(0, gainBrut - abattement);
        if (gainNetAbatt > 0) {
          if (over8) {
            if (primesNettes > 150000) {
              // Partie prop. au-delà de 150k → PFU 30% ; en dessous → PFLi 7.5% + PS 17.2%
              const ratioAbove = Math.min(1, (primesNettes - 150000) / primesNettes);
              avRachatImpot += gainNetAbatt * ratioAbove * 0.314; // PFU 31,4%
              avRachatImpot += gainNetAbatt * (1 - ratioAbove) * (0.075 + 0.186); // PFLi 7,5% + PS 18,6%
            } else {
              avRachatImpot += gainNetAbatt * (0.075 + 0.186); // PFLi 7,5% + PS 18,6%
            }
          } else {
            avRachatImpot += gainNetAbatt * 0.314; // PFU 31,4%
          }
        }
      }
    }
  }

  // ── Calcul PER par personne + plafond individuel ──
  function isPER(type: string) { return ["PER bancaire", "PER assurantiel", "Madelin"].includes(type); }
  const PASS_2026 = 47100; // PASS 2026

  // Helper plafond PER par revenu/statut
  function calcPlafondPER(revenu: number, isIndep: boolean): number {
    if (isIndep) {
      // TNS : max(bénéfice × 10%, PASS × 10%) + 15% × fraction entre 1 et 8 PASS
      const base = Math.max(revenu * 0.10, PASS_2026 * 0.10);
      const fractionSup = Math.max(0, Math.min(revenu, 8 * PASS_2026) - PASS_2026);
      return Math.min(base + fractionSup * 0.15, PASS_2026 * (0.10 * 8 + 0.15 * 7));
    } else {
      // Salarié : 10% revenus N-1, min 4 771 €, max 37 680 € (= 10% × 8 PASS 2026)
      return Math.min(Math.max(revenu * 0.10, PASS_2026 * 0.10), PASS_2026 * 0.10 * 8);
    }
  }

  const revP1 = isIndep1 ? benefice1 : salary1;
  const revP2 = isIndep2 ? benefice2 : (salary2 + pensionForP2); // pensions nominatives P2
  const plafondPER1 = calcPlafondPER(revP1, isIndep1);
  const plafondPER2 = calcPlafondPER(revP2, isIndep2);

  // Versements PER par personne (ownership = person1 ou person2 ou child_X)
  const perP1Deductible = data.placements
    .filter(p => isPER(p.type) && p.ownership === "person1" && p.perDeductible !== false)
    .reduce((sum, p) => sum + n(p.annualContribution || ""), 0);
  const perP2Deductible = data.placements
    .filter(p => isPER(p.type) && p.ownership === "person2" && p.perDeductible !== false)
    .reduce((sum, p) => sum + n(p.annualContribution || ""), 0);

  // Total déductible = min(versements, plafond) par personne
  const perDeductionCalc = Math.min(perP1Deductible, plafondPER1) + Math.min(perP2Deductible, plafondPER2)
    + (perP1Deductible === 0 && perP2Deductible === 0 ? n(data.perDeduction) : 0); // fallback saisie manuelle

  // Plafond global (pour affichage — somme des deux)
  const plafondPER = plafondPER1 + plafondPER2;

  // ── Retrait PER en capital : capital au barème, intérêts au PFU ──
  let perCapitalImposable = 0;   // s'ajoute au revenu net global (barème)
  let perInteretsPFU = 0;        // imposé au PFU 31,4%
  for (const p of data.placements) {
    if (!isPER(p.type)) continue;
    const retrait = n(p.perWithdrawal || "");
    if (retrait <= 0) continue;
    if (p.perAnticiped) {
      // Déblocage anticipé : capital exonéré, intérêts PFU
      const capital = n(p.perWithdrawalCapital || "");
      const interets = n(p.perWithdrawalInterest || "");
      perInteretsPFU += interets > 0 ? interets : Math.max(0, retrait - capital);
    } else {
      // Sortie normale retraite : capital au barème + intérêts PFU
      const capital = n(p.perWithdrawalCapital || "");
      const interets = n(p.perWithdrawalInterest || "");
      // Si ventilation manuelle renseignée, l'utiliser ; sinon calcul auto depuis encours/versements
      const encours = n(p.value);
      const versements = n(p.annualContribution || "");
      const ratioCapital = encours > 0 && versements > 0
        ? Math.min(1, versements / encours)
        : (capital > 0 || interets > 0 ? 0 : 0.5); // fallback 50/50 si rien de renseigné
      perCapitalImposable += capital > 0 ? capital : retrait * ratioCapital;
      perInteretsPFU += interets > 0 ? interets : retrait * (1 - ratioCapital);
    }
  }

  // ── Rentes PER (RVTO) : fraction imposable au barème + PS 17,2% ──
  let perRentesImposable = 0;
  let perRentesPS = 0;
  for (const r of (data.perRentes || [])) {
    const montant = n(r.annualAmount || "");
    const age = Math.max(0, n(r.ageAtFirst || "0"));
    const fraction = fractionRVTO(age);
    perRentesImposable += montant * fraction;
    perRentesPS += montant * fraction * 0.172;
  }

  const deductibleCharges = perDeductionCalc + n(data.pensionDeductible) + n(data.otherDeductible)
    + n(data.csgDeductibleFoncier); // CSG déductible revenus fonciers N-1 (6,8% des rev. fonciers nets — ligne 6DE)
  // Abattement handicap personne 1 et/ou 2 — CGI art. 157 bis (2 627 € si rev ≤ 16 410 €, 1 313 € si ≤ 26 831 €)
  const handicapAbatt1 = data.person1Handicap ? getHandicapAbattement(n(data.salary1) + n(data.ca1) + n(data.baRevenue1)) : 0;
  const handicapAbatt2 = data.person2Handicap ? getHandicapAbattement(n(data.salary2) + n(data.ca2) + n(data.baRevenue2)) : 0;
  const handicapAbatt = handicapAbatt1 + handicapAbatt2;
  const revenuNetGlobal = Math.max(0, salaries + taxableFonciers + taxablePlacements + perCapitalImposable + perRentesImposable - retainedExpenses - deductibleCharges - handicapAbatt);

  // ── Réduction d'impôt forfait scolaire — art. 199 quater B CGI ──
  // Collège : 61 €/enfant | Lycée : 153 €/enfant | Supérieur : 183 €/enfant
  const FORFAIT_SCOLAIRE: Record<string, number> = { college: 61, lycee: 153, superieur: 183 };
  const forfaitScolaireReduction = data.childrenData
    .filter(c => c.rattached !== false)
    .reduce((sum, child) => sum + (FORFAIT_SCOLAIRE[(child.schoolLevel || "").toLowerCase()] || 0), 0);

  const isConcubin = data.coupleStatus === "cohab";

  // ── Concubinage : 2 foyers séparés ──────────────────────────────
  if (isConcubin) {
    const childrenParts = getChildrenFiscalParts(data.childrenData);
    // Enfants rattachés à la personne dont c'est le foyer (déterminé par qui a les enfants)
    const childrenP1 = data.childrenData.filter(c => c.rattached !== false && (c.parentLink === "common_child" || c.parentLink === "person1_only"));
    const childrenP2 = data.childrenData.filter(c => c.rattached !== false && c.parentLink === "person2_only");
    const partsChildP1 = getChildrenFiscalParts(childrenP1);
    const partsChildP2 = getChildrenFiscalParts(childrenP2);
    // Parts de base : 1 part chacun + enfants selon parenté
    const parts1 = 1 + partsChildP1 + (partsChildP2 === 0 && childrenParts > 0 ? childrenParts - partsChildP1 : 0);
    // Si aucun enfant n'est "person2_only", tous vont à p1 par défaut
    const parts2 = 1 + partsChildP2;
    // Revenus de chaque personne (foncier et placements partagés à parts égales)
    const rev1 = Math.max(0, (isIndep1 ? benefice1 : salary1) - retained1 + taxableFonciers / 2 + taxablePlacements / 2 - deductibleCharges / 2);
    const rev2 = Math.max(0, (isIndep2 ? benefice2 : (salary2 + pensionForP2)) - retained2 + taxableFonciers / 2 + taxablePlacements / 2 - deductibleCharges / 2);
    const r1 = computeIRConcubin(rev1, parts1);
    const r2 = computeIRConcubin(rev2, parts2);
    const totalPFU = pfuBase * 0.314 + perInteretsPFU * 0.314; // PFU 31,4% = 12,8% IR + 18,6% PS — dividendes, intérêts, PV mob. (LFSS 2026)
    const finalIR = Math.max(0, r1.bareme + r2.bareme + totalPFU + foncierSocialLevy + avRachatImpot + perRentesPS - forfaitScolaireReduction);
    const averageRate = revenuNetGlobal > 0 ? finalIR / revenuNetGlobal : 0;
    const brackets: TaxBracket[] = [
      { from: 0, to: 11600, rate: 0 }, { from: 11600, to: 29579, rate: 0.11 },
      { from: 29579, to: 84577, rate: 0.3 }, { from: 84577, to: 181917, rate: 0.41 },
      { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
    ];
    // Données pour la personne active (affichage)
    const rActive = activeConcubinPerson === 2 ? r2 : r1;
    const partsActive = activeConcubinPerson === 2 ? parts2 : parts1;
    const revActive = activeConcubinPerson === 2 ? rev2 : rev1;
    const bracketFill = computeTaxFromBrackets(rActive.quotient, brackets).fill;
    const currentBracket = bracketFill.find((s) => rActive.quotient <= s.to) || bracketFill[bracketFill.length - 1];
    const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(rActive.quotient, 1);
    return {
      salaries, retainedExpenses, foncierBrut, foncierCharges, foncierInterests,
      taxableFonciers, foncierSocialLevy, taxablePlacements, pfuBase, deductibleCharges,
      revenuNetGlobal: revActive, finalIR, totalPFU, forfaitScolaireReduction,
      bareme: rActive.bareme, quotient: rActive.quotient, parts: partsActive,
      quotientFamilialCapAdjustment: 0, qfBenefit: 0, qfCap: 0,
      marginalRate: rActive.marginalRate, averageRate,
      bracketFill, currentBracketLabel: currentBracket.label,
      indicatorPct: visualMax > 0 ? Math.min(100, (rActive.quotient / visualMax) * 100) : 0, visualMax,
      avRachatImpot, perCapitalImposable, perInteretsPFU, perRentesImposable, perRentesPS, isConcubin: true, ir1: r1.bareme, ir2: r2.bareme,
      rev1, rev2, parts1, parts2, plafondPER, plafondPER1, plafondPER2, perDeductionCalc, perP1Deductible, perP2Deductible,
    };
  }

  // ── Foyer commun (marié, pacsé, célibataire) ─────────────────────
  const baseParts = getBaseFiscalParts(data);
  const childrenParts = getChildrenFiscalParts(data.childrenData);
  // Demi-part supplémentaire si personne du foyer titulaire carte invalidité — CGI art. 195-1
  // (s'ajoute aux parts de base — plafond QF 1 785 € par demi-part supplémentaire)
  const handicapPersonParts = (data.person1Handicap ? 0.5 : 0) + (data.person2Handicap ? 0.5 : 0);
  const parts = Math.max(1, baseParts + childrenParts + handicapPersonParts + (data.singleParent ? 0.5 : 0));
  const quotient = revenuNetGlobal / parts;

  const brackets: TaxBracket[] = [
    { from: 0, to: 11600, rate: 0 },
    { from: 11600, to: 29579, rate: 0.11 },
    { from: 29579, to: 84577, rate: 0.3 },
    { from: 84577, to: 181917, rate: 0.41 },
    { from: 181917, to: Number.POSITIVE_INFINITY, rate: 0.45 },
  ];

  const taxWithParts = computeTaxFromBrackets(quotient, brackets).tax * parts;
  const taxWithBaseParts = computeTaxFromBrackets(revenuNetGlobal / baseParts, brackets).tax * baseParts;
  const addedHalfParts = Math.max(0, parts - baseParts);
  const qfCap = getQuotientCapPerHalfPart() * (addedHalfParts / 0.5);
  const qfBenefit = Math.max(0, taxWithBaseParts - taxWithParts);
  const quotientFamilialCapAdjustment = qfBenefit > qfCap ? qfBenefit - qfCap : 0;
  const bareme = taxWithParts + quotientFamilialCapAdjustment;
  const bracketFill = computeTaxFromBrackets(quotient, brackets).fill;
  const totalPFU = pfuBase * 0.314 + perInteretsPFU * 0.314; // PFU 31,4% = 12,8% IR + 18,6% PS — dividendes, intérêts, PV mob. (LFSS 2026)
  const finalIR = Math.max(0, bareme + totalPFU + foncierSocialLevy + avRachatImpot + perRentesPS - forfaitScolaireReduction);

  const marginalRate = quotient <= 11600 ? 0 : quotient <= 29579 ? 0.11 : quotient <= 84577 ? 0.3 : quotient <= 181917 ? 0.41 : 0.45;
  const averageRate = revenuNetGlobal > 0 ? finalIR / revenuNetGlobal : 0;
  const currentBracket = bracketFill.find((s) => quotient <= s.to) || bracketFill[bracketFill.length - 1];
  const visualMax = Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(quotient, 1);
  const indicatorPct = visualMax > 0 ? Math.min(100, Math.max(0, (quotient / visualMax) * 100)) : 0;

  return {
    salaries, retainedExpenses, foncierBrut, foncierCharges, foncierInterests,
    taxableFonciers, foncierSocialLevy, taxablePlacements, pfuBase, deductibleCharges,
    revenuNetGlobal, finalIR, totalPFU, forfaitScolaireReduction, bareme, quotient, parts,
    quotientFamilialCapAdjustment, qfBenefit, qfCap, marginalRate, averageRate,
    bracketFill, currentBracketLabel: currentBracket.label, indicatorPct, visualMax,
    avRachatImpot, perCapitalImposable, perInteretsPFU, perRentesImposable, perRentesPS, isConcubin: false, plafondPER, plafondPER1, plafondPER2, perDeductionCalc, perP1Deductible, perP2Deductible,
  };
}
