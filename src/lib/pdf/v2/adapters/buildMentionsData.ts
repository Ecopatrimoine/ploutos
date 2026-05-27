// ─── Lot Dossier client — Adapter Mentions v2 ───────────────────────
//
// Compose la page Mentions à partir des données disponibles : notes libres
// (data.notes ou mission.notes), mentions légales standard du cabinet (4
// paragraphes : portée, ORIAS, RGPD, médiation) + ligne "généré le".

import type { MentionsPageData } from "../pages/pageMentions";

export type BuildMentionsDataParams = {
  cabinet: Record<string, any>;
  mission?: Record<string, any>;
  data: Record<string, any>;
  clientName?: string;
  dateLettre?: string;
  pagePosition?: string;
  notes?: string;
};

export function buildMentionsData(p: BuildMentionsDataParams): MentionsPageData {
  const cabinet = p.cabinet || {};
  const data = p.data || {};
  const mission = p.mission || {};
  const dateStr = p.dateLettre || formatDateFr(new Date());

  const p1 = [data.person1FirstName, data.person1LastName].filter(Boolean).join(" ");
  const p2 = [data.person2FirstName, data.person2LastName].filter(Boolean).join(" ");
  const isCouple = data.coupleStatus === "married" || data.coupleStatus === "pacs";
  const clientName = p.clientName || (isCouple && p2 ? `${p1} & ${p2}` : (data.person1LastName || p1)) || "Client";

  const notesConseiller = p.notes || data.notes || mission.notes || "";

  const cabinetNom = cabinet.cabinetName || cabinet.nom || "Cabinet";
  const orias = cabinet.orias || "—";
  const mediateur = cabinet.mediateur || "Médiateur de la consommation compétent (coordonnées disponibles sur demande)";

  const mentionsLegales: string[] = [
    `<strong>Portée du document.</strong> Le présent rapport est remis à titre indicatif. Il est établi sur la base des informations communiquées par le client et de la réglementation en vigueur à la date d'émission. Il ne constitue ni un conseil juridique, fiscal ou comptable opposable, ni une garantie de résultat. Le client est invité à le faire valider par son conseil habituel.`,
    `<strong>Limites des simulations.</strong> Les calculs sont basés sur la législation en vigueur à la date d'édition. Certaines situations particulières ne sont pas traitées en simulation (pacte Dutreil, SCI, holding, démembrement complexe, optimisations spécifiques) et doivent faire l'objet d'une étude dédiée.`,
    `<strong>Statuts et agréments.</strong> ${cabinetNom} est immatriculé à l'ORIAS sous le n° ${orias} (statuts vérifiables sur www.orias.fr). Les obligations professionnelles applicables relèvent du Code monétaire et financier, du Code des assurances et du règlement général de l'AMF.`,
    `<strong>Protection des données (RGPD).</strong> Les données personnelles collectées sont traitées dans le cadre de la relation contractuelle. Le client dispose d'un droit d'accès, de rectification, d'opposition et d'effacement (art. 15 à 22 RGPD) à exercer auprès du cabinet.`,
    `<strong>Médiation.</strong> En cas de litige non résolu après réclamation écrite, le client peut saisir gratuitement le médiateur : ${mediateur}.`,
    `<strong>Confidentialité.</strong> Document strictement confidentiel. Toute reproduction ou diffusion partielle ou totale est interdite sans accord préalable écrit du cabinet et du client.`,
  ];

  const generePar = `Document généré le ${dateStr} — ${cabinetNom} — ORIAS ${orias}`;

  return {
    clientName,
    dateStr,
    notesConseiller: notesConseiller || undefined,
    mentionsLegales,
    generePar,
    pagePosition: p.pagePosition || "— / —",
    cabinetLibellePied: `${cabinetNom} · Annexe — confidentiel`,
  };
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
