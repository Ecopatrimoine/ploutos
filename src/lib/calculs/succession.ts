// Calcul succession — droits, AV/PER, legs, démembrement
import type { PatrimonialData, SuccessionData, TaxBracket, FilledBracket,
  Heir, SuccessionPropertyLine, SuccessionPlacementLine, SuccessionAvLine,
  SuccessionResult, PieDatum } from '../../types/patrimoine';
import { n, getDemembrementPercentages, computeTaxFromBrackets, isAV, isPERType,
  childMatchesDeceased, getAgeFromBirthDate, isSpouseHeirEligible, getAvailableSpouseOptions,
  getQuotiteDisponible, buildCollectedHeirs, euro } from './utils';
import { resolveLoanValuesMulti } from './credit';

// ─── CALCUL SUCCESSION ────────────────────────────────────────────────────────

export function getSuccessionTaxProfile(relation: string, handicap = false) {
  const HANDICAP_BONUS = 159325; // abattement supplémentaire cumulable — CGI art. 779 II
  if (relation === "enfant") {
    return {
      allowance: 100000 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe",
    };
  }
  if (relation === "frereSoeur") {
    return {
      allowance: 15932 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 24430, rate: 0.35 },
        { from: 24430, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème frère / sœur",
    };
  }
  if (relation === "neveuNiece") {
    return {
      allowance: 7967 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.55 }] as TaxBracket[],
      graphTitle: "Barème neveu / nièce",
    };
  }
  if (relation === "parent") {
    return {
      allowance: 100000 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe (ascendant)",
    };
  }
  if (relation === "petit-enfant") {
    return {
      allowance: 1594 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [
        { from: 0, to: 8072, rate: 0.05 },
        { from: 8072, to: 12109, rate: 0.1 },
        { from: 12109, to: 15932, rate: 0.15 },
        { from: 15932, to: 552324, rate: 0.2 },
        { from: 552324, to: 902838, rate: 0.3 },
        { from: 902838, to: 1805677, rate: 0.4 },
        { from: 1805677, to: Number.POSITIVE_INFINITY, rate: 0.45 },
      ] as TaxBracket[],
      graphTitle: "Barème en ligne directe (petit-enfant)",
    };
  }
  // Enfant du conjoint non adopté = tiers fiscal (1 594 € / 60%)
  if (relation === "enfant_conjoint") {
    return {
      allowance: 1594 + (handicap ? HANDICAP_BONUS : 0),
      brackets: [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.6 }] as TaxBracket[],
      graphTitle: "Enfant du conjoint (tiers fiscal — 60%)",
    };
  }
  // NOTE : abattement handicap (159 325 €) est cumulable avec tout abattement légal
  // Il s'applique en supplément : abattement total = abattement relation + 159 325 €
  // À gérer via un flag "handicap" par héritier (prévu phase suivante)
  return {
    allowance: relation === "conjoint" ? 0 : 1594 + (handicap ? HANDICAP_BONUS : 0),
    brackets: relation === "conjoint" ? [] as TaxBracket[] : [{ from: 0, to: Number.POSITIVE_INFINITY, rate: 0.6 }] as TaxBracket[],
    graphTitle: relation === "conjoint" ? "Exonération conjoint" : "Barème tiers (60%)",
  };
}

/**
 * Fiscalité AV :
 * - Avant 70 ans : art. 990 I — abattement 152 500 € / bénéficiaire, puis 20 % jusqu'à 700 k€, 31,25 % au-delà
 * - Après 70 ans : art. 757 B — abattement commun 30 500 € sur les primes (déjà alloué en amont), droits de succession selon barème lien
 *
 * FIX #3 — cette fonction est appelée UNE SEULE FOIS dans avLines ; results la réutilise depuis avLines.
 */
export function computeAvTax(relation: string, amountBefore70Capital: number, amountAfter70TaxableShare: number) {
  const isConjoint = relation === "conjoint";
  const before70Taxable = isConjoint ? 0 : Math.max(0, amountBefore70Capital - 152500);
  const before70Tax = isConjoint
    ? 0
    : before70Taxable <= 700000
      ? before70Taxable * 0.2
      : 700000 * 0.2 + (before70Taxable - 700000) * 0.3125;
  const profile = getSuccessionTaxProfile(relation);
  const after70Taxable = isConjoint ? 0 : Math.max(0, amountAfter70TaxableShare - profile.allowance);
  const after70Tax = isConjoint
    ? 0
    : computeTaxFromBrackets(after70Taxable, profile.brackets).tax;
  return {
    before70Tax,
    before70Taxable,
    after70Tax,
    after70Taxable,
    totalTax: before70Tax + after70Tax,
  };
}

export function computeSuccession(successionData: SuccessionData, data: PatrimonialData) {
  // Testament actif = supplante la dévolution légale
  const testamentMode = successionData.useTestament && (
    (successionData.legsMode === "global" && successionData.testamentHeirs.length > 0) ||
    (successionData.legsMode === "precis" && (successionData.legsPrecisItems || []).length > 0)
  );
  // Legs global : on convertit testamentHeirs en Heir[] avec les % saisis
  const buildLegsGlobalHeirs = (): Heir[] => {
    return successionData.testamentHeirs.map(h => {
      // Retrouver le childLink réel depuis la collecte si c'est un enfant
      const matchedChild = h.relation === "enfant"
        ? data.childrenData.find(c =>
            (c.firstName || "").toLowerCase() === h.firstName.toLowerCase() &&
            (c.lastName || "").toLowerCase() === h.lastName.toLowerCase()
          )
        : null;
      // Si l'enfant n'est pas biologique du défunt → tiers fiscal (enfant_conjoint)
      const effectiveRelation = matchedChild && !childMatchesDeceased(matchedChild.parentLink || "common_child", successionData.deceasedPerson)
        ? "enfant_conjoint"
        : h.relation;
      return {
        name: `${h.firstName} ${h.lastName}`.trim() || "Légataire",
        relation: effectiveRelation,
        share: h.shareGlobal || "0",
        priorDonations: h.priorDonations || "0",
        childLink: matchedChild ? (matchedChild.parentLink || "common_child") : (h.relation === "enfant" ? "common_child" : null),
      };
    });
  };
  // Legs précis : construire les héritiers depuis les items (nouvelle structure + rétrocompat)
  const buildLegsPrecisHeirs = (): Heir[] => {
    const seen = new Set<string>();
    const heirs: Heir[] = [];
    const addHeir = (name: string, relation: string) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      const matchedChild = relation === "enfant"
        ? data.childrenData.find(c =>
            (c.firstName || "").toLowerCase() === name.split(" ")[0]?.toLowerCase() &&
            (c.lastName || "").toLowerCase() === name.split(" ").slice(1).join(" ").toLowerCase()
          )
        : null;
      const effectiveRelation = matchedChild && !childMatchesDeceased(matchedChild.parentLink || "common_child", successionData.deceasedPerson)
        ? "enfant_conjoint"
        : relation;
      heirs.push({ name, relation: effectiveRelation, share: "0", priorDonations: "0", childLink: matchedChild?.parentLink || (relation === "enfant" ? "common_child" : null) });
    };
    (successionData.legsPrecisItems || []).forEach(item => {
      // Nouvelle structure : legataires[]
      if (item.legataires && item.legataires.length > 0) {
        item.legataires.forEach(l => {
          addHeir(l.heirName?.trim() || "", l.heirRelation);
          (l.contreparties || []).forEach(cp => addHeir(cp.heirName?.trim() || "", cp.heirRelation));
        });
      } else {
        // Ancienne structure (rétrocompat)
        addHeir((item as any).heirName?.trim() || "", (item as any).heirRelation);
        ((item as any).contreparties || []).forEach((cp: any) => addHeir(cp.heirName?.trim() || "", cp.heirRelation));
      }
    });
    return heirs;
  };

  const heirs = testamentMode && successionData.legsMode === "global"
    ? buildLegsGlobalHeirs()
    : testamentMode && successionData.legsMode === "precis"
      ? buildLegsPrecisHeirs()
      : successionData.heirs.length > 0
        ? successionData.heirs
        : buildCollectedHeirs(data, successionData.deceasedPerson);

  const deceasedKey = successionData.deceasedPerson;
  const survivorKey = deceasedKey === "person1" ? "person2" : "person1";
  const spouseEligible = isSpouseHeirEligible(data);
  const spouseOptions = getAvailableSpouseOptions(data, deceasedKey);
  const allowedSpouseValues = new Set(spouseOptions.map((o) => o.value));
  const spouseOption = spouseEligible && allowedSpouseValues.has(successionData.spouseOption)
    ? successionData.spouseOption
    : spouseOptions[0]?.value || "none";

  const warnings: string[] = [];
  const reserveChildrenCount = data.childrenData.filter((c) => childMatchesDeceased(c.parentLink, deceasedKey)).length;
  const hasNonCommonChildren = testamentMode
    ? false
    : data.childrenData.some((c) => childMatchesDeceased(c.parentLink, deceasedKey) && c.parentLink !== "common_child");
  const usufruitierBirthDate = survivorKey === "person1" ? data.person1BirthDate : data.person2BirthDate;
  const usufruitierAge = getAgeFromBirthDate(usufruitierBirthDate);
  const demembrementPct = getDemembrementPercentages(usufruitierAge);

  if (!spouseEligible && spouseOption !== "none")
    warnings.push("Le conjoint n'a pas de vocation successorale automatique dans cette situation de couple.");
  if (spouseOption === "legal_usufruct_total" && hasNonCommonChildren)
    warnings.push("La totalité en usufruit n'est pas ouverte en dévolution légale en présence d'enfants non communs.");

  // ── Actif successoral immobilier ──
  const propertyLines: SuccessionPropertyLine[] = data.properties.map((property) => {
    const fullValue = Math.max(0, n(property.value));
    // Multi-crédits : capital restant total + assurance agrégée
    const loanAgg = resolveLoanValuesMulti(property);
    const debt = loanAgg.capital;
    const belongsToDeceased = property.ownership === deceasedKey || property.ownership === "common" || property.ownership === "indivision";
    // Quote-part du défunt selon type de propriété
    let baseShare = 0;
    if (property.ownership === "indivision") {
      // Quote-part exacte selon les % d'indivision saisis
      baseShare = deceasedKey === "person1"
        ? Math.min(1, Math.max(0, n(property.indivisionShare1) / 100 || 0.5))
        : Math.min(1, Math.max(0, n(property.indivisionShare2) / 100 || 0.5));
    } else if (property.ownership === "common" && data.matrimonialRegime !== "separation_biens") {
      baseShare = 0.5;
    } else if (property.ownership === deceasedKey) {
      baseShare = 1;
    }
    const rpAbatementEligible = property.type === "Résidence principale" && belongsToDeceased
      && (spouseEligible || data.childrenData.length > 0);

    // ── Crédit immobilier (calculé avant le bloc note pour que debtNote soit disponible) ──
    // Pour les biens communs ou en indivision : co-emprunteurs solidaires.
    // Après DC, le passif résiduel est ENTIÈREMENT à la charge du survivant (pas de la succession).
    // → netDebtShare = 0 : 100% de la quote-part du défunt passe en succession sans passif crédit.
    const isJointCredit = property.ownership === "common" || property.ownership === "indivision";
    const debtNote = isJointCredit && debt > 0 ? " — crédit solidaire : passif résiduel au survivant" : "";

    // Quote-part brute de dette (pour affichage et calcul assurance)
    const debtShareGross = property.ownership === "indivision"
      ? debt * baseShare
      : property.ownership === "common" && data.matrimonialRegime !== "separation_biens"
        ? debt * 0.5
        : property.ownership === deceasedKey ? debt : 0;

    // Assurance emprunteur DC — quotité agrégée par personne
    // Multi-crédits : moyenne pondérée des quotités DC sur tous les crédits avec assurance
    let insuranceRate = 0;
    if (property.loans && property.loans.length > 0) {
      const loansWithInsurance = loanAgg.loans.filter(r => r.loan.insurance && r.capital > 0);
      if (loansWithInsurance.length > 0) {
        const totalCap = loansWithInsurance.reduce((s, r) => s + r.capital, 0);
        for (const r of loansWithInsurance) {
          const w = totalCap > 0 ? r.capital / totalCap : 0;
          const rateForPerson = isJointCredit
            ? (deceasedKey === "person1"
                ? Math.min(100, Math.max(0, n(r.loan.insuranceRate1) || n(r.loan.insuranceRate)))
                : Math.min(100, Math.max(0, n(r.loan.insuranceRate2) || n(r.loan.insuranceRate))))
            : Math.min(100, Math.max(0, n(r.loan.insuranceRate)));
          insuranceRate += rateForPerson * w;
        }
      }
    } else if (property.loanInsurance) {
      if (isJointCredit) {
        insuranceRate = deceasedKey === "person1"
          ? Math.min(100, Math.max(0, n(property.loanInsuranceRate1) || n(property.loanInsuranceRate)))
          : Math.min(100, Math.max(0, n(property.loanInsuranceRate2) || n(property.loanInsuranceRate)));
      } else {
        insuranceRate = Math.min(100, Math.max(0, n(property.loanInsuranceRate)));
      }
    }
    const insuranceCover = debtShareGross * insuranceRate / 100;
    // Passif effectif : 0 pour commun/indivision (solidarité), sinon dette après DC
    const netDebtShare = isJointCredit ? 0 : Math.max(0, debtShareGross - insuranceCover);

    // Warnings crédit
    if (!isJointCredit && property.loanInsurance && insuranceRate > 0 && insuranceRate < 100 && debtShareGross > 0) {
      warnings.push(`${property.name || property.type} : assurance DC à ${insuranceRate}% → passif résiduel de ${Math.round(netDebtShare).toLocaleString("fr")} € à la charge de la succession.`);
    }
    if (isJointCredit && property.loanInsurance && debtShareGross > 0) {
      const survivorDebt = debtShareGross - insuranceCover;
      if (survivorDebt > 100) {
        warnings.push(`${property.name || property.type} : assurance DC à ${insuranceRate}% — passif résiduel de ${Math.round(survivorDebt).toLocaleString("fr")} € à la charge du survivant (solidarité crédit — hors succession).`);
      }
    }

    // ── Valeur successorale ──
    let estateValue = 0;
    let note = "";

    if (!belongsToDeceased) {
      note = "Bien hors succession du défunt";
    } else if (property.propertyRight === "usufruct") {
      note = "Usufruit non retenu à l'actif successoral";
    } else if (property.propertyRight === "bare") {
      const usufAge = property.usufructAge ? n(property.usufructAge) : null;
      const dePercent = usufAge !== null ? getDemembrementPercentages(usufAge) : null;
      estateValue = fullValue * baseShare * (dePercent ? dePercent.nuePropriete : 0);
      note = dePercent
        ? `Nue-propriété retenue — CGI art. 669 (âge usufruitier : ${usufAge} ans)`
        : "Nue-propriété non valorisable sans âge de l'usufruitier";
      if (!dePercent)
        warnings.push(`Le bien « ${property.name || property.type} » est en nue-propriété mais l'âge de l'usufruitier n'est pas renseigné.`);
    } else {
      estateValue = fullValue * baseShare;
      note = property.ownership === "common"
        ? `Part communautaire retenue (50%)${debtNote}`
        : property.ownership === "indivision"
          ? `Quote-part indivision retenue (${Math.round(baseShare * 100)}%)${debtNote}`
          : "Bien propre retenu";
    }

    const residenceAbatement = rpAbatementEligible ? estateValue * 0.2 : 0;

    return {
      name: property.name || property.type,
      grossEstateValue: estateValue,
      residenceAbatement,
      debtShare: netDebtShare,       // 0 pour common/indivision (solidarité crédit)
      debtShareGross,                // quote-part brute de dette (informatif)
      insuranceCover,
      insuranceRate,
      netEstateValue: Math.max(0, estateValue - residenceAbatement - netDebtShare),
      note,
    };
  });

  // ── Actif successoral placements hors AV ──
  const placementLines: SuccessionPlacementLine[] = data.placements.map((placement) => {
    const value = Math.max(0, n(placement.deathValue || placement.value));
    const belongsToDeceased = placement.ownership === deceasedKey || placement.ownership === "common";
    const baseShare = placement.ownership === "common" && data.matrimonialRegime !== "separation_biens" ? 0.5
      : placement.ownership === deceasedKey ? 1 : 0;
    return {
      name: placement.name || placement.type,
      netEstateValue: belongsToDeceased && !isAV(placement.type) ? value * baseShare : 0,
      note: !belongsToDeceased ? "Placement hors succession du défunt"
        : isAV(placement.type) ? "Assurance-vie hors actif successoral classique"
          : placement.ownership === "common" ? "Part communautaire retenue" : "Placement propre retenu",
    };
  });

  // ── Lignes AV — FIX #3 : calcul de la fiscalité ici, réutilisé dans results ──
  // AV + PER : même régime successoral 990I / 757B
  const avContracts = data.placements.filter(
    (p) => (isAV(p.type) || isPERType(p.type)) && (p.ownership === deceasedKey || p.ownership === "common")
  );
  const totalAfter70Pool = avContracts.reduce((s, p) => s + Math.max(0, n(p.premiumsAfter70)), 0);
  const totalAfter70TaxablePool = Math.max(0, totalAfter70Pool - 30500);

  // ── Phase 1 : Collecter les montants par contrat (sans encore calculer la taxe) ──
  // La taxe 990I s'applique sur le TOTAL reçu par bénéficiaire, pas contrat par contrat.
  // L'abattement de 152 500 € est global par bénéficiaire, tous contrats confondus.
  type AvLineRaw = {
    contract: string; beneficiary: string; relation: string; sharePct: number;
    amount: number; amountBefore70Capital: number; amountAfter70Premiums: number; amountAfter70TaxableShare: number;
  };
  const avLinesRaw: AvLineRaw[] = avContracts.flatMap((placement) => {
    const rawValue = Math.max(0, n(placement.value));
    // Nantissement : réduire capital AV du crédit in fine nanti
    const placementIndexInData = data.placements.indexOf(placement);
    const pledgedProperty = data.properties.find(
      p => (p.loans && p.loans.length > 0
        ? p.loans.some(l => l.type === "in_fine" && +(l.pledgedPlacementIndex || "-1") === placementIndexInData)
        : p.loanEnabled && p.loanType === "in_fine" && +(p.loanPledgedPlacementIndex || "-1") === placementIndexInData)
    );
    let pledgedDebt = 0;
    if (pledgedProperty) {
      const lv = resolveLoanValuesMulti(pledgedProperty);
      const insurRate = pledgedProperty.loanInsurance ? Math.min(100, Math.max(0, n(pledgedProperty.loanInsuranceRate))) : 0;
      pledgedDebt = lv.capital * (1 - insurRate / 100);
    }
    const contractValue = Math.max(0, rawValue - pledgedDebt);
    const exemptCapital = Math.min(Math.max(0, n(placement.exemptFromSuccession)), contractValue);
    const taxableContractValue = contractValue - exemptCapital;
    const before70PremiumPool = Math.max(0, n(placement.premiumsBefore70));
    const after70Pool = Math.max(0, n(placement.premiumsAfter70));
    const totalPremiumPool = before70PremiumPool + after70Pool;
    const before70CapRatio = totalPremiumPool > 0 ? before70PremiumPool / totalPremiumPool : 1;
    const before70CapPool = taxableContractValue * before70CapRatio;
    const after70TaxableContractPool = totalAfter70Pool > 0
      ? totalAfter70TaxablePool * (after70Pool / totalAfter70Pool)
      : 0;
    return placement.beneficiaries.map((beneficiary, index) => {
      const sharePct = Math.max(0, n(beneficiary.share));
      const shareRatio = sharePct / 100;
      return {
        contract: placement.name || placement.type,
        beneficiary: beneficiary.name || `Bénéficiaire ${index + 1}`,
        relation: beneficiary.relation || "autre",
        sharePct,
        amount: contractValue * shareRatio,
        amountBefore70Capital: before70CapPool * shareRatio,
        amountAfter70Premiums: after70Pool * shareRatio,
        amountAfter70TaxableShare: after70TaxableContractPool * shareRatio,
        pledgedDebt: pledgedDebt * shareRatio,
      };
    });
  });

  // ── Phase 2 : Agréger par bénéficiaire et calculer la taxe 990I UNE SEULE FOIS ──
  // Construire un map : nom bénéficiaire → totaux cumulés tous contrats
  const benefMap: Record<string, { relation: string; totalBefore70: number; totalAfter70Taxable: number }> = {};
  for (const l of avLinesRaw) {
    if (!benefMap[l.beneficiary]) benefMap[l.beneficiary] = { relation: l.relation, totalBefore70: 0, totalAfter70Taxable: 0 };
    benefMap[l.beneficiary].totalBefore70 += l.amountBefore70Capital;
    benefMap[l.beneficiary].totalAfter70Taxable += l.amountAfter70TaxableShare;
  }
  // Calculer la taxe agrégée par bénéficiaire (abattement 152 500 € appliqué une fois)
  const benefTaxMap: Record<string, { before70Tax: number; after70Tax: number; totalTax: number; before70Taxable: number; after70Taxable: number }> = {};
  for (const [name, agg] of Object.entries(benefMap)) {
    const avTax = computeAvTax(agg.relation, agg.totalBefore70, agg.totalAfter70Taxable);
    benefTaxMap[name] = {
      before70Tax: avTax.before70Tax, after70Tax: avTax.after70Tax, totalTax: avTax.totalTax,
      before70Taxable: avTax.before70Taxable, after70Taxable: avTax.after70Taxable,
    };
  }
  // ── Phase 3 : Construire avLines avec taxe pro-ratée par contrat pour l'affichage ──
  const avLines: SuccessionAvLine[] = avLinesRaw.map((l) => {
    const agg = benefMap[l.beneficiary];
    const tax = benefTaxMap[l.beneficiary];
    // Pro-rata : part de ce contrat dans le total avant70 du bénéficiaire
    const ratioBefore70 = agg.totalBefore70 > 0 ? l.amountBefore70Capital / agg.totalBefore70 : 0;
    const ratioAfter70 = agg.totalAfter70Taxable > 0 ? l.amountAfter70TaxableShare / agg.totalAfter70Taxable : 0;
    return {
      ...l,
      before70Tax: tax.before70Tax * ratioBefore70,
      after70Tax: tax.after70Tax * ratioAfter70,
      totalTax: tax.before70Tax * ratioBefore70 + tax.after70Tax * ratioAfter70,
    };
  });

  // ── Masses successorales ──
  const propertyEstateBrut = propertyLines.reduce((s, l) => s + l.netEstateValue, 0);
  const placementsSuccession = placementLines.reduce((s, l) => s + l.netEstateValue, 0);
  const furnitureForfait = Math.max(0, (propertyEstateBrut + placementsSuccession) * 0.05);
  const collectedPropertyEstate = propertyEstateBrut + furnitureForfait;
  const activeNet = collectedPropertyEstate + placementsSuccession;

  const eligibleChildren = testamentMode
    ? heirs.filter((h) => h.relation === "enfant")
    : heirs.filter((h) => h.relation === "enfant" && childMatchesDeceased(h.childLink, deceasedKey));
  const childrenCount = eligibleChildren.length;
  const quotiteDisponible = getQuotiteDisponible(reserveChildrenCount);

  // En mode testament, l'option conjoint est ignorée si le legs couvre déjà le patrimoine
  const testamentCoversAll = testamentMode && (
    (successionData.legsMode === "global" && successionData.testamentHeirs.length > 0) ||
    (successionData.legsMode === "precis" && (successionData.legsPrecisItems || []).length > 0)
  );

  let spouseFullFraction = 0;
  let spouseUsufructFraction = 0;
  if (!testamentCoversAll) {
    switch (spouseOption) {
      case "legal_quarter_full": spouseFullFraction = spouseEligible ? 0.25 : 0; break;
      case "legal_usufruct_total": spouseUsufructFraction = spouseEligible && !hasNonCommonChildren ? 1 : 0; break;
      case "ddv_usufruct_total": spouseUsufructFraction = spouseEligible ? 1 : 0; break;
      case "ddv_quarter_full_3q_usufruct":
        spouseFullFraction = spouseEligible ? 0.25 : 0;
        spouseUsufructFraction = spouseEligible ? 0.75 : 0;
        break;
      case "ddv_quotite_disponible": spouseFullFraction = spouseEligible ? quotiteDisponible : 0; break;
    }
  }

  if (reserveChildrenCount > 0 && spouseFullFraction > quotiteDisponible + 1e-9)
    warnings.push("La pleine propriété attribuée au conjoint dépasse la quotité disponible.");
  if (spouseUsufructFraction > 0 && usufruitierAge === null)
    warnings.push("La date de naissance du conjoint survivant doit être renseignée pour valoriser le démembrement.");

  const childNueFraction = spouseUsufructFraction > 0 && childrenCount > 0
    ? (1 - spouseFullFraction) / childrenCount : 0;
  const childFullFraction = spouseUsufructFraction > 0
    ? 0
    : childrenCount > 0 ? Math.max(0, 1 - spouseFullFraction) / childrenCount : 0;

  const legalReserveAmount = reserveChildrenCount > 0 ? activeNet * (1 - quotiteDisponible) : 0;
  const legalDisposableAmount = reserveChildrenCount > 0 ? activeNet * quotiteDisponible : activeNet;

  // ── Résultats par héritier ──
  // En legs global : les fractions viennent du % saisi par héritier
  // En dévolution légale : fractions calculées (conjoint + enfants éligibles)
  const results: SuccessionResult[] = heirs.map((heir) => {
    let fraction = 0;
    let nueFraction = 0;
    let usufructFraction = 0;

    if (testamentCoversAll && successionData.legsMode === "global") {
      // Legs global : fraction = % saisi / 100
      const shareGlobal = +(heir.share || "0") / 100;
      const right = (successionData.testamentHeirs.find(
        th => (`${th.firstName} ${th.lastName}`.trim() || "Légataire") === heir.name
      )?.propertyRight) || "full";
      if (right === "usufruct") usufructFraction = shareGlobal;
      else if (right === "bare") nueFraction = shareGlobal;
      else fraction = shareGlobal;
    } else if (testamentCoversAll && successionData.legsMode === "precis") {
      // Legs précis : valeur totale reçue = items principaux + contreparties
      const _dk = successionData.deceasedPerson;
      const getAssetBaseValue = (it: { propertyIndex: number; assetType: string }) => {
        const _rp = it.assetType === "property" ? data.properties[it.propertyIndex] : null;
        const _rv = it.assetType === "property" ? n(_rp?.value) : n(data.placements[it.propertyIndex]?.value);
        const _bs = _rp
          ? _rp.ownership === "indivision"
            ? (_dk === "person1" ? Math.min(1, Math.max(0, n(_rp.indivisionShare1) / 100 || 0.5)) : Math.min(1, Math.max(0, n(_rp.indivisionShare2) / 100 || 0.5)))
            : _rp.ownership === "common" ? 0.5 : 1
          : 1;
        return _rv * _bs;
      };
      const getUsufructDate = (it: { propertyRight: string; heirBirthDate: string; contreparties?: { heirBirthDate: string }[] }) =>
        it.propertyRight === "usufruct" ? it.heirBirthDate : (it.contreparties||[])[0]?.heirBirthDate || "";

      let totalFiscalValue = 0;

      // Helper : valeur de base d'un bien (tient compte indivision/communauté)
      const getAssetBaseValueFree = (freeValue: string) => n(freeValue) || 0;

      // Valeur totale de l'actif net pour le calcul du résiduel
      const totalBiensExplicites = (successionData.legsPrecisItems || [])
        .filter(it => !it.isResidual)
        .reduce((s, it) => {
          if (it.assetType === "free") return s + (n(it.freeValue) || 0);
          return s + getAssetBaseValue(it);
        }, 0);

      (successionData.legsPrecisItems || []).forEach(it => {
        // Valeur de base du bien
        let av: number;
        if (it.assetType === "free") {
          av = it.isResidual ? Math.max(0, activeNet - totalBiensExplicites) : (n(it.freeValue) || 0);
        } else {
          av = it.isResidual ? Math.max(0, activeNet - totalBiensExplicites) : getAssetBaseValue(it);
        }

        // Nouvelle structure : legataires[]
        const legataires = it.legataires && it.legataires.length > 0
          ? it.legataires
          : (it as any).heirName ? [{ heirName: (it as any).heirName, heirRelation: (it as any).heirRelation, heirBirthDate: (it as any).heirBirthDate, sharePercent: (it as any).sharePercent, propertyRight: (it as any).propertyRight || "full", contreparties: (it as any).contreparties || [] }]
          : [];

        legataires.forEach(l => {
          if ((l.heirName?.trim() || "") === heir.name) {
            const sv = n(l.sharePercent) / 100;
            const ub = l.propertyRight === "usufruct" ? l.heirBirthDate : (l.contreparties||[])[0]?.heirBirthDate || "";
            const ua = ub ? new Date().getFullYear() - new Date(ub).getFullYear() : null;
            const dp = (l.propertyRight === "bare" || l.propertyRight === "usufruct") && ua ? getDemembrementPercentages(ua) : null;
            if (dp && l.propertyRight === "usufruct") totalFiscalValue += av * sv * dp.usufruct;
            else if (dp && l.propertyRight === "bare") totalFiscalValue += av * sv * dp.nuePropriete;
            else totalFiscalValue += av * sv;
          }
          // Contreparties
          (l.contreparties || [])
            .filter(cp => (cp.heirName?.trim() || "") === heir.name)
            .forEach(cp => {
              const cpSv = n(cp.sharePercent) / 100;
              const cpRight = l.propertyRight === "usufruct" ? "bare" : "usufruct";
              const ub = cpRight === "usufruct" ? cp.heirBirthDate : (l.propertyRight === "usufruct" ? l.heirBirthDate : (l.contreparties||[])[0]?.heirBirthDate || "");
              const ua = ub ? new Date().getFullYear() - new Date(ub).getFullYear() : null;
              const dp = ua ? getDemembrementPercentages(ua) : null;
              if (dp && cpRight === "usufruct") totalFiscalValue += av * cpSv * dp.usufruct;
              else if (dp && cpRight === "bare") totalFiscalValue += av * cpSv * dp.nuePropriete;
              else totalFiscalValue += av * cpSv;
            });
        });
      });

      if (activeNet > 0) fraction = totalFiscalValue / activeNet;
      else fraction = 0;
    } else if (heir.relation === "conjoint") {
      fraction = spouseFullFraction;
      usufructFraction = spouseUsufructFraction;
    } else if (heir.relation === "enfant") {
      // Vérification filiation : l'enfant doit être héritier du défunt
      const isEligible = testamentMode || childMatchesDeceased(heir.childLink, deceasedKey);
      if (isEligible) {
        fraction = childFullFraction;
        nueFraction = childNueFraction;
      }
    }

    const grossReceived = activeNet * fraction;
    const nueRawValue = activeNet * nueFraction;
    const nueValue = nueRawValue * demembrementPct.nuePropriete;
    const usufructRawValue = activeNet * usufructFraction;
    // NOTE : usufructTaxValue n'entre PAS dans successionTaxable (FIX #2)
    // Le conjoint est exonéré de droits de succession (CGI art. 796-0 bis).

    // ── AV/PER : taxe agrégée par bénéficiaire (abattement 152 500 € appliqué une fois) ──
    const avForHeir = avLines.filter((l) => l.beneficiary === heir.name);
    const avReceived = avForHeir.reduce((s, l) => s + l.amount, 0);
    // Utiliser benefTaxMap pour la taxe totale — calculée sur le cumul tous contrats
    const avDuties = benefTaxMap[heir.name]?.totalTax ?? 0;
    const avTaxableBefore70 = benefTaxMap[heir.name]?.before70Taxable ?? 0;
    const avTaxableAfter70 = benefTaxMap[heir.name]?.after70Taxable ?? 0;

    // ── Droits de succession (hors AV) ──
    // Vérifier si cet héritier est un enfant handicapé (depuis la collecte)
    const heirIsHandicap = data.childrenData.some(c =>
      (`${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase() === heir.name.toLowerCase()) && c.handicap
    );
    const profile = getSuccessionTaxProfile(heir.relation, heirIsHandicap);
    // FIX #2 : base = grossReceived + nueValue uniquement (pas usufructTaxValue)
    const successionTaxable = Math.max(
      0,
      grossReceived + nueValue - profile.allowance - Math.max(0, n(heir.priorDonations))
    );
    const successionCalc = profile.brackets.length > 0
      ? computeTaxFromBrackets(successionTaxable, profile.brackets)
      : { tax: 0, fill: [] as FilledBracket[] };
    const successionDuties = successionCalc.tax;

    const duties = successionDuties + avDuties;

    // FIX #4 : netReceived cohérent — le conjoint reçoit aussi usufructRawValue économiquement
    const successionNetReceived = Math.max(0, grossReceived + nueRawValue + usufructRawValue - successionDuties);
    const avNetReceived = Math.max(0, avReceived - avDuties);
    const netReceived = successionNetReceived + avNetReceived;

    const currentBracket = successionCalc.fill.find((s) => successionTaxable <= s.to) || successionCalc.fill[successionCalc.fill.length - 1];
    const visualMax = currentBracket ? (Number.isFinite(currentBracket.to) ? currentBracket.to : Math.max(successionTaxable, 1)) : 1;
    const indicatorPct = successionTaxable > 0 && visualMax > 0 ? Math.min(100, Math.max(0, (successionTaxable / visualMax) * 100)) : 0;

    return {
      name: heir.name,
      relation: heir.relation,
      fraction, nueFraction, usufructFraction,
      grossReceived, nueRawValue, nueValue, usufructRawValue,
      avReceived, successionTaxable, successionDuties, avDuties, duties,
      netReceived, successionNetReceived, avNetReceived,
      avTaxableBefore70, avTaxableAfter70,
      bracketFill: successionCalc.fill,
      graphTitle: profile.graphTitle,
      allowance: profile.allowance,
      indicatorPct, visualMax,
      currentBracketLabel: currentBracket?.label || "—",
      effectiveReceived: grossReceived + nueRawValue + usufructRawValue + avReceived,
    };
  });

  // ── Graphique de référence (héritier le plus taxé) ──
  const taxableResults = results.filter((r) => r.successionTaxable > 0 && r.bracketFill.length > 0);
  const reference = [...taxableResults].sort((a, b) => b.successionTaxable - a.successionTaxable)[0] || null;
  const successionBracketFill = reference ? reference.bracketFill : [];
  const successionCurrentBracket = reference
    ? successionBracketFill.find((s) => reference.successionTaxable <= s.to) || successionBracketFill[successionBracketFill.length - 1]
    : null;
  const successionVisualMax = successionCurrentBracket
    ? (Number.isFinite(successionCurrentBracket.to) ? successionCurrentBracket.to : Math.max(reference.successionTaxable, 1))
    : 1;
  const successionIndicatorPct = reference ? Math.min(100, Math.max(0, (reference.successionTaxable / successionVisualMax) * 100)) : 0;

  // ── Camemberts ──
  const pieData: PieDatum[] = [
    legalReserveAmount > 0 ? { name: "Réserve légale", holder: `${reserveChildrenCount} enfant(s)`, value: legalReserveAmount } : null,
    legalDisposableAmount > 0 ? { name: reserveChildrenCount > 0 ? "Quotité disponible" : "Masse disponible", holder: spouseEligible ? "Conjoint / disposition" : "Libre disposition", value: legalDisposableAmount } : null,
  ].filter((e): e is PieDatum => Boolean(e));

  const receivedPieData: PieDatum[] = results
    .filter((r) => r.effectiveReceived > 0)
    .map((r) => ({ name: r.name, holder: r.relation, value: r.effectiveReceived }));

  const patrimoineLeguePieData: PieDatum[] = results
    .filter((r) => r.grossReceived + r.nueValue > 0)
    .map((r) => ({ name: r.name, holder: r.grossReceived > 0 ? "PP" : "NP", value: r.grossReceived + r.nueValue }));

  // ── Vérification réserve ──
  const reserveAllocatedToChildren = results
    .filter((r) => r.relation === "enfant")
    .reduce((s, r) => s + r.grossReceived + r.nueRawValue, 0);
  if (reserveChildrenCount > 0 && reserveAllocatedToChildren + 0.5 < legalReserveAmount) {
    warnings.push(`Réserve héréditaire spoliée : les enfants devraient recevoir au moins ${euro(legalReserveAmount)}, mais la simulation ne leur attribue que ${euro(reserveAllocatedToChildren)}.`);
  }

  return {
    deceasedKey, survivorKey, spouseEligible, spouseOptions, spouseOption, quotiteDisponible,
    warnings, activeNet, furnitureForfait,
    totalRights: results.reduce((s, r) => s + r.duties, 0),
    totalSuccessionRights: results.reduce((s, r) => s + r.successionDuties, 0),
    totalAvRights: results.reduce((s, r) => s + r.avDuties, 0),
    collectedPropertyEstate, placementsSuccession, propertyLines, placementLines, avLines, results,
    graphReferenceName: reference?.name || "Aucun héritier taxable",
    graphReferenceTitle: reference?.graphTitle || "Aucun barème applicable",
    bracketFill: successionBracketFill,
    currentBracketLabel: successionCurrentBracket?.label || "—",
    indicatorPct: successionIndicatorPct,
    visualMax: successionVisualMax,
    graphTaxableBase: reference?.successionTaxable || 0,
    testamentMode, reserveChildrenCount,
    pieData, receivedPieData, patrimoineLeguePieData,
    legalReserveAmount, legalDisposableAmount, usufruitierAge, demembrementPct,
  };
}
