// @vitest-environment jsdom
//
// Lot A2 — BlocContratsIndividuels devient « Incapacité et invalidité » :
//  - création restreinte à ij + invalidite ;
//  - garanties legacy (ptia/dependance/gav/deces_capital) lisibles, éditables et
//    supprimables (type affiché en item désactivé) ;
//  - AUCUNE autre catégorie de contratsIndividuels n'est perdue à l'édition
//    (merge util A1 : survivants deces_rente_* + legacy préservés).

import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlocContratsIndividuels } from "../components/prevoyance/BlocContratsIndividuels";
import { getContratsTransmissionDecesAvecLegacy } from "../lib/prevoyance/utils";
import type { PayloadContratIndividuel, PayloadPrevoyancePerso } from "../types/patrimoine";

// Polyfills MINIMAUX et LOCAUX pour Radix Select sous jsdom (cf. BlocForfait.render).
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

// Fabrique un contrat ; cast pour autoriser les types LEGACY hors union créable.
function contrat(id: string, type: string, capitalOuMontant = 0, over: Record<string, unknown> = {}): PayloadContratIndividuel {
  return { id, type, capitalOuMontant, ...over } as unknown as PayloadContratIndividuel;
}

describe("BlocContratsIndividuels — Lot A2 « Incapacité et invalidité »", () => {
  it("(a) la création ne propose que ij + invalidité", async () => {
    render(<BlocContratsIndividuels contrats={[contrat("c1", "ij")]} onChange={() => {}} />);
    // La ligne ij a 2 selects (Type puis Nature) → le Type est le premier dans le DOM.
    const combos = screen.getAllByRole("combobox");
    ouvrirSelect(combos[0]);
    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent ?? "");
    expect(labels.some((l) => /IJ complémentaires/i.test(l))).toBe(true);
    expect(labels.some((l) => /Rente invalidité/i.test(l))).toBe(true);
    // exactement 2 options créables
    expect(options).toHaveLength(2);
    // aucun type retiré n'est proposé à la création
    expect(labels.some((l) => /Capital décès/i.test(l))).toBe(false);
    expect(labels.some((l) => /Rente conjoint/i.test(l))).toBe(false);
    expect(labels.some((l) => /Rente éducation/i.test(l))).toBe(false);
    expect(labels.some((l) => /PTIA/i.test(l))).toBe(false);
    expect(labels.some((l) => /Dépendance/i.test(l))).toBe(false);
    expect(labels.some((l) => /accidents de la vie/i.test(l))).toBe(false);
  });

  it("(b) une ligne legacy (ptia) est lisible (item désactivé) et supprimable", async () => {
    render(<BlocContratsIndividuels contrats={[contrat("old", "ptia", 50000)]} onChange={() => {}} />);
    // Montant lisible.
    expect(screen.getByDisplayValue("50000")).toBeInTheDocument();
    // Type legacy affiché en item DÉSACTIVÉ (non re-sélectionnable). ptia → 1 seul
    // select (pas de bloc Nature pour un type hors ij/invalidite).
    ouvrirSelect(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    const legacyOption = options.find((o) => /PTIA/i.test(o.textContent ?? ""));
    expect(legacyOption).toBeTruthy();
    expect(legacyOption?.getAttribute("aria-disabled")).toBe("true");
    // Poubelle présente → la ligne reste supprimable.
    expect(screen.getByTitle("Supprimer ce contrat")).toBeInTheDocument();
  });

  it("(c) ANTI-PERTE : ajouter un contrat ne perd ni survivants ni legacy", () => {
    const onChange = vi.fn();
    const initial = [
      contrat("a", "ij", 100),
      contrat("b", "deces_rente_conj", 500),
      contrat("z", "gav", 20000),
    ];
    render(<BlocContratsIndividuels contrats={initial} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un contrat/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    // survivants + legacy préservés
    expect(next.find((x) => x.id === "b")?.type).toBe("deces_rente_conj");
    expect(next.find((x) => x.id === "z")?.type).toBe("gav");
    // ij initial conservé + 1 nouveau contrat (ij par défaut)
    expect(next.find((x) => x.id === "a")?.type).toBe("ij");
    expect(next).toHaveLength(initial.length + 1);
    // ordre fixe : incapacite → survivants → legacy
    expect(next.map((x) => x.type)).toEqual(["ij", "ij", "deces_rente_conj", "gav"]);
  });

  it("(d) SUPPRESSION legacy : supprimer gav laisse [ij, deces_rente_conj]", () => {
    const onChange = vi.fn();
    const initial = [
      contrat("a", "ij", 100),
      contrat("b", "deces_rente_conj", 500),
      contrat("z", "gav", 20000),
    ];
    render(<BlocContratsIndividuels contrats={initial} onChange={onChange} />);
    // VUE rendue = [ij (a), gav (z)] (le survivant b n'est pas rendu) → 2 poubelles.
    const poubelles = screen.getAllByTitle("Supprimer ce contrat");
    expect(poubelles).toHaveLength(2);
    // 2e poubelle = ligne gav (legacy affiché après l'incapacité).
    fireEvent.click(poubelles[1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
    expect(next.find((x) => x.id === "z")).toBeUndefined();
    expect(next.find((x) => x.id === "b")?.type).toBe("deces_rente_conj");
  });

  it("(e) non-régression pont legacy : un deces_capital reste mappé en transmission", () => {
    const perso = {
      contratsIndividuels: [contrat("old", "deces_capital", 50000)],
      couvertureCollective: null,
      categorieInvaliditeProjetee: "cat2",
    } as unknown as PayloadPrevoyancePerso;
    const ponts = getContratsTransmissionDecesAvecLegacy(perso);
    expect(ponts).toHaveLength(1);
    expect(ponts[0].capitalTransmis).toBe(50000);
  });
});

// ─── Lot B3 — cadre Madelin (saisie déductible) ──────────────────────────────

const tnsData = () => ({ travail: { p1: { statutPro: "tns_artisan" }, p2: null } }) as any;
const nonTnsData = () => ({ travail: { p1: { statutPro: "salarie_cadre" }, p2: null } }) as any;

describe("BlocContratsIndividuels — Lot B3 cadre Madelin", () => {
  it("personne TNS : ligne ij affiche le cadre Madelin, ligne legacy (gav) non", () => {
    render(
      <BlocContratsIndividuels
        contrats={[contrat("a", "ij"), contrat("z", "gav")]}
        onChange={() => {}}
        data={tnsData()}
        which={1}
      />
    );
    expect(screen.getAllByText(/Cotisation déductible de l'IR/i)).toHaveLength(1);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("personne NON-TNS : aucune ligne n'affiche le cadre Madelin", () => {
    render(
      <BlocContratsIndividuels
        contrats={[contrat("a", "ij"), contrat("b", "invalidite")]}
        onChange={() => {}}
        data={nonTnsData()}
        which={1}
      />
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/Cotisation déductible de l'IR/i)).toBeNull();
  });

  it("ANTI-PERTE : cocher déductible sur une ligne ij préserve survivants + legacy", () => {
    const onChange = vi.fn();
    const initial = [contrat("a", "ij", 100), contrat("b", "deces_rente_conj", 500), contrat("z", "gav", 20000)];
    render(<BlocContratsIndividuels contrats={initial} onChange={onChange} data={tnsData()} which={1} />);
    fireEvent.click(screen.getByRole("checkbox")); // cadre Madelin de la ligne ij
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    expect(next.find((x) => x.id === "a")).toMatchObject({ type: "ij", deductibleMadelin: true });
    expect(next.find((x) => x.id === "b")?.type).toBe("deces_rente_conj");
    expect(next.find((x) => x.id === "z")?.type).toBe("gav");
  });

  it("ANTI-PERTE : saisir la cotisation (ij déjà coché) préserve survivants + legacy", () => {
    const onChange = vi.fn();
    const initial = [
      contrat("a", "ij", 100, { deductibleMadelin: true }),
      contrat("b", "deces_rente_conj", 500),
      contrat("z", "gav", 20000),
    ];
    render(<BlocContratsIndividuels contrats={initial} onChange={onChange} data={tnsData()} which={1} />);
    fireEvent.change(screen.getByPlaceholderText("ex. 1200"), { target: { value: "1500" } });
    const next = onChange.mock.calls[0][0] as PayloadContratIndividuel[];
    expect(next.find((x) => x.id === "a")).toMatchObject({ deductibleMadelin: true, cotisationMadelinAnnuelle: 1500 });
    expect(next.find((x) => x.id === "b")?.type).toBe("deces_rente_conj");
    expect(next.find((x) => x.id === "z")?.type).toBe("gav");
  });

  it("AVERTISSEMENT : non-TNS avec cotisation Madelin dormante -> encart, cadre absent, donnée intacte", () => {
    const onChange = vi.fn();
    render(
      <BlocContratsIndividuels
        contrats={[contrat("a", "ij", 0, { deductibleMadelin: true, cotisationMadelinAnnuelle: 1000 })]}
        onChange={onChange}
        data={nonTnsData()}
        which={1}
      />
    );
    expect(screen.getByText(/statut n'est pas TNS/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();   // cadre masqué
    expect(onChange).not.toHaveBeenCalled();              // aucune donnée effacée
  });

  it("pas d'avertissement : non-TNS sans cotisation Madelin", () => {
    render(<BlocContratsIndividuels contrats={[contrat("a", "ij")]} onChange={() => {}} data={nonTnsData()} which={1} />);
    expect(screen.queryByText(/statut n'est pas TNS/i)).toBeNull();
  });

  it("pas d'avertissement : personne TNS (cadre normal)", () => {
    render(<BlocContratsIndividuels contrats={[contrat("a", "ij", 0, { deductibleMadelin: true })]} onChange={() => {}} data={tnsData()} which={1} />);
    expect(screen.queryByText(/statut n'est pas TNS/i)).toBeNull();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
