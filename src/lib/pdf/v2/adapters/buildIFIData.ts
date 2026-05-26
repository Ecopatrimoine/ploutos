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

  // Mapping des lignes — souple pour différentes structures possibles côté computeIFI
  const linesRaw: any[] = Array.isArray(ifi.lines) ? ifi.lines : [];
  const biens = linesRaw.map(line => ({
    nom: line.name ?? line.label ?? line.nom ?? "Bien immobilier",
    valeurBrute: num(line.grossValue ?? line.value ?? line.valeurBrute ?? 0),
    abattementRP: num(line.residenceAbatement ?? line.abattementRP ?? 0),
    dette: num(line.deductibleDebt ?? line.debt ?? line.dette ?? 0),
    netTaxable: num(line.taxableNet ?? line.netTaxable ?? 0),
  }));

  return {
    clientName,
    dateStr,
    assietteNette,
    seuilIFI: SEUIL_IFI_2026,
    margeSousSeuil,
    ifiDu,
    biens,
    notreLecture: p.notreLecture || (assietteNette < SEUIL_IFI_2026
      ? `Votre patrimoine immobilier net taxable s'établit à ${formatEuro(assietteNette)}, sous le seuil de ${formatEuro(SEUIL_IFI_2026)} : vous n'êtes pas redevable de l'IFI cette année, avec une marge de ${formatEuro(margeSousSeuil)}.`
      : `Votre patrimoine immobilier net taxable dépasse le seuil de ${formatEuro(SEUIL_IFI_2026)} : vous êtes redevable d'un IFI de ${formatEuro(ifiDu)}.`),
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
