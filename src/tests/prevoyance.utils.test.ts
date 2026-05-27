// ─── Tests unitaires utils Prévoyance (Lot 2) ─────────────────────────────

import { describe, expect, it, vi } from "vitest";
import {
  validateSiret,
  resolveSiret,
  lookupCCNName,
  createEmptyTravail,
  createEmptyEmployeur,
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

describe("lookupCCNName (stub Lot 2)", () => {
  it("retourne null tant que le Lot 3 n'a pas livré le référentiel ccn-2026.json", () => {
    expect(lookupCCNName("1486")).toBeNull();
    expect(lookupCCNName(null)).toBeNull();
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
});
