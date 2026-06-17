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
import type { Constat } from "../lib/prevoyance/types";
import { mentionDDAPrevoyance } from "../lib/pdf/v2/textesLegaux";

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

// Constat synthetique (controle deterministe du nombre de constats / du chunk).
function fakeConstat(i: number): Constat {
  return {
    id: `c${i}`,
    severite: "non_conformite",
    axe: "conformite",
    cible: "entreprise",
    titre: `Constat numero ${i}`,
    detail: "Detail synthetique du constat.",
    action: "Action proposee.",
    reference: "art. L.911-7 CSS",
  };
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

  it("module inactif : une feuille unique, DDA presente exactement une fois", () => {
    const d = buildPrevoyanceCollData({ data: dataSalarie(), cabinet, dateLettre });
    expect(d.active).toBe(false);
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("Activer le module Prévoyance collective");
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBe(1);
    expect(html.split("L.521-4").length - 1).toBe(1); // DDA une seule fois
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

  it("decoupage : feuille 1 = Audit borne ; obligations + DDA sur la DERNIERE feuille", () => {
    const data = dataAvecSouscrit({ cadres: { capitalDC: { tauxSalaireRef: 1.0 } } });
    const d = buildPrevoyanceCollData({ data, cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBeGreaterThanOrEqual(2);
    const f1 = feuilles[0];
    expect(f1).toContain("Audit de conformit");
    expect(f1).not.toContain("Constats et pistes");   // constats sur feuille(s) dediee(s)
    expect(f1).not.toContain("L.521-4");               // DDA pas sur la feuille 1
    expect(f1).not.toContain("Obligation de branche"); // obligations ailleurs
    // obligations ET DDA sur la DERNIERE feuille
    const fObl = feuilles[feuilles.length - 1];
    expect(fObl).toContain("Obligation de branche");
    expect(fObl).toContain("L.521-4");
    // les feuilles de constats (entre Conformite et Obligations) ne portent pas la DDA
    for (const f of feuilles.slice(1, -1)) expect(f).not.toContain("L.521-4");
  });

  it("Syntec garanties vides : bandeau 'comparaison non realisee', pas de colonne Verdict", () => {
    const d = buildPrevoyanceCollData({ data: dataDirigeant("1486", "Syntec"), cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("comparaison non realisee");
    expect(html).not.toContain("Verdict");
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("Banque 2120 (etat vide) : statut sur la DERNIERE feuille (obligations), pas de tableau", () => {
    const d = buildPrevoyanceCollData({ data: dataDirigeant("2120", "Banque"), cabinet, dateLettre });
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    expect(feuilles.length).toBeGreaterThanOrEqual(2);
    const fObl = feuilles[feuilles.length - 1];
    expect(fObl).toContain("Aucune obligation de prevoyance de branche");
    expect(fObl).not.toContain("Obligation de branche"); // pas de tableau obligations
  });

  it("beaucoup de constats (9) : audit borne + constats chunkes (cap 4) + DDA unique", () => {
    const base = buildPrevoyanceCollData({ data: dataDirigeant("1486", "Syntec"), cabinet, dateLettre });
    const constats: Constat[] = Array.from({ length: 9 }, (_, i) => fakeConstat(i + 1));
    const d = { ...base, constats };
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    // Conformite (1) + ceil(9/4)=3 feuilles constats + Obligations (1) = 5
    expect(feuilles.length).toBe(5);
    // aucune carte perdue au chunk
    for (let i = 1; i <= 9; i++) expect(html).toContain(`Constat numero ${i}`);
    // mention DDA EXACTEMENT une fois, sur la DERNIERE feuille (obligations)
    expect(html.split("L.521-4").length - 1).toBe(1);
    for (const f of feuilles.slice(1, -1)) expect(f).not.toContain("L.521-4"); // pas sur les constats
    expect(feuilles[feuilles.length - 1]).toContain("L.521-4");
    expect(html).not.toMatch(REGEX_ASSUREURS);
  });

  it("aucun constat : une feuille Constats avec le message + DDA unique (sur obligations)", () => {
    const base = buildPrevoyanceCollData({ data: dataDirigeant("1486", "Syntec"), cabinet, dateLettre });
    const d = { ...base, constats: [] };
    const html = pagePrevoyanceColl(t, d);
    const feuilles = html.split("width:210mm;height:297mm").slice(1);
    // Conformite + 1 feuille Constats (message) + Obligations = 3
    expect(feuilles.length).toBe(3);
    expect(html).toContain("Aucune non-conformité");
    expect(html.split("L.521-4").length - 1).toBe(1);
    expect(feuilles[feuilles.length - 1]).toContain("L.521-4"); // sur la feuille obligations
  });

  it("DDA centralisee : texte legal byte-a-byte inchange (anti-divergence)", () => {
    const s = mentionDDAPrevoyance("EcoPatrimoine Conseil", "25006907");
    for (const m of ["non contractuelle", "L.541-1", "L.521-4", "devoir de conseil", "ORIAS"]) {
      expect(s).toContain(m);
    }
    expect(s).toBe(
      "Document remis à titre indicatif — analyse non contractuelle. Ne constitue ni un conseil en " +
      "investissement au sens de l'art. L.541-1 et s. CMF, ni un conseil en distribution d'assurance au " +
      "sens de l'art. L.521-4 C. ass. Toute mise en place de couverture doit faire l'objet d'un devoir de " +
      "conseil formalisé et d'une recommandation personnalisée par un intermédiaire habilité. " +
      "EcoPatrimoine Conseil — ORIAS n° 25006907."
    );
  });
});
