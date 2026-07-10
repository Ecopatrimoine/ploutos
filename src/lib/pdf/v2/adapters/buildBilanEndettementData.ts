// ─── Lot Dossier client — Adapter Bilan endettement v2 ───────────────
//
// Calcule le patrimoine net + le taux d'endettement (méthode bancaire) à
// partir des biens immobiliers, placements et crédits du dossier. Tous
// les calculs sont locaux (pas de moteur dédié dans l'app actuelle).

import type { BilanEndettementPageData } from "../pages/pageBilanEndettement";
import { isAV, isPERType, euro, pct } from "../../../calculs/utils";
import { resolveLoanValuesMulti, resolveOtherLoan } from "../../../calculs/credit";
import { resolveBeneficeTns } from "../../../calculs/ir";
import { computeTauxEndettement } from "../../../calculs/endettement";
import { computeBudget } from "../../../calculs/budget";
import { SEMANTIC_DANGER } from "../tokens";

const isAvOrPer = (type: any): boolean => isAV(type) || isPERType(type);

export type BuildBilanEndettementDataParams = {
  data: Record<string, any>;
  cabinet: Record<string, any>;
  ir?: any;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildBilanEndettementData(p: BuildBilanEndettementDataParams): BilanEndettementPageData {
  const data = p.data || {};
  const cabinet = p.cabinet || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Calculs patrimoine ─────────────────────────────────────────────
  const properties: any[] = Array.isArray(data.properties) ? data.properties : [];
  const placements: any[] = Array.isArray(data.placements) ? data.placements : [];
  const otherLoans: any[] = Array.isArray(data.otherLoans) ? data.otherLoans : [];

  const immobilier = properties.reduce((s, p) => s + num(p.value), 0);
  const autresCredits = otherLoans.reduce((s, l) => s + Math.max(0, resolveOtherLoan(l as any).capitalRemaining), 0); // CRD résolu (saisi ou déduit)

  const avEtPER = placements.filter(pl => isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);
  const placementsFinanciers = placements.filter(pl => !isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);

  // ─── Taux d'endettement : SOURCE UNIQUE (computeTauxEndettement, ecran + PDF) ──
  const res = computeTauxEndettement(data as any);
  const tauxEndettementPct = res.tauxPct;
  const tauxEndettement = pct(res.tauxPct / 100, 1);

  // ─── Sous-totaux de DETAIL pour l'encart pedagogique. Ils refletent la meme
  // formule que res (assurance autres, CA TNS net, pensions fallback) : leur
  // somme == numerateur/denominateur de res, donc l'encart affiche le MEME
  // taux. res reste la source du chiffre-cle (KPI + note).
  let monthlyCreditImmo = 0;
  let annualInsuranceImmo = 0;
  let creditImmobilier = 0;
  for (const p of properties) {
    const r = resolveLoanValuesMulti(p as any);
    monthlyCreditImmo += r.monthlyPayment || 0;
    annualInsuranceImmo += r.insurancePremiumAnnual || 0;
    creditImmobilier += r.capital || 0;
  }
  const monthlyCreditAutre = otherLoans.reduce((s, l) => s + resolveOtherLoan(l as any).monthlyPayment, 0);
  // Assurance des autres credits : annuelle, comptee seulement si hasInsurance (cf endettement.ts).
  const assuranceCreditAutre = otherLoans.reduce((s, l) => s + (l.hasInsurance ? num(l.insurancePremium) : 0), 0);
  const chargesCreditAnnuelles = Math.round((monthlyCreditImmo + monthlyCreditAutre) * 12);
  const assuranceCreditAnnuelle = Math.round(annualInsuranceImmo + assuranceCreditAutre);

  // ─── Bilan agrégé ─────────────────────────────────────────────────
  const actifBrut = immobilier + placementsFinanciers + avEtPER;
  const passifTotal = creditImmobilier + autresCredits;
  const patrimoineNet = actifBrut - passifTotal;

  // Revenus retenus (memes termes que res) : salaires + CA TNS NET + pensions
  // (fallback safe, jamais la somme des 3) + loyers ponderes x0,70.
  const salairesNetsAnnuels = num(data.salary1) + num(data.salary2 || 0) + resolveBeneficeTns(data as any, 1) + resolveBeneficeTns(data as any, 2);
  const loyersBrutsAnnuels = properties.reduce((s, p) => s + num(p.rentGrossAnnual), 0);
  const quotitLoyers = 0.70;
  const pP1 = num(data.pensions1 || 0);
  const pP2 = num(data.pensions2 || 0);
  const autresRevenusRetenus = pP1 + pP2 > 0 ? pP1 + pP2 : num(data.pensions || 0);

  const totalCharges = chargesCreditAnnuelles + assuranceCreditAnnuelle;
  const totalRevenus = salairesNetsAnnuels + Math.round(loyersBrutsAnnuels * quotitLoyers) + autresRevenusRetenus;

  // ─── Budget & capacite d'epargne (Lot D) : SOURCE UNIQUE computeBudget, AUCUN
  // recalcul local. `ir` vient du payload (App.tsx useMemo) deja passe par
  // concatPack. Base budget : loyers a 100 % (distincte des 70 % bancaires). ──
  const b = computeBudget(data as any, p.ir || {});
  const budget = {
    salairesPensions: b.detail.salairesPensions,
    beneficeTns: b.detail.beneficeTns,
    rentesPer: b.detail.rentesPer,
    loyersBruts: b.detail.loyersBruts,
    retraitsAvPer: b.detail.retraitsAvPer,
    revenusMensuels: b.revenusMensuels,
    chargesCourantes: b.detail.chargesCourantes,
    chargesFoncieres: b.detail.chargesFoncieres,
    creditsAssurances: b.detail.creditsAssurances,
    impots: b.detail.impots,
    pensionVersee: b.detail.pensionVersee,
    chargesMensuelles: b.chargesMensuelles,
    capaciteEpargne: b.capaciteEpargne,
    hasChargesCourantes: b.hasChargesCourantes,
  };

  return {
    clientName,
    dateStr,
    patrimoineNet,
    actifBrut,
    passifTotal,
    tauxEndettement,
    noteKpi: "Taux d'endettement (méthode bancaire) : charges de crédit, assurance comprise, ÷ revenus nets retenus — loyers comptés à 70 %. Plafond HCSF de 35 %.",
    calculTaux: {
      chargesCreditAnnuelles,
      assuranceCreditAnnuelle,
      salairesNetsAnnuels,
      loyersBrutsAnnuels,
      quotitLoyers,
      autresRevenusRetenus,
    },
    immobilier,
    placementsFinanciers,
    assuranceVieEtPER: avEtPER,
    creditImmobilier,
    autresCredits,
    budget,
    notreLecture: p.notreLecture || (() => {
      const seuilHCSF = 35;
      const sousSeuil = tauxEndettementPct < seuilHCSF;
      const margePoints = Math.abs(seuilHCSF - tauxEndettementPct);
      // Points d'écart HCSF (unité = points de %, pas €/%) — format FR sans toFixed rendu.
      const margePointsFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(margePoints);
      const capaciteResiduelle = Math.max(0, Math.round((seuilHCSF * totalRevenus / 100) - (chargesCreditAnnuelles + assuranceCreditAnnuelle)));

      // Leviers contextuels
      const leviers: string[] = [];
      if (!sousSeuil) {
        leviers.push("renégociation des taux ou rallongement de durée pour réduire la mensualité");
        leviers.push("rachat de crédits si plusieurs prêts en cours");
        leviers.push("vente d'un actif non stratégique pour désendetter");
      } else if (tauxEndettementPct < 20) {
        leviers.push(`capacité résiduelle d'endettement estimée à ${euro(capaciteResiduelle)}/an avant plafond HCSF — opportunité d'investissement immobilier`);
      } else {
        leviers.push("marge présente mais limitée — un nouveau crédit doit être calibré");
      }
      if (avEtPER < immobilier * 0.10) {
        leviers.push("poche financière (AV/PER) faible vs immobilier — diversification à renforcer pour la liquidité d'urgence");
      }

      return `
        <p style="margin:0 0 10px 0">Votre bilan patrimonial révèle la <strong>structure de votre patrimoine</strong> (immobilier, financier, dettes) et votre <strong>capacité d'endettement</strong> selon la méthode bancaire (charges crédit ÷ revenus retenus, loyers à 70 %).</p>
        <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
          <li><strong>Patrimoine net</strong> — ${euro(patrimoineNet)} (actif ${euro(actifBrut)} − dettes ${euro(passifTotal)}). Répartition : immobilier ${euro(immobilier)}, AV/PER ${euro(avEtPER)}, autres placements ${euro(placementsFinanciers)}.</li>
          <li><strong>Charges crédit annuelles</strong> — ${euro(chargesCreditAnnuelles)} de mensualités + ${euro(assuranceCreditAnnuelle)} d'assurance, sur ${euro(totalRevenus)}/an de revenus retenus.</li>
          <li><strong>Position vs plafond HCSF (${seuilHCSF} %)</strong> — Taux d'endettement <strong>${tauxEndettement}</strong>, ${sousSeuil ? `sous le seuil avec une marge de ${margePointsFmt} points` : `<span style="color:${SEMANTIC_DANGER}">au-dessus du seuil de ${margePointsFmt} points — refinancement contraint</span>`}.</li>
        </ul>
        <p style="margin:0;font-style:italic;color:#6B6353"><strong>Leviers à étudier :</strong> ${leviers.join(" ; ")}.</p>
      `.trim();
    })(),
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Patrimoine — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}


function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
