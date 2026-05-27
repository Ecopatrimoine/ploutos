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
  // Abattement 10% salaires — plafonné 14 555 €, plancher 509 € par personne (revenus 2025)
  const retained1 = isIndep1 ? 0 : (irOptions.expenseMode1 === "actual"
    ? kmAllowance1 + mealExpenses1 + otherExpenses1
    : salary1 > 0 ? Math.max(509, Math.min(salary1 * 0.1, 14555)) : 0);
  const retained2 = isIndep2 ? 0 : (irOptions.expenseMode2 === "actual"
    ? kmAllowance2 + mealExpenses2 + otherExpenses2
    : salary2 > 0 ? Math.max(509, Math.min(salary2 * 0.1, 14555)) : 0);
  // Abattement 10% pensions — plancher 454 € par pensionné, plafond 4 439 € par foyer (revenus 2025)
  const pensionAbatt1 = pensionP1 > 0 ? Math.max(454, pensionP1 * 0.1) : 0;
  const pensionAbatt2 = pensionP2 > 0 ? Math.max(454, pensionP2 * 0.1) : 0;
  const pensionAbattFoyer = (pensionP1 + pensionP2 > 0)
    ? Math.min(pensionAbatt1 + pensionAbatt2, 4439)
    // Cas legacy (champ global, pas de ventilation) : 1 seul pensionné
    : (n(data.pensions) > 0 ? Math.min(Math.max(454, n(data.pensions) * 0.1), 4439) : 0);
  const retainedExpenses = retained1 + retained2 + pensionAbattFoyer;

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

  // Déficit foncier — CGI art. 156-I-3° (régime réel uniquement)
  // Intérêts imputés d'abord sur les loyers ; seul le déficit hors intérêts s'impute
  // sur le revenu global (plafond 10 700 €) ; le surplus est reportable (informatif).
  let taxableFonciers: number;
  let deficitFoncierImpute = 0;    // part imputée sur revenu global (≤ 10 700)
  let deficitFoncierReportable = 0; // informatif — à reporter sur revenus fonciers futurs
  if (irOptions.foncierRegime === "real") {
    const resultatBrut = foncierBrut - foncierCharges - foncierInterests;
    if (resultatBrut >= 0) {
      taxableFonciers = resultatBrut;
    } else {
      // Déficit : ventiler intérêts vs charges hors intérêts
      const interetsAbsorbes = Math.min(foncierInterests, foncierBrut);
      const interetsNonAbsorbes = foncierInterests - interetsAbsorbes;
      const loyersApresInterets = foncierBrut - interetsAbsorbes;
      const deficitHorsInterets = Math.max(0, foncierCharges - loyersApresInterets);
      deficitFoncierImpute = Math.min(deficitHorsInterets, 10700);
      deficitFoncierReportable = interetsNonAbsorbes + Math.max(0, deficitHorsInterets - 10700);
      taxableFonciers = -deficitFoncierImpute; // négatif → réduit le revenu global
    }
  } else {
    taxableFonciers = Math.max(0, foncierBrut * 0.7);
  }
  const foncierSocialLevy = Math.max(0, taxableFonciers) * 0.172; // PS uniquement sur revenu foncier positif

  let taxablePlacements = 0;
  let pfuBase = 0;
  let avRachatImpot = 0; // Fiscalité AV rachat (PFU + prélèvements sociaux)
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";

  for (const placement of data.placements) {
    if (isOwnedByNonRattached(placement.ownership)) continue; // exclu : appartient à un enfant non rattaché
    if (!isAV(placement.type)) {
      if (placement.pfuEligible && !placement.pfuOptOut) {
        pfuBase += n(placement.taxableIncome);          // PFU : taxé à part (31,4%)
      } else {
        taxablePlacements += n(placement.taxableIncome); // Barème : une seule fois
      }
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
              // Partie prop. au-delà de 150k → 12,8% IR + 17,2% PS ; en dessous → PFLi 7,5% + 17,2% PS
              // AV exclue de la hausse LFSS 2026 : PS restent à 17,2% (CSG 9,2% + CRDS 0,5% + solidarité 7,5%)
              const ratioAbove = Math.min(1, (primesNettes - 150000) / primesNettes);
              avRachatImpot += gainNetAbatt * ratioAbove * 0.30; // 12,8% IR + 17,2% PS
              avRachatImpot += gainNetAbatt * (1 - ratioAbove) * (0.075 + 0.172); // PFLi 7,5% + PS 17,2%
            } else {
              avRachatImpot += gainNetAbatt * (0.075 + 0.172); // PFLi 7,5% + PS 17,2%
            }
          } else {
            avRachatImpot += gainNetAbatt * 0.30; // 12,8% IR + 17,2% PS (AV exclue hausse LFSS 2026)
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
    // ── Ventilation des revenus par propriétaire réel ──────────────
    // Helper : quote-part d'un bien pour une personne donnée
    const ownerShare = (ownership: string, personKey: "person1" | "person2", prop?: { indivisionShare1?: string; indivisionShare2?: string }) => {
      if (ownership === personKey) return 1;
      if (ownership === (personKey === "person1" ? "person2" : "person1")) return 0;
      if (ownership === "common") return 0.5;
      if (ownership === "indivision" && prop) {
        const s = personKey === "person1" ? n(prop.indivisionShare1) : n(prop.indivisionShare2);
        return s > 0 ? Math.min(1, s / 100) : 0.5; // fallback 50/50 si non renseigné
      }
      return 0; // child_* ou autre → hors foyer
    };

    // ── Foncier ventilé par personne ──
    let foncierBrut1 = 0, foncierCharges1 = 0, foncierInterests1 = 0;
    let foncierBrut2 = 0, foncierCharges2 = 0, foncierInterests2 = 0;
    for (const property of data.properties) {
      if (isOwnedByNonRattached(property.ownership)) continue;
      if (!["Location nue", "SCI IR", "SCI IS", "LMNP", "LMP", "Local professionnel", "Autre"].includes(property.type)) continue;
      const s1 = ownerShare(property.ownership, "person1", property);
      const s2 = ownerShare(property.ownership, "person2", property);
      const rent = n(property.rentGrossAnnual);
      const lv = resolveLoanValuesMulti(property);
      const charges = n(property.propertyTaxAnnual) + n(property.insuranceAnnual) + n(property.worksAnnual) + n(property.otherChargesAnnual) + lv.insurancePremiumAnnual;
      let interests = 0;
      const isLocatif = ["Location nue", "SCI IR", "SCI IS", "LMNP", "LMP", "Local professionnel"].includes(property.type);
      if (isLocatif && irOptions.foncierRegime === "real") {
        if (property.loans && property.loans.length > 0) {
          for (const r of lv.loans) { if (r.loan.type !== "ptz") interests += r.interestAnnual; }
        } else {
          const lt = property.loanType || "amortissable";
          if (lt !== "ptz") interests += lv.interestAnnual > 0 ? lv.interestAnnual : n(property.loanInterestAnnual);
        }
      }
      foncierBrut1 += rent * s1; foncierCharges1 += charges * s1; foncierInterests1 += interests * s1;
      foncierBrut2 += rent * s2; foncierCharges2 += charges * s2; foncierInterests2 += interests * s2;
    }

    // Déficit foncier par personne (même logique #6, plafond 10 700 € par personne)
    const calcFoncierPerson = (brut: number, charges: number, interests: number) => {
      if (irOptions.foncierRegime !== "real") return { taxable: Math.max(0, brut * 0.7), impute: 0, reportable: 0 };
      const resultat = brut - charges - interests;
      if (resultat >= 0) return { taxable: resultat, impute: 0, reportable: 0 };
      const interetsAbsorbes = Math.min(interests, brut);
      const interetsNonAbsorbes = interests - interetsAbsorbes;
      const loyersApresInterets = brut - interetsAbsorbes;
      const deficitHorsInterets = Math.max(0, charges - loyersApresInterets);
      const impute = Math.min(deficitHorsInterets, 10700);
      const reportable = interetsNonAbsorbes + Math.max(0, deficitHorsInterets - 10700);
      return { taxable: -impute, impute, reportable };
    };
    const foncier1 = calcFoncierPerson(foncierBrut1, foncierCharges1, foncierInterests1);
    const foncier2 = calcFoncierPerson(foncierBrut2, foncierCharges2, foncierInterests2);

    // PS foncier par personne (uniquement sur la part positive)
    const foncierPS1 = Math.max(0, foncier1.taxable) * 0.172;
    const foncierPS2 = Math.max(0, foncier2.taxable) * 0.172;

    // ── Placements ventilés par personne (hors AV) ──
    let taxablePlac1 = 0, taxablePlac2 = 0, pfuBase1 = 0, pfuBase2 = 0;
    for (const placement of data.placements) {
      if (isOwnedByNonRattached(placement.ownership)) continue;
      if (isAV(placement.type)) continue; // AV traité séparément (avRachatImpot global)
      const s1 = ownerShare(placement.ownership, "person1");
      const s2 = ownerShare(placement.ownership, "person2");
      const income = n(placement.taxableIncome);
      if (placement.pfuEligible && !placement.pfuOptOut) {
        pfuBase1 += income * s1; pfuBase2 += income * s2;
      } else {
        taxablePlac1 += income * s1; taxablePlac2 += income * s2;
      }
    }

    // ── PER ventilé par personne ──
    const perDeduction1 = Math.min(perP1Deductible, plafondPER1);
    const perDeduction2 = Math.min(perP2Deductible, plafondPER2);

    // PER retraits capital ventilés par personne
    let perCapital1 = 0, perCapital2 = 0, perInteretsPFU1 = 0, perInteretsPFU2 = 0;
    for (const p of data.placements) {
      if (!isPER(p.type)) continue;
      const retrait = n(p.perWithdrawal || "");
      if (retrait <= 0) continue;
      const isP1 = p.ownership === "person1";
      if (p.perAnticiped) {
        const capital = n(p.perWithdrawalCapital || "");
        const interets = n(p.perWithdrawalInterest || "");
        const pfu = interets > 0 ? interets : Math.max(0, retrait - capital);
        if (isP1) perInteretsPFU1 += pfu; else perInteretsPFU2 += pfu;
      } else {
        const capital = n(p.perWithdrawalCapital || "");
        const interets = n(p.perWithdrawalInterest || "");
        const encours = n(p.value);
        const versements = n(p.annualContribution || "");
        const ratioCapital = encours > 0 && versements > 0
          ? Math.min(1, versements / encours)
          : (capital > 0 || interets > 0 ? 0 : 0.5);
        const cap = capital > 0 ? capital : retrait * ratioCapital;
        const int = interets > 0 ? interets : retrait * (1 - ratioCapital);
        if (isP1) { perCapital1 += cap; perInteretsPFU1 += int; } else { perCapital2 += cap; perInteretsPFU2 += int; }
      }
    }

    // PER rentes ventilées par personne
    let perRentes1 = 0, perRentesPS1 = 0, perRentes2 = 0, perRentesPS2 = 0;
    for (const r of (data.perRentes || [])) {
      const montant = n(r.annualAmount || "");
      const fraction = fractionRVTO(Math.max(0, n(r.ageAtFirst || "0")));
      const imposable = montant * fraction;
      const ps = imposable * 0.172;
      if (r.owner === "person2") { perRentes2 += imposable; perRentesPS2 += ps; }
      else { perRentes1 += imposable; perRentesPS1 += ps; }
    }

    // ── Charges déductibles ventilées par personne ──
    // CSG déductible foncier : ventilée au prorata du foncier net imposable
    // de chaque personne (cohérent avec qui paye réellement la CSG).
    // Fallback 50/50 si aucun foncier (champ saisi par erreur).
    const csgFoncier = n(data.csgDeductibleFoncier);
    const foncierTaxableP1 = Math.max(0, foncier1.taxable);
    const foncierTaxableP2 = Math.max(0, foncier2.taxable);
    const totalFoncierNet = foncierTaxableP1 + foncierTaxableP2;
    const csgFoncierP1 = totalFoncierNet > 0 ? (csgFoncier * foncierTaxableP1 / totalFoncierNet) : csgFoncier / 2;
    const csgFoncierP2 = csgFoncier - csgFoncierP1;
    // Pension déductible + autres charges : pas de champ nominatif → 50/50
    // (à ventiler quand des champs payeur dédiés existeront)
    const autresNonVentilable = n(data.pensionDeductible) + n(data.otherDeductible);

    // ── Abattement handicap par personne ──
    const hAbatt1 = data.person1Handicap ? getHandicapAbattement(n(data.salary1) + n(data.ca1) + n(data.baRevenue1)) : 0;
    const hAbatt2 = data.person2Handicap ? getHandicapAbattement(n(data.salary2) + n(data.ca2) + n(data.baRevenue2)) : 0;

    // ── Revenus nets par personne ──
    const rev1 = Math.max(0, (isIndep1 ? benefice1 : salary1) + pensionP1 - retained1
      + foncier1.taxable + taxablePlac1 + perCapital1 + perRentes1
      - perDeduction1 - csgFoncierP1 - autresNonVentilable / 2 - hAbatt1);
    const rev2 = Math.max(0, (isIndep2 ? benefice2 : salary2) + pensionP2 - retained2
      + foncier2.taxable + taxablePlac2 + perCapital2 + perRentes2
      - perDeduction2 - csgFoncierP2 - autresNonVentilable / 2 - hAbatt2);

    const r1 = computeIRConcubin(rev1, parts1);
    const r2 = computeIRConcubin(rev2, parts2);
    // Décote concubinage — chaque foyer est un célibataire fiscal (897 € / seuil 1 982 €)
    const decote1 = r1.bareme > 0 && r1.bareme < 1982 ? Math.max(0, 897 - 0.4525 * r1.bareme) : 0;
    const decote2 = r2.bareme > 0 && r2.bareme < 1982 ? Math.max(0, 897 - 0.4525 * r2.bareme) : 0;
    const bareme1 = Math.max(0, r1.bareme - decote1);
    const bareme2 = Math.max(0, r2.bareme - decote2);
    // PFU ventilé par personne
    const totalPFU = (pfuBase1 + pfuBase2) * 0.314 + (perInteretsPFU1 + perInteretsPFU2) * 0.314;
    const finalIR = Math.max(0, bareme1 + bareme2 + totalPFU + foncierPS1 + foncierPS2 + avRachatImpot + perRentesPS1 + perRentesPS2 - forfaitScolaireReduction);
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
      taxableFonciers: foncier1.taxable + foncier2.taxable,
      foncierSocialLevy: foncierPS1 + foncierPS2,
      taxablePlacements: taxablePlac1 + taxablePlac2, pfuBase: pfuBase1 + pfuBase2, deductibleCharges,
      revenuNetGlobal: revActive, finalIR, totalPFU, forfaitScolaireReduction,
      bareme: activeConcubinPerson === 2 ? bareme2 : bareme1, quotient: rActive.quotient, parts: partsActive,
      quotientFamilialCapAdjustment: 0, qfBenefit: 0, qfCap: 0,
      marginalRate: rActive.marginalRate, averageRate,
      bracketFill, currentBracketLabel: currentBracket.label,
      indicatorPct: visualMax > 0 ? Math.min(100, (rActive.quotient / visualMax) * 100) : 0, visualMax,
      avRachatImpot, perCapitalImposable: perCapital1 + perCapital2,
      perInteretsPFU: perInteretsPFU1 + perInteretsPFU2,
      perRentesImposable: perRentes1 + perRentes2, perRentesPS: perRentesPS1 + perRentesPS2,
      isConcubin: true, ir1: bareme1, ir2: bareme2,
      rev1, rev2, parts1, parts2, plafondPER, plafondPER1, plafondPER2,
      perDeductionCalc: perDeduction1 + perDeduction2, perP1Deductible, perP2Deductible,
      deficitFoncierImpute: foncier1.impute + foncier2.impute,
      deficitFoncierReportable: foncier1.reportable + foncier2.reportable,
      // ── Détail par personne (audit IR concubins #3 : affichage TabIR) ──
      foncierBrut1, foncierBrut2,
      foncierCharges1, foncierCharges2,
      foncierInterests1, foncierInterests2,
      foncierTaxable1: foncier1.taxable, foncierTaxable2: foncier2.taxable,
      foncierPS1, foncierPS2,
      taxablePlac1, taxablePlac2,
      pfuBase1, pfuBase2,
      perInteretsPFU1, perInteretsPFU2,
      // PFU total par foyer (placements barème PFU + PER intérêts) × 31,4 %
      totalPFU1: (pfuBase1 + perInteretsPFU1) * 0.314,
      totalPFU2: (pfuBase2 + perInteretsPFU2) * 0.314,
      csgFoncierP1, csgFoncierP2,
      // IR total des 2 foyers (ir.finalIR est filtré sur la personne active dans
      // certaines vues, mais ici le total réel = bareme1 + bareme2 + PS + PFU)
      finalIR1: bareme1 + foncierPS1 + (pfuBase1 * 0.314) + (perInteretsPFU1 * 0.314) + perRentesPS1,
      finalIR2: bareme2 + foncierPS2 + (pfuBase2 * 0.314) + (perInteretsPFU2 * 0.314) + perRentesPS2,
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
  // Plafonnement QF — parent isolé (case T) : 1ère demi-part enfant plafonnée à 4 262 €,
  // les suivantes à 1 807 € (CGI art. 197-I-2, revenus 2025)
  const qfCapParentIsole = data.singleParent && childrenParts > 0 ? 4262 : 0;
  const qfCapStandard = addedHalfParts > 0
    ? (data.singleParent && childrenParts > 0
      ? qfCapParentIsole + getQuotientCapPerHalfPart() * ((addedHalfParts - 0.5) / 0.5)
      : getQuotientCapPerHalfPart() * (addedHalfParts / 0.5))
    : 0;
  const qfCap = qfCapStandard;
  const qfBenefit = Math.max(0, taxWithBaseParts - taxWithParts);
  const quotientFamilialCapAdjustment = qfBenefit > qfCap ? qfBenefit - qfCap : 0;
  const baremeBeforeDecote = taxWithParts + quotientFamilialCapAdjustment;
  // Décote — CGI art. 197-I-4 (LF 2026, revenus 2025)
  const decotePlafond = isCouple ? 1483 : 897;
  const decoteSeuil = isCouple ? 3277 : 1982;
  const decote = baremeBeforeDecote > 0 && baremeBeforeDecote < decoteSeuil
    ? Math.max(0, decotePlafond - 0.4525 * baremeBeforeDecote) : 0;
  const bareme = Math.max(0, baremeBeforeDecote - decote);
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
    avRachatImpot, perCapitalImposable, perInteretsPFU, perRentesImposable, perRentesPS, isConcubin: false, plafondPER, plafondPER1, plafondPER2, perDeductionCalc, perP1Deductible, perP2Deductible, deficitFoncierImpute, deficitFoncierReportable,
  };
}
