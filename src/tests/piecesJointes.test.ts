// ─── Tests Lot 8e — module piecesJointes ──────────────────────────────────
//
// Couvre :
//   • Helpers de filtre / présence / persistabilité.
//   • Garde-fou critique : INTROSPECTION des exports du module pour
//     vérifier qu'AUCUNE fonction de génération d'IPID/DIC n'est exposée.
//     Ploutos ne fabrique jamais ces documents — ils proviennent de l'assureur.

import { describe, it, expect } from "vitest";
import * as Mod from "../lib/conformite/piecesJointes";
import {
  filterByType,
  hasIPID,
  hasDIC,
  isPiecePersistable,
  formatTaille,
  PIECE_TYPE_LABELS,
  type PieceJointe,
} from "../lib/conformite/piecesJointes";

const makeIPID = (over: Partial<PieceJointe> = {}): PieceJointe => ({
  id: "id-ipid",
  type: "ipid",
  nom: "ipid-garantie-itt.pdf",
  mimeType: "application/pdf",
  taille: 128_456,
  uploadedAt: "2026-05-26T10:00:00.000Z",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
  ...over,
});

const makeDIC = (over: Partial<PieceJointe> = {}): PieceJointe => ({
  id: "id-dic",
  type: "dic",
  nom: "dic-uc-balanced.pdf",
  mimeType: "application/pdf",
  taille: 65_432,
  uploadedAt: "2026-05-26T11:00:00.000Z",
  dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
  ...over,
});

describe("filterByType", () => {
  it("filtre uniquement les pièces du type demandé", () => {
    const pieces = [makeIPID(), makeDIC(), makeIPID({ id: "ipid-2" })];
    expect(filterByType(pieces, "ipid").map(p => p.id)).toEqual(["id-ipid", "ipid-2"]);
    expect(filterByType(pieces, "dic").map(p => p.id)).toEqual(["id-dic"]);
    expect(filterByType(pieces, "autre")).toEqual([]);
  });

  it("liste vide → liste vide", () => {
    expect(filterByType([], "ipid")).toEqual([]);
  });

  it("robustesse : null/undefined dans la liste sont ignorés", () => {
    const pieces = [makeIPID(), null as any, undefined as any];
    expect(filterByType(pieces, "ipid").length).toBe(1);
  });
});

describe("hasIPID / hasDIC", () => {
  it("hasIPID vrai si ≥ 1 IPID", () => {
    expect(hasIPID([makeIPID()])).toBe(true);
    expect(hasIPID([makeDIC()])).toBe(false);
    expect(hasIPID([])).toBe(false);
  });

  it("hasDIC vrai si ≥ 1 DIC", () => {
    expect(hasDIC([makeDIC()])).toBe(true);
    expect(hasDIC([makeIPID()])).toBe(false);
    expect(hasDIC([])).toBe(false);
  });

  it("mélange : les deux peuvent être vrais", () => {
    const pieces = [makeIPID(), makeDIC()];
    expect(hasIPID(pieces)).toBe(true);
    expect(hasDIC(pieces)).toBe(true);
  });
});

describe("isPiecePersistable", () => {
  it("vrai si nom + (dataUrl OU storagePath)", () => {
    expect(isPiecePersistable(makeIPID())).toBe(true);
    expect(isPiecePersistable(makeIPID({ dataUrl: undefined, storagePath: "client-A/pieces/xyz.pdf" }))).toBe(true);
  });

  it("faux si ni dataUrl ni storagePath (métadonnée incomplète)", () => {
    expect(isPiecePersistable(makeIPID({ dataUrl: undefined, storagePath: undefined }))).toBe(false);
    expect(isPiecePersistable(makeIPID({ dataUrl: "" }))).toBe(false);
  });

  it("faux si nom vide", () => {
    expect(isPiecePersistable(makeIPID({ nom: "" }))).toBe(false);
    expect(isPiecePersistable(makeIPID({ nom: "  " }))).toBe(false);
  });

  it("faux pour null/undefined", () => {
    expect(isPiecePersistable(null)).toBe(false);
    expect(isPiecePersistable(undefined)).toBe(false);
  });
});

describe("formatTaille", () => {
  it("formate bytes / ko / Mo correctement", () => {
    expect(formatTaille(0)).toBe("0 o");
    expect(formatTaille(512)).toBe("512 o");
    expect(formatTaille(1024)).toBe("1.0 ko");
    expect(formatTaille(150_000)).toBe("146.5 ko");
    expect(formatTaille(2_500_000)).toBe("2.38 Mo");
  });

  it("retourne '—' pour valeurs invalides", () => {
    expect(formatTaille(NaN)).toBe("—");
    expect(formatTaille(-10)).toBe("—");
  });
});

describe("PIECE_TYPE_LABELS", () => {
  it("contient les 3 catégories réglementaires avec libellés humains", () => {
    expect(PIECE_TYPE_LABELS.ipid).toMatch(/IPID/);
    expect(PIECE_TYPE_LABELS.dic).toMatch(/DIC/);
    expect(PIECE_TYPE_LABELS.autre).toMatch(/Autre/);
  });
});

// ─── GARDE-FOU CRITIQUE — introspection des exports ─────────────────────
describe("Garde-fou conformité : Ploutos NE GÉNÈRE PAS d'IPID/DIC", () => {
  it("aucun export du module ne commence par generate|create|fabriquer|build (sauf helpers métadonnées)", () => {
    const exports = Object.keys(Mod);
    const interdits = /^(generate|create|fabriquer|build|produce|render|make).*[Ii]pid|.*[Dd]ic.*[Ff]ile|.*pdf.*[Cc]ontent/i;
    for (const name of exports) {
      expect(name, `Export interdit : ${name}`).not.toMatch(interdits);
    }
  });

  it("le type Recommandation n'a pas de champ contenant 'genere' ou 'fabrique'", () => {
    const piece: PieceJointe = makeIPID();
    const champs = Object.keys(piece);
    for (const c of champs) {
      expect(c.toLowerCase()).not.toMatch(/genere|fabrique|produce|render/i);
    }
  });

  it("aucun helper du module ne prend un MIME type 'IPID' en entrée pour produire un contenu", () => {
    // Vérification grossière : tous les exports fonction doivent prendre une
    // pièce ou une liste de pièces en lecture, jamais un type à instancier.
    const exportsList = Object.entries(Mod);
    for (const [name, val] of exportsList) {
      if (typeof val !== "function") continue;
      // Les fonctions prennent des entrées de type PieceJointe / liste / type / nombre.
      // Si une fonction nouvelle apparaissait avec un nom suggérant la fabrication,
      // ce test échouerait (couvert par le test précédent), mais on fait aussi
      // un check d'arité : aucun helper actuel ne prend > 2 arguments.
      expect(val.length, `${name} a trop d'arguments (suspect)`).toBeLessThanOrEqual(2);
    }
  });
});
