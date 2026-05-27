// ─── Lot Dossier client — Adapter Cabinet v2 ────────────────────────
//
// Mappe les paramètres cabinet vers CabinetPageData (page de couverture
// secondaire : à propos + objet + démarche en 5 étapes).

import type { CabinetPageData, CabinetInfoLigne, DemarcheEtape } from "../pages/pageCabinet";

export type BuildCabinetDataParams = {
  cabinet: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
};

export function buildCabinetData(p: BuildCabinetDataParams): CabinetPageData {
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const cabinetNom = cabinet.cabinetName || cabinet.nom || "Cabinet";

  const infosCabinet: CabinetInfoLigne[] = [
    { label: "Cabinet",    valeur: cabinetNom },
    { label: "ORIAS",      valeur: cabinet.orias || "—" },
    { label: "Ville",      valeur: cabinet.ville || cabinet.adresse || "—" },
    { label: "Téléphone",  valeur: cabinet.tel || cabinet.telephone || "—" },
    { label: "Email",      valeur: cabinet.email || "—" },
    { label: "Conseiller", valeur: cabinet.conseiller || cabinet.conseillerName || "—" },
  ].filter(l => l.valeur && l.valeur !== "—");

  const objetDocument = cabinet.objetDocument
    || `Ce rapport patrimonial dresse une photographie globale de votre situation à la date d'émission. Il analyse votre patrimoine, votre fiscalité (IR, IFI le cas échéant), votre prévoyance, votre succession et formule des recommandations adaptées à vos objectifs. Il est remis à titre indicatif et doit être validé par vos conseils habituels.`;

  // Portée MIF2 / non-contractuel — repris du rapport v1 (conformité)
  const porteeMif2 = `Document remis à titre indicatif — simulation non contractuelle. Ne constitue pas un conseil en investissement au sens de MIF II, ni un conseil fiscal ou juridique.`;

  const demarcheEtapes: DemarcheEtape[] = [
    { num: 1, titre: "Collecte",        description: "Recueil de votre situation personnelle, professionnelle, patrimoniale et fiscale." },
    { num: 2, titre: "Analyse",         description: "Étude de votre patrimoine, revenus et fiscalité actuelle (IR, IFI, succession)." },
    { num: 3, titre: "Optimisation",    description: "Simulation de scénarios pour mesurer l'impact fiscal de différentes stratégies." },
    { num: 4, titre: "Recommandations", description: "Propositions adaptées à votre profil, vos objectifs et votre horizon de placement." },
    { num: 5, titre: "Suivi",           description: "Mise à jour régulière en fonction de votre situation et de la législation." },
  ];

  return {
    clientName,
    dateStr,
    infosCabinet,
    objetDocument,
    porteeMif2,
    demarcheEtapes,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinetNom} · Cabinet — confidentiel`,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
