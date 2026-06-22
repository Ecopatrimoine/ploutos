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
