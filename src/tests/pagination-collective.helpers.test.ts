// Lot pagination collective — helpers PURS de primitives.ts :
//  - tientSurUneFeuille(counts) : décision de fusion CONSERVATRICE.
//  - regionCorpsCentree(corps, opts) : enveloppe centrée à hauteur bornée.
//
// Constantes FIGÉES (source : primitives.ts, table Lot 0) — l'arithmétique des
// cas-limite est calculée À LA MAIN depuis ces valeurs, sans rappeler la
// fonction, pour VERROUILLER les constantes (un drift de formule casse un literal).
//
//   HAUTEUR_FEUILLE=1122  PADDING_HAUT=32  RESERVE_BAS=120  -> BUDGET_FUSION=970
//   MARGE_SECURITE=120    -> seuil reel de fusion : hauteurEstimee <= 970-120 = 850
//   H_HEADER=80  H_BANDE_KPI=90  H_SOUSTITRE=26  H_SOUSTITRE_SERIF=30  H_LIGNE_TEXTE=20
//   CHARS_PAR_LIGNE_CONVENTION=60  H_TABLE_ENTETE=28  H_LIGNE_AUDIT=34
//   H_OBLIG_STATUT=18  H_OBLIG_SYNTHESE=28  H_LIGNE_OBLIG=46  H_NOTE_OBLIG=16  H_SEPARATEUR=16
//   RESERVE_PIED=30  PLAFOND_BLANC_HAUT=90
//
// Formule hauteurEstimee (mode actif) :
//   base   = 170                          (H_HEADER 80 + H_BANDE_KPI 90)
//   conv   = conv>0 ? 16+30+ceil(conv/60)*20 : 0
//   audit  = 16+26+28 + 34*nbControles                          (= 70 + 34*ctrl)
//   oblig  = 16+26+18 + (synth?28:0) + (nbOblig>0 ? 28+46*nbOblig : 0) + 16*nbNotes  (fixe 60)
//   total  = base + conv + audit + oblig
//   fusion <=> total <= 850

import { describe, it, expect } from "vitest";
import {
  tientSurUneFeuille,
  regionCorpsCentree,
  type CountsFeuilleCollective,
} from "../lib/pdf/v2/primitives";

// Fabrique un Counts actif par défaut (synthese off, 0 note) — surchargeable.
function counts(over: Partial<CountsFeuilleCollective> = {}): CountsFeuilleCollective {
  return {
    modeActif: true,
    nbControles: 0,
    conventionLongueur: 0,
    nbLignesObligations: 0,
    nbNotesObligations: 0,
    syntheseObligations: false,
    ...over,
  };
}

// ─── 1. Balayage cartésien : PROPRIÉTÉS (pas de verdict par cellule) ──────────

const CTRL_VALS = [0, 2, 4, 6, 8, 12, 18];
const OBLIG_VALS = [0, 3, 6, 10, 16, 24];
const CONV_VALS = [0, 120, 600]; // absent / court / long

describe("tientSurUneFeuille — propriétés sur le balayage cartésien", () => {
  it("mode inactif => toujours false (ce n'est pas une fusion)", () => {
    for (const nbControles of CTRL_VALS) {
      for (const nbLignesObligations of OBLIG_VALS) {
        for (const conventionLongueur of CONV_VALS) {
          expect(
            tientSurUneFeuille(counts({ modeActif: false, nbControles, nbLignesObligations, conventionLongueur }))
          ).toBe(false);
        }
      }
    }
  });

  it("MONOTONIE en nbControles : augmenter les contrôles ne fait jamais false->true", () => {
    for (const conventionLongueur of CONV_VALS) {
      for (const nbLignesObligations of OBLIG_VALS) {
        let dejaFalse = false;
        for (const nbControles of CTRL_VALS) {
          const r = tientSurUneFeuille(counts({ nbControles, nbLignesObligations, conventionLongueur }));
          if (dejaFalse) expect(r).toBe(false);
          if (r === false) dejaFalse = true;
        }
      }
    }
  });

  it("MONOTONIE en nbObligations : augmenter les obligations ne fait jamais false->true", () => {
    for (const conventionLongueur of CONV_VALS) {
      for (const nbControles of CTRL_VALS) {
        let dejaFalse = false;
        for (const nbLignesObligations of OBLIG_VALS) {
          const r = tientSurUneFeuille(counts({ nbControles, nbLignesObligations, conventionLongueur }));
          if (dejaFalse) expect(r).toBe(false);
          if (r === false) dejaFalse = true;
        }
      }
    }
  });

  it("MONOTONIE en conventionLongueur : rallonger la convention ne fait jamais false->true", () => {
    for (const nbControles of CTRL_VALS) {
      for (const nbLignesObligations of OBLIG_VALS) {
        let dejaFalse = false;
        for (const conventionLongueur of CONV_VALS) {
          const r = tientSurUneFeuille(counts({ nbControles, nbLignesObligations, conventionLongueur }));
          if (dejaFalse) expect(r).toBe(false);
          if (r === false) dejaFalse = true;
        }
      }
    }
  });

  it("ASYMÉTRIE SÛRE : le coin énorme ne fusionne JAMAIS (interdiction de clip)", () => {
    // 18 ctrl + 24 oblig + convention longue + synthese + notes, actif.
    expect(
      tientSurUneFeuille(
        counts({
          nbControles: 18,
          nbLignesObligations: 24,
          conventionLongueur: 600,
          syntheseObligations: true,
          nbNotesObligations: 2,
        })
      )
    ).toBe(false);
  });

  it("incertitude (NaN / négatif / undefined) => false", () => {
    expect(tientSurUneFeuille(counts({ nbControles: NaN }))).toBe(false);
    expect(tientSurUneFeuille(counts({ nbLignesObligations: -1 }))).toBe(false);
    expect(
      tientSurUneFeuille(counts({ conventionLongueur: undefined as unknown as number }))
    ).toBe(false);
  });
});

// ─── 2. Cas-limite VERROUILLÉS (verdict literal, arithmétique en commentaire) ──

describe("tientSurUneFeuille — cas-limite verrouillant les constantes", () => {
  // total = 170 + audit(70+34*0=70) + oblig(60) = 300 <= 850
  it("L2 dossier vide actif -> true (300)", () => {
    expect(tientSurUneFeuille(counts())).toBe(true);
  });

  // total = 170 + (70+34*2=138) + 60 = 368 <= 850
  it("L3 (2 ctrl, 0 oblig) -> true (368)", () => {
    expect(tientSurUneFeuille(counts({ nbControles: 2 }))).toBe(true);
  });

  // total = 170 + (70+34*8=342) + (60 + (28+46*5=258)) = 170+342+318 = 830 <= 850
  it("L4 (8 ctrl, 5 oblig) -> true (830, juste sous le seuil 850)", () => {
    expect(tientSurUneFeuille(counts({ nbControles: 8, nbLignesObligations: 5 }))).toBe(true);
  });

  // total = 170 + 342 + (60 + (28+46*6=304)) = 170+342+364 = 876 ; 850 < 876 <= 970
  it("L5 (8 ctrl, 6 oblig) -> false (876, dans [BUDGET-MARGE, BUDGET])", () => {
    expect(tientSurUneFeuille(counts({ nbControles: 8, nbLignesObligations: 6 }))).toBe(false);
  });

  // total = 170 + (70+34*6=274) + (60 + (28+46*6=304)) = 170+274+364 = 808 <= 850
  it("L7 (6 ctrl, 6 oblig, sans convention) -> true (808)", () => {
    expect(tientSurUneFeuille(counts({ nbControles: 6, nbLignesObligations: 6 }))).toBe(true);
  });

  // conv 600 -> 16+30+ceil(600/60)*20 = 16+30+200 = 246 ; total = 808 + 246 = 1054 > 850
  it("L8 (6 ctrl, 6 oblig, convention longue) -> false (1054 ; la convention fait basculer)", () => {
    expect(
      tientSurUneFeuille(counts({ nbControles: 6, nbLignesObligations: 6, conventionLongueur: 600 }))
    ).toBe(false);
  });

  // 830 + H_OBLIG_SYNTHESE(28) = 858 > 850
  it("L9 (8 ctrl, 5 oblig, synthese) -> false (858 ; la synthese fait basculer)", () => {
    expect(
      tientSurUneFeuille(counts({ nbControles: 8, nbLignesObligations: 5, syntheseObligations: true }))
    ).toBe(false);
  });

  // 830 + 16*2 notes = 862 > 850
  it("L10 (8 ctrl, 5 oblig, 2 notes) -> false (862 ; les notes font basculer)", () => {
    expect(
      tientSurUneFeuille(counts({ nbControles: 8, nbLignesObligations: 5, nbNotesObligations: 2 }))
    ).toBe(false);
  });

  // conv 120 -> 16+30+ceil(120/60)*20 = 16+30+40 = 86 ; total = 170+86+(70+34*4=206)+(60+(28+46*3=166)=226) = 688 <= 850
  it("L11 (4 ctrl, 3 oblig, convention courte) -> true (688)", () => {
    expect(
      tientSurUneFeuille(counts({ nbControles: 4, nbLignesObligations: 3, conventionLongueur: 120 }))
    ).toBe(true);
  });

  // coin énorme (doublon explicite de l'asymétrie, en literal) : total ~ 2350 >> 850
  it("L12 coin énorme -> false", () => {
    expect(
      tientSurUneFeuille(
        counts({ nbControles: 18, nbLignesObligations: 24, conventionLongueur: 600, syntheseObligations: true, nbNotesObligations: 2 })
      )
    ).toBe(false);
  });
});

// ─── 3. regionCorpsCentree — assertions structurelles ────────────────────────

describe("regionCorpsCentree — deux entretoises ratio 1:2 + hauteur bornée", () => {
  it("flex colonne, DEUX entretoises (ratio 1:2), sans justify-content ni cap pixel, corps intact", () => {
    const html = regionCorpsCentree("<p>CORPS_AUDIT</p>", { hauteurZoneHautPx: 300 });
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:column");
    // forme déterministe : pas de justify-content, plus de cap pixel
    expect(html).not.toContain("justify-content");
    expect(html).not.toContain("max-height");
    // 2 entretoises ratio (haute 2 parts, basse 3 parts) exactement
    const nbEntretoises = (html.match(/flex:\d 1 0/g) || []).length;
    expect(nbEntretoises).toBe(2);
    expect(html).toContain('<div style="flex:1 1 0"></div>'); // entretoise HAUTE (1 part)
    expect(html).toContain('<div style="flex:2 1 0"></div>'); // entretoise BASSE (2 parts)
    // hauteur = 1122 - 32 - 300 - RESERVE_PIED(30) = 760
    expect(html).toContain("height:760px");
    expect(html).toContain("<p>CORPS_AUDIT</p>");
  });

  it("reserveBasPx surchargé est pris en compte", () => {
    const html = regionCorpsCentree("X", { hauteurZoneHautPx: 200, reserveBasPx: 120 });
    // hauteur = 1122 - 32 - 200 - 120 = 770
    expect(html).toContain("height:770px");
    expect(html).toContain('<div style="flex:1 1 0"></div>'); // entretoise HAUTE
    expect(html).toContain('<div style="flex:2 1 0"></div>'); // entretoise BASSE
    expect(html).not.toContain("justify-content");
    expect(html).not.toContain("max-height");
    expect(html).toContain("X");
  });

  it("hauteur jamais négative (zone haute démesurée -> 0)", () => {
    const html = regionCorpsCentree("X", { hauteurZoneHautPx: 5000 });
    expect(html).toContain("height:0px");
  });
});
