// src/lib/calculs/donation.ts
// Calcul donation — droits de donation + simulation rappel fiscal succession
// Aucun setState, aucun hook React — fonctions pures

import type { PatrimonialData, DonationItem, DonationHeir } from "../../types/patrimoine";
import { n, getDemembrementPercentages, computeTaxFromBrackets, getAgeFromBirthDate } from "./utils";
import { getSuccessionTaxProfile } from "./succession";
import { resolvePlacementRef, resolvePropertyRef } from "./refs";

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
    const p = resolvePropertyRef(data.properties, { id: donation.assetId, index: donation.assetIndex });
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
  const pl = resolvePlacementRef(data.placements, { id: donation.assetId, index: donation.assetIndex });
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

// ─── Profil fiscal DONATION (distinct de getSuccessionTaxProfile) ─────────────
// Abattements de DONATION verifies le 04/07/2026 (impots.gouv.fr « Donations :
// les abattements » / service-public.fr F14203 / Legifrance CGI) :
//   - enfant / ascendant   100 000 € (CGI art. 779 I)
//   - conjoint / PACS        80 724 € (CGI art. 790 E et 790 F) — EN SUCCESSION le
//                            conjoint est EXONERE (0), mais EN DONATION l'abattement
//                            est 80 724 € : c'est le bug corrige ici (avant, computeDonation
//                            appelait getSuccessionTaxProfile('conjoint') -> 0).
//   - petit-enfant           31 865 € (CGI art. 790 B)
//   - arriere-petit-enfant    5 310 € (CGI art. 790 D)
//   - frere / soeur          15 932 € (CGI art. 779 IV)
//   - neveu / niece           7 967 € (CGI art. 779 V)
//   - tiers / autre               0 € (aucun abattement de droit commun en donation)
//   - handicap            + 159 325 € cumulable avec tout abattement (CGI art. 779 II)
// Bareme : on REUTILISE le bareme ligne directe EXISTANT (getSuccessionTaxProfile
// ('enfant').brackets) pour les liens en ligne directe et conjoint/PACS ; frere-soeur,
// neveu et tiers gardent leur bareme (identique au bareme donation art. 777).
// SIMPLIFICATION ASSUMEE : le bareme conjoint/PACS de donation (art. 777 tableau II,
// tranche 15 932-31 865 a 15 %) est approxime par le bareme ligne directe existant.
export function getDonationTaxProfile(relation: string, handicap = false) {
  const HANDICAP_BONUS = 159325; // CGI art. 779 II — cumulable
  const bonus = handicap ? HANDICAP_BONUS : 0;
  const ligneDirecte = getSuccessionTaxProfile("enfant").brackets;
  switch (relation) {
    case "enfant":
    case "parent":
      return { allowance: 100000 + bonus, brackets: ligneDirecte };
    case "conjoint":
    case "pacs_partner":
      return { allowance: 80724 + bonus, brackets: ligneDirecte };
    case "petit-enfant":
      return { allowance: 31865 + bonus, brackets: ligneDirecte };
    case "arriere-petit-enfant":
      return { allowance: 5310 + bonus, brackets: ligneDirecte };
    case "frereSoeur":
      return { allowance: 15932 + bonus, brackets: getSuccessionTaxProfile("frereSoeur").brackets };
    case "neveuNiece":
      return { allowance: 7967 + bonus, brackets: getSuccessionTaxProfile("neveuNiece").brackets };
    default: // tiers, autre, enfant_conjoint : aucun abattement de droit commun, 60 %
      return { allowance: 0 + bonus, brackets: getSuccessionTaxProfile("autre").brackets };
  }
}

// ─── Mapping vocabulaire membresFamille -> relation DONATION (Lot C) ──────────
// membresFamille (lib/prevoyance/membres-famille) produit un vocabulaire oriente
// SUCCESSION/990 I : conjoint | pacs_partner | autre | enfant | enfant_conjoint.
// Le picker donation attend le vocabulaire DONATION_RELATIONS (enfant, conjoint,
// petit-enfant, frereSoeur, neveuNiece, parent, tiers). Table :
//   enfant          -> enfant
//   conjoint / pacs -> conjoint  (abattement donation 80 724, art. 790 E/F)
//   enfant_conjoint -> tiers     (beau-fils non adopte = tiers fiscal, 0 / 60 %)
//   autre / defaut  -> tiers
export function mapMembreToDonationRelation(relationMembre: string): string {
  switch (relationMembre) {
    case "enfant": return "enfant";
    case "conjoint":
    case "pacs_partner": return "conjoint";
    default: return "tiers"; // enfant_conjoint, autre, inconnu
  }
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

    // Droits de DONATION : profil dedie (abattements donation, fix conjoint). Le
    // rappel fiscal (computeRappelFiscal, scenario deces) garde le profil SUCCESSION.
    const profile = getDonationTaxProfile(heir.relation);
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

    if (don.assetType === "property") {
      const prop = resolvePropertyRef(d.properties, { id: don.assetId, index: don.assetIndex });
      if (!prop) continue;
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
    } else if (don.assetType === "placement") {
      const plac = resolvePlacementRef(d.placements, { id: don.assetId, index: don.assetIndex });
      if (!plac) continue;
      if (don.donationType === "full") {
        const currentVal = n(plac.value);
        plac.value = String(Math.max(0, currentVal * (1 - share)));
      }
    }
  }

  return d;
}
