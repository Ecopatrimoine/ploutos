// src/lib/calculs/donation.ts
// Calcul donation — droits de donation + simulation rappel fiscal succession
// Aucun setState, aucun hook React — fonctions pures

import type { PatrimonialData, DonationItem, DonationHeir } from "../../types/patrimoine";
import { n, getDemembrementPercentages, computeTaxFromBrackets, getAgeFromBirthDate } from "./utils";
import { getSuccessionTaxProfile } from "./succession";

// ─── Résultat pour un donataire ───────────────────────────────────────────────
export type DonationHeirResult = {
  name: string;
  relation: string;
  sharePercent: number;
  grossReceived: number;       // valeur brute transmise
  taxableAmount: number;       // après abattement
  allowanceUsed: number;       // abattement consommé
  allowanceTotal: number;      // abattement total disponible
  donationTax: number;         // droits de donation dus
  netReceived: number;         // net après droits
};

// ─── Résultat global d'une donation ──────────────────────────────────────────
export type DonationResult = {
  donationId: string;
  assetLabel: string;
  assetValue: number;
  donatedValue: number;          // valeur totale donnée (PP ou NP)
  donationType: "full" | "dismembered";
  npPercent: number;             // % NP si démembrement (1 si PP)
  heirs: DonationHeirResult[];
  totalDonationTax: number;
  // Simulation impact succession
  before15: SuccessionImpact;    // décès dans les 15 ans
  after15: SuccessionImpact;     // décès après 15 ans
};

export type SuccessionImpact = {
  label: string;
  additionalSuccessionTax: number; // droits succession supplémentaires (rappel)
  donationTaxImputed: number;      // droits donation déduits des droits succession
  netAdditionalCost: number;       // coût net = droits succession - imputation
  totalCost: number;               // droits donation + net succession
  rappelFiscal: boolean;
};

// ─── Valeur du bien donné ─────────────────────────────────────────────────────
export function getDonationAssetValue(
  donation: DonationItem,
  data: PatrimonialData
): { label: string; value: number } {
  if (donation.assetType === "free") {
    return {
      label: donation.freeLabel || "Bien libre",
      value: n(donation.freeValue),
    };
  }
  if (donation.assetType === "property") {
    const p = data.properties[donation.assetIndex];
    if (!p) return { label: "—", value: 0 };
    // Quote-part du donateur selon ownership
    let ownerShare = 1;
    if (p.ownership === "common") ownerShare = 0.5;
    else if (p.ownership === "indivision") {
      const donorKey = donation.donorPersonKey || "person1";
      ownerShare = donorKey === "person2"
        ? Math.min(1, Math.max(0, n(p.indivisionShare2) / 100 || 0.5))
        : Math.min(1, Math.max(0, n(p.indivisionShare1) / 100 || 0.5));
    }
    // Valeur nette de dette sur la quote-part
    const debt = n(p.loanCapitalRemaining);
    const insurRate = p.loanInsurance
      ? Math.min(100, Math.max(0, n(p.loanInsuranceRate))) / 100
      : 0;
    const netValue = Math.max(0, n(p.value) - debt * (1 - insurRate)) * ownerShare;
    return { label: p.name || p.type || "Immobilier", value: netValue };
  }
  // placement
  const pl = data.placements[donation.assetIndex];
  if (!pl) return { label: "—", value: 0 };
  return { label: pl.name || pl.type || "Placement", value: n(pl.value) };
}

// ─── Frais de notaire donation immobilière ────────────────────────────────────
export function computeNotaryFees(value: number): {
  emoluments: number;
  emolumentsTTC: number;
  securiteImmobiliere: number;
  debours: number;
  total: number;
} {
  if (value <= 0) return { emoluments: 0, emolumentsTTC: 0, securiteImmobiliere: 0, debours: 0, total: 0 };

  // Barème émoluments (décret 2016)
  const tranches = [
    { max: 6500,  rate: 0.03945 },
    { max: 17000, rate: 0.01627 },
    { max: 60000, rate: 0.01085 },
    { max: Infinity, rate: 0.00814 },
  ];
  let emoluments = 0;
  let prev = 0;
  for (const t of tranches) {
    const slice = Math.min(value, t.max) - prev;
    if (slice <= 0) break;
    emoluments += slice * t.rate;
    prev = t.max;
  }
  const emolumentsTTC = emoluments * 1.2; // TVA 20%
  const securiteImmobiliere = Math.max(15, value * 0.001); // 0,10% min 15€
  const debours = 400; // forfait débours

  return {
    emoluments: Math.round(emoluments),
    emolumentsTTC: Math.round(emolumentsTTC),
    securiteImmobiliere: Math.round(securiteImmobiliere),
    debours,
    total: Math.round(emolumentsTTC + securiteImmobiliere + debours),
  };
}

// ─── Calcul principal ─────────────────────────────────────────────────────────
export function computeDonation(
  donation: DonationItem,
  data: PatrimonialData
): DonationResult {
  const { label: assetLabel, value: assetValue } = getDonationAssetValue(donation, data);
  const shareRatio = Math.min(100, Math.max(0, n(donation.sharePercent))) / 100;

  // Valeur PP de la quote-part donnée
  const ppValue = assetValue * shareRatio;

  // Démembrement : calcul valeur NP selon âge donateur (barème Duvergier)
  let npPercent = 1; // PP par défaut
  if (donation.donationType === "dismembered") {
    const donorAge = n(donation.donorAge) ||
      getAgeFromBirthDate(data.person1BirthDate) || 60;
    const demerPct = getDemembrementPercentages(donorAge);
    npPercent = demerPct.nuePropriete; // déjà en décimal (0.4 = 40%)
  }

  const donatedValue = ppValue * npPercent; // valeur transmise au donataire

  // Calcul droits pour chaque donataire
  const heirResults: DonationHeirResult[] = donation.heirs.map((heir) => {
    const heirShare = Math.min(100, Math.max(0, n(heir.sharePercent))) / 100;
    const grossReceived = donatedValue * heirShare;

    const profile = getSuccessionTaxProfile(heir.relation);
    const priorDon = n(heir.priorDonations);
    const residualAllowance = Math.max(0, profile.allowance - priorDon);
    const taxable = Math.max(0, grossReceived - residualAllowance);
    const donationTax = taxable > 0
      ? computeTaxFromBrackets(taxable, profile.brackets).tax
      : 0;

    return {
      name: heir.name || "—",
      relation: heir.relation,
      sharePercent: heirShare * 100,
      grossReceived,
      taxableAmount: taxable,
      allowanceUsed: Math.min(grossReceived, residualAllowance),
      allowanceTotal: profile.allowance,
      donationTax,
      netReceived: grossReceived - donationTax,
    };
  });

  const totalDonationTax = heirResults.reduce((s, h) => s + h.donationTax, 0);

  // ── Impact sur la succession ──────────────────────────────────────────────
  // Scénario décès < 15 ans : rappel fiscal
  const before15 = computeRappelFiscal(heirResults, totalDonationTax, true);
  // Scénario décès > 15 ans : pas de rappel
  const after15 = computeRappelFiscal(heirResults, totalDonationTax, false);

  return {
    donationId: donation.id,
    assetLabel,
    assetValue,
    donatedValue,
    donationType: donation.donationType,
    npPercent,
    heirs: heirResults,
    totalDonationTax,
    before15,
    after15,
  };
}

// ─── Simulation rappel fiscal ─────────────────────────────────────────────────
function computeRappelFiscal(
  heirs: DonationHeirResult[],
  totalDonationTax: number,
  rappel: boolean
): SuccessionImpact {
  if (!rappel) {
    return {
      label: "Décès après 15 ans",
      additionalSuccessionTax: 0,
      donationTaxImputed: 0,
      netAdditionalCost: 0,
      totalCost: totalDonationTax,
      rappelFiscal: false,
    };
  }

  // En cas de rappel : la donation s'ajoute à la base successorale
  // L'abattement déjà consommé n'est plus disponible à la succession
  // Les droits déjà payés s'imputent sur les droits de succession
  let additionalSuccessionTax = 0;

  for (const heir of heirs) {
    const profile = getSuccessionTaxProfile(heir.relation);
    // Abattement résiduel à la succession = abattement total - abattement déjà utilisé
    const residualAtDeath = Math.max(0, profile.allowance - heir.allowanceUsed);
    // Si le don revient dans la base successorale, on calcule les droits avec l'abattement résiduel
    const successionTaxable = Math.max(0, heir.grossReceived - residualAtDeath);
    const successionDuties = successionTaxable > 0
      ? computeTaxFromBrackets(successionTaxable, profile.brackets).tax
      : 0;
    // Imputation des droits déjà payés
    const netSuccessionDuties = Math.max(0, successionDuties - heir.donationTax);
    additionalSuccessionTax += netSuccessionDuties;
  }

  return {
    label: "Décès avant 15 ans",
    additionalSuccessionTax,
    donationTaxImputed: totalDonationTax,
    netAdditionalCost: additionalSuccessionTax,
    totalCost: totalDonationTax + additionalSuccessionTax,
    rappelFiscal: true,
  };
}

// ─── Applique les donations à la data pour le calcul succession ───────────────
// Retire les biens donnés (PP) ou réduit leur valeur (NP) de la masse successorale
// Vision > 15 ans : abattements pleins, pas de rappel
export function applyDonationsToData(
  donations: DonationItem[],
  data: PatrimonialData
): PatrimonialData {
  if (!donations || donations.length === 0) return data;

  // Deep clone pour ne pas muter l'original
  const d: PatrimonialData = JSON.parse(JSON.stringify(data));

  for (const don of donations) {
    const share = Math.min(100, Math.max(0, n(don.sharePercent))) / 100;

    if (don.assetType === "property" && don.assetIndex < d.properties.length) {
      const prop = d.properties[don.assetIndex];
      const isCommon = prop.ownership === "common" || prop.ownership === "indivision";
      const donorKey = don.donorPersonKey || "person1";

      if (don.donationType === "full") {
        // PP : retirer le bien de la masse
        prop.value = "0";
        prop.loanCapitalRemaining = "0";
        prop.rentGrossAnnual = "0";
      } else {
        // NP : donateur garde l'usufruit, donataire reçoit la NP
        const donorAge = n(don.donorAge) || 60;
        const { nuePropriete } = getDemembrementPercentages(donorAge);
        const currentVal = n(prop.value);
        const npDonated = currentVal * share * nuePropriete;
        prop.value = String(Math.max(0, currentVal - npDonated));

        // Récupérer le premier donataire pour la contrepartie
        const firstHeir = don.heirs?.[0];
        const cpName = firstHeir?.name || "";
        const cpRelation = firstHeir?.relation || "enfant";

        // Mettre à jour le démembrement pour que la collecte reflète la donation
        const cpCounterpart = [{
          id: "donation_cp",
          key: "other",
          birthDate: "",
          relation: cpRelation,
          name: cpName,
          sharePercent: "100",
        }];

        if (isCommon) {
          // Bien commun : côté donateur passe en usufruit avec donataire en NP
          const donorDismemberKey = donorKey === "person1" ? "dismemberP1" : "dismemberP2";
          (prop as any)[donorDismemberKey] = {
            propertyRight: "usufruct",
            counterparts: cpCounterpart,
          };
        } else {
          // Bien propre : propertyRight usufruit + contrepartie NP
          prop.propertyRight = "usufruct";
          prop.counterpartKey = "other";
          prop.counterpartBirthDate = "";
          prop.counterpartRelation = cpRelation;
          prop.counterpartName = cpName;
        }
      }
    } else if (don.assetType === "placement" && don.assetIndex < d.placements.length) {
      const plac = d.placements[don.assetIndex];
      if (don.donationType === "full") {
        const currentVal = n(plac.value);
        plac.value = String(Math.max(0, currentVal * (1 - share)));
      }
    }
  }

  return d;
}
