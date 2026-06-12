// ─── Obligations de branche (CCN) — checklist structuree cote ENTREPRISE ─────
//
// Module PUR (LOT OBLIGATIONS). Produit, pour UNE convention collective (IDCC),
// la liste structuree des OBLIGATIONS employeur de branche, par college (cadres /
// nonCadres), destinee a un audit ENTREPRISE (pas a une personne).
//
// On CONSOMME les resolveurs de branche existants (capitaux/rentes/couverture/
// maintien) sans les modifier — leurs tests sont figes. Les resolveurs donnent le
// signal d'autorite `donneeIndisponible` + les structures validees ; la presence
// (obligation documentee vs absente) est lue sur la convention elle-meme.
//
// Regles :
//  1. Fonction TOTALE : jamais d'exception. idcc absent / convention inconnue ->
//     statut dedie. TO_FILL / TO_VERIFY -> donneeIndisponible: true, JAMAIS
//     interprete comme "pas d'obligation" (defaut conservateur).
//  2. Resumes FACTUELS, sans nom d'assureur ni produit (contrainte DDA, cf.
//     audit-collectif.ts).
//  3. Le college passe par les structures de la convention (prevoyanceCadres /
//     prevoyanceNonCadres), PAS par un statutPro : on audite l'entreprise.
//  4. Unites : IJ / invalidite en FRACTIONS (0..1) -> affichees x100 ; maintien en
//     ENTIERS (100 / 50) -> affiches tels quels ; capital en unites explicites
//     (x salaire de reference, x PASS).

import type { Referentiels } from "../../data/prevoyance";
import { safeNum, getMaintienParams } from "./projection";
import { resolveCapitalDecesBranche, resolveRenteEducationBranche, resolveRenteConjointSubstitutiveBranche } from "./capitaux-deces-branche";
import { resolveCouvertureBranche } from "./couverture-branche";

export type ObligationGarantie =
  | "capitalDC"
  | "renteEducation"
  | "renteConjoint"
  | "ij"
  | "invalidite"
  | "maintienEmployeur";

export type ObligationItem = {
  garantie: ObligationGarantie;
  presente: boolean;
  resume: string;             // libelle factuel (sans assureur ni produit)
  source: "ccn" | "legal";    // maintien legal Mensualisation = repli
  donneeIndisponible?: boolean;
};

export type ObligationsStatut =
  | "branche_documentee"
  | "aucune_obligation_assuree"
  | "convention_inconnue"
  | "idcc_absent";

export type TauxT1Minimum = {
  taux: number | null;            // ex 1.50 (ANI) ou valeur CCN ; null si derogation non modelisee
  source: "ccn" | "ani_defaut";
  donneeIndisponible: boolean;
};

export type SanteMinimumObligation = {
  presente: boolean;
  panier: string | null;
  donneeIndisponible: boolean;    // TO_FILL / participation TO_VERIFY -> true (jamais "absent")
  resume: string;
};

export type ObligationsBranche = {
  statut: ObligationsStatut;
  idcc: string | null;
  nomCCN: string | null;
  cadres: ObligationItem[];
  nonCadres: ObligationItem[];
  tauxT1Minimum: TauxT1Minimum;
  santeMinimum: SanteMinimumObligation;
};

const GARANTIES_ASSUREES: ObligationGarantie[] = [
  "capitalDC",
  "renteEducation",
  "renteConjoint",
  "ij",
  "invalidite",
];

// Forme de lecture defensive de la convention (champs polymorphes).
type GarantiesMinimum = Record<string, unknown> | null | undefined;
type BlocPrev = { tauxT1Minimum?: unknown; garantiesMinimum?: GarantiesMinimum } | null | undefined;
type ConvLecture = {
  nom?: unknown;
  prevoyanceCadres?: BlocPrev;
  prevoyanceNonCadres?: BlocPrev;
  santeMinimum?: { panier?: unknown; participationEmployeur?: unknown; TO_FILL?: unknown } | null;
};

// ─── Helpers d'affichage (factuels) ──────────────────────────────────────────

// Fraction (0..1) -> "85 %" ou "66,66 %". Pieges graves : IJ / invalidite sont en
// FRACTIONS, jamais en entiers.
function pctFraction(x: number): string {
  const v = x * 100;
  return (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace(".", ",") + " %";
}
// Nombre brut francise (virgule decimale).
function num(x: number): string {
  return String(x).replace(".", ",");
}

// ─── Construction d'un item par garantie ─────────────────────────────────────

function itemNonPresente(garantie: ObligationGarantie, resume: string): ObligationItem {
  return { garantie, presente: false, resume, source: "ccn", donneeIndisponible: false };
}

function resumeCapital(raw: Record<string, unknown>): string {
  const mode = raw.mode;
  if (mode === "situationFamiliale") {
    return "Capital deces selon la situation familiale (conjoint / enfants a charge)";
  }
  const taux = safeNum(raw.tauxSalaireRef);
  const minP = safeNum(raw.minimumPass);
  if (taux === null) return "Capital deces impose par la branche";
  const min = minP !== null && minP > 0 ? ` (min ${num(minP)} PASS)` : "";
  return `Capital deces : ${num(taux)}x salaire de reference${min}`;
}

function itemCapitalDC(raw: unknown, indispoResolveur: boolean): ObligationItem {
  if (raw == null) return itemNonPresente("capitalDC", "Capital deces : non prevu par la branche");
  const indispo = typeof raw === "string" ? true : indispoResolveur;
  return {
    garantie: "capitalDC",
    presente: true,
    source: "ccn",
    donneeIndisponible: indispo,
    resume: indispo
      ? "Capital deces impose par la branche — montant a documenter"
      : resumeCapital(raw as Record<string, unknown>),
  };
}

function itemRenteEducation(raw: unknown, phases: { deAge: number; aAge: number; tauxSalaireRef: number }[], indispoResolveur: boolean): ObligationItem {
  if (raw == null) return itemNonPresente("renteEducation", "Rente education : non prevue par la branche");
  const indispo = typeof raw === "string" ? true : (indispoResolveur || phases.length === 0);
  const segs = phases.map((p) => `${pctFraction(p.tauxSalaireRef)} [${p.deAge}-${p.aAge} ans]`).join(", ");
  return {
    garantie: "renteEducation",
    presente: true,
    source: "ccn",
    donneeIndisponible: indispo,
    resume: indispo ? "Rente education imposee par la branche — bareme a documenter" : `Rente education : ${segs}`,
  };
}

function itemRenteConjoint(raw: unknown, conj: { montantAnnuel: number | null; dureeMaxAnnees: number | null; cumulableAvecRenteEducation: boolean; donneeIndisponible: boolean }): ObligationItem {
  if (raw == null) return itemNonPresente("renteConjoint", "Rente conjoint : non prevue par la branche");
  const indispo = typeof raw === "string" ? true : conj.donneeIndisponible;
  let resume: string;
  if (indispo) {
    resume = "Rente conjoint imposee par la branche — modalites a documenter";
  } else if (conj.cumulableAvecRenteEducation) {
    resume = "Rente conjoint (cible reversion, cumulable avec la rente education, versee jusqu'a l'age legal)";
  } else {
    const duree = conj.dureeMaxAnnees != null ? ` (${num(conj.dureeMaxAnnees)} ans)` : "";
    resume = `Rente conjoint substitutive${duree}`;
  }
  return { garantie: "renteConjoint", presente: true, source: "ccn", donneeIndisponible: indispo, resume };
}

type IJResolue = { pctSalaire: number; franchise: number; plafondJours: number; paliers?: { deJour: number; aJour: number; pctSalaire: number }[] };

function itemIJ(raw: unknown, ij: IJResolue | undefined): ObligationItem {
  if (raw == null) return itemNonPresente("ij", "IJ (incapacite) : non prevues par la branche");
  // present mais non exploitable (TO_VERIFY string, ou objet malforme -> ij undefined).
  if (typeof raw === "string" || !ij) {
    return { garantie: "ij", presente: true, source: "ccn", donneeIndisponible: true, resume: "IJ imposees par la branche — bareme a documenter" };
  }
  let resume: string;
  if (ij.paliers && ij.paliers.length > 0) {
    resume = "IJ : " + ij.paliers.map((p) => `${pctFraction(p.pctSalaire)} j${p.deJour}-j${p.aJour}`).join(" puis ") + ` (franchise ${ij.franchise} j)`;
  } else {
    resume = `IJ : ${pctFraction(ij.pctSalaire)} (franchise ${ij.franchise} j, max ${ij.plafondJours} j)`;
  }
  return { garantie: "ij", presente: true, source: "ccn", donneeIndisponible: false, resume };
}

type InvResolue = { cat1: { pctSalaire: number }; cat2: { pctSalaire: number }; cat3: { pctSalaire: number } };

function itemInvalidite(raw: unknown, inv: InvResolue | undefined): ObligationItem {
  if (raw == null) return itemNonPresente("invalidite", "Invalidite : non prevue par la branche");
  if (typeof raw === "string" || !inv) {
    return { garantie: "invalidite", presente: true, source: "ccn", donneeIndisponible: true, resume: "Invalidite imposee par la branche — bareme a documenter" };
  }
  const resume = `Invalidite : cat1 ${pctFraction(inv.cat1.pctSalaire)}, cat2 ${pctFraction(inv.cat2.pctSalaire)}, cat3 ${pctFraction(inv.cat3.pctSalaire)}`;
  return { garantie: "invalidite", presente: true, source: "ccn", donneeIndisponible: false, resume };
}

function itemMaintien(idcc: string, college: "cadres" | "nonCadres", ref: Referentiels): ObligationItem {
  const m = getMaintienParams(idcc, ref, college);
  if (m.source === "ccn") {
    const seuils = m.paliers.map((p) => p.ancienneteMois).join(" / ");
    const prem = m.paliers[0]?.segments.map((s) => `${s.pct} % ${s.jours} j`).join(" puis ") ?? "";
    return {
      garantie: "maintienEmployeur",
      presente: true,
      source: "ccn",
      donneeIndisponible: false,
      resume: `Maintien employeur CCN : ${m.paliers.length} palier(s) d'anciennete (${seuils} mois), carence ${m.carenceJours} j ; 1er palier ${prem}`,
    };
  }
  // Repli legal Mensualisation : ce n'est PAS une obligation de branche -> presente false.
  return {
    garantie: "maintienEmployeur",
    presente: false,
    source: "legal",
    donneeIndisponible: m.source === "indisponible",
    resume: "Maintien legal (Mensualisation) en repli — aucune amelioration de branche",
  };
}

// ─── College complet ─────────────────────────────────────────────────────────

function gmDuCollege(conv: ConvLecture, college: "cadres" | "nonCadres"): GarantiesMinimum {
  const bloc = college === "cadres" ? conv.prevoyanceCadres : conv.prevoyanceNonCadres;
  return bloc?.garantiesMinimum ?? null;
}

function buildCollege(idcc: string, conv: ConvLecture, college: "cadres" | "nonCadres", ref: Referentiels, pass: number): ObligationItem[] {
  const gm = gmDuCollege(conv, college) ?? {};
  const refSalaire = pass; // reference neutre : on n'exploite QUE donneeIndisponible + structure

  const cap = resolveCapitalDecesBranche(idcc, college, refSalaire, pass, ref);
  const edu = resolveRenteEducationBranche(idcc, college, refSalaire, pass, null, ref);
  const conj = resolveRenteConjointSubstitutiveBranche(idcc, college, refSalaire, pass, ref, 64);
  const couv = resolveCouvertureBranche(idcc, college, ref);

  return [
    itemCapitalDC(gm.capitalDC, cap.donneeIndisponible),
    itemRenteEducation(gm.renteEducation, edu.phases, edu.donneeIndisponible),
    itemRenteConjoint(gm.renteConjoint, conj),
    itemIJ(gm.ij, couv.ij as IJResolue | undefined),
    itemInvalidite(gm.invalidite, couv.invalidite as InvResolue | undefined),
    itemMaintien(idcc, college, ref),
  ];
}

// ─── tauxT1Minimum + santeMinimum ────────────────────────────────────────────

function resolveTauxT1(conv: ConvLecture): TauxT1Minimum {
  const bloc = conv.prevoyanceCadres;
  // Pas de regime cadres de branche : le plancher ANI 1,50 % T1 s'applique par defaut.
  if (bloc == null) return { taux: 1.5, source: "ani_defaut", donneeIndisponible: false };
  const v = safeNum((bloc as { tauxT1Minimum?: unknown }).tauxT1Minimum);
  if (v !== null) return { taux: v, source: "ccn", donneeIndisponible: false };
  // tauxT1Minimum explicitement null (ex. Metallurgie : derogation 1,12 % documentaire,
  // non modelisee) -> on ne l'invente PAS (regle 1, conservateur).
  return { taux: null, source: "ccn", donneeIndisponible: true };
}

function resolveSanteMinimum(conv: ConvLecture): SanteMinimumObligation {
  const sm = conv.santeMinimum;
  if (sm == null) {
    return { presente: false, panier: null, donneeIndisponible: false, resume: "Aucun panier sante de branche documente" };
  }
  if (sm.TO_FILL === true) {
    // TO_FILL -> indisponible, JAMAIS "absent" (defaut conservateur).
    return { presente: true, panier: null, donneeIndisponible: true, resume: "Panier sante de branche a documenter (TO_FILL)" };
  }
  const panier = typeof sm.panier === "string" ? sm.panier : null;
  const part = sm.participationEmployeur;
  const partIndispo = part == null || part === "TO_VERIFY" || part === "TO_FILL";
  return {
    presente: true,
    panier,
    donneeIndisponible: partIndispo,
    resume: `Panier sante de branche${panier ? ` : ${panier}` : ""}${partIndispo ? " (participation employeur a documenter)" : ""}`,
  };
}

// ─── Fonction principale ─────────────────────────────────────────────────────

const T1_ABSENT: TauxT1Minimum = { taux: null, source: "ani_defaut", donneeIndisponible: true };
const SANTE_ABSENTE: SanteMinimumObligation = { presente: false, panier: null, donneeIndisponible: false, resume: "—" };

export function resolveObligationsBranche(
  idcc: string | null,
  ref: Referentiels
): ObligationsBranche {
  const vide = (statut: ObligationsStatut): ObligationsBranche => ({
    statut,
    idcc: idcc ?? null,
    nomCCN: null,
    cadres: [],
    nonCadres: [],
    tauxT1Minimum: T1_ABSENT,
    santeMinimum: SANTE_ABSENTE,
  });

  if (!idcc || String(idcc).trim() === "") return vide("idcc_absent");

  const conventions = (ref.ccn as { conventions?: Record<string, ConvLecture | undefined> }).conventions;
  const conv = conventions?.[idcc];
  if (!conv) return vide("convention_inconnue");

  const pass = safeNum((ref.pass as { pass?: { annuel?: unknown } }).pass?.annuel) ?? 48060;
  const nomCCN = typeof conv.nom === "string" ? conv.nom : idcc;

  const cadres = buildCollege(idcc, conv, "cadres", ref, pass);
  const nonCadres = buildCollege(idcc, conv, "nonCadres", ref, pass);

  // Statut global : au moins une garantie ASSUREE presente (le maintien employeur
  // n'est PAS une garantie assuree -> 2120/44 restent "aucune_obligation_assuree"
  // tout en exposant leur maintien CCN).
  const assureePresente = [...cadres, ...nonCadres].some(
    (i) => GARANTIES_ASSUREES.includes(i.garantie) && i.presente
  );

  return {
    statut: assureePresente ? "branche_documentee" : "aucune_obligation_assuree",
    idcc,
    nomCCN,
    cadres,
    nonCadres,
    tauxT1Minimum: resolveTauxT1(conv),
    santeMinimum: resolveSanteMinimum(conv),
  };
}
