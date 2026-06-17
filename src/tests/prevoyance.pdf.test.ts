// ─── Sentinelles pages PDF Prévoyance v2 (Lot 9) ───────────────────────
//
// Vérifie que les pages PDF du module Prévoyance (perso P1/P2 +
// collective) rendent du HTML non vide, structuré, avec :
//   - graphique SVG inline (perso)
//   - tableau jalons + constats (perso)
//   - matrice audit + score (collective)
//   - mention DDA en bas (ORIAS du cabinet, jamais d'assureur)
//   - état vide propre quand données absentes

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { buildPrevoyancePersoData } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { pagePrevoyancePerso } from "../lib/pdf/v2/pages/pagePrevoyancePerso";
import { buildPrevoyanceCollData } from "../lib/pdf/v2/adapters/buildPrevoyanceCollData";
import { pagePrevoyanceColl } from "../lib/pdf/v2/pages/pagePrevoyanceColl";

const t = buildTokens("encreOr");
const dateLettre = "28 mai 2026";
const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };

const REGEX_ASSUREURS = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut/i;

function dataSalarie(extra: Record<string, any> = {}): Record<string, any> {
  return {
    person1FirstName: "Mathieu",
    person1LastName: "Dupont",
    person1BirthDate: "1990-01-01",
    person2FirstName: "",
    person2LastName: "",
    coupleStatus: "single",
    salary1: "42900",
    salary2: "0",
    ca1: "0",
    ca2: "0",
    childrenData: [],
    properties: [],
    travail: {
      p1: {
        statutPro: "salarie_cadre",
        caisseAffiliation: "CPAM",
        employeur: {
          siret: "78404636300040", siren: "784046363", nom: "ACME",
          formeJuridique: "SARL", codeNAF: "7022Z",
          idccCCN: "1486", nomCCN: "Syntec", sourceCCN: "auto",
          effectif: 50, adresseEtablissement: null, dateCreation: null,
        },
        dateEmbauche: "2021-01-01",
        tempsTravail: { type: "plein" },
        salaireBrutAnnuel: 55000,
        primeAnnuelle: null,
        revenuBNC: null, revenuBIC: null, optionMadelin: false,
      },
      p2: null,
    },
    ...extra,
  };
}

// Dirigeant (gerant majoritaire) dont l'entreprise porte une convention donnee :
// active la page collective et alimente la section obligations de branche.
function dataDirigeant(idccCCN: string, nomCCN: string): Record<string, any> {
  return dataSalarie({
    travail: {
      p1: {
        statutPro: "gerant_majoritaire",
        caisseAffiliation: "SSI",
        employeur: {
          siret: "12345678901234", siren: "123456789", nom: "SARL DUPONT",
          formeJuridique: "SARL", codeNAF: "4321A",
          idccCCN, nomCCN, sourceCCN: "auto",
          effectif: 12, adresseEtablissement: null, dateCreation: null,
        },
        dateEmbauche: "2015-01-01",
        tempsTravail: { type: "plein" },
        salaireBrutAnnuel: 0,
        primeAnnuelle: null,
        revenuBNC: null, revenuBIC: null, optionMadelin: false,
      },
      p2: null,
    },
  });
}

// Dossier dont la collective enregistree porte des garanties souscrites
// (-> afficherComparaison = true cote vue fusionnee).
function dataAvecSouscrit(garantiesSouscrites: Record<string, any>): Record<string, any> {
  return dataSalarie({
    prevoyance: {
      version: 1,
      p1: { contratsIndividuels: [], couvertureCollective: null, categorieInvaliditeProjetee: "cat2" },
      p2: null,
      collective: {
        active: true,
        source: "analyse_externe",
        entreprise: {
          siret: "12345678901234", nom: "SARL DUPONT", formeJuridique: "SARL",
          effectif: 12, idccCCN: "1486", nomCCN: "Syntec", codeNAF: "4321A",
          santeCollectiveEnPlace: false, participationEmployeurSante: 0.5,
          prevoyanceCadresEnPlace: false, tauxT1Cadres: 1.5,
          prevoyanceNonCadresEnPlace: false, categoriesObjectivesDeclarees: "",
          retraiteSuppEnPlace: false,
          garantiesSouscrites,
        },
      },
    },
  });
}

describe("pagePrevoyancePerso — sentinelles", () => {
  it("rend une page complète avec SVG + jalons + mention DDA pour un salarié P1", () => {
    const d = buildPrevoyancePersoData({ data: dataSalarie(), cabinet, which: "p1", dateLettre });
    const html = pagePrevoyancePerso(t, d);
    expect(html.length).toBeGreaterThan(800);
    expect(html).toContain("Prévoyance personnelle");
    expect(html).toContain("Mathieu Dupont");
    // Graphique SVG inline
    expect(html).toContain("<svg");
    // Tableau jalons
    expect(html).toContain("Points clés");
    // Mention DDA + ORIAS du cabinet (jamais en dur)
    expect(html).toContain("non contractuelle");
    expect(html).toContain("L.521-4");
    expect(html).toContain("25006907");
    expect(html).toContain("EcoPatrimoine Conseil");
  });

  it("affiche un état vide propre si data.travail.p2 absent (which=p2)", () => {
    const d = buildPrevoyancePersoData({ data: dataSalarie(), cabinet, which: "p2", dateLettre });
    expect(d.disponible).toBe(false);
    const html = pagePrevoyancePerso(t, d);
    expect(html).toContain("Compléter l'onglet Travail");
  });

  it("ne mentionne jamais d'assureur ni de produit (conformité DDA)", () => {
    const d = buildPrevoyancePersoData({ data: dataSalarie(), cabinet, which: "p1", dateLettre });
    const html = pagePrevoyancePerso(t, d);
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("intègre la couverture collective saisie dans data.prevoyance", () => {
    const data = dataSalarie({
      prevoyance: {
        version: 1,
        p1: {
          contratsIndividuels: [],
          couvertureCollective: {
            ij: { pctSalaire: 0.8, franchise: 90, plafondJours: 1095, baseCalcul: "T1_T2" },
            invalidite: { cat1: { pctSalaire: 0.4 }, cat2: { pctSalaire: 0.8 }, cat3: { pctSalaire: 1.0 } },
            capitalDeces: { montant: 55000 },
          },
          categorieInvaliditeProjetee: "cat2",
        },
        p2: null,
        collective: null,
      },
    });
    const d = buildPrevoyancePersoData({ data, cabinet, which: "p1", dateLettre });
    expect(d.disponible).toBe(true);
    // La projection doit contenir une couche collective non nulle quelque part.
    const sommeColl =
      d.projection!.series.ijComplementaireCollective.reduce((a, b) => a + b, 0) +
      d.projection!.series.renteInvalCollective.reduce((a, b) => a + b, 0);
    expect(sommeColl).toBeGreaterThan(0);
  });
});

describe("pagePrevoyanceColl — sentinelles", () => {
  it("rend un audit avec matrice + score + mention DDA pour un dirigeant", () => {
    const data = dataSalarie({
      travail: {
        p1: {
          statutPro: "gerant_majoritaire",
          caisseAffiliation: "SSI",
          employeur: {
            siret: "12345678901234", siren: "123456789", nom: "SARL DUPONT",
            formeJuridique: "SARL", codeNAF: "4321A",
            idccCCN: null, nomCCN: null, sourceCCN: "non_defini",
            effectif: 12, adresseEtablissement: null, dateCreation: null,
          },
          dateEmbauche: "2015-01-01",
          tempsTravail: { type: "plein" },
          salaireBrutAnnuel: 0,
          primeAnnuelle: null,
          revenuBNC: null, revenuBIC: null, optionMadelin: false,
        },
        p2: null,
      },
    });
    const d = buildPrevoyanceCollData({ data, cabinet, dateLettre });
    expect(d.active).toBe(true);
    const html = pagePrevoyanceColl(t, d);
    expect(html.length).toBeGreaterThan(800);
    expect(html).toContain("Prévoyance collective");
    expect(html).toContain("Audit de conformité");
    expect(html).toContain("SARL DUPONT");
    expect(html).toContain("%"); // score
    expect(html).toContain("25006907"); // ORIAS cabinet
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("affiche un état inactif si aucun dirigeant ni collective enregistrée", () => {
    const d = buildPrevoyanceCollData({ data: dataSalarie(), cabinet, dateLettre });
    expect(d.active).toBe(false);
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("Activer le module Prévoyance collective");
  });

  it("Syntec riche (garanties renseignees) : verdicts + synthese (feuille 2)", () => {
    const data = dataAvecSouscrit({ cadres: { capitalDC: { tauxSalaireRef: 1.0 } } });
    const d = buildPrevoyanceCollData({ data, cabinet, dateLettre });
    expect(d.active).toBe(true);
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("Obligations de prevoyance de branche");
    expect(html).toContain("Capital deces");
    expect(html).toContain("Verdict"); // colonne presente -> comparaison active
    expect(html).toMatch(/Conforme|Insuffisant|A etudier/);
    // compteurs de synthese
    expect(html).toContain("conformes");
    expect(html).toContain("insuffisante(s)");
    expect(html).toContain("a etudier");
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("decoupage 2 feuilles : Conformite (Audit + Constats) puis Obligations", () => {
    const data = dataAvecSouscrit({ cadres: { capitalDC: { tauxSalaireRef: 1.0 } } });
    const d = buildPrevoyanceCollData({ data, cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBe(2); // deux feuilles A4
    const [f1, f2] = feuilles;
    expect(f1).toContain("Audit de conformit");
    expect(f1).toContain("Constats et pistes");
    expect(f1).not.toContain("Obligation de branche"); // obligations PAS sur la feuille 1
    expect(f2).toContain("Obligation de branche");      // ... mais sur la feuille 2
  });

  it("Syntec garanties vides : bandeau 'comparaison non realisee', pas de colonne Verdict", () => {
    const d = buildPrevoyanceCollData({ data: dataDirigeant("1486", "Syntec"), cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("comparaison non realisee");
    expect(html).not.toContain("Verdict");
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("Banque 2120 (etat vide) : statut sur la feuille 2, pas de tableau, feuille non blanche", () => {
    const d = buildPrevoyanceCollData({ data: dataDirigeant("2120", "Banque"), cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBe(2);
    const f2 = feuilles[1];
    expect(f2).toContain("Aucune obligation de prevoyance de branche");
    expect(f2).not.toContain("Obligation de branche"); // pas de tableau obligations
  });
});
