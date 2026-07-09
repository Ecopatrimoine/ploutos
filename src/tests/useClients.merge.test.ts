// LOT 1 (fix autosave) — L1 : departage pur mergeClients / pickClientWinner.
//
// Prouve l'invariant central du fix : un payload SANS data ne supplante JAMAIS un
// payload AVEC data (dossier fraichement cree vs 1re saisie). Matrice complete
// 4 combinaisons de richesse (vide/data) x 3 ordres de updatedAt (a<b, a=b, a>b).
//
// useClients.tsx importe @/lib/supabase, qui throw si les variables d'env sont
// absentes : on le mocke (aucun appel reseau ici, fonctions pures uniquement).

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { pickClientWinner, hasClientData, mergeClients, resolveLoadedNotes, type ClientRecord, type ClientPayload } from "../useClients";

const T_OLD = "2026-01-01T00:00:00.000Z";
const T_NEW = "2026-01-02T00:00:00.000Z";

function rec(id: string, updatedAt: string, withData: boolean): ClientRecord {
  return {
    id,
    displayName: "Dossier " + id,
    createdAt: T_OLD,
    updatedAt,
    payload: withData
      ? { clientName: "Dupont", data: { person1FirstName: "Jean" } }
      : { clientName: "Dupont" }, // createClient : pas de cle data
  };
}

describe("hasClientData — detection vide vs porteur de donnees", () => {
  it("faux quand payload.data absent (dossier fraichement cree)", () => {
    expect(hasClientData(rec("A", T_OLD, false))).toBe(false);
  });
  it("faux quand payload.data est un objet vide", () => {
    expect(hasClientData({ ...rec("A", T_OLD, false), payload: { clientName: "x", data: {} } })).toBe(false);
  });
  it("vrai quand payload.data porte au moins une cle", () => {
    expect(hasClientData(rec("A", T_OLD, true))).toBe(true);
  });
  it("faux pour null / undefined", () => {
    expect(hasClientData(null)).toBe(false);
    expect(hasClientData(undefined)).toBe(false);
  });
});

describe("pickClientWinner — matrice 4 richesses x 3 ordres updatedAt", () => {
  // Chaque cas : [aData, bData, ordre, gagnantAttendu]. a a l'id "A", b l'id "B".
  // ordre : "lt" => ta<tb, "eq" => ta=tb, "gt" => ta>tb.
  const cases: Array<[boolean, boolean, "lt" | "eq" | "gt", "A" | "B"]> = [
    // (vide, vide) : meme richesse -> plus recent gagne ; egalite -> statu quo (A)
    [false, false, "lt", "B"],
    [false, false, "eq", "A"],
    [false, false, "gt", "A"],
    // (vide, data) : non-vide (B) gagne quel que soit updatedAt
    [false, true, "lt", "B"],
    [false, true, "eq", "B"],
    [false, true, "gt", "B"],
    // (data, vide) : non-vide (A) gagne quel que soit updatedAt
    [true, false, "lt", "A"],
    [true, false, "eq", "A"],
    [true, false, "gt", "A"],
    // (data, data) : meme richesse -> plus recent gagne ; egalite -> statu quo (A)
    [true, true, "lt", "B"],
    [true, true, "eq", "A"],
    [true, true, "gt", "A"],
  ];

  it.each(cases)(
    "a(data=%s) b(data=%s) ordre=%s -> gagnant %s",
    (aData, bData, ordre, gagnant) => {
      const ta = ordre === "lt" ? T_OLD : T_NEW;
      const tb = ordre === "lt" ? T_NEW : ordre === "eq" ? T_NEW : T_OLD;
      const a = rec("A", ta, aData);
      const b = rec("B", tb, bData);
      expect(pickClientWinner(a, b).id).toBe(gagnant);
    },
  );
});

describe("mergeClients — un record vide n'ecrase jamais un record porteur de donnees", () => {
  it("bug d'origine : remote vide (course createClient) n'ecrase pas le local saisi", () => {
    const remote = [rec("X", T_OLD, false)]; // push vide arrive en premier cote serveur
    const local = [rec("X", T_NEW, true)];   // 1re saisie locale, plus recente
    const merged = mergeClients(local, remote);
    expect(merged).toHaveLength(1);
    expect(hasClientData(merged[0])).toBe(true);
  });

  it("meme a updatedAt egal : le non-vide gagne sur le vide", () => {
    const remote = [rec("X", T_NEW, false)];
    const local = [rec("X", T_NEW, true)];
    const merged = mergeClients(local, remote);
    expect(merged).toHaveLength(1);
    expect(hasClientData(merged[0])).toBe(true);
  });

  it("symetrie : remote porteur de donnees n'est pas ecrase par un local vide", () => {
    const remote = [rec("X", T_OLD, true)];
    const local = [rec("X", T_NEW, false)]; // local vide meme plus recent
    const merged = mergeClients(local, remote);
    expect(merged).toHaveLength(1);
    expect(hasClientData(merged[0])).toBe(true);
  });

  it("data vs data a updatedAt egal : statu quo sur la base remote", () => {
    const remote = [{ ...rec("X", T_NEW, true), displayName: "REMOTE" }];
    const local = [{ ...rec("X", T_NEW, true), displayName: "LOCAL" }];
    const merged = mergeClients(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].displayName).toBe("REMOTE");
  });

  it("union des ids : dossiers distincts local et remote coexistent", () => {
    const remote = [rec("R", T_OLD, true)];
    const local = [rec("L", T_NEW, true)];
    const merged = mergeClients(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.id).sort()).toEqual(["L", "R"]);
  });
});

// LOT 10d N11 — chargement des Notes de synthèse : une suppression volontaire (chaîne
// vide) doit persister ; la protection L1 (payload sans data) ne doit pas être cassée.
describe("resolveLoadedNotes — la chaîne vide est une valeur légitime (N11)", () => {
  const pl = (over: Partial<ClientPayload>): ClientPayload => ({ data: { salary1: "1" }, ...over } as ClientPayload);

  it("CAUSE PROUVÉE : ancien comportement (if notes) IGNORAIT la note vide -> ancienne note résiste", () => {
    // Simulation de l'ancien code : `if (p.notes) setNotes(p.notes)` = garder l'actuel si "".
    const ancien = (p: ClientPayload, cur: string) => (p.notes ? String(p.notes) : cur);
    expect(ancien(pl({ notes: "" }), "TEXTE ANCIEN")).toBe("TEXTE ANCIEN"); // bug : ressuscite
    // Nouveau comportement : la note vide d'un vrai dossier est appliquée.
    expect(resolveLoadedNotes(pl({ notes: "" }), "TEXTE ANCIEN")).toBe(""); // corrigé
  });

  it("dossier avec data : note appliquée telle quelle (texte, vide, ou absente -> défaut)", () => {
    expect(resolveLoadedNotes(pl({ notes: "note client" }), "X")).toBe("note client");
    expect(resolveLoadedNotes(pl({ notes: "" }), "X")).toBe("");        // suppression persistée
    expect(resolveLoadedNotes(pl({ notes: undefined }), "X")).toBe(""); // ancien dossier sans notes
  });

  it("L1 préservé : payload SANS data -> on garde la note courante (ne pas écraser)", () => {
    const sansData = { clientName: "Nouveau", notes: "" } as ClientPayload;
    expect(hasClientData({ payload: sansData } as ClientRecord)).toBe(false);
    expect(resolveLoadedNotes(sansData, "note en cours")).toBe("note en cours");
    expect(resolveLoadedNotes(null, "note en cours")).toBe("note en cours");
  });
});
