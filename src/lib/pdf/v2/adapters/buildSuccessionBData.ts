// ─── Lot Dossier client — Adapter Succession B (AV & transmission) ───
//
// Reprend les bénéficiaires de l'assurance-vie depuis le résultat
// succession + computeSuccession (volet AV/PER) et calcule le total
// consolidé transmis (succession + AV).

import type { SuccessionBPageData, BeneficiaireAV } from "../pages/pageSuccessionB";

const ABATTEMENT_990I = 152_500;

export type BuildSuccessionBDataParams = {
  succession: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildSuccessionBData(p: BuildSuccessionBDataParams): SuccessionBPageData {
  const s = p.succession || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  // ─── Bénéficiaires AV ─────────────────────────────────────────────
  // Clé réelle : succession.avLines[] = lignes individuelles (1 par contrat
  // × bénéficiaire). On agrège par bénéficiaire pour la page (un même nom
  // peut avoir plusieurs contrats AV/PER).
  const avLines: any[] = Array.isArray(s.avLines) ? s.avLines : [];

  const benefMap = new Map<string, { amount: number; tax: number; relation: string }>();
  for (const line of avLines) {
    const key = String(line.beneficiary || "Bénéficiaire");
    if (!benefMap.has(key)) {
      benefMap.set(key, { amount: 0, tax: 0, relation: line.relation || "—" });
    }
    const agg = benefMap.get(key)!;
    agg.amount += num(line.amount ?? 0);
    agg.tax += num(line.totalTax ?? 0);
  }

  const beneficiaires: BeneficiaireAV[] = Array.from(benefMap.entries()).map(([nom, agg]) => ({
    nom,
    lien: relationLabel(agg.relation),
    capital: agg.amount,
    abattement990I: ABATTEMENT_990I,
    fiscalite: agg.tax,
    net: agg.amount - agg.tax,
  }));

  // KPI
  const capitauxTransmis = beneficiaires.reduce((s, b) => s + b.capital, 0);
  const fiscaliteTotale = beneficiaires.reduce((s, b) => s + b.fiscalite, 0);
  const netAuxBeneficiaires = capitauxTransmis - fiscaliteTotale;

  // Abattement restant : approximation par bénéficiaire (152 500 € × nb − capital cumulé)
  const abattementTotal = ABATTEMENT_990I * Math.max(1, beneficiaires.length);
  const abattementRestant = Math.max(0, abattementTotal - capitauxTransmis);

  // Total consolidé succession + AV
  const masseSuccessoraleCivile = num(s.activeNet ?? s.netCivil ?? 0);
  const droitsSuccession = num(s.totalRights ?? s.totalTax ?? 0);
  const netCivilTransmis = masseSuccessoraleCivile - droitsSuccession;
  const totalNetTransmis = netCivilTransmis + netAuxBeneficiaires;

  return {
    clientName,
    dateStr,
    capitauxTransmis,
    fiscaliteTotale,
    netAuxBeneficiaires,
    abattementRestant,
    noteKpi: "Régime : 990 I pour les versements avant 70 ans (abattement de 152 500 € par bénéficiaire) ; 757 B après 70 ans (abattement global de 30 500 €).",
    beneficiaires,
    clauseBeneficiaireHtml: data.clauseBeneficiaire || "Clause bénéficiaire retenue : <em>mes enfants vivants ou représentés, par parts égales</em>.",
    totalNetTransmis,
    totalLabelHaut: "Total transmis net aux proches",
    totalLabelBas: "(succession + assurance-vie)",
    notreLecture: p.notreLecture || (fiscaliteTotale === 0
      ? `Les capitaux décès s'élèvent à ${formatEuro(capitauxTransmis)} et restent intégralement transmis grâce aux abattements 990 I (152 500 € par bénéficiaire).`
      : `Les capitaux décès s'élèvent à ${formatEuro(capitauxTransmis)}, dont ${formatEuro(fiscaliteTotale)} de fiscalité due (dépassement des abattements 990 I).`),
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Transmission — confidentiel`,
  };
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function relationLabel(r: any): string {
  if (!r) return "Bénéficiaire";
  const map: Record<string, string> = { conjoint: "Conjoint", enfant: "Enfant", parent: "Parent", autre: "Autre" };
  return map[String(r).toLowerCase()] || String(r);
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
