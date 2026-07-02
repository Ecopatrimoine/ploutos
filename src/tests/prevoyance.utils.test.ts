// ─── Tests unitaires utils Prévoyance (Lot 2) ─────────────────────────────

import { describe, expect, it, vi } from "vitest";
import {
  validateSiret,
  resolveSiret,
  lookupCCNName,
  createEmptyTravail,
  createEmptyEmployeur,
  suggestCaisseFromStatut,
} from "../lib/prevoyance/utils";

describe("validateSiret", () => {
  it("accepte un SIRET de 14 chiffres", () => {
    expect(validateSiret("12345678901234")).toBe(true);
  });

  it("refuse un SIRET trop court", () => {
    expect(validateSiret("123")).toBe(false);
  });

  it("refuse un SIRET trop long", () => {
    expect(validateSiret("123456789012345")).toBe(false);
  });

  it("refuse un SIRET avec lettres", () => {
    expect(validateSiret("1234567890123A")).toBe(false);
  });

  it("refuse null / undefined / vide", () => {
    expect(validateSiret(null)).toBe(false);
    expect(validateSiret(undefined)).toBe(false);
    expect(validateSiret("")).toBe(false);
  });
});

describe("lookupCCNName (câblé sur ccn-2026.json — Lot 3)", () => {
  it("retourne le libellé officiel pour Syntec (IDCC 1486)", () => {
    expect(lookupCCNName("1486")).toContain("Syntec");
  });

  it("retourne le libellé officiel pour Métallurgie (IDCC 3248)", () => {
    expect(lookupCCNName("3248")).toContain("Métallurgie");
  });

  it("retourne le libellé pour HCR (IDCC 1979)", () => {
    expect(lookupCCNName("1979")).toContain("Hôtels");
  });

  it("retourne null pour un IDCC absent du référentiel", () => {
    expect(lookupCCNName("999999")).toBeNull();
  });

  it("retourne null pour null / undefined / vide", () => {
    expect(lookupCCNName(null)).toBeNull();
    expect(lookupCCNName(undefined)).toBeNull();
    expect(lookupCCNName("")).toBeNull();
  });
});

describe("createEmptyTravail", () => {
  it("crée une structure cohérente avec les valeurs par défaut attendues", () => {
    const t = createEmptyTravail();
    expect(t.statutPro).toBe("");
    expect(t.caisseAffiliation).toBeNull();
    expect(t.employeur).toBeNull();
    expect(t.tempsTravail).toEqual({ type: "plein" });
    expect(t.salaireBrutAnnuel).toBe(0);
    expect(t.optionMadelin).toBe(false);
  });
});

describe("createEmptyEmployeur", () => {
  it("crée une structure avec tous les champs à null et sourceCCN=non_defini", () => {
    const e = createEmptyEmployeur();
    expect(e.siret).toBeNull();
    expect(e.idccCCN).toBeNull();
    expect(e.sourceCCN).toBe("non_defini");
  });
});

describe("suggestCaisseFromStatut", () => {
  it("CPAM pour salariés et assimilés", () => {
    expect(suggestCaisseFromStatut("salarie_non_cadre")).toBe("CPAM");
    expect(suggestCaisseFromStatut("salarie_cadre")).toBe("CPAM");
    expect(suggestCaisseFromStatut("president_sas")).toBe("CPAM");
    expect(suggestCaisseFromStatut("eurl_unique")).toBe("CPAM");
  });

  it("FONCTION_PUBLIQUE pour fonctionnaire (titulaire)", () => {
    expect(suggestCaisseFromStatut("fonctionnaire")).toBe("FONCTION_PUBLIQUE");
  });

  it("SSI pour TNS commerce / artisan / gérant majoritaire", () => {
    expect(suggestCaisseFromStatut("tns_commercant")).toBe("SSI");
    expect(suggestCaisseFromStatut("tns_artisan")).toBe("SSI");
    expect(suggestCaisseFromStatut("gerant_majoritaire")).toBe("SSI");
  });

  it("null pour TNS libéral (caisse dépend de la profession)", () => {
    expect(suggestCaisseFromStatut("tns_liberal")).toBeNull();
  });

  it("null pour retraité, sans activité, vide, null", () => {
    expect(suggestCaisseFromStatut("retraite")).toBeNull();
    expect(suggestCaisseFromStatut("sans_activite")).toBeNull();
    expect(suggestCaisseFromStatut("")).toBeNull();
    expect(suggestCaisseFromStatut(null)).toBeNull();
    expect(suggestCaisseFromStatut(undefined)).toBeNull();
  });
});

describe("resolveSiret", () => {
  function mockFetchOK(payload: any): typeof fetch {
    return vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    })) as unknown as typeof fetch;
  }

  function mockFetchKO(status = 500): typeof fetch {
    return vi.fn(async () => ({
      ok: false,
      status,
      json: async () => ({}),
    })) as unknown as typeof fetch;
  }

  it("refuse un SIRET au format invalide", async () => {
    const res = await resolveSiret("abc", mockFetchOK({ results: [] }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid_format");
  });

  it("renvoie not_found si l'API ne retourne aucun résultat", async () => {
    const fetchMock = mockFetchOK({ results: [] });
    const res = await resolveSiret("12345678901234", fetchMock);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_found");
  });

  it("renvoie network_error si l'API répond en erreur", async () => {
    const res = await resolveSiret("12345678901234", mockFetchKO());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("network_error");
  });

  it("renvoie network_error si fetch throw", async () => {
    const fetchThrow = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const res = await resolveSiret("12345678901234", fetchThrow);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("network_error");
  });

  it("résout un SIRET valide avec IDCC depuis matching_etablissements", async () => {
    const payload = {
      results: [
        {
          nom_complet: "ACME CONSEIL SARL",
          nature_juridique: "5499",
          date_creation: "2010-03-12",
          matching_etablissements: [
            {
              liste_idcc: ["1486"],
              activite_principale: "7022Z",
              tranche_effectif_salarie: "12",
              adresse: "1 rue de la Paix, 75001 Paris",
            },
          ],
        },
      ],
    };
    const res = await resolveSiret("12345678901234", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.siret).toBe("12345678901234");
      expect(res.data.siren).toBe("123456789");
      expect(res.data.nom).toBe("ACME CONSEIL SARL");
      expect(res.data.idccCCN).toBe("1486");
      expect(res.data.sourceCCN).toBe("auto");
      expect(res.data.codeNAF).toBe("7022Z");
      expect(res.data.effectif).toBe(12);
    }
  });

  it("fallback sur complements.liste_idcc si matching_etablissements vide", async () => {
    const payload = {
      results: [
        {
          nom_complet: "BETA SAS",
          nature_juridique: "5499",
          matching_etablissements: [{}],
          complements: { liste_idcc: ["3248"] },
        },
      ],
    };
    const res = await resolveSiret("98765432109876", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccCCN).toBe("3248");
      expect(res.data.sourceCCN).toBe("auto");
    }
  });

  it("renvoie sourceCCN=non_defini si aucun IDCC", async () => {
    const payload = {
      results: [
        {
          nom_complet: "GAMMA SCI",
          matching_etablissements: [{ activite_principale: "6820A" }],
        },
      ],
    };
    const res = await resolveSiret("11122233344455", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccCCN).toBeNull();
      expect(res.data.sourceCCN).toBe("non_defini");
    }
  });

  // ─── Multi-IDCC (LOT MULTI-IDCC) — additif, non-regression stricte ──────────
  it("(a) mono-IDCC : comportement inchange — idccCCN = [0], multiIdcc false, idccListe complete", async () => {
    const payload = { results: [{ nom_complet: "ACME", matching_etablissements: [{ liste_idcc: ["1486"] }] }] };
    const res = await resolveSiret("12345678901234", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccCCN).toBe("1486");
      expect(res.data.idccListe).toEqual(["1486"]);
      expect(res.multiIdcc).toBe(false);
      expect(res.data.sourceCCN).toBe("auto");
    }
  });

  it("(b) multi-IDCC : multiIdcc true + liste complete conservee + [0] pre-rempli", async () => {
    const payload = { results: [{ nom_complet: "MULTI", matching_etablissements: [{ liste_idcc: ["1486", "3248", "1979"] }] }] };
    const res = await resolveSiret("12345678901234", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccCCN).toBe("1486"); // 1er pre-rempli (comportement par defaut inchange)
      expect(res.data.idccListe).toEqual(["1486", "3248", "1979"]);
      expect(res.multiIdcc).toBe(true);
    }
  });

  it("(c) reponse sans liste_idcc : idccCCN null, idccListe [], multiIdcc false (pas de crash)", async () => {
    const payload = { results: [{ nom_complet: "NO-IDCC", matching_etablissements: [{ activite_principale: "6820A" }] }] };
    const res = await resolveSiret("11122233344455", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccCCN).toBeNull();
      expect(res.data.idccListe).toEqual([]);
      expect(res.multiIdcc).toBe(false);
    }
  });

  // ─── Sentinelle DSN 9999 « aucune convention applicable » ───────────────────
  it("(d) filtre le sentinelle 9999 et garde la vraie CCN (ex. BNP [9999, 2120])", async () => {
    const payload = { results: [{ nom_complet: "BNP", matching_etablissements: [{ liste_idcc: ["9999", "2120"] }] }] };
    const res = await resolveSiret("66204244900014", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccListe).toEqual(["2120"]);
      expect(res.data.idccCCN).toBe("2120");
      expect(res.multiIdcc).toBe(false);
      expect(res.data.sourceCCN).toBe("auto");
    }
  });

  it("(e) filtre 9999 meme renvoye en number (tolerance de type API)", async () => {
    const payload = { results: [{ nom_complet: "BNP-NUM", matching_etablissements: [{ liste_idcc: [9999, 2120] }] }] };
    const res = await resolveSiret("66204244900014", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccListe).toEqual(["2120"]);
      expect(res.data.idccCCN).toBe("2120");
      expect(res.multiIdcc).toBe(false);
    }
  });

  it("(f) 9999 seul → aucune convention de branche (idccListe [], idccCCN null)", async () => {
    const payload = { results: [{ nom_complet: "SANS-CCN", matching_etablissements: [{ liste_idcc: ["9999"] }] }] };
    const res = await resolveSiret("12345678901234", mockFetchOK(payload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.idccListe).toEqual([]);
      expect(res.data.idccCCN).toBeNull();
      expect(res.multiIdcc).toBe(false);
      expect(res.data.sourceCCN).toBe("non_defini");
    }
  });
});
