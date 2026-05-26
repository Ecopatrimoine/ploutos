// ─── Lot 8d — Snapshots + assertions de la Déclaration d'adéquation
//
// Document le plus exigeant du Lot 8 : JUSTIFIE le conseil et RELIE chaque
// recommandation aux infos KYC (besoin + dimension du profil). Date+heure
// figées via le paramètre dateGeneration pour des snapshots déterministes.
//
// 3 snapshots :
//   • COA seul + 5 recos couvrant les 4 dimensions → matrice complète
//   • CIF coché + 5 recos → cadre allumé (MIF II + DDA)
//   • État dégradé (0 recommandation) → bandeau NON VALIDE + matrice absente
//
// 0 régénération des snapshots existants (66 snapshots des autres docs).

import { describe, it, expect } from "vitest";
import { buildAndPrintAdequation } from "../lib/pdf/pdfAdequation";
import {
  fixtureData,
  fixtureMission,
  fixtureCabinet,
  fixtureCabinetCifCoche,
} from "./__fixtures__/pdfFixture";
import { capturePdfHtml } from "./__fixtures__/capturePdfHtml";
import type { Recommandation } from "../lib/conformite/recommandations";

// Date figée pour stabilité des snapshots (paramètre dateGeneration).
const DATE_FIXE = new Date("2026-05-26T14:30:00");

// Fixture locale de recommandations (5 recos, 4 dimensions, 2 avec besoinKey).
const fixtureRecommandationsAdequation: Recommandation[] = [
  {
    id: "reco-1",
    libelle: "Souscrire une garantie ITT renforcée",
    justification: "Le client a déclaré l'arrêt de travail comme besoin prioritaire et son profil dynamique (54/96 pts) tolère un coût additionnel pour cette garantie.",
    dimension: "besoin",
    besoinKey: "besoinPrev_arret",
  },
  {
    id: "reco-2",
    libelle: "Compléter la couverture décès toutes causes",
    justification: "Capital actuel insuffisant pour maintenir le train de vie du conjoint et des enfants pendant 5 ans en cas de disparition.",
    dimension: "besoin",
    besoinKey: "besoinPrev_deces",
  },
  {
    id: "reco-3",
    libelle: "Augmenter la part actions de l'allocation cible",
    justification: "Profil dynamique + horizon long terme (9-15 ans) : la part actions actuelle (35 %) est en-deçà de la cible théorique (60-80 %).",
    dimension: "risque",
  },
  {
    id: "reco-4",
    libelle: "Privilégier des supports labellisés ISR / article 8 SFDR",
    justification: "Cohérent avec la préférence ESG partielle exprimée au questionnaire (sous-score 2/4).",
    dimension: "esg",
  },
  {
    id: "reco-5",
    libelle: "Constituer une réserve liquide complémentaire",
    justification: "Coussin liquide actuel inférieur à 12 mois de revenus — viser un horizon de 18 mois avant d'engager des arbitrages plus dynamiques.",
    dimension: "capacitePerte",
  },
];

const baseParams = (cabinet: typeof fixtureCabinet, recos: Recommandation[] = fixtureRecommandationsAdequation) => ({
  cabinet,
  data: fixtureData,
  mission: fixtureMission,
  recommandations: recos,
  clientName: "Pierre Dupont & Sophie Dupont",
  logoSrc: "",
  dateGeneration: DATE_FIXE,
});

// ─── Snapshots ─────────────────────────────────────────────────────────────
describe("pdfAdequation — snapshot COA seul + 5 recos (matrice complète)", () => {
  it("génère la déclaration d'adéquation pour COA seul avec date figée", () => {
    const html = capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet)));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfAdequation — snapshot CIF coché + 5 recos (cadre MIF II + DDA allumé)", () => {
  it("génère la déclaration avec cadre 'MIF II + DDA' + RG AMF allumés", () => {
    const html = capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinetCifCoche)));
    expect(html).toMatchSnapshot();
  });
});

describe("pdfAdequation — snapshot état dégradé (0 recommandation)", () => {
  it("génère la déclaration NON VALIDE avec bandeau + matrice absente + coûts grisés", () => {
    const html = capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet, [])));
    expect(html).toMatchSnapshot();
  });
});

// ─── Invariants matrice (cœur du 8d) ───────────────────────────────────────
describe("pdfAdequation — invariants matrice profil/besoin → reco", () => {
  const html = () => capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet)));

  it("contient les 4 colonnes du tableau (Recommandation, Dimension, Lien KYC, Justification)", () => {
    const h = html();
    expect(h).toContain("Recommandation");
    expect(h).toContain("Dimension du profil");
    expect(h).toContain("Lien KYC");
    expect(h).toContain("Justification");
  });

  it("affiche les 5 recommandations dans la matrice", () => {
    const h = html();
    expect(h).toContain("Souscrire une garantie ITT renforcée");
    expect(h).toContain("Compléter la couverture décès toutes causes");
    expect(h).toContain("Augmenter la part actions de l'allocation cible");
    expect(h).toContain("Privilégier des supports labellisés ISR");
    expect(h).toContain("Constituer une réserve liquide complémentaire");
  });

  it("regroupe les recos par dimension (en-têtes Besoin / Risque / ESG / Capacité)", () => {
    const h = html();
    expect(h).toContain("Besoin exprimé");
    expect(h).toContain("Tolérance au risque");
    expect(h).toContain("Préférences en matière de durabilité (ESG)");
    expect(h).toContain("Capacité à subir des pertes");
  });

  it("reco avec besoinKey → colonne Lien KYC remplie via besoinLabel", () => {
    const h = html();
    expect(h).toContain("Prévoyance — Arrêt de travail / invalidité");
    expect(h).toContain("Prévoyance — Décès");
  });

  it("reco sans besoinKey → colonne Lien KYC affiche '—'", () => {
    const h = html();
    // La reco-3 (risque) n'a pas de besoinKey → doit afficher "—" dans la cellule.
    // Le tiret apparaît dans la ligne du tableau correspondant à reco-3 (Augmenter part actions).
    expect(h).toMatch(/Augmenter la part actions[^]*<td>—<\/td>/);
  });
});

// ─── Invariants profil (4 dimensions Lots 6/6bis) ─────────────────────────
describe("pdfAdequation — invariants synthèse profil KYC", () => {
  const html = () => capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet)));

  it("affiche le profil 4 niveaux capitalisé (Dynamique pour la fixture)", () => {
    expect(html()).toContain("Dynamique");
  });

  it("affiche le score risque sur 96 pts (hors ESG)", () => {
    expect(html()).toContain("54");  // scoreRisque fixture = 54 (Lot 6bis)
    expect(html()).toContain("/ 96 pts");
  });

  it("affiche l'horizon de placement humain", () => {
    expect(html()).toContain("Long terme (9 à 15 ans)");
  });

  it("affiche le sous-score ESG sur 4 pts (esgPref=partiel = 2 pts)", () => {
    const h = html();
    expect(h).toContain("2");
    expect(h).toContain("/ 4 pts");
  });

  it("affiche la capacité à subir des pertes (issue de computeCapacitePerte)", () => {
    const h = html();
    expect(h).toContain("Capacité à subir des pertes");
    expect(h).toMatch(/mois de coussin liquide/);
  });
});

// ─── Mentions réglementaires obligatoires ─────────────────────────────────
describe("pdfAdequation — mentions réglementaires obligatoires", () => {
  const html = () => capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet)));

  it("date ET heure de remise affichées (paramètre dateGeneration)", () => {
    const h = html();
    expect(h).toContain("26 mai 2026");
    expect(h).toContain("14:30");
  });

  it("mention 'MÊME SANS TRANSACTION' présente", () => {
    expect(html()).toContain("MÊME SANS TRANSACTION");
  });

  it("mention 'remise même sans transaction' dans l'en-tête", () => {
    expect(html()).toMatch(/[Rr]emise même sans transaction/);
  });

  it("mention 'suivi périodique' avec périodicité par défaut 'annuelle'", () => {
    const h = html();
    expect(h).toContain("suivi périodique");
    expect(h).toContain("annuelle");
  });

  it("section coûts et frais présente (mode de rémunération + impact)", () => {
    const h = html();
    expect(h).toContain("Coûts, frais et impact durabilité");
    expect(h).toContain("Commission");  // fixture par défaut
    expect(h).toContain("Impact des frais sur la performance");
  });

  it("cadre = 'DDA' pour COA seul (pas de MIF II)", () => {
    const h = html();
    expect(h).toContain("obligations DDA");
    expect(h).not.toContain("obligations MIF II");
  });

  it("contient le pied 'Portée du document — Ploutos (Ecopatrimoine)'", () => {
    expect(html()).toContain("Portée du document — Ploutos (Ecopatrimoine)");
  });
});

// ─── Règle dégradée (0 recommandation) ────────────────────────────────────
describe("pdfAdequation — règle de validité : 0 recommandation = NON VALIDE", () => {
  const html = () => capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet, [])));

  it("bandeau 'NON VALIDE' présent quand aucune recommandation", () => {
    const h = html();
    expect(h).toContain("Déclaration d'adéquation NON VALIDE");
  });

  it("la matrice est ABSENTE en état dégradé (aucune ligne de tableau matrice)", () => {
    const h = html();
    expect(h).not.toContain("Matrice profil/besoin → recommandation justifiée");
  });

  it("la section coûts/frais est grisée (classe deg-grise)", () => {
    expect(html()).toMatch(/section deg-grise/);
  });

  it("la cover affiche 'à titre informatif uniquement' au lieu de 'préalablement à toute opération'", () => {
    const h = html();
    expect(h).toContain("à titre informatif uniquement");
  });
});

describe("pdfAdequation — règle de validité : ≥ 1 recommandation = valide", () => {
  it("avec ≥ 1 reco, le bandeau NON VALIDE est absent", () => {
    const html = capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet)));
    expect(html).not.toContain("Déclaration d'adéquation NON VALIDE");
  });
});

// ─── Invariants CIF coché (sur-ensemble allumé) ───────────────────────────
describe("pdfAdequation — invariants CIF coché", () => {
  const html = () => capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinetCifCoche)));

  it("cadre passe à 'MIF II + DDA'", () => {
    expect(html()).toContain("obligations MIF II + DDA");
  });

  it("bloc références allume RG AMF + MIF II + L.541-1 et s.", () => {
    const h = html();
    expect(h).toContain("L.541-1 et s.");
    expect(h).toContain("RG AMF");
    expect(h).toContain("MIF II");
  });

  it("contenu matrice (recos + dimensions) inchangé", () => {
    const h = html();
    expect(h).toContain("Souscrire une garantie ITT renforcée");
    expect(h).toContain("Privilégier des supports labellisés ISR");
  });

  it("section suivi mentionne le volet CIF (RG AMF)", () => {
    expect(html()).toContain("RG AMF (volet CIF)");
  });
});

// ─── Garde-fou conformité ─────────────────────────────────────────────────
describe("pdfAdequation — garde-fou conformité : aucun produit / aucun assureur nommé", () => {
  it("ni la version COA seul, ni CIF coché, ni état dégradé ne citent un produit ou assureur", () => {
    const variantes = [
      capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet))),
      capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinetCifCoche))),
      capturePdfHtml(() => buildAndPrintAdequation(baseParams(fixtureCabinet, []))),
    ];
    const interdits = /\b(predica|generali|axa|allianz|swisslife|spirica|cardif|nortia|primonial|amundi)\b/i;
    for (const html of variantes) {
      expect(html.match(interdits)).toBeNull();
    }
  });
});
