// ─── Lot Dossier client — Adapter IFI v2 ─────────────────────────────
//
// Mappe `computeIFI(data)` vers IFIPageData. Le moteur calcule déjà
// l'assiette nette, l'IFI dû et les lignes par bien immobilier.

import type { IFIPageData } from "../pages/pageIFI";

const SEUIL_IFI_2026 = 1_300_000;

export type BuildIFIDataParams = {
  ifi: any;
  data: Record<string, any>;
  cabinet: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notreLecture?: string;
};

export function buildIFIData(p: BuildIFIDataParams): IFIPageData {
  const ifi = p.ifi || {};
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const assietteNette = num(ifi.netTaxable ?? 0);
  const ifiDu = num(ifi.ifi ?? 0);
  const margeSousSeuil = SEUIL_IFI_2026 - assietteNette;

  // SOURCE UNIQUE : décomposition par tranche DÉJÀ produite par computeIFI
  // (bracketFill = FilledBracket[]) + IFI brut/décote. Aucun recalcul, aucun barème ici.
  const bracketFill = Array.isArray(ifi.bracketFill) ? ifi.bracketFill : [];
  const grossIfi = num(ifi.grossIfi ?? 0);
  const decote = num(ifi.decote ?? 0);

  // Mapping des lignes — souple pour différentes structures possibles côté computeIFI
  const linesRaw: any[] = Array.isArray(ifi.lines) ? ifi.lines : [];
  const biens = linesRaw.map(line => ({
    nom: line.name ?? line.label ?? line.nom ?? "Bien immobilier",
    valeurBrute: num(line.grossValue ?? line.value ?? line.valeurBrute ?? 0),
    abattementRP: num(line.residenceAbatement ?? line.abattementRP ?? 0),
    dette: num(line.deductibleDebt ?? line.debt ?? line.dette ?? 0),
    netTaxable: num(line.taxableNet ?? line.netTaxable ?? 0),
  }));

  // ─── Analyse "masque" structurée — cadrage métier + chiffres + leviers ──
  const nbBiens = biens.length;
  const totalBrut = biens.reduce((s, b) => s + b.valeurBrute, 0);
  const totalAbatRP = biens.reduce((s, b) => s + b.abattementRP, 0);
  const totalDette = biens.reduce((s, b) => s + b.dette, 0);
  const sousSeuil = assietteNette < SEUIL_IFI_2026;
  const margeRelative = SEUIL_IFI_2026 > 0 ? Math.round((margeSousSeuil / SEUIL_IFI_2026) * 100) : 0;

  // Leviers contextuels
  const leviers: string[] = [];
  if (sousSeuil && margeRelative < 20) {
    leviers.push("vigilance : votre marge sous le seuil est inférieure à 20 % — une revalorisation immobilière peut vous faire basculer dès l'an prochain");
  }
  if (!sousSeuil) {
    leviers.push("plafonnement IFI à 75 % du revenu imposable (CGI art. 979) à vérifier");
    leviers.push("démembrement (donation de nue-propriété) pour sortir une partie du patrimoine de l'assiette taxable");
    leviers.push("nantissement / SCI familiale : usage à étudier sans optimisation abusive");
  }
  if (leviers.length === 0) {
    leviers.push("Aucun levier prioritaire — votre situation patrimoniale est confortablement sous le seuil");
  }

  const notreLectureCalculee = `
    <p style="margin:0 0 10px 0">L'IFI taxe le <strong>patrimoine immobilier net</strong> du foyer, après abattement de 30 % sur la résidence principale et déduction des dettes affectées. Le seuil d'assujettissement est de ${formatEuro(SEUIL_IFI_2026)}.</p>
    <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.7">
      <li><strong>Composition</strong> — ${nbBiens > 0
        ? `${nbBiens} bien${nbBiens > 1 ? "s" : ""} immobilier${nbBiens > 1 ? "s" : ""} pour ${formatEuro(totalBrut)} en valeur brute, abattement RP ${formatEuro(totalAbatRP)}, dettes déductibles ${formatEuro(totalDette)}.`
        : `Aucun bien immobilier saisi.`}</li>
      <li><strong>Assiette nette taxable</strong> — ${formatEuro(assietteNette)}.</li>
      <li><strong>Position</strong> — ${sousSeuil
        ? `Sous le seuil de ${formatEuro(SEUIL_IFI_2026)}. Marge avant assujettissement : ${formatEuro(margeSousSeuil)} (${margeRelative} %).`
        : `Au-dessus du seuil. IFI dû : <strong>${formatEuro(ifiDu)}</strong>.`}</li>
    </ul>
    <p style="margin:0;font-style:italic;color:#6B6353"><strong>Leviers à étudier :</strong> ${leviers.join(" ; ")}.</p>
  `.trim();

  return {
    clientName,
    dateStr,
    assietteNette,
    seuilIFI: SEUIL_IFI_2026,
    margeSousSeuil,
    ifiDu,
    bracketFill,
    grossIfi,
    decote,
    biens,
    notreLecture: p.notreLecture || notreLectureCalculee,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinet.cabinetName || cabinet.nom || "Cabinet"} · Fiscalité — confidentiel`,
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
