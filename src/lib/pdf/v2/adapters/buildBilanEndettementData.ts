// ─── Lot Dossier client — Adapter Bilan endettement v2 ───────────────
//
// Calcule le patrimoine net + le taux d'endettement (méthode bancaire) à
// partir des biens immobiliers, placements et crédits du dossier. Tous
// les calculs sont locaux (pas de moteur dédié dans l'app actuelle).

import type { BilanEndettementPageData } from "../pages/pageBilanEndettement";
import { isAV, isPERType } from "../../../calculs/utils";
import { resolveLoanValuesMulti } from "../../../calculs/credit";

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
  const autresCredits = otherLoans.reduce((s, l) => s + num(l.capitalRemaining ?? l.capitalRestant), 0);

  const avEtPER = placements.filter(pl => isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);
  const placementsFinanciers = placements.filter(pl => !isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);

  // ─── Crédits immobiliers via resolveLoanValuesMulti ──────────────
  // Gère le nouveau système multi-crédits (property.loans[]) ET l'ancien
  // (property.loan*). Auto-calcul depuis loanAmount/Rate/Duration si
  // loanCapitalRemaining est vide. Retourne aussi insurancePremiumAnnual.
  let monthlyCreditImmo = 0;
  let annualInsuranceImmo = 0;
  let creditImmobilier = 0;
  for (const p of properties) {
    const r = resolveLoanValuesMulti(p as any);
    monthlyCreditImmo += r.monthlyPayment || 0;
    annualInsuranceImmo += r.insurancePremiumAnnual || 0;
    creditImmobilier += r.capital || 0;
  }
  const monthlyCreditAutre = otherLoans.reduce((s, l) => s + num(l.monthlyPayment), 0);
  const chargesCreditAnnuelles = Math.round((monthlyCreditImmo + monthlyCreditAutre) * 12);
  const assuranceCreditAnnuelle = Math.round(annualInsuranceImmo);

  // ─── Bilan agrégé ─────────────────────────────────────────────────
  const actifBrut = immobilier + placementsFinanciers + avEtPER;
  const passifTotal = creditImmobilier + autresCredits;
  const patrimoineNet = actifBrut - passifTotal;

  // Revenus : salaires + loyers (clé réelle = rentGrossAnnual, déjà annuel)
  const salairesNetsAnnuels = num(data.salary1) + num(data.salary2 || 0);
  const loyersBrutsAnnuels = properties.reduce((s, p) => s + num(p.rentGrossAnnual), 0);
  const quotitLoyers = 0.70;
  const autresRevenusRetenus = num(data.pensions || 0) + num(data.pensions1 || 0) + num(data.pensions2 || 0);

  const totalCharges = chargesCreditAnnuelles + assuranceCreditAnnuelle;
  const totalRevenus = salairesNetsAnnuels + Math.round(loyersBrutsAnnuels * quotitLoyers) + autresRevenusRetenus;
  const tauxEndettementPct = totalRevenus > 0 ? (totalCharges / totalRevenus) * 100 : 0;
  const tauxEndettement = `${tauxEndettementPct.toFixed(1).replace(".", ",")} %`;

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
    notreLecture: p.notreLecture || (() => {
      const seuilHCSF = 35;
      const sousSeuil = tauxEndettementPct < seuilHCSF;
      const margePoints = Math.abs(seuilHCSF - tauxEndettementPct);
      const capaciteResiduelle = Math.max(0, Math.round((seuilHCSF * totalRevenus / 100) - (chargesCreditAnnuelles + assuranceCreditAnnuelle)));

      // Leviers contextuels
      const leviers: string[] = [];
      if (!sousSeuil) {
        leviers.push("renégociation des taux ou rallongement de durée pour réduire la mensualité");
        leviers.push("rachat de crédits si plusieurs prêts en cours");
        leviers.push("vente d'un actif non stratégique pour désendetter");
      } else if (tauxEndettementPct < 20) {
        leviers.push(`capacité résiduelle d'endettement estimée à ${formatEuro(capaciteResiduelle)}/an avant plafond HCSF — opportunité d'investissement immobilier`);
      } else {
        leviers.push("marge présente mais limitée — un nouveau crédit doit être calibré");
      }
      if (avEtPER < immobilier * 0.10) {
        leviers.push("poche financière (AV/PER) faible vs immobilier — diversification à renforcer pour la liquidité d'urgence");
      }

      return `
        <p style="margin:0 0 10px 0">Votre bilan patrimonial révèle la <strong>structure de votre patrimoine</strong> (immobilier, financier, dettes) et votre <strong>capacité d'endettement</strong> selon la méthode bancaire (charges crédit ÷ revenus retenus, loyers à 70 %).</p>
        <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
          <li><strong>Patrimoine net</strong> — ${formatEuro(patrimoineNet)} (actif ${formatEuro(actifBrut)} − dettes ${formatEuro(passifTotal)}). Répartition : immobilier ${formatEuro(immobilier)}, AV/PER ${formatEuro(avEtPER)}, autres placements ${formatEuro(placementsFinanciers)}.</li>
          <li><strong>Charges crédit annuelles</strong> — ${formatEuro(chargesCreditAnnuelles)} de mensualités + ${formatEuro(assuranceCreditAnnuelle)} d'assurance, sur ${formatEuro(totalRevenus)}/an de revenus retenus.</li>
          <li><strong>Position vs plafond HCSF (${seuilHCSF} %)</strong> — Taux d'endettement <strong>${tauxEndettement}</strong>, ${sousSeuil ? `sous le seuil avec une marge de ${margePoints.toFixed(1).replace(".", ",")} points` : `<span style="color:#B0413E">au-dessus du seuil de ${margePoints.toFixed(1).replace(".", ",")} points — refinancement contraint</span>`}.</li>
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

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
