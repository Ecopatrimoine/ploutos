// ─── Lot Dossier client — Adapter Bilan endettement v2 ───────────────
//
// Calcule le patrimoine net + le taux d'endettement (méthode bancaire) à
// partir des biens immobiliers, placements et crédits du dossier. Tous
// les calculs sont locaux (pas de moteur dédié dans l'app actuelle).

import type { BilanEndettementPageData } from "../pages/pageBilanEndettement";

const isAvOrPer = (type: any): boolean => {
  const t = String(type || "").toLowerCase();
  return t.includes("assurance") || t.includes("av") || t.includes("per");
};

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
  const creditImmobilier = properties.reduce((s, p) => s + num(p.loanCapitalRemaining), 0);
  const autresCredits = otherLoans.reduce((s, l) => s + num(l.capitalRemaining ?? l.capitalRestant), 0);

  const avEtPER = placements.filter(pl => isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);
  const placementsFinanciers = placements.filter(pl => !isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);

  const actifBrut = immobilier + placementsFinanciers + avEtPER;
  const passifTotal = creditImmobilier + autresCredits;
  const patrimoineNet = actifBrut - passifTotal;

  // ─── Calcul taux endettement méthode bancaire ──────────────────────
  // Sommes mensuelles → annuelles. Quotité loyers HCSF = 70 %.
  const monthlyCredit = properties.reduce((s, p) => s + num(p.loanMonthlyPayment), 0)
                      + otherLoans.reduce((s, l) => s + num(l.monthlyPayment ?? l.mensualite), 0);
  const monthlyInsurance = properties.reduce((s, p) => {
    if (!p.loanInsurance) return s;
    return s + num(p.loanMonthlyInsurance);
  }, 0);
  const chargesCreditAnnuelles = Math.round(monthlyCredit * 12);
  const assuranceCreditAnnuelle = Math.round(monthlyInsurance * 12);

  const salairesNetsAnnuels = num(data.salary1) + num(data.salary2 || 0);
  const loyersBrutsAnnuels = properties.reduce((s, p) => s + (num(p.monthlyRent) * 12), 0);
  const quotitLoyers = 0.70;
  const autresRevenusRetenus = num(data.pensions || 0);

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
    notreLecture: p.notreLecture || `Votre patrimoine net atteint ${formatEuro(patrimoineNet)}, porté par l'immobilier (${formatEuro(immobilier)} bruts) et une poche financière de ${formatEuro(placementsFinanciers + avEtPER)}, après ${formatEuro(passifTotal)} de crédits. Calculé à la manière des banques, votre taux d'endettement ressort à ${tauxEndettement}.`,
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
