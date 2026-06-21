// @vitest-environment jsdom
//
// MVP sélecteur critère R.242-1-1 — BlocEntreprise.
//  - sélecteur fermé : exactement les 5 critères licites (décret 2021-1002) ;
//  - sélection -> critereR242 (logique pure patchCritereR242) ;
//  - pré-remplissage DOUX du texte libre (vide -> rempli ; saisi -> jamais écrasé) ;
//  - aide statique (critères interdits + base légale) présente ;
//  - non-régression : le champ complément reste éditable et patche le bon champ.

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BlocEntreprise,
  emptyEntrepriseAudit,
  patchCritereR242,
  LIBELLE_CRITERE_R242,
} from "../components/prevoyance/BlocEntreprise";
import type { EntrepriseAudit } from "../types/patrimoine";

// Polyfills MINIMAUX et LOCAUX pour Radix Select sous jsdom (cf. RentesSurvivants.render).
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

function ouvrirSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
}

function audit(over: Partial<EntrepriseAudit> = {}): EntrepriseAudit {
  return { ...emptyEntrepriseAudit(), ...over };
}

describe("BlocEntreprise — selecteur critere R.242-1-1 (MVP)", () => {
  it("le Select propose EXACTEMENT les 5 criteres licites", async () => {
    render(<BlocEntreprise value={audit()} onChange={() => {}} />);
    ouvrirSelect(screen.getByRole("combobox")); // unique select du bloc
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(5);
    const labels = options.map((o) => o.textContent ?? "");
    expect(labels.some((l) => /Cadres \/ non-cadres/i.test(l))).toBe(true);
    expect(labels.some((l) => /Seuil de rémunération/i.test(l))).toBe(true);
    expect(labels.some((l) => /Classifications professionnelles/i.test(l))).toBe(true);
    expect(labels.some((l) => /Sous-catégories/i.test(l))).toBe(true);
    expect(labels.some((l) => /Régime obligatoire/i.test(l))).toBe(true);
  });

  // La logique exécutée à la sélection (onValueChange -> patch(patchCritereR242…)).
  it("selectionner un critere pose critereR242", () => {
    const p = patchCritereR242(audit({ categoriesObjectivesDeclarees: "deja saisi" }), "classifications");
    expect(p.critereR242).toBe("classifications");
  });

  it("pre-remplissage doux : texte VIDE -> rempli avec le libelle du critere", () => {
    const p = patchCritereR242(audit({ categoriesObjectivesDeclarees: "" }), "cadres_non_cadres");
    expect(p.critereR242).toBe("cadres_non_cadres");
    expect(p.categoriesObjectivesDeclarees).toBe(LIBELLE_CRITERE_R242.cadres_non_cadres);
  });

  it("pre-remplissage doux : texte DEJA saisi -> JAMAIS ecrase", () => {
    const p = patchCritereR242(audit({ categoriesObjectivesDeclarees: "Mon libelle perso" }), "seuil_pass");
    expect(p.critereR242).toBe("seuil_pass");
    // Le texte libre n'est pas touché : la clé n'est même pas dans le patch.
    expect("categoriesObjectivesDeclarees" in p).toBe(false);
  });

  it("texte = espaces seuls -> considere vide -> pre-rempli", () => {
    const p = patchCritereR242(audit({ categoriesObjectivesDeclarees: "   " }), "sous_categories");
    expect(p.categoriesObjectivesDeclarees).toBe(LIBELLE_CRITERE_R242.sous_categories);
  });

  it("aide des criteres interdits + mention base legale presentes", () => {
    render(<BlocEntreprise value={audit()} onChange={() => {}} />);
    expect(screen.getByText(/Non autorisés comme critère de catégorie/i)).toBeInTheDocument();
    expect(screen.getByText(/temps de travail/i)).toBeInTheDocument();
    expect(screen.getByText(/R\.242-1-1 CSS/i)).toBeInTheDocument();
    expect(screen.getByText(/2021-1002/i)).toBeInTheDocument();
  });

  it("non-regression : le champ complement reste editable et patche categoriesObjectivesDeclarees", () => {
    const onChange = vi.fn();
    render(<BlocEntreprise value={audit()} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Cadres au sens art\. 4/i);
    fireEvent.change(input, { target: { value: "Cadres art. 4 conv. coll." } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as EntrepriseAudit;
    expect(next.categoriesObjectivesDeclarees).toBe("Cadres art. 4 conv. coll.");
  });
});
