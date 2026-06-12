// @vitest-environment jsdom
//
// LOT ANCIEN-UI — Test de rendu de l'alerte "anciennete non fiable".
//
// Couvre les 3 cas de la spec, sur le referentiel REEL (aucun mock) :
//   (a) date d'embauche absente + maintien a palier(s) a seuil > 0 -> alerte AFFICHEE
//   (b) date d'embauche saisie (meme < 12 mois) -> alerte ABSENTE (resultat correct)
//   (c) CCN dont le maintien n'a qu'un palier a 0 mois -> alerte ABSENTE
//
// Reperes de donnees utilises :
//   - idccCCN null  -> maintien LEGAL Mensualisation (paliers 12/72/... mois, tous > 0)
//   - idccCCN "1486" (Syntec) non-cadres -> paliers d'anciennete 12 et 60 mois
//   - idccCCN "2264" (Hospitalisation privee) -> palier UNIQUE a ancienneteMois 0
//
// Composant purement presentationnel (un <div>) : aucun polyfill jsdom requis.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlerteAncienneteNonFiable } from "../components/prevoyance/AlerteAncienneteNonFiable";

// Sous-chaine stable du message d'alerte (insensible a la casse).
const TEXTE_ALERTE = /maintien de salaire employeur/i;

describe("AlerteAncienneteNonFiable — rendu (LOT ANCIEN-UI)", () => {
  it("(a) AFFICHE l'alerte : date absente + maintien legal conditionne par l'anciennete (sans IDCC)", () => {
    render(
      <AlerteAncienneteNonFiable statutPro="salarie_non_cadre" idccCCN={null} dateEmbauche={null} />
    );
    expect(screen.getByText(TEXTE_ALERTE)).toBeInTheDocument();
  });

  it("(a bis) AFFICHE l'alerte : CCN a paliers d'anciennete (Syntec non-cadres, IDCC 1486)", () => {
    render(
      <AlerteAncienneteNonFiable statutPro="salarie_non_cadre" idccCCN="1486" dateEmbauche="" />
    );
    expect(screen.getByText(TEXTE_ALERTE)).toBeInTheDocument();
  });

  it("(b) n'affiche PAS l'alerte : date d'embauche saisie (meme < 12 mois d'anciennete)", () => {
    render(
      <AlerteAncienneteNonFiable statutPro="salarie_non_cadre" idccCCN={null} dateEmbauche="2026-01-01" />
    );
    expect(screen.queryByText(TEXTE_ALERTE)).toBeNull();
  });

  it("(c) n'affiche PAS l'alerte : maintien CCN a palier UNIQUE a 0 mois (IDCC 2264)", () => {
    render(
      <AlerteAncienneteNonFiable statutPro="salarie_non_cadre" idccCCN="2264" dateEmbauche={null} />
    );
    expect(screen.queryByText(TEXTE_ALERTE)).toBeNull();
  });

  it("(d) n'affiche PAS l'alerte pour un TNS (pas de maintien employeur)", () => {
    render(
      <AlerteAncienneteNonFiable statutPro="tns_liberal" idccCCN={null} dateEmbauche={null} />
    );
    expect(screen.queryByText(TEXTE_ALERTE)).toBeNull();
  });
});
