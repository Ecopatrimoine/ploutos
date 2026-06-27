// ─── Lot distribution du blanc (1/3 haut - 2/3 bas) — asserts structurels ───────
//
// Le HANDLER lui-meme (DISTRIBUTE_HANDLER_SCRIPT) est du JS INJECTE qui ne tourne que
// dans l'iframe paged.js du vrai pack (ApercuPdf) -> sa MESURE/INJECTION DOM n'est PAS
// unit-testable ici (jsdom n'execute pas paged.js). On verrouille donc ce qui l'est :
//   1) le mecanisme d'opt-in (compilerPageContrat attributs) ;
//   2) le hissage data-pdf-distribute -> data-distribute par le feeder ;
//   3) la PRESENCE du marqueur sur les 3 pages pilotes / son ABSENCE ailleurs ;
//   4) les invariants STRUCTURELS du handler (formule round(residuel/3), seuil, clamp,
//      derniere feuille, opt-in) — verrouille la formule, pas le comportement DOM.
// La distribution effective (descente d'1/3 du blanc, pas de feuille fantome) releve de
// la VALIDATION VISUELLE dans le vrai pack.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTokens } from "../lib/pdf/v2/tokens";
import { compilerPageContrat, compilerBloc } from "../lib/pdf/v2/engine/contrat";
import { buildFeederDocument } from "../lib/pdf/v2/engine/feeder";
import { DISTRIBUTE_HANDLER_SCRIPT } from "../lib/pdf/v2/engine/pagedHandler";
import { pageIR } from "../lib/pdf/v2/pages/pageIR";
import { pageFamille } from "../lib/pdf/v2/pages/pageFamille";
import { pageCapitauxDeces } from "../lib/pdf/v2/pages/pageCapitauxDeces";
import { pageCouverture } from "../lib/pdf/v2/pages/pageCouverture";
import { buildIRData } from "../lib/pdf/v2/adapters/buildIRData";
import { buildFamilleData } from "../lib/pdf/v2/adapters/buildFamilleData";
import { buildCapitauxDecesData } from "../lib/pdf/v2/adapters/buildCapitauxDecesData";
import { fixtureData, fixtureCabinet, buildFixtureComputed } from "./__fixtures__/pdfFixture";

const t = buildTokens("encreOr");
const dateLettre = "25 mai 2026";
const lireSource = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("compilerPageContrat — opt-in attributs (mecanisme)", () => {
  it("sans attributs : wrapper .pdf-contrat strictement inchange", () => {
    const html = compilerPageContrat([{ kind: "insecable", html: "<p>X</p>" }]);
    expect(html).toContain('<div class="pdf-contrat" style="padding:0 38px 0;orphans:2;widows:2">');
    expect(html).not.toContain("data-pdf-distribute");
  });

  it("avec attributs : poses sur le wrapper", () => {
    const html = compilerPageContrat([{ kind: "insecable", html: "<p>X</p>" }], { attributs: 'data-pdf-distribute="1"' });
    expect(html).toContain('<div class="pdf-contrat" data-pdf-distribute="1" style=');
  });
});

describe("compilerBloc — attributs PAR BLOC (ancre de frontiere)", () => {
  it("insecable sans attributs : <div> strictement inchange (additif)", () => {
    expect(compilerBloc({ kind: "insecable", html: "<p>X</p>" })).toBe('<div style="break-inside:avoid"><p>X</p></div>');
  });
  it("insecable avec attributs : pose sur le <div> du bloc, avant style", () => {
    const html = compilerBloc({ kind: "insecable", html: "<p>X</p>", attributs: "data-pdf-distribute-anchor" });
    expect(html).toBe('<div data-pdf-distribute-anchor style="break-inside:avoid"><p>X</p></div>');
  });
  it("queue avec attributs : pose sur le <div class=pdf-queue>", () => {
    const html = compilerBloc({ kind: "queue", html: "<p>Q</p>", attributs: "data-pdf-distribute-anchor" });
    expect(html).toContain('<div class="pdf-queue" data-pdf-distribute-anchor style=');
  });
});

describe("feeder — hissage data-pdf-distribute -> data-distribute", () => {
  const feeder = (bodies: string[]) =>
    buildFeederDocument({ bodies, t, doctitle: "Doc", cabinetLibelle: "Cab", polyfillCode: "" });

  it("corps marque -> section data-distribute=<idx> (idx = position de section)", () => {
    const html = feeder([
      '<div class="pdf-contrat">A</div>',                       // idx 0 : non marque
      '<div class="pdf-contrat" data-pdf-distribute="1">B</div>', // idx 1 : marque
    ]);
    expect(html).toContain('data-distribute="1"');     // hisse sur la 2e section (idx 1)
    expect(html).not.toContain('data-distribute="0"'); // la 1re section n'est pas marquee
  });

  it("corps non marque -> aucune section data-distribute= (le script handler en parle, pas la section)", () => {
    // NB : on cible l'ATTRIBUT de section data-distribute=" ; le DistributeHandler injecte
    // mentionne "[data-distribute]" sans "=", donc ne fausse pas cette assertion.
    expect(feeder(['<div class="pdf-contrat">A</div>'])).not.toContain('data-distribute="');
  });

  it("docReg (data-pdf-page + data-pdf-doc, sans distribute) -> data-page/doc mais PAS data-distribute=", () => {
    const html = feeder(['<div class="pdf-contrat" data-pdf-page="docReg" data-pdf-doc="DER">Z</div>']);
    expect(html).toContain('data-page="docReg"');
    expect(html).toContain('data-doc="DER"');
    expect(html).not.toContain('data-distribute="');
  });

  it("le DistributeHandler est injecte dans le document feeder", () => {
    expect(feeder(['<div class="pdf-contrat">A</div>'])).toContain("DistributeHandler");
  });
});

describe("marqueur par page — PRESENCE sur les 3 pilotes", () => {
  const { ir, succession } = buildFixtureComputed();

  it("pageIR porte data-pdf-distribute", () => {
    const html = pageIR(t, buildIRData({ ir, data: fixtureData, cabinet: fixtureCabinet, dateLettre }));
    expect(html).toContain('data-pdf-distribute="1"');
  });

  it("pageFamille porte data-pdf-distribute", () => {
    const html = pageFamille(t, buildFamilleData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    expect(html).toContain('data-pdf-distribute="1"');
  });

  it("pageCapitauxDeces porte data-pdf-distribute", () => {
    const html = pageCapitauxDeces(t, buildCapitauxDecesData({ succession, data: fixtureData, cabinet: fixtureCabinet, dateLettre }));
    expect(html).toContain('data-pdf-distribute="1"');
  });
});

describe("ancre de frontiere en-tete/corps — PRESENCE + POSITION sur les 3 pilotes", () => {
  const { ir, succession } = buildFixtureComputed();

  it("pageIR : ancre APRES la bande KPI, SUR le 1er corps (Revenus par nature)", () => {
    const html = pageIR(t, buildIRData({ ir, data: fixtureData, cabinet: fixtureCabinet, dateLettre }));
    const a = html.indexOf("data-pdf-distribute-anchor");
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(html.indexOf("Fiscalité"));        // apres le masthead (eyebrow)
    expect(a).toBeGreaterThan(html.indexOf("IMPÔT NET DÛ"));     // apres la bande KPI
    expect(a).toBeLessThan(html.indexOf("Revenus par nature"));  // pose SUR le 1er corps (attribut avant le texte)
  });

  it("pageFamille : ancre APRES le masthead, SUR les cartes (masthead seul fixe)", () => {
    const html = pageFamille(t, buildFamilleData({ data: fixtureData, cabinet: fixtureCabinet, ir, dateLettre }));
    const a = html.indexOf("data-pdf-distribute-anchor");
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(html.indexOf("Composition du foyer")); // apres le masthead (eyebrow)
    expect(a).toBeLessThan(html.indexOf("Personne 1"));              // pose SUR le bloc des cartes
  });

  it("pageCapitauxDeces : ancre APRES la bande KPI, AVANT la queue Notre lecture", () => {
    const html = pageCapitauxDeces(t, buildCapitauxDecesData({ succession, data: fixtureData, cabinet: fixtureCabinet, dateLettre }));
    const a = html.indexOf("data-pdf-distribute-anchor");
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(html.indexOf("Capital décès assurance")); // apres le dernier KPI
    expect(a).toBeLessThan(html.indexOf("Notre lecture"));              // 1er corps, avant la queue
  });

  it("couverture (non opt-in) ne porte PAS d'ancre", () => {
    const html = pageCouverture(t, {
      cabinetNom: "EcoPatrimoine Conseil", cabinetSousTitre: "CONSEIL", orias: "25006907",
      eyebrowDocument: "Conseil", titreDocument: "Rapport", clientName: "Dubreuil", dateStr: dateLettre,
    });
    expect(html).not.toContain("data-pdf-distribute-anchor");
  });
});

describe("marqueur par page — ABSENCE (couverture + docReg jamais marques)", () => {
  it("pageCouverture (full-bleed) ne porte PAS data-pdf-distribute", () => {
    const html = pageCouverture(t, {
      cabinetNom: "EcoPatrimoine Conseil", cabinetSousTitre: "CONSEIL", orias: "25006907",
      eyebrowDocument: "Conseil", titreDocument: "Rapport", clientName: "Dubreuil", dateStr: dateLettre,
    });
    expect(html).toContain("data-pdf-cover");          // sanity : c'est bien la couverture
    expect(html).not.toContain("data-pdf-distribute");
  });

  it("les pages docReg (source) ne contiennent PAS data-pdf-distribute", () => {
    const docReg = [
      "../lib/pdf/v2/pages/pageDer.ts",
      "../lib/pdf/v2/pages/pageDerAnnexe.ts",
      "../lib/pdf/v2/pages/pageLettreMission.ts",
      "../lib/pdf/v2/pages/pageFicheDDA.ts",
      "../lib/pdf/v2/pages/pageDeclarationAdequation.ts",
    ];
    for (const f of docReg) {
      expect(lireSource(f)).not.toContain("data-pdf-distribute");
    }
  });
});

describe("DistributeHandler — invariants structurels (formule + garde-fous)", () => {
  const s = DISTRIBUTE_HANDLER_SCRIPT;
  it("s'enregistre comme handler paged.js", () => {
    expect(s).toContain("registerHandlers(DistributeHandler)");
  });
  it("groupe en afterPageLayout, agit en afterRendered (pagination figee)", () => {
    expect(s).toContain("afterPageLayout");
    expect(s).toContain("afterRendered");
  });
  it("opt-in strict sur [data-distribute] + no-op si marqueur absent", () => {
    expect(s).toContain('querySelector("[data-distribute]")');
    expect(s).toContain("if (!holder) return");   // feuille non marquee -> jamais touchee
  });
  it("derniere feuille uniquement (sheets[sheets.length - 1])", () => {
    expect(s).toContain("sheets[sheets.length - 1]");
  });
  it("mesure la zone reelle .pagedjs_page_content", () => {
    expect(s).toContain(".pagedjs_page_content");
  });
  it("formule 1/3 : round(residuel / 3)", () => {
    expect(s).toContain("Math.round(residuel / 3)");
  });
  it("seuil minimal : no-op si residuel <= seuil (pas de micro-decalage)", () => {
    expect(s).toContain("SEUIL_MIN = 48");
    expect(s).toContain("if (residuel <= SEUIL_MIN) return");
  });
  it("clamp strict : spacer jamais > residuel", () => {
    expect(s).toContain("if (spacer > residuel) spacer = residuel");
  });
  it("anti-boucle : re-mesure et annulation si debordement", () => {
    expect(s).toContain("check > avail");
    expect(s).toContain("removeChild(sp)");
  });
  it("cherche l'ancre de frontiere data-pdf-distribute-anchor", () => {
    expect(s).toContain('querySelector("[data-pdf-distribute-anchor]")');
  });
  it("injecte le spacer DANS le parent de l'ancre, AVANT l'ancre (masthead protege)", () => {
    expect(s).toContain("anchor.parentNode");
    expect(s).toContain("parent.insertBefore(sp, ref)");
  });
  it("feuille de continuation (multi-feuille) : injection en tete legitime", () => {
    expect(s).toContain("sheets.length > 1");
  });
  it("garde-fou : feuille unique sans ancre -> no-op (jamais pousser le masthead)", () => {
    expect(s).toContain("garde-fou");
  });
});
