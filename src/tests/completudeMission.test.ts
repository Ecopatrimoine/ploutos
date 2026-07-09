// LOT 10d D1 — conditions de complétude par section (dérivées des données existantes).
import { describe, it, expect } from "vitest";
import { completudeMission } from "../lib/conformite/completudeMission";

describe("completudeMission — badges dérivés des données existantes", () => {
  it("dossier vierge : toutes les sections à faire", () => {
    const c = completudeMission({ horizon: "", modeGestion: "", esgPref: "" }, [], []);
    expect(c).toEqual({ besoins: false, profil: false, esg: false, recommandations: false, piecesJointes: false });
  });

  it("besoins : un seul besoin coché suffit", () => {
    expect(completudeMission({ besoinSante_hospit: true }, [], []).besoins).toBe(true);
    expect(completudeMission({ besoinEpargne_projet: true }, [], []).besoins).toBe(true);
    expect(completudeMission({}, [], []).besoins).toBe(false);
  });

  it("profil : complété seulement si horizon ET mode de gestion renseignés", () => {
    expect(completudeMission({ horizon: "5-8", modeGestion: "" }, [], []).profil).toBe(false);
    expect(completudeMission({ horizon: "", modeGestion: "pilote" }, [], []).profil).toBe(false);
    expect(completudeMission({ horizon: "5-8", modeGestion: "pilote" }, [], []).profil).toBe(true);
  });

  it("esg : préférence renseignée", () => {
    expect(completudeMission({ esgPref: "non" }, [], []).esg).toBe(true);
    expect(completudeMission({ esgPref: "" }, [], []).esg).toBe(false);
  });

  it("recommandations / pièces jointes : liste non vide", () => {
    expect(completudeMission({}, [{ id: "r1" }], []).recommandations).toBe(true);
    expect(completudeMission({}, [], [{ id: "p1" }]).piecesJointes).toBe(true);
    expect(completudeMission({}, [], []).recommandations).toBe(false);
  });
});
