// @vitest-environment jsdom
//
// Lot B — Test de montage RTL de BlocForfait (anti-regression "ecran blanc Radix").
//
// Contexte du bug d'origine : Radix interdit <Select.Item value="">. Les caisses
// "classe SANS grille" (CAVOM, CARPV : discriminant.type === "classe" mais pas de
// grilleRevenuClasse, donc hasGrille === false) etaient le cas qui crashait, car la
// valeur du Select / d'un item pouvait retomber sur "". On verifie ici que :
//   1. BlocForfait se MONTE sans throw pour ces caisses a risque (CAVOM, CARPV) ;
//   2. le cas de controle AVEC grille (CAVEC) marche aussi (item "auto" rendu) ;
//   3. a l'ouverture du Select CAVOM, aucun item a valeur vide ne fait throw Radix.
//
// On NE touche pas BlocForfait : test pur de montage.

import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocForfait } from "../components/prevoyance/BlocForfait";
import { referentiels } from "../data/prevoyance";
import type { ForfaitConfig } from "../types/patrimoine";

// Radix Select s'appuie sur des APIs DOM que jsdom n'implemente pas. SANS ces
// polyfills, l'OUVERTURE du select throw pour une raison purement TECHNIQUE (jsdom),
// ce qui masquerait le vrai sujet (l'invariant metier "pas de SelectItem value vide").
// Polyfills MINIMAUX et LOCAUX a ce fichier (jamais dans setup.ts global, pour ne pas
// alterer l'environnement node des 923 tests moteur).
beforeAll(() => {
  const noop = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = noop;
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = noop;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = noop;
  if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ForfaitConfig minimal VALIDE : seul tauxInvalidite est obligatoire (cf. type).
// classeOption:"" reproduit le cas placeholder a risque (aucune classe choisie).
function forfait(over: Partial<ForfaitConfig> = {}): ForfaitConfig {
  return { tauxInvalidite: 100, classeOption: "", ...over };
}

// caisseRef reel, lu du referentiel (meme pattern que prevoyance.forfait.ui.test.ts).
function caisse(code: string): unknown {
  return (referentiels.caisses as { caisses: Record<string, unknown> }).caisses[code];
}

// Ouvre un Select Radix au clavier (plus robuste que le pointer en jsdom : evite la
// capture de pointeur). Radix ouvre le contenu sur ArrowDown depuis le trigger.
function ouvrirSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
}

describe("BlocForfait — montage RTL (anti-regression ecran blanc Radix)", () => {
  it("monte sans crash pour CAVOM (classe SANS grille)", () => {
    render(
      <BlocForfait value={forfait()} onChange={() => {}} caisseRef={caisse("CAVOM")} />
    );
    // Preuve de montage : l'en-tete "Parametres ..." est rendu et le Select de classe
    // (role combobox) est present. L'essentiel : aucun throw au render.
    expect(screen.getByText(/Paramètres/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("monte sans crash pour CARPV (classe SANS grille)", () => {
    render(
      <BlocForfait value={forfait()} onChange={() => {}} caisseRef={caisse("CARPV")} />
    );
    expect(screen.getByText(/Paramètres/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("monte sans crash pour CAVEC (classe AVEC grille) et rend l'option deduite", async () => {
    render(
      <BlocForfait
        value={forfait()}
        onChange={() => {}}
        caisseRef={caisse("CAVEC")}
        revenuTNSAnnuel={60000}
      />
    );
    expect(screen.getByText(/Paramètres/)).toBeInTheDocument();
    // Cas de controle inverse : avec grille, l'item "Classe deduite" (hasGrille) doit
    // exister une fois le select ouvert. On scope au role="option" : le mot "deduite"
    // figure aussi dans le label du Field, donc on cible specifiquement les options.
    ouvrirSelect(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    expect(options.some((o) => /déduite/i.test(o.textContent ?? ""))).toBe(true);
  });

  it("ne rend aucun SelectItem a value vide pour CAVOM (cause exacte du crash Radix)", async () => {
    // Radix ne projette PAS la prop `value` des items dans le DOM, et le contenu du
    // Select est demonte tant qu'il n'est pas ouvert. L'assertion robuste equivalente :
    // OUVRIR le select. Si un <SelectItem value=""> existait, Radix leverait son
    // invariant ("must have a value prop that is not an empty string") AU RENDU du
    // contenu -> l'ouverture throw et le test echoue. Atteindre les options prouve
    // donc l'absence de valeur vide. On verifie en plus qu'aucune option n'est vide.
    render(
      <BlocForfait value={forfait()} onChange={() => {}} caisseRef={caisse("CAVOM")} />
    );
    ouvrirSelect(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect((opt.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});
