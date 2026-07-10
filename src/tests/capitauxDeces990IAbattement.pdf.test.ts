// LOT 11 G5-F — le bloc 990 I d'un contrat rachetable affiche l'abattement RÉELLEMENT
// imputé (assiette − base taxable, sorties moteur), PAS le forfait 152 500 € trompeur.
// Quand l'assurance-vie a déjà consommé l'abattement de 152 500 €/bénéficiaire (versements
// avant 70 ans), il reste 0 € imputable et l'assiette est taxée en plein — avec la mention
// « abattement consommé par l'assurance-vie ». Cas réel : contrat de nono (Perry), AV avant
// 70 = 350 000 € > 152 500 € → assiette 40 000 taxée en plein, droits 8 000 €.
import { describe, it, expect } from "vitest";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";
import { pageCapitauxDeces } from "../lib/pdf/v2/pages/pageCapitauxDeces";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { euro } from "../lib/calculs/utils";

const t = buildTokens("encreOr");
const data = { person1FirstName: "David", person1LastName: "Perry" };
const cabinet = { cabinetName: "EcoPatrimoine" };

// Un contrat rachetable (nature=capital) dont l'abattement 990 I est ENTIÈREMENT consommé
// par l'AV : before70Taxable === assiette990I (rien d'abattu ici), droits sur l'assiette pleine.
function successionAvecContrat(before70Taxable: number, duties: number) {
  return {
    capitalDecesLines: {
      caisses: [], branche: [], renteEducationBranche: [], renteConjointBranche: [],
      prives: [
        { contrat: "defd mmaaf", beneficiary: "nono guy", relation: "enfant_conjoint", sharePct: 100, montant: 40000, natureAssiette: "capital", assiette990I: 40000, before70Taxable, duties },
      ],
    },
    capitalDecesPriveCapital: 40000, capitalDecesPriveDuties: duties,
  };
}

describe("Capitaux décès 990 I — abattement imputé (restant), pas le forfait", () => {
  it("abattement consommé par l'AV → cellule « Abattement imputé » 0 € + mention, assiette taxée en plein", () => {
    const d = buildCapitauxDecesData({ succession: successionAvecContrat(40000, 8000), data, cabinet });
    const html = pageCapitauxDeces(t, d);
    expect(html).toContain("data-bloc-990i");
    expect(html).toContain("Abattement imputé");
    // 0 € imputé (et non 152 500 €) dans la cellule.
    expect(html).toContain(euro(0));
    // Mention explicite de consommation par l'assurance-vie.
    expect(html).toContain("data-abattement-consomme");
    expect(html).toContain("consommé par l'assurance-vie");
    // Droits calculés sur l'assiette PLEINE (moteur), inchangés.
    expect(html).toContain(euro(8000));
  });

  it("abattement disponible (AV ne l'a pas consommé) → montant imputé réel, AUCUNE mention de consommation", () => {
    // before70Taxable=0 → tout l'abattement disponible absorbe l'assiette (40 000 imputés).
    const d = buildCapitauxDecesData({ succession: successionAvecContrat(0, 0), data, cabinet });
    const html = pageCapitauxDeces(t, d);
    expect(html).toContain("Abattement imputé");
    expect(html).toContain(euro(40000));            // abattement réellement imputé
    expect(html).not.toContain("data-abattement-consomme");
    expect(html).not.toContain("consommé par l'assurance-vie");
  });
});
