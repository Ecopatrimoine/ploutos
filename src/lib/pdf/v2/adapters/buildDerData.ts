// ─── Lot 9 (bascule) — Adapter cabinet → DerPageData v2 ───────────────
//
// Convertit l'objet cabinet de l'app (Paramètres → statuts/conformité, Lot 5)
// vers le `DerPageData` attendu par `pageDer.ts` v2.
//
// Pilotage automatique par les statuts ORIAS cochés dans le cabinet :
//  - statutCoa OU statutMia → statutIas = true (catégorie déduite)
//  - statutCif              → bloc CIF + AMF + association
//  - statutIobsp            → bloc IOBSP
//
// Champs non renseignés dans Paramètres → affichés en `champCabinet`
// (varc beige bordé doré) avec un libellé pédagogique : la fixture v2
// utilise déjà cette convention donc rien à porter, juste fournir des
// valeurs ou laisser undefined.

import type { DerPageData } from "../pages/pageDer";

export type BuildDerDataParams = {
  cabinet: Record<string, any>;
  /** Optionnel : date forcée (par défaut = aujourd'hui). */
  dateLettre?: string;
};

export function buildDerData(params: BuildDerDataParams): DerPageData {
  const cabinet = params.cabinet || {};
  const dateLettre = params.dateLettre || formatDateFr(new Date());

  // ── Statuts ORIAS détenus (Lot 5) ────────────────────────────────────
  const statutCoa    = !!cabinet.statutCoa;
  const statutMia    = !!cabinet.statutMia;
  const statutIas    = statutCoa || statutMia;
  const statutCif    = !!cabinet.statutCif;
  const statutIobsp  = !!cabinet.statutIobsp;

  // Catégorie IAS textuelle déduite des sous-statuts cochés.
  const categoriesIas: string[] = [];
  if (statutCoa) categoriesIas.push("Courtier en assurance (COA)");
  if (statutMia) categoriesIas.push("Mandataire d'intermédiaire en assurance (MIA)");
  const cabinetCategorieIas = categoriesIas.join(" · ") || undefined;

  return {
    // Cabinet
    cabinetNom:         cabinet.cabinetName || "—",
    cabinetAdresse:     cabinet.cabinetAdresse || cabinet.adresse || "adresse",
    cabinetEmail:       cabinet.email || cabinet.cabinetEmail || undefined,
    cabinetTel:         cabinet.tel   || cabinet.cabinetTel   || undefined,
    cabinetORIAS:       cabinet.orias || "—",
    cabinetForme:       cabinet.forme || cabinet.formeJuridique || undefined,
    cabinetCapital:     cabinet.capital || undefined,
    cabinetSiren:       cabinet.siren || undefined,
    cabinetConseiller:  cabinet.conseillerNom || cabinet.conseiller || "—",
    // Statuts
    statutCif,
    cabinetAssociationCif: cabinet.associationCif || cabinet.assocCif || undefined,
    statutIas,
    cabinetCategorieIas,
    statutIobsp,
    cabinetCategorieIobsp: cabinet.categorieIobsp || undefined,
    // RCP
    cabinetRcpAssureur:   cabinet.rcpAssureur || undefined,
    cabinetRcpContrat:    cabinet.rcpContrat || cabinet.rcpPolice || undefined,
    cabinetRcpMontants:   cabinet.rcpMontants || undefined,
    cabinetGarantieFinanciere: cabinet.garantieFinanciere || undefined,
    // Rémunération
    remunerationCifMode:  cabinet.remunerationCif || undefined,
    remunerationIasMode:  cabinet.remunerationIas || undefined,
    natureConseil:        cabinet.natureConseil || "indépendant / non indépendant",
    partenaires:          cabinet.partenaires || undefined,
    // Médiateurs
    mediateurAmf:         statutCif ? (cabinet.mediateurAmf || undefined) : undefined,
    mediateurAssurance:   statutIas ? (cabinet.mediateur || cabinet.mediateurAssurance || undefined) : undefined,
    // Date
    dateLettre,
    villeSignature:       cabinet.lieuSignature || cabinet.villeSignature || undefined,
    // Mention non-contractuelle
    mentionNonContractuelle:
      "Document d'aide à la conformité remis à titre indicatif. Ne constitue ni une attestation de conformité, ni un conseil juridique. À valider au regard des textes en vigueur, du contrôle de l'association agréée et, le cas échéant, d'un avocat." +
      (cabinet.cabinetName ? ` ${cabinet.cabinetName}` : "") +
      (cabinet.orias ? ` — ORIAS n° ${cabinet.orias} (statuts à confirmer sur www.orias.fr).` : "."),
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
