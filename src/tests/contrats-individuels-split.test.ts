// ─── Tests util pur contrats-individuels-split (Lot A1) ──────────────────────
//
// Plomberie de données : partition/recomposition du tableau contratsIndividuels.
// Aucun calcul métier, aucune UI. On vérifie ici la pureté, l'absence de
// perte/doublon, et la règle d'ordre FIXE (incapacite -> survivants -> legacy).

import { describe, it, expect } from "vitest";
import {
  categorieDeType,
  splitContratsIndividuels,
  mergeContratsIndividuels,
  type CategorieContratIndividuel,
} from "../lib/prevoyance/contrats-individuels-split";
import type { PayloadContratIndividuel } from "../types/patrimoine";

// Fabrique un contrat minimal d'un `type` donné. Cast volontaire : on doit
// pouvoir représenter des valeurs LEGACY/inconnues hors union créable (ex.
// "deces_capital"), telles que chargées du stockage.
function c(id: string, type: string): PayloadContratIndividuel {
  return { id, type, capitalOuMontant: 0 } as unknown as PayloadContratIndividuel;
}

describe("categorieDeType", () => {
  it("classe chaque type connu dans la bonne catégorie", () => {
    expect(categorieDeType("ij")).toBe("incapacite");
    expect(categorieDeType("invalidite")).toBe("incapacite");
    expect(categorieDeType("deces_rente_conj")).toBe("survivants");
    expect(categorieDeType("deces_rente_educ")).toBe("survivants");
    expect(categorieDeType("ptia")).toBe("legacy");
    expect(categorieDeType("dependance")).toBe("legacy");
    expect(categorieDeType("gav")).toBe("legacy");
    expect(categorieDeType("deces_capital")).toBe("legacy");
  });

  it("classe un type inconnu (ou vide) en legacy", () => {
    expect(categorieDeType("type_inexistant_xyz")).toBe("legacy");
    expect(categorieDeType("")).toBe("legacy");
  });
});

describe("splitContratsIndividuels", () => {
  it("répartit un mélange des 7 types + un deces_capital, ordre préservé par catégorie", () => {
    const contrats = [
      c("1", "gav"),
      c("2", "ij"),
      c("3", "deces_rente_educ"),
      c("4", "invalidite"),
      c("5", "deces_capital"),
      c("6", "deces_rente_conj"),
      c("7", "ptia"),
      c("8", "dependance"),
      c("9", "ij"),
    ];
    const r = splitContratsIndividuels(contrats);
    expect(r.incapacite.map((x) => x.id)).toEqual(["2", "4", "9"]);
    expect(r.survivants.map((x) => x.id)).toEqual(["3", "6"]);
    expect(r.legacy.map((x) => x.id)).toEqual(["1", "5", "7", "8"]);
  });

  it("catégorie absente -> []", () => {
    const r = splitContratsIndividuels([c("1", "ij"), c("2", "invalidite")]);
    expect(r.incapacite.map((x) => x.id)).toEqual(["1", "2"]);
    expect(r.survivants).toEqual([]);
    expect(r.legacy).toEqual([]);
  });

  it("tableau vide -> 3 catégories vides", () => {
    expect(splitContratsIndividuels([])).toEqual({ incapacite: [], survivants: [], legacy: [] });
  });
});

describe("mergeContratsIndividuels — round-trip sur tableau DÉJÀ TRIÉ", () => {
  // x déjà dans l'ordre fixe : incapacite -> survivants -> legacy
  const x: PayloadContratIndividuel[] = [
    c("i1", "ij"),
    c("i2", "invalidite"),
    c("s1", "deces_rente_conj"),
    c("s2", "deces_rente_educ"),
    c("l1", "ptia"),
    c("l2", "deces_capital"),
  ];
  const cats: CategorieContratIndividuel[] = ["incapacite", "survivants", "legacy"];
  for (const cat of cats) {
    it(`merge(x, "${cat}", split(x)["${cat}"]) === x (deep equal, ordre compris)`, () => {
      const out = mergeContratsIndividuels(x, cat, splitContratsIndividuels(x)[cat]);
      expect(out).toEqual(x);
    });
  }
});

describe("mergeContratsIndividuels — normalisation d'un tableau ENTREMÊLÉ", () => {
  it("réordonne selon l'ordre fixe en conservant le même multiset d'éléments", () => {
    const x = [
      c("l1", "gav"),
      c("i1", "ij"),
      c("s1", "deces_rente_conj"),
      c("i2", "invalidite"),
      c("l2", "deces_capital"),
      c("s2", "deces_rente_educ"),
    ];
    // merge sans rien modifier dans la catégorie éditée : on réinjecte split(x).incapacite
    const out = mergeContratsIndividuels(x, "incapacite", splitContratsIndividuels(x).incapacite);
    // ordre fixe attendu : incapacite (i1,i2) -> survivants (s1,s2) -> legacy (l1,l2)
    expect(out.map((o) => o.id)).toEqual(["i1", "i2", "s1", "s2", "l1", "l2"]);
    // même multiset (mêmes éléments, indépendamment de l'ordre)
    const tri = (arr: PayloadContratIndividuel[]) =>
      [...arr].sort((a, b) => a.id.localeCompare(b.id)).map((o) => o.id);
    expect(tri(out)).toEqual(tri(x));
    // un 2e merge est stable (déjà normalisé)
    const out2 = mergeContratsIndividuels(out, "incapacite", splitContratsIndividuels(out).incapacite);
    expect(out2).toEqual(out);
  });
});

describe("mergeContratsIndividuels — isolation des catégories non touchées", () => {
  it("éditer survivants (ajout ET suppression) laisse incapacite et legacy STRICTEMENT inchangés", () => {
    const i1 = c("i1", "ij");
    const i2 = c("i2", "invalidite");
    const s1 = c("s1", "deces_rente_conj");
    const s2 = c("s2", "deces_rente_educ");
    const l1 = c("l1", "ptia");
    const x = [i1, s1, i2, l1, s2]; // entremêlé
    const s3 = c("s3", "deces_rente_conj"); // ajout
    // nouveau sous-ensemble survivants : suppression de s1, conservation de s2, ajout de s3
    const out = mergeContratsIndividuels(x, "survivants", [s2, s3]);
    // ordre fixe : incapacite (i1,i2) -> survivants (s2,s3) -> legacy (l1)
    expect(out.map((o) => o.id)).toEqual(["i1", "i2", "s2", "s3", "l1"]);
    // incapacite et legacy : MÊMES objets (référence) et même ordre
    expect(out[0]).toBe(i1);
    expect(out[1]).toBe(i2);
    expect(out[4]).toBe(l1);
    // s1 supprimé, s3 ajouté (même référence)
    expect(out.some((o) => o.id === "s1")).toBe(false);
    expect(out.find((o) => o.id === "s3")).toBe(s3);
  });

  it("sous-ensemble vide : la catégorie est vidée, les autres intactes", () => {
    const i1 = c("i1", "ij");
    const s1 = c("s1", "deces_rente_conj");
    const l1 = c("l1", "gav");
    const out = mergeContratsIndividuels([i1, s1, l1], "survivants", []);
    expect(out.map((o) => o.id)).toEqual(["i1", "l1"]);
    expect(out[0]).toBe(i1);
    expect(out[1]).toBe(l1);
  });
});

describe("mergeContratsIndividuels — cas limites", () => {
  it("tableau vide + ajout dans une catégorie", () => {
    const n1 = c("n1", "ij");
    expect(mergeContratsIndividuels([], "incapacite", [n1])).toEqual([n1]);
  });

  it("une seule catégorie présente : merge d'une AUTRE catégorie respecte l'ordre fixe", () => {
    const l1 = c("l1", "ptia");
    const i1 = c("i1", "ij");
    const out = mergeContratsIndividuels([l1], "incapacite", [i1]);
    // ordre fixe : incapacite (i1) -> legacy (l1)
    expect(out.map((o) => o.id)).toEqual(["i1", "l1"]);
    expect(out[1]).toBe(l1);
  });

  it("ne mute pas les tableaux d'entrée", () => {
    const x = [c("i1", "ij"), c("s1", "deces_rente_conj")];
    const xCopieIds = x.map((o) => o.id);
    const sousEnsemble = [c("s2", "deces_rente_educ")];
    const sousEnsembleIds = sousEnsemble.map((o) => o.id);
    mergeContratsIndividuels(x, "survivants", sousEnsemble);
    expect(x.map((o) => o.id)).toEqual(xCopieIds);
    expect(sousEnsemble.map((o) => o.id)).toEqual(sousEnsembleIds);
  });
});
