// ─── T3 / Famille E — Conformité DDA (PLAN_TESTS §E) ───────────────────
//
// Filet de sécurité réglementaire CRITIQUE : aucun constat produit par
// AUCUNE combinaison ne doit nommer un assureur/produit, ni pousser à
// souscrire. Mentions légales DDA présentes dans chaque page PDF.

import { describe, it, expect } from "vitest";
import { projeterArretMaladie } from "../lib/prevoyance/projection";
import { buildContexteRegle } from "../lib/prevoyance/contexte";
import { evaluerToutesLesRegles, mapAuditEnConstats } from "../lib/prevoyance/regles";
import { runAuditConformite } from "../lib/prevoyance/audit-collectif";
import { referentiels } from "../data/prevoyance";
import { buildPrevoyancePersoData } from "../lib/pdf/v2/adapters/buildPrevoyancePersoData";
import { pagePrevoyancePerso } from "../lib/pdf/v2/pages/pagePrevoyancePerso";
import { buildPrevoyanceCollData } from "../lib/pdf/v2/adapters/buildPrevoyanceCollData";
import { pagePrevoyanceColl } from "../lib/pdf/v2/pages/pagePrevoyanceColl";
import { buildTokens } from "../lib/pdf/v2/tokens";
import {
  trouveAssureurInterdit,
  REGEX_PRODUITS_COMMERCIAUX,
  REGEX_VERBES_PRESCRIPTIFS,
  actionCommenceParVerbeAnalyse,
  actionCommenceParVerbeObligation,
} from "../lib/prevoyance/__fixtures__/assureurs-interdits";
import { generateProfils } from "./__fixtures__/prevoyanceFuzzing";
import type { Constat, ContexteRegle, EntreePerso } from "../lib/prevoyance/types";
import type { EntrepriseAudit, PatrimonialData } from "../types/patrimoine";

// Construit un ContexteRegle directement depuis un EntreePerso fuzzé
// (sans payload complet), avec des paramètres foyer aléatoires bornés.
function ctxFromEntree(entree: EntreePerso, seed: number): ContexteRegle {
  const projection = projeterArretMaladie(entree, "cat2", referentiels);
  const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  return {
    entree,
    projection,
    dettesImmobilieres: r(1) < 0.5 ? Math.round(r(2) * 400000) : 0,
    conjointACharge: r(3) < 0.5,
    enfantsMineurs: Math.floor(r(4) * 4),
    revenuP1Mensuel: 3000,
    revenuP2Mensuel: r(5) < 0.5 ? 800 : 2500,
  };
}

function entrepriseAudit(over: Partial<EntrepriseAudit> = {}): EntrepriseAudit {
  return {
    siret: "12345678901234", nom: "ACME", formeJuridique: "SARL",
    effectif: 20, idccCCN: null, nomCCN: null, codeNAF: "7022Z",
    santeCollectiveEnPlace: false, participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false, tauxT1Cadres: 1.0,
    prevoyanceNonCadresEnPlace: false, categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false, ...over,
  };
}

// Échantillon « max constats » : contextes ciblés déclenchant un large
// éventail de règles individuelles + constats de conformité.
function echantillonConstats(): Constat[] {
  const constats: Constat[] = [];

  // TNS CARMF sans contrats, conjoint à charge + enfants → DC + IJ + invalidité
  const tns: EntreePerso = {
    age: 45, ageRetraite: 64, statutPro: "tns_liberal", caisse: "CARMF",
    idccCCN: null, ancienneteMois: 0, salaireBrutAnnuel: 0, salaireNetMensuel: 0,
    revenuTNSAnnuel: 95000, contratsIndividuels: [], couvertureCollective: null,
  };
  const ctxTns: ContexteRegle = {
    entree: tns, projection: projeterArretMaladie(tns, "cat2", referentiels),
    dettesImmobilieres: 280000, conjointACharge: true, enfantsMineurs: 2,
    revenuP1Mensuel: 7917, revenuP2Mensuel: 1000,
  };
  constats.push(...evaluerToutesLesRegles(ctxTns, "p1"));

  // Salarié IDCC non documenté → ij_ccn_non_documentee
  const sal: EntreePerso = {
    age: 30, ageRetraite: 64, statutPro: "salarie_non_cadre", caisse: "CPAM",
    idccCCN: "1486", ancienneteMois: 24, salaireBrutAnnuel: 28000, salaireNetMensuel: 0,
    contratsIndividuels: [], couvertureCollective: null,
  };
  const ctxSal: ContexteRegle = {
    entree: sal, projection: projeterArretMaladie(sal, "cat2", referentiels),
    dettesImmobilieres: 0, conjointACharge: false, enfantsMineurs: 0,
    revenuP1Mensuel: 1800, revenuP2Mensuel: 0,
  };
  constats.push(...evaluerToutesLesRegles(ctxSal, "p1"));

  // Audit conformité non conforme → constats conf_*
  const audit = runAuditConformite(
    entrepriseAudit({ effectif: 20, santeCollectiveEnPlace: false, prevoyanceCadresEnPlace: true, tauxT1Cadres: 1.0 }),
    referentiels
  );
  constats.push(...mapAuditEnConstats(audit));

  return constats;
}

describe("Famille E — Conformité DDA", () => {
  const constats = echantillonConstats();

  it("échantillon non vide (sanity)", () => {
    expect(constats.length).toBeGreaterThan(3);
  });

  // E1 — aucun assureur nommé dans titre / détail / action
  it("E1 — aucun assureur interdit dans titre/détail/action de tous les constats", () => {
    for (const c of constats) {
      expect(trouveAssureurInterdit(c.titre), `titre: ${c.titre}`).toBeNull();
      expect(trouveAssureurInterdit(c.detail), `detail: ${c.id}`).toBeNull();
      expect(trouveAssureurInterdit(c.action), `action: ${c.id}`).toBeNull();
    }
  });

  // E2 — aucun nom de gamme commerciale dans les actions
  it("E2 — aucun produit commercial nommé dans les actions", () => {
    for (const c of constats) {
      expect(c.action, `action: ${c.id}`).not.toMatch(REGEX_PRODUITS_COMMERCIAUX);
    }
  });

  // E3 — verbes : aucun verbe prescriptif ; constats individuels = verbe d'analyse
  it("E3a — aucune action ne commence par un verbe prescriptif (Souscrire/Choisir/Prendre)", () => {
    for (const c of constats) {
      expect(c.action, `action: ${c.id}`).not.toMatch(REGEX_VERBES_PRESCRIPTIFS);
    }
  });

  it("E3b — les constats individuels (axe non-conformité) commencent par un verbe d'analyse", () => {
    // Les actions correctives de conformité collective (cible=entreprise)
    // sont des obligations légales (« Mettre en place… ») : exemptées du
    // verbe d'analyse, mais soumises à E3a (pas de verbe prescriptif).
    for (const c of constats) {
      if (c.cible === "entreprise") continue;
      expect(actionCommenceParVerbeAnalyse(c.action), `action individuelle: ${c.id} → "${c.action.slice(0, 30)}"`).toBe(true);
    }
  });

  // E3c — liste FERMÉE de verbes d'obligation pour les actions collectives
  it("E3c — toute action de conformité collective commence par un verbe d'obligation autorisé", () => {
    const collectifs = constats.filter((c) => c.cible === "entreprise");
    expect(collectifs.length).toBeGreaterThan(0);
    for (const c of collectifs) {
      expect(
        actionCommenceParVerbeObligation(c.action),
        `action collective: ${c.id} → "${c.action.slice(0, 30)}"`
      ).toBe(true);
    }
  });

  // E4 — génératif : 200 profils fuzzés, agrégation de TOUS les constats
  it("E4 — fuzzing 200 profils : aucun assureur cité dans aucun constat agrégé", () => {
    const profils = generateProfils(200, 4242);
    const tous: Constat[] = [];
    profils.forEach(({ entree }, i) => {
      const ctx = ctxFromEntree(entree, i + 1);
      tous.push(...evaluerToutesLesRegles(ctx, "p1"));
      tous.push(...evaluerToutesLesRegles(ctx, "p2"));
      // Audit collectif sur une entreprise dérivée
      const audit = runAuditConformite(
        entrepriseAudit({ effectif: (i % 30), santeCollectiveEnPlace: i % 2 === 0, idccCCN: i % 3 === 0 ? "1486" : null }),
        referentiels
      );
      tous.push(...mapAuditEnConstats(audit));
    });
    expect(tous.length).toBeGreaterThan(100);
    for (const c of tous) {
      expect(trouveAssureurInterdit(c.titre)).toBeNull();
      expect(trouveAssureurInterdit(c.detail)).toBeNull();
      expect(trouveAssureurInterdit(c.action)).toBeNull();
    }
  });

  // E5 — mentions légales DDA dans chaque page PDF prévoyance
  it("E5 — page PDF perso : mention DDA + ORIAS du cabinet présents", () => {
    const t = buildTokens("encreOr");
    const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };
    const data = makeDataSalarie();
    const d = buildPrevoyancePersoData({ data, cabinet, which: "p1", dateLettre: "28 mai 2026" });
    const html = pagePrevoyancePerso(t, d);
    expect(html).toContain("non contractuelle");
    expect(html).toContain("L.521-4");
    expect(html).toContain("25006907");
  });

  it("E5 — page PDF collective : mention DDA + ORIAS du cabinet présents", () => {
    const t = buildTokens("encreOr");
    const cabinet = { cabinetName: "EcoPatrimoine Conseil", orias: "25006907" };
    const data = makeDataDirigeant();
    const d = buildPrevoyanceCollData({ data, cabinet, dateLettre: "28 mai 2026" });
    const html = pagePrevoyanceColl(t, d);
    expect(html).toContain("non contractuelle");
    expect(html).toContain("L.521-4");
    expect(html).toContain("25006907");
  });
});

// ── fixtures payload PDF ──
function baseData(over: Partial<PatrimonialData> = {}): PatrimonialData {
  return {
    person1FirstName: "Test", person1LastName: "Client", person1BirthDate: "1985-01-01",
    person1JobTitle: "", person1Csp: "", person1PcsGroupe: "",
    person2FirstName: "", person2LastName: "", person2BirthDate: "",
    person2JobTitle: "", person2Csp: "", person2PcsGroupe: "",
    coupleStatus: "single", matrimonialRegime: "", singleParent: false,
    person1Handicap: false, person2Handicap: false, childrenData: [],
    salary1: "40000", salary2: "0", pensions: "0", perDeduction: "0",
    pensionDeductible: "0", otherDeductible: "0",
    ca1: "0", bicType1: "", microRegime1: true, chargesReelles1: "0", baRevenue1: "0",
    chargesDetail1: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    ca2: "0", bicType2: "", microRegime2: true, chargesReelles2: "0", baRevenue2: "0",
    chargesDetail2: { loyer: "0", materiel: "0", deplacements: "0", repas: "0", tns: "0", bancaires: "0", comptable: "0", autres: "0" },
    properties: [], placements: [], perRentes: [], otherLoans: [],
    ...over,
  };
}
function makeDataSalarie(): PatrimonialData {
  return baseData({
    travail: {
      p1: {
        statutPro: "salarie_cadre", caisseAffiliation: "CPAM",
        employeur: { siret: "78404636300040", siren: "784046363", nom: "ACME", formeJuridique: "SAS", codeNAF: "6201Z", idccCCN: "1486", nomCCN: "Syntec", sourceCCN: "auto", effectif: 50, adresseEtablissement: null, dateCreation: null },
        dateEmbauche: "2020-01-01", tempsTravail: { type: "plein" },
        salaireBrutAnnuel: 55000, primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
      },
      p2: null,
    },
  });
}
function makeDataDirigeant(): PatrimonialData {
  return baseData({
    travail: {
      p1: {
        statutPro: "gerant_majoritaire", caisseAffiliation: "SSI",
        employeur: { siret: "12345678901234", siren: "123456789", nom: "SARL DUPONT", formeJuridique: "SARL", codeNAF: "4321A", idccCCN: null, nomCCN: null, sourceCCN: "non_defini", effectif: 12, adresseEtablissement: null, dateCreation: null },
        dateEmbauche: "2015-01-01", tempsTravail: { type: "plein" },
        salaireBrutAnnuel: 0, primeAnnuelle: null, revenuBNC: null, revenuBIC: null, optionMadelin: false,
      },
      p2: null,
    },
  });
}
