// Bilan patrimonial net = actif brut − passif total. Fonction PURE, locale (l'app n'a
// pas de moteur de bilan dédié). MÊME formule que l'adapter PDF buildBilanEndettementData
// (source de vérité de la « Patrimoine net ») : valeurs d'actif arrondies à l'euro comme
// là-bas, dettes via les resolvers de crédit. Consommée par l'écran (perspective IFI)
// sans recalcul divergent — garder les deux alignées si la formule évolue.
import { isAV, isPERType } from "./utils";
import { resolveLoanValuesMulti, resolveOtherLoan } from "./credit";

// Parseur identique à buildBilanEndettementData.num (arrondi à l'euro) pour cohérence exacte.
function num(v: any): number {
  const parsed = typeof v === "string" ? parseFloat(v.replace(/\s/g, "").replace(",", ".")) : (v || 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}
const isAvOrPer = (type: any): boolean => isAV(type) || isPERType(type);

export type PatrimoineNet = {
  immobilier: number;
  avEtPER: number;
  placementsFinanciers: number;
  actifBrut: number;
  creditImmobilier: number;
  autresCredits: number;
  passifTotal: number;
  patrimoineNet: number;
};

export function computePatrimoineNet(data: any): PatrimoineNet {
  const properties: any[] = Array.isArray(data?.properties) ? data.properties : [];
  const placements: any[] = Array.isArray(data?.placements) ? data.placements : [];
  const otherLoans: any[] = Array.isArray(data?.otherLoans) ? data.otherLoans : [];

  const immobilier = properties.reduce((s, p) => s + num(p.value), 0);
  const avEtPER = placements.filter((pl) => isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);
  const placementsFinanciers = placements.filter((pl) => !isAvOrPer(pl.type)).reduce((s, pl) => s + num(pl.value), 0);
  const creditImmobilier = properties.reduce((s, p) => s + (resolveLoanValuesMulti(p as any).capital || 0), 0);
  const autresCredits = otherLoans.reduce((s, l) => s + Math.max(0, resolveOtherLoan(l as any).capitalRemaining), 0);

  const actifBrut = immobilier + placementsFinanciers + avEtPER;
  const passifTotal = creditImmobilier + autresCredits;
  return { immobilier, avEtPER, placementsFinanciers, actifBrut, creditImmobilier, autresCredits, passifTotal, patrimoineNet: actifBrut - passifTotal };
}
