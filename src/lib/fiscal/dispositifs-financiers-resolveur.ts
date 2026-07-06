// ─── Résolveur pur des dispositifs financiers de défiscalisation (Lot 1) ───────
//
// Miroir de dispositifs-resolveur.ts (immobilier), pour les réductions d'IR sur
// investissements financiers : IR-PME, FCPI, FCPI JEI, FIP (métropole / Corse /
// outre-mer), SOFICA, Girardin industriel. AUCUNE dépendance à ir.ts : à partir
// d'un bloc `defiscalisation` (porté par un Placement), d'une année fiscale
// (toujours passée en paramètre, jamais Date.now()) et d'un contexte foyer
// (couple + RNG pour la SOFICA), calcule la réduction imputable cette année.
//
// Règle d'ouverture : une réduction n'est générée QUE si l'ANNÉE de
// dateInvestissement == année simulée ET que la date tombe dans une fenêtre
// active du référentiel. Sinon : soit `null` (investissement d'une autre année :
// comportement NORMAL, aucune alerte), soit montant 0 + alerte « hors fenêtre »
// (investissement de l'année mais dispositif clos/non ouvert). Le placement est
// toujours conservé au patrimoine (le résolveur ne le supprime jamais).
//
// Toutes les valeurs proviennent du référentiel millésimé
// data/fiscal/dispositifs-financiers.json.
import type { DefiscalisationPlacement, DispositifFinancier } from "../../types/patrimoine";
import { n } from "../calculs/utils";
import { normPlafondNiches, type PlafondNiches } from "./dispositifs-resolveur";
import ref from "../../data/fiscal/dispositifs-financiers.json";

const anneeDe = (dateISO: string) => Number(String(dateISO).slice(0, 4));

const LABELS: Record<DispositifFinancier, string> = {
  irpme: "IR-PME",
  fcpi: "FCPI",
  fcpiJei: "FCPI JEI",
  fipMetropole: "FIP Métropole",
  fipCorse: "FIP Corse",
  fipOutreMer: "FIP Outre-mer",
  sofica: "SOFICA",
  girardinIndustriel: "Girardin industriel",
};

// Alertes DOUCES (jamais de hard lock) — exposées pour l'UI (Lot 2).
export type CodeAlerteDefisc = "hors_fenetre" | "excedent_versement" | "sortie_avant_engagement";
export type AlerteDefisc = { code: CodeAlerteDefisc; message: string };

export interface ReductionFinanciere {
  id: DispositifFinancier;
  label: string;
  montant: number;            // réduction BRUTE imputable cette année (avant écrêtement niches)
  plafondNiches: PlafondNiches;
  fractionPlafond?: number;   // part du montant consommant l'enveloppe (SOFICA 1, Girardin 0.44/0.34)
  baseRetenue: number;        // base après plafonnement de versement (info UI)
  alertes: AlerteDefisc[];
}
// null = aucune réduction pour l'année simulée (pas de bloc, ou investissement une AUTRE année).
export type ResolutionFinanciere = ReductionFinanciere | null;

export function resolveReductionFinanciere(
  defisc: DefiscalisationPlacement | undefined,
  anneeFiscale: number,
  ctx: { couple: boolean; rng: number },
): ResolutionFinanciere {
  if (!defisc || !defisc.dispositif) return null;
  const cfg = (ref as Record<string, any>)[defisc.dispositif];
  if (!cfg) return null;

  const dateInv = defisc.dateInvestissement;
  if (!dateInv) return null;
  // Ouverture du droit seulement l'année de l'investissement (C8 : autre année -> null, normal).
  if (anneeDe(dateInv) !== anneeFiscale) return null;

  const id = defisc.dispositif;
  const label = LABELS[id];
  const plafondNiches = normPlafondNiches(cfg.plafondNiches);
  const alertes: AlerteDefisc[] = [];

  // Fenêtre active couvrant la date d'investissement (comparaison lexicographique ISO).
  const fenetre = (cfg.fenetres as any[]).find((f) => dateInv >= f.du && dateInv <= f.au);
  if (!fenetre) {
    alertes.push({ code: "hors_fenetre", message: `${label} : investissement du ${dateInv} hors fenêtre active (dispositif clos ou non encore ouvert).` });
    return { id, label, montant: 0, plafondNiches, baseRetenue: 0, alertes };
  }

  // Alerte reprise : sortie prévue avant la fin de l'engagement (N + dureeEngagementAnnees).
  const dureeEng = Number(cfg.dureeEngagementAnnees) || 0;
  if (defisc.dateSortiePrevue && dureeEng > 0 && anneeDe(defisc.dateSortiePrevue) < anneeDe(dateInv) + dureeEng) {
    alertes.push({ code: "sortie_avant_engagement", message: `${label} : sortie prévue en ${anneeDe(defisc.dateSortiePrevue)} avant la fin d'engagement (${anneeDe(dateInv) + dureeEng}) — risque de reprise de la réduction.` });
  }

  // ── Girardin industriel : réduction SAISIE, fractionPlafond selon le régime ──
  if (id === "girardinIndustriel") {
    const montant = n(defisc.montantReductionGirardin);
    const regime = defisc.regimeGirardin ?? "pleinDroit";
    const fractionPlafond = (cfg.fractionParRegime as Record<string, number>)[regime];
    return { id, label, montant, plafondNiches, fractionPlafond, baseRetenue: montant, alertes };
  }

  // ── SOFICA : base = min(versement, 25% RNG, 18000) ; taux 30/36/48% ──
  if (id === "sofica") {
    const versement = n(defisc.montantSouscrit);
    const clef = defisc.tauxSofica ?? String(cfg.tauxClefDefaut);
    const taux = (cfg.tauxParClef as Record<string, number>)[clef] ?? (cfg.tauxParClef as Record<string, number>)[String(cfg.tauxClefDefaut)];
    const base = Math.min(versement, ctx.rng * Number(cfg.plafondBasePctRNG), Number(cfg.plafondBaseAbsolu));
    const montant = base * taux;
    return { id, label, montant, plafondNiches, fractionPlafond: Number(cfg.fractionPlafond) || 1, baseRetenue: base, alertes };
  }

  // ── Autres : base = min(versement, plafond selon situation familiale) ──
  const versement = n(defisc.montantSouscrit);
  const plafondVers = ctx.couple ? Number(cfg.plafondsVersement.couple) : Number(cfg.plafondsVersement.seul);
  const base = Math.min(versement, plafondVers);
  if (versement > plafondVers) {
    alertes.push({ code: "excedent_versement", message: `${label} : versement ${versement} € au-delà du plafond ${plafondVers} € — excédent de ${versement - plafondVers} € non réductible ni reportable en v1.` });
  }

  // FCPI JEI : hors plafond global mais plafond PROPRE de réduction (cumul 2024-2028).
  if (id === "fcpiJei") {
    const brut = base * Number(fenetre.taux);
    const dejaConsommee = n(defisc.reductionJeiDejaConsommee ?? "0");
    const restantPropre = Math.max(0, Number(cfg.plafondReductionPropre) - dejaConsommee);
    const montant = Math.min(brut, restantPropre);
    return { id, label, montant, plafondNiches, baseRetenue: base, alertes };
  }

  // IR-PME / FCPI / FIP : réduction = base × taux de la fenêtre.
  const montant = base * Number(fenetre.taux);
  return { id, label, montant, plafondNiches, baseRetenue: base, alertes };
}
