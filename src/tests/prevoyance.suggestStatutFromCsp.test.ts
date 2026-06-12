// LOT UX-COLLECTE sub-lot 2 — table de suggestion statutPro depuis la CSP.
//
// Fonction PURE (aucun rendu) : on couvre la table complete + les cas "" (pas
// de suggestion) + la priorite des regles (csp specifique > groupe).

import { describe, it, expect } from "vitest";
import { suggestStatutFromCsp } from "../lib/prevoyance/utils";

describe("suggestStatutFromCsp — table de suggestion", () => {
  it("groupe 7 (retraites) -> retraite (quel que soit le csp)", () => {
    expect(suggestStatutFromCsp("7", "")).toBe("retraite");
    expect(suggestStatutFromCsp("7", "74")).toBe("retraite");
  });

  it("groupe 8 (sans activite) -> sans_activite", () => {
    expect(suggestStatutFromCsp("8", "")).toBe("sans_activite");
    expect(suggestStatutFromCsp("8", "85")).toBe("sans_activite");
  });

  it("csp fonctionnaire (33/45/52/53) -> fonctionnaire", () => {
    expect(suggestStatutFromCsp("3", "33")).toBe("fonctionnaire");
    expect(suggestStatutFromCsp("4", "45")).toBe("fonctionnaire");
    expect(suggestStatutFromCsp("5", "52")).toBe("fonctionnaire");
    expect(suggestStatutFromCsp("5", "53")).toBe("fonctionnaire");
  });

  it("csp 31 (profession liberale) -> tns_liberal", () => {
    expect(suggestStatutFromCsp("3", "31")).toBe("tns_liberal");
  });

  it("csp 21 -> tns_artisan ; csp 22 -> tns_commercant", () => {
    expect(suggestStatutFromCsp("2", "21")).toBe("tns_artisan");
    expect(suggestStatutFromCsp("2", "22")).toBe("tns_commercant");
  });

  it("groupe 3 hors cas specifiques -> salarie_cadre", () => {
    expect(suggestStatutFromCsp("3", "37")).toBe("salarie_cadre");
    expect(suggestStatutFromCsp("3", "38")).toBe("salarie_cadre");
    expect(suggestStatutFromCsp("3", "")).toBe("salarie_cadre");
  });

  it("groupes 4/5/6 hors cas specifiques -> salarie_non_cadre", () => {
    expect(suggestStatutFromCsp("4", "47")).toBe("salarie_non_cadre");
    expect(suggestStatutFromCsp("5", "54")).toBe("salarie_non_cadre");
    expect(suggestStatutFromCsp("6", "62")).toBe("salarie_non_cadre");
    expect(suggestStatutFromCsp("5", "")).toBe("salarie_non_cadre");
  });

  it("priorite : la regle csp specifique l'emporte sur la regle groupe", () => {
    // csp 31 dans le groupe 3 -> tns_liberal (et NON salarie_cadre)
    expect(suggestStatutFromCsp("3", "31")).toBe("tns_liberal");
    // csp 33 (fonctionnaire) dans le groupe 3 -> fonctionnaire (et NON salarie_cadre)
    expect(suggestStatutFromCsp("3", "33")).toBe("fonctionnaire");
  });

  it("cas trop ambigus -> \"\" (pas de suggestion)", () => {
    expect(suggestStatutFromCsp("1", "11")).toBe(""); // agriculteur
    expect(suggestStatutFromCsp("1", "")).toBe("");
    expect(suggestStatutFromCsp("2", "23")).toBe(""); // chef d'entreprise >= 10 sal.
    expect(suggestStatutFromCsp("2", "")).toBe("");    // groupe 2 sans csp encore choisi
  });

  it("entrees vides / nulles -> \"\"", () => {
    expect(suggestStatutFromCsp("", "")).toBe("");
    expect(suggestStatutFromCsp(null, null)).toBe("");
    expect(suggestStatutFromCsp(undefined, undefined)).toBe("");
  });
});
