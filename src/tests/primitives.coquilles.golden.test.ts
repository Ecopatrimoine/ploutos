// ─── GOLDEN MASTER — coquilles PDF + ancres de pied (LOT #3, etape 3.1) ──────
//
// Filet MECANIQUE pose AVANT le refacto bandePiedAncree (etapes 3.2/3.3/3.4).
// Capture l'output HTML EXACT des primitives que le refacto va toucher, sur le
// code de prod ACTUEL. Aucune modif de code de prod ; ces snapshots doivent etre
// VERTS tels quels. Si une etape de refacto change l'output (marges, ancre,
// lisere, pied bespoke de la couverture...), le diff de snapshot le revele.
//
// Surface pinnee :
//   - coquillePage : branche signature absente / presente (marges 38/38) ;
//   - coquillePageDocReg : branche signature absente / presente (marges 44/36 + lisere) ;
//   - piedPage (bottom:16, font 10px) et piedPageDocReg (bottom:15, font 9.5px) ;
//   - pageCouverture complete (protege le repli du pied bespoke 56/42 en 3.4).
//
// Token : buildTokens("encreOr") = theme utilise par tous les tests PDF du repo
// (couleurs fideles, deterministe).

import { describe, it, expect } from "vitest";
import { buildTokens } from "../lib/pdf/v2/tokens";
import {
  coquillePage,
  coquillePageDocReg,
  piedPage,
  piedPageDocReg,
} from "../lib/pdf/v2/primitives";
import { pageCouverture } from "../lib/pdf/v2/pages/pageCouverture";
import { pageFamille, type FamillePageData } from "../lib/pdf/v2/pages/pageFamille";
import { pageSuccessionA, type SuccessionAPageData } from "../lib/pdf/v2/pages/pageSuccessionA";
import { pageSuccessionB, type SuccessionBPageData } from "../lib/pdf/v2/pages/pageSuccessionB";
import { pageBilanEndettement, type BilanEndettementPageData } from "../lib/pdf/v2/pages/pageBilanEndettement";

const t = buildTokens("encreOr");

// Entrees deterministes (placeholders fixes pour isoler la structure).
const contenu = "CONTENU_TEST";
const pied = "PIED_TEST";
const signature = "SIGNATURE_TEST";
const gauche = "GAUCHE";
const droite = "DROITE";

describe("GOLDEN — coquillePage (marges 38/38)", () => {
  it("1. sans signature", () => {
    expect(coquillePage(t, { contenu, pied })).toMatchInlineSnapshot(`
      "
          <div style="position:relative;width:210mm;height:297mm;overflow:hidden">
            <div style="padding:32px 38px 0">
              CONTENU_TEST
            </div>
            
            PIED_TEST
          </div>
        "
    `);
  });

  it("2. avec signature", () => {
    expect(coquillePage(t, { contenu, pied, signature })).toMatchInlineSnapshot(`
      "
          <div style="position:relative;width:210mm;height:297mm;overflow:hidden">
            <div style="padding:32px 38px 0">
              CONTENU_TEST
            </div>
            <div style="position:absolute;left:38px;right:38px;bottom:42px">SIGNATURE_TEST</div>
            PIED_TEST
          </div>
        "
    `);
  });
});

describe("GOLDEN — coquillePageDocReg (marges 44/36 + lisere navy/or)", () => {
  it("3. sans signature", () => {
    expect(coquillePageDocReg(t, { contenu, pied })).toMatchInlineSnapshot(`
      "
          <div style="position:relative;width:210mm;height:297mm;overflow:hidden">
            <div style="position:absolute;top:0;left:0;bottom:0;width:7px;background:#0F172A"></div>
            <div style="position:absolute;top:0;left:7px;bottom:0;width:2px;background:#C4973D"></div>
            <div style="padding:30px 36px 0 44px">
              CONTENU_TEST
            </div>
            
            PIED_TEST
          </div>
        "
    `);
  });

  it("4. avec signature", () => {
    expect(coquillePageDocReg(t, { contenu, pied, signature })).toMatchInlineSnapshot(`
      "
          <div style="position:relative;width:210mm;height:297mm;overflow:hidden">
            <div style="position:absolute;top:0;left:0;bottom:0;width:7px;background:#0F172A"></div>
            <div style="position:absolute;top:0;left:7px;bottom:0;width:2px;background:#C4973D"></div>
            <div style="padding:30px 36px 0 44px">
              CONTENU_TEST
            </div>
            <div style="position:absolute;left:44px;right:36px;bottom:42px">SIGNATURE_TEST</div>
            PIED_TEST
          </div>
        "
    `);
  });
});

describe("GOLDEN — pieds ancres", () => {
  it("5. piedPage (left/right 38, bottom 16, font 10px)", () => {
    expect(piedPage(t, { gauche, droite })).toMatchInlineSnapshot(`
      "
          <div style="position:absolute;left:38px;right:38px;bottom:16px;border-top:1px solid #E4DDCF;padding-top:8px;display:flex;justify-content:space-between">
            <span class="lt" style="font-size:10px;color:#A39A88">GAUCHE</span>
            <span class="lt" style="font-size:10px;color:#A39A88">DROITE</span>
          </div>
        "
    `);
  });

  it("6. piedPageDocReg (left 44 / right 36, bottom 15, font 9.5px)", () => {
    expect(piedPageDocReg(t, { gauche, droite })).toMatchInlineSnapshot(`
      "
          <div style="position:absolute;left:44px;right:36px;bottom:15px;border-top:1px solid #E4DDCF;padding-top:7px;display:flex;justify-content:space-between">
            <span class="lt" style="font-size:9.5px;color:#A39A88">GAUCHE</span>
            <span class="lt" style="font-size:9.5px;color:#A39A88">DROITE</span>
          </div>
        "
    `);
  });
});

describe("GOLDEN — pageCouverture (page complete, pied bespoke 56/42)", () => {
  // Fixture MINIMAL representatif : seulement les champs requis. Pas de logo
  // (-> repli initiales deterministe), pas d'ORIAS (-> bloc vide). Snapshot
  // externe (.snap) car l'output est long.
  it("7. page complete (snapshot externe)", () => {
    const html = pageCouverture(t, {
      cabinetNom: "Cabinet Test",
      eyebrowDocument: "EYEBROW_TEST",
      titreDocument: "TITRE_TEST",
      clientName: "CLIENT_TEST",
      dateStr: "01 janvier 2026",
    });
    expect(html).toMatchSnapshot();
  });
});

// ─── Pilote generalisation centrage (regionCorpsCentree) sur pageFamille ──────
// pageFamille mono-feuille, pied simple, AUCUNE DDA. Le CORPS (foyer) est enveloppe
// dans regionCorpsCentree ; le header reste en haut. Cas court (2 adultes + 1 enfant)
// = base de regression + assertions structurelles (entretoises + header hors region).
const dFamilleCourt: FamillePageData = {
  clientName: "CLIENT_TEST",
  dateStr: "01 janvier 2026",
  personne1: { prenom: "Alex", nom: "Martin", dateNaissance: "01/01/1980", age: 46, profession: "Cadre" },
  personne2: { prenom: "Sam", nom: "Martin", dateNaissance: "01/01/1982", age: 44, profession: "Profession liberale" },
  statutCouple: "Marie - communaute legale",
  parts: 3,
  nbEnfants: 1,
  enfants: [{ prenom: "Lou", dateNaissance: "01/01/2015", lien: "Commun", garde: "Pleine", rattache: true, handicap: false }],
  pagePosition: "1 / 8",
  cabinetLibellePied: "Cabinet Test",
};

describe("GOLDEN — pageFamille centrage (foyer court : corps centre, header en haut)", () => {
  it("8. foyer court (2 adultes + 1 enfant) : base de regression (snapshot externe)", () => {
    expect(pageFamille(t, dFamilleCourt)).toMatchSnapshot();
  });

  it("8b. structure : 2 entretoises ratio 1:2 autour du corps, header hors region", () => {
    const html = pageFamille(t, dFamilleCourt);
    // Region centree = colonne flex a hauteur bornee.
    expect(html).toMatch(/height:\d+px;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box/);
    // Les 2 entretoises ratio (haute 2 parts, basse 3 parts) ; le cap pixel disparu
    // est verrouille par le snapshot de regression cas 8.
    expect(html).toContain('<div style="flex:1 1 0"></div>');   // entretoise HAUTE (1 part)
    expect(html).toContain('<div style="flex:2 1 0"></div>');   // entretoise BASSE (2 parts)
    // Header HORS region : l'eyebrow (unique au header) precede la 1re entretoise.
    expect(html.indexOf("Composition du foyer")).toBeLessThan(html.indexOf("flex:1 1 0"));
    // Corps DANS la region : "Personne 1" suit la 1re entretoise.
    expect(html.indexOf("Personne 1")).toBeGreaterThan(html.indexOf("flex:1 1 0"));
  });
});

// ─── Lot groupe centrage : SuccessionA / SuccessionB / BilanEndettement ───────
// Meme patron que pageFamille : zone haute (header + KPI + note) fixe, CORPS centre
// via regionCorpsCentree. Cas court par page = base de regression + entretoises 1:2
// + header hors region (token CLIENT_TEST en header, token corps dans la region).
const HAUTE = '<div style="flex:1 1 0"></div>';
const BASSE = '<div style="flex:2 1 0"></div>';

const dSuccA: SuccessionAPageData = {
  clientName: "CLIENT_TEST", dateStr: "01 janvier 2026",
  masseSuccessoraleNette: 500000, droitsSuccession: 20000, netTransmis: 480000, tauxMoyen: "4 %",
  noteKpi: "Masse civile de test.",
  devolutionBadge: "Devolution legale", devolutionDescription: "1 enfant, conjoint",
  reservePct: 50, reserveLabel: "Reserve", reserveMontant: 250000,
  quotitePct: 50, quotiteLabel: "Quotite dispo", quotiteMontant: 250000,
  heritiers: [{ nom: "HERITIER_TEST", lien: "Conjoint", partRecue: 240000, droits: 0, droitsExonere: true, net: 240000 }],
  notreLecture: "Lecture de test succession A.",
  pagePosition: "1 / 8", cabinetLibellePied: "Cabinet Test - confidentiel",
};

const dSuccB: SuccessionBPageData = {
  clientName: "CLIENT_TEST", dateStr: "01 janvier 2026",
  capitauxTransmis: 100000, fiscaliteTotale: 0, netAuxBeneficiaires: 100000, abattementRestant: 52500,
  noteKpi: "Regime 990 I de test.",
  beneficiaires: [{ nom: "BENEF_TEST", lien: "Enfant", capital: 100000, abattement990I: 152500, fiscalite: 0, net: 100000 }],
  clauseBeneficiaireHtml: "Clause de test.",
  totalNetTransmis: 600000, totalLabelHaut: "Total transmis net", totalLabelBas: "(succession + AV)",
  notreLecture: "Lecture de test succession B.",
  pagePosition: "2 / 8", cabinetLibellePied: "Cabinet Test - confidentiel",
};

const dBilan: BilanEndettementPageData = {
  clientName: "CLIENT_TEST", dateStr: "01 janvier 2026",
  patrimoineNet: 300000, actifBrut: 400000, passifTotal: 100000, tauxEndettement: "20 %",
  noteKpi: "Methode bancaire de test.",
  calculTaux: { chargesCreditAnnuelles: 12000, assuranceCreditAnnuelle: 600, salairesNetsAnnuels: 60000, loyersBrutsAnnuels: 0 },
  immobilier: 300000, placementsFinanciers: 80000, assuranceVieEtPER: 20000,
  creditImmobilier: 90000, autresCredits: 10000,
  notreLecture: "LECTURE_BILAN_TEST lecture de test bilan.",
  pagePosition: "1 / 8", cabinetLibellePied: "Cabinet Test - confidentiel",
};

describe("GOLDEN — pageSuccessionA centrage (cas court)", () => {
  it("9. cas court : base de regression + entretoises 1:2, header hors region", () => {
    const html = pageSuccessionA(t, dSuccA);
    expect(html).toMatchSnapshot();
    expect(html).toContain(HAUTE);
    expect(html).toContain(BASSE);
    expect(html.indexOf("CLIENT_TEST")).toBeLessThan(html.indexOf(HAUTE));
    expect(html.indexOf("HERITIER_TEST")).toBeGreaterThan(html.indexOf(HAUTE));
  });
});

describe("GOLDEN — pageSuccessionB centrage (cas court)", () => {
  it("10. cas court : base de regression + entretoises 1:2, header hors region", () => {
    const html = pageSuccessionB(t, dSuccB);
    expect(html).toMatchSnapshot();
    expect(html).toContain(HAUTE);
    expect(html).toContain(BASSE);
    expect(html.indexOf("CLIENT_TEST")).toBeLessThan(html.indexOf(HAUTE));
    expect(html.indexOf("BENEF_TEST")).toBeGreaterThan(html.indexOf(HAUTE));
  });
});

describe("GOLDEN — pageBilanEndettement centrage (cas court)", () => {
  it("11. cas court : base de regression + entretoises 1:2, header hors region", () => {
    const html = pageBilanEndettement(t, dBilan);
    expect(html).toMatchSnapshot();
    expect(html).toContain(HAUTE);
    expect(html).toContain(BASSE);
    expect(html.indexOf("CLIENT_TEST")).toBeLessThan(html.indexOf(HAUTE));
    expect(html.indexOf("LECTURE_BILAN_TEST")).toBeGreaterThan(html.indexOf(HAUTE));
  });
});
