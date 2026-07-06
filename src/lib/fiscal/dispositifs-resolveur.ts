// ─── Résolveur pur des dispositifs fiscaux immobiliers (Lot D1) ───────────────
//
// AUCUNE dépendance à ir.ts : ce module calcule, à partir d'un bien et d'une
// année fiscale (toujours passée en paramètre, jamais Date.now()), la fraction
// annuelle d'avantage fiscal. Le câblage au moteur (deux branches de computeIR)
// est le Lot D2. Toutes les valeurs proviennent du référentiel millésimé
// data/fiscal/dispositifs-fiscaux.json.
import type { Property } from "../../types/patrimoine";
import { n, dispositifsPourNature } from "../calculs/utils";
import { DISPOSITIFS_FISCAUX } from "../../constants";
import ref from "../../data/fiscal/dispositifs-fiscaux.json";

const labelOf = (id: string) => DISPOSITIFS_FISCAUX.find((d) => d.value === id)?.label ?? id;
const anneeDe = (dateISO: string) => Number(String(dateISO).slice(0, 4));

// Categorie de plafonnement global (art. 200-0 A CGI) : 'commun' = enveloppe
// 10 000 EUR ; 'majore' = enveloppe majoree 18 000 EUR (outre-mer / Sofica) ;
// false = hors plafond. Type PARTAGE avec le socle ir.ts (ReductionIR).
export type PlafondNiches = 'commun' | 'majore' | false;
// Normalise la valeur brute du referentiel (JSON) : seules 'commun' / 'majore'
// sont retenues, tout le reste (true/false/undefined) => false (hors plafond).
export const normPlafondNiches = (v: unknown): PlafondNiches =>
  v === 'commun' || v === 'majore' ? v : false;

// ── Réduction d'IR (Pinel/Pinel+/Denormandie/Censi/Loc'Avantages) ─────────────
export interface ReductionDispositif {
  id: string;
  label: string;
  montant: number;            // fraction annuelle imputable cette année fiscale
  plafondNiches: PlafondNiches; // categorie de plafond global 200-0 A (Lot B / double enveloppe)
  phase: "engagement" | "prorogation" | "locavantages";
  anneeFiscale: number;
}
export interface StatutDispositif {
  statut: "eteint" | "incoherent" | "incomplet";
  motif: string;
}
// null = pas de dispositif du tout ; StatutDispositif = présent mais inactif
// (jamais silencieux, pour l'affichage Lot D2) ; ReductionDispositif = actif.
export type ResolutionReduction = ReductionDispositif | StatutDispositif | null;
export const estReduction = (r: ResolutionReduction): r is ReductionDispositif =>
  r !== null && "montant" in r;

type Bien = Partial<Property>;

export function resolveReductionDispositif(bien: Bien, anneeFiscale: number): ResolutionReduction {
  const dispo = bien.dispositifFiscal as string | undefined; // "" possible (Lot C : bascule Aucun)
  if (!dispo || dispo === "aucun") return null;
  // Jeanbrun est une DÉDUCTION foncière : hors de cette fonction (voir resolveDeductionsJeanbrun).
  if (dispo === "jeanbrunRelanceLogement") return null;
  const type = bien.type ?? "";

  // Règle Censi : détention directe uniquement (motif dédié avant la règle générale).
  if (dispo === "censiBouvard" && (type === "SCPI" || type === "SCI IR")) {
    return { statut: "incoherent", motif: "Censi-Bouvard : detention directe uniquement (SCPI et societes exclues)" };
  }
  // Cohérence nature (matrice Lot C partagée).
  if (!dispositifsPourNature(type).includes(dispo)) {
    return { statut: "incoherent", motif: `dispositif ${labelOf(dispo)} incoherent avec la nature ${type}` };
  }
  const cfg = (ref.reductionsIR as Record<string, any>)[dispo];
  if (!cfg) return { statut: "incomplet", motif: `dispositif ${dispo} non reference` };

  if (dispo === "locavantages") return resoudreLocavantages(bien, anneeFiscale, cfg, dispo);
  if (dispo === "censiBouvard") return resoudreCensi(bien, anneeFiscale, cfg, dispo);
  return resoudrePinelFamille(bien, anneeFiscale, cfg, dispo);
}

function resoudrePinelFamille(bien: Bien, anneeFiscale: number, cfg: any, dispo: string): ResolutionReduction {
  const annee = n(bien.dispositifAnnee);
  const base0 = n(bien.dispositifBase);
  const eng = bien.dispositifEngagementAns; // "6" | "9"
  if (!annee || !base0 || !eng) return { statut: "incomplet", motif: "annee d'investissement, base ou engagement manquant" };
  const base = Math.min(base0, cfg.plafondBase);
  const m = (cfg.millesimes as any[]).find((w) => annee >= w.de && annee <= w.a);
  if (!m) return { statut: "incoherent", motif: `annee d'investissement ${annee} hors fenetre du dispositif (fin ${cfg.finInvestissement})` };
  const tauxEng = m.taux[eng];
  if (tauxEng === undefined) return { statut: "incomplet", motif: `engagement ${eng} ans non prevu pour ce millesime` };
  const engN = Number(eng);
  const engEnd = annee + engN - 1;
  if (anneeFiscale < annee) return { statut: "eteint", motif: `annee fiscale ${anneeFiscale} anterieure a l'investissement (${annee})` };
  if (anneeFiscale <= engEnd) {
    return { id: dispo, label: labelOf(dispo), montant: base * tauxEng / engN, plafondNiches: normPlafondNiches(cfg.plafondNiches), phase: "engagement", anneeFiscale };
  }
  // Phase de prorogation : seules les périodes DÉCLARÉES (dispositifProrogation) comptent.
  const P = Number(bien.dispositifProrogation || "0");
  const prorogs: number[] = m.prorogations?.[eng] ?? [];
  for (let k = 1; k <= P; k++) {
    const taux = prorogs[k - 1];
    if (taux === undefined) break;
    const pStart = annee + engN + 3 * (k - 1);
    const pEnd = pStart + 2;
    if (anneeFiscale >= pStart && anneeFiscale <= pEnd) {
      return { id: dispo, label: labelOf(dispo), montant: base * taux / 3, plafondNiches: normPlafondNiches(cfg.plafondNiches), phase: "prorogation", anneeFiscale };
    }
  }
  return { statut: "eteint", motif: `reduction terminee en ${engEnd} (aucune prorogation declaree couvrant ${anneeFiscale})` };
}

function resoudreCensi(bien: Bien, anneeFiscale: number, cfg: any, dispo: string): ResolutionReduction {
  const annee = n(bien.dispositifAnnee);
  const base0 = n(bien.dispositifBase);
  if (!annee || !base0) return { statut: "incomplet", motif: "annee d'investissement ou base manquant" };
  const deb = anneeDe(cfg.debutInvestissement);
  const fin = anneeDe(cfg.finInvestissement);
  if (annee < deb || annee > fin) return { statut: "incoherent", motif: `annee ${annee} hors fenetre Censi-Bouvard (${deb}-${fin})` };
  const base = Math.min(base0, cfg.plafondBase);
  const duree = cfg.dureeAns;
  const engEnd = annee + duree - 1;
  if (anneeFiscale < annee) return { statut: "eteint", motif: `annee fiscale ${anneeFiscale} anterieure a l'investissement (${annee})` };
  if (anneeFiscale <= engEnd) {
    return { id: dispo, label: labelOf(dispo), montant: base * cfg.taux / duree, plafondNiches: normPlafondNiches(cfg.plafondNiches), phase: "engagement", anneeFiscale };
  }
  return { statut: "eteint", motif: `reduction terminee en ${engEnd} (report 6 ans non modelise)` };
}

function resoudreLocavantages(bien: Bien, anneeFiscale: number, cfg: any, dispo: string): ResolutionReduction {
  const annee = n(bien.dispositifAnnee); // prise d'effet de la convention
  const niveau = bien.dispositifNiveauLoyer; // loc1 | loc2 | loc3
  const loyers = n(bien.rentGrossAnnual);
  if (!annee || !niveau) return { statut: "incomplet", motif: "annee de prise d'effet ou niveau de loyer manquant" };
  const tx = (cfg.tauxLoyers as Record<string, any>)[niveau];
  if (!tx) return { statut: "incoherent", motif: `niveau de loyer ${niveau} inconnu pour Loc'Avantages` };
  const interm = !!bien.dispositifIntermediation;
  const taux = interm ? tx.avec : tx.sans;
  if (taux === undefined) {
    return { statut: "incoherent", motif: `Loc'Avantages ${niveau} : intermediation locative obligatoire (aucun taux sans IML)` };
  }
  if (!loyers) return { statut: "incomplet", motif: "loyers bruts annuels non renseignes" };
  if (anneeFiscale < annee) return { statut: "eteint", motif: `annee fiscale ${anneeFiscale} avant la prise d'effet (${annee})` };
  // Convention 6 ans min RECONDUCTIBLE : pas de coupure automatique en sortie (cf JSON _comment).
  return { id: dispo, label: labelOf(dispo), montant: loyers * taux, plafondNiches: normPlafondNiches(cfg.plafondNiches), phase: "locavantages", anneeFiscale };
}

// ── Déduction foncière Jeanbrun (amortissement, HORS plafond 200-0 A) ─────────
export interface JeanbrunParBien {
  id: string;
  montantBrut: number;
  montantRetenu: number;
  motif?: string; // présent si le bien est écarté (démembrement, hors fenêtre, incomplet)
}
export interface JeanbrunResultat {
  parBien: JeanbrunParBien[];
  plafondFoyer: number;
  ecretement: number;
}

export function resolveDeductionsJeanbrun(biens: Bien[], anneeFiscale: number): JeanbrunResultat {
  const cfg = (ref.deductionsFoncieres as any).jeanbrunRelanceLogement;
  const debYear = anneeDe(cfg.debutAcquisition);
  const finYear = anneeDe(cfg.finAcquisition);
  const eligibles = biens.filter((b) => b.dispositifFiscal === "jeanbrunRelanceLogement");
  const actifs: { id: string; brut: number; niveau: string; rent: number }[] = [];
  const ecartes: JeanbrunParBien[] = [];

  for (const b of eligibles) {
    const id = String(b.id ?? "");
    // Démembrement exclu (art. 47 LF 2026).
    if (b.dismemberP1 || b.dismemberP2 || (b.propertyRight && b.propertyRight !== "full")) {
      ecartes.push({ id, montantBrut: 0, montantRetenu: 0, motif: "bien demembre : exclu (art. 47 LF 2026)" });
      continue;
    }
    const annee = n(b.dispositifAnnee);
    if (!annee || annee < debYear || annee > finYear) {
      ecartes.push({ id, montantBrut: 0, montantRetenu: 0, motif: `hors fenetre d'acquisition (${debYear}-${finYear})` });
      continue;
    }
    const finAmort = annee + cfg.engagementAns - 1;
    if (anneeFiscale < annee || anneeFiscale > finAmort) {
      ecartes.push({ id, montantBrut: 0, montantRetenu: 0, motif: `hors periode d'amortissement (${annee}-${finAmort})` });
      continue;
    }
    const base = n(b.dispositifBase);
    const neufAncien = b.dispositifNeufAncien;
    const niveau = b.dispositifNiveauLoyer;
    if (!base || !neufAncien || !niveau) {
      ecartes.push({ id, montantBrut: 0, montantRetenu: 0, motif: "base, neuf/ancien ou niveau de loyer manquant" });
      continue;
    }
    const taux = cfg.taux?.[neufAncien]?.[niveau];
    if (taux === undefined) {
      ecartes.push({ id, montantBrut: 0, montantRetenu: 0, motif: `taux introuvable (${neufAncien}/${niveau})` });
      continue;
    }
    const assiette = base * cfg.assiettePct; // base x 0.80
    actifs.push({ id, brut: assiette * taux, niveau, rent: n(b.rentGrossAnnual) });
  }

  const plafondFoyer = determinerPlafondFoyer(actifs, cfg.plafondsFoyer);
  const totalBrut = actifs.reduce((s, a) => s + a.brut, 0);
  const facteur = totalBrut > plafondFoyer && totalBrut > 0 ? plafondFoyer / totalBrut : 1;
  const ecretement = Math.max(0, totalBrut - plafondFoyer);
  const parBien: JeanbrunParBien[] = [
    ...ecartes,
    ...actifs.map((a) => ({ id: a.id, montantBrut: a.brut, montantRetenu: a.brut * facteur })),
  ];
  return { parBien, plafondFoyer, ecretement };
}

// Plafond foyer i+j COMMUN. Approximation v1 documentée : pondération par les
// loyers si saisis (le plafond du niveau le plus élevé atteignant >= 50 % des
// loyers amortis, cumul du haut vers le bas) ; sinon 8000 conservateur.
function determinerPlafondFoyer(actifs: { niveau: string; rent: number }[], plafonds: Record<string, number>): number {
  const base = plafonds.intermediaire; // 8000
  const totalRent = actifs.reduce((s, a) => s + a.rent, 0);
  if (totalRent <= 0) return base;
  let cumul = 0;
  for (const niveau of ["tresSocial", "social", "intermediaire"]) {
    cumul += actifs.filter((a) => a.niveau === niveau).reduce((s, a) => s + a.rent, 0);
    if (cumul / totalRent >= 0.5) return plafonds[niveau];
  }
  return base;
}
