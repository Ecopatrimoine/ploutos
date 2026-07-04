// ─── Helper pur — membres de la famille comme bénéficiaires potentiels (Lot P1) ─
//
// Liste les bénéficiaires potentiels (conjoint + enfants) issus de la composition
// familiale du dossier, AVEC leur `relation` FISCALEMENT correcte par rapport au
// DÉFUNT. Destiné à PRÉ-REMPLIR le sélecteur de bénéficiaires d'un
// ContratTransmissionDeces (capital décès).
//
// CRITIQUE : `relation` pilote la fiscalité 990 I côté succession (computeAvTax /
// getSuccessionTaxProfile). Ce helper doit donc produire une relation EXACTE. Il
// NE touche PAS le calcul : il alimente seulement la saisie en amont. Fonction
// PURE, déterministe, sans effet de bord. Import de type uniquement (aucune UI).
//
// Vocabulaire produit (sous-ensemble des RELATIONS de BlocTransmissionDeces) :
//   "conjoint" | "pacs_partner" | "autre" | "enfant" | "enfant_conjoint".

import type { PatrimonialData } from "../../types/patrimoine";

export type MembreFamille = {
  name: string;        // "Prénom Nom" (fallback "Conjoint"/"Enfant" si vide)
  relation: string;    // valeur RELATIONS, fiscalement correcte vis-à-vis du défunt
  source: "conjoint" | "enfant"; // groupage UI uniquement, JAMAIS le calcul
  childId?: string;    // si source === "enfant" : Child.id stable (Lot C, picker donation)
};

// Relation fiscale du CONJOINT selon le statut du couple. Le conjoint d'un contrat
// porté par le défunt = l'AUTRE personne du couple.
//   "married" -> "conjoint"      (exonéré TEPA, art. 796-0 bis CGI)
//   "pacs"    -> "pacs_partner"
//   "cohab"   -> "autre"         (concubin = tiers fiscal 60 %)
//   sinon (single/divorced/widowed/vide) -> pas de conjoint (null)
function relationConjoint(coupleStatus: string): string | null {
  switch (coupleStatus) {
    case "married": return "conjoint";
    case "pacs":    return "pacs_partner";
    case "cohab":   return "autre";
    default:        return null;
  }
}

// Relation fiscale d'un ENFANT selon parentLink CROISÉ avec le défunt :
//
//   parentLink      | défunt = 1        | défunt = 2
//   ----------------|-------------------|-------------------
//   common_child    | enfant            | enfant
//   person1_only    | enfant            | enfant_conjoint
//   person2_only    | enfant_conjoint   | enfant
//   autre / vide    | enfant (*)        | enfant (*)
//
// (*) DÉFAUT CONSERVATEUR du cas dominant (enfant propre). parentLink ambigu/vide
// -> "enfant" ; le picker étant un pré-remplisseur ÉDITABLE, le CGP corrige si
// beau-fils. Ne JAMAIS traiter ce défaut comme une certitude fiscale.
function relationEnfant(parentLink: string, whichDefunt: 1 | 2): string {
  if (parentLink === "common_child") return "enfant";
  if (parentLink === "person1_only") return whichDefunt === 1 ? "enfant" : "enfant_conjoint";
  if (parentLink === "person2_only") return whichDefunt === 2 ? "enfant" : "enfant_conjoint";
  return "enfant"; // défaut documenté révisable (cf. ci-dessus)
}

function nomComplet(firstName: unknown, lastName: unknown): string {
  const f = typeof firstName === "string" ? firstName : "";
  const l = typeof lastName === "string" ? lastName : "";
  return `${f} ${l}`.trim();
}

export function membresFamille(data: PatrimonialData, whichDefunt: 1 | 2): MembreFamille[] {
  const membres: MembreFamille[] = [];

  // ── Conjoint = l'AUTRE personne du couple ──
  // défunt = 1 -> conjoint = person2 ; défunt = 2 -> conjoint = person1.
  // Proposé dès que coupleStatus dénote un partenaire (married/pacs/cohab) ; le
  // nom vient de l'autre personne, fallback "Conjoint" si non saisi.
  const relConjoint = relationConjoint(data.coupleStatus);
  if (relConjoint) {
    const conjointNom =
      whichDefunt === 1
        ? nomComplet(data.person2FirstName, data.person2LastName)
        : nomComplet(data.person1FirstName, data.person1LastName);
    membres.push({
      name: conjointNom || "Conjoint",
      relation: relConjoint,
      source: "conjoint",
    });
  }

  // ── Enfants ──
  const enfants = Array.isArray(data.childrenData) ? data.childrenData : [];
  for (const c of enfants) {
    membres.push({
      name: nomComplet(c.firstName, c.lastName) || "Enfant",
      relation: relationEnfant(c.parentLink, whichDefunt),
      source: "enfant",
      childId: c.id, // ref stable pour le picker donation (Lot C) — undefined si non migre
    });
  }

  return membres;
}
