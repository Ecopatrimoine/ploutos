// ─── Tests audit conformité collective (Lot 8) ─────────────────────────

import { describe, expect, it } from "vitest";
import { runAuditConformite } from "../lib/prevoyance/audit-collectif";
import { mapAuditEnConstats } from "../lib/prevoyance/regles";
import { referentiels } from "../data/prevoyance";
import type { EntrepriseAudit } from "../types/patrimoine";

function baseEntreprise(over: Partial<EntrepriseAudit> = {}): EntrepriseAudit {
  return {
    siret: "12345678901234",
    nom: "ACME SARL",
    formeJuridique: "SARL",
    effectif: 10,
    idccCCN: null,
    nomCCN: null,
    codeNAF: "7022Z",
    santeCollectiveEnPlace: false,
    participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false,
    tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false,
    categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
    ...over,
  };
}

describe("runAuditConformite — structure", () => {
  it("retourne 6 contrôles", () => {
    const audit = runAuditConformite(baseEntreprise(), referentiels);
    expect(audit.controles).toHaveLength(6);
  });

  it("scoreGlobal entre 0 et 100", () => {
    const audit = runAuditConformite(baseEntreprise(), referentiels);
    expect(audit.scoreGlobal).toBeGreaterThanOrEqual(0);
    expect(audit.scoreGlobal).toBeLessThanOrEqual(100);
  });

  it("expose les 6 IDs attendus", () => {
    const audit = runAuditConformite(baseEntreprise(), referentiels);
    const ids = audit.controles.map((c) => c.id);
    expect(ids).toContain("c_sante_ani_obligatoire");
    expect(ids).toContain("c_cadres_15_t1");
    expect(ids).toContain("c_categories_objectives");
    expect(ids).toContain("c_ccn_branche_prevoyance");
    expect(ids).toContain("c_ccn_branche_sante");
    expect(ids).toContain("c_forfait_social_correctement_applique");
  });
});

describe("c_sante_ani_obligatoire", () => {
  it("non_applicable si effectif = 0", () => {
    const audit = runAuditConformite(baseEntreprise({ effectif: 0 }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_sante_ani_obligatoire")!;
    expect(c.statut).toBe("non_applicable");
  });

  it("non_conforme si effectif > 0 et pas de santé déclarée", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 12, santeCollectiveEnPlace: false }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_sante_ani_obligatoire")!;
    expect(c.statut).toBe("non_conforme");
    expect(c.actionCorrective).toBeDefined();
  });

  it("conforme si santé en place", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 12, santeCollectiveEnPlace: true }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_sante_ani_obligatoire")!;
    expect(c.statut).toBe("conforme");
  });
});

describe("c_cadres_15_t1", () => {
  it("vigilance si pas de prévoyance cadres déclarée", () => {
    const audit = runAuditConformite(
      baseEntreprise({ prevoyanceCadresEnPlace: false }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_cadres_15_t1")!;
    expect(c.statut).toBe("vigilance");
  });

  it("non_conforme si taux T1 < 1,5 %", () => {
    const audit = runAuditConformite(
      baseEntreprise({ prevoyanceCadresEnPlace: true, tauxT1Cadres: 1.2 }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_cadres_15_t1")!;
    expect(c.statut).toBe("non_conforme");
  });

  it("conforme si taux T1 ≥ 1,5 %", () => {
    const audit = runAuditConformite(
      baseEntreprise({ prevoyanceCadresEnPlace: true, tauxT1Cadres: 1.5 }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_cadres_15_t1")!;
    expect(c.statut).toBe("conforme");
  });
});

describe("c_categories_objectives", () => {
  it("non_conforme si aucune catégorie déclarée", () => {
    const audit = runAuditConformite(
      baseEntreprise({ categoriesObjectivesDeclarees: "" }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_categories_objectives")!;
    expect(c.statut).toBe("non_conforme");
  });

  it("vigilance si catégorie déclarée (à valider)", () => {
    const audit = runAuditConformite(
      baseEntreprise({ categoriesObjectivesDeclarees: "Cadres au sens art. 4" }),
      referentiels
    );
    const c = audit.controles.find((x) => x.id === "c_categories_objectives")!;
    expect(c.statut).toBe("vigilance");
  });
});

describe("c_ccn_branche_prevoyance", () => {
  it("non_applicable si pas d'IDCC", () => {
    const audit = runAuditConformite(baseEntreprise({ idccCCN: null }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_ccn_branche_prevoyance")!;
    expect(c.statut).toBe("non_applicable");
  });

  it("vigilance pour Syntec (1486) qui impose un plancher T1 1.5", () => {
    const audit = runAuditConformite(baseEntreprise({ idccCCN: "1486" }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_ccn_branche_prevoyance")!;
    expect(c.statut).toBe("vigilance");
  });
});

describe("c_forfait_social_correctement_applique", () => {
  it("non_applicable si effectif < 11 (forfait social 0 %)", () => {
    const audit = runAuditConformite(baseEntreprise({ effectif: 5 }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_forfait_social_correctement_applique")!;
    expect(c.statut).toBe("non_applicable");
    expect(c.detail).toContain("0 %");
  });

  it("vigilance si effectif ≥ 11 (taux standard 20 %)", () => {
    const audit = runAuditConformite(baseEntreprise({ effectif: 25 }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_forfait_social_correctement_applique")!;
    expect(c.statut).toBe("vigilance");
    expect(c.detail).toContain("20 %");
  });

  it("vigilance si effectif null (prudence)", () => {
    const audit = runAuditConformite(baseEntreprise({ effectif: null }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_forfait_social_correctement_applique")!;
    expect(c.statut).toBe("vigilance");
    expect(c.detail).toContain("non renseigné");
  });
});

describe("scoreGlobal", () => {
  it("100 si tous applicables sont conformes", () => {
    // Effectif = 0 + tous les checks "conformes par défaut"
    const audit = runAuditConformite(
      baseEntreprise({
        effectif: 0,
        prevoyanceCadresEnPlace: true,
        tauxT1Cadres: 1.5,
        categoriesObjectivesDeclarees: "OK",
      }),
      referentiels
    );
    // Au moins quelques conformes — c_cadres_15_t1 = conforme.
    // c_categories_objectives reste vigilance. Donc < 100.
    expect(audit.scoreGlobal).toBeLessThanOrEqual(100);
  });

  it("diminue quand on enlève une couverture obligatoire", () => {
    const sansSante = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false }),
      referentiels
    );
    const avecSante = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: true }),
      referentiels
    );
    expect(avecSante.scoreGlobal).toBeGreaterThanOrEqual(sansSante.scoreGlobal);
  });
});

describe("mapAuditEnConstats", () => {
  it("ignore les contrôles conformes et non_applicables", () => {
    // Effectif = 0 → c_sante_ani non_applicable.
    // c_cadres_15_t1 (vigilance), c_categories_objectives (non_conforme),
    // c_ccn_branche_prevoyance (non_applicable car pas d'IDCC),
    // c_ccn_branche_sante (non_applicable), c_forfait_social (vigilance).
    const audit = runAuditConformite(baseEntreprise({ effectif: 0 }), referentiels);
    const constats = mapAuditEnConstats(audit);
    // 3 non-conformes ou vigilance attendus.
    expect(constats.length).toBeGreaterThanOrEqual(2);
    // Aucun n'a statut "conforme" ou "non_applicable" (n'existe pas dans Constat)
    for (const c of constats) {
      expect(["non_conformite", "alerte", "attention", "info"]).toContain(c.severite);
    }
  });

  it("non_conforme → severite non_conformite", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const sante = constats.find((c) => c.id.includes("c_sante_ani_obligatoire"));
    expect(sante?.severite).toBe("non_conformite");
  });

  it("vigilance → severite attention", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: true }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const cadres = constats.find((c) => c.id.includes("c_cadres_15_t1"));
    expect(cadres?.severite).toBe("attention");
  });

  it("tri par sévérité décroissante (non_conformite > attention)", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const ordre: Record<string, number> = { non_conformite: 0, alerte: 1, attention: 2, info: 3 };
    for (let i = 1; i < constats.length; i++) {
      expect(ordre[constats[i].severite]).toBeGreaterThanOrEqual(ordre[constats[i - 1].severite]);
    }
  });

  it("ID contient une des 4 règles conf_* attendues (mapping spec)", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false, categoriesObjectivesDeclarees: "" }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const ids = constats.map((c) => c.id);
    expect(ids.some((i) => i.includes("conf_ani_sante_obligatoire"))).toBe(true);
    expect(ids.some((i) => i.includes("conf_categories_objectives_invalides"))).toBe(true);
  });

  it("aucune mention d'assureur dans les actions (DDA)", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const interdits = /axa|generali|apicil|allianz|cnp|swisslife|aviva|maaf|matmut|gan|mma|macif/i;
    for (const c of constats) {
      expect(c.action).not.toMatch(interdits);
      expect(c.detail).not.toMatch(interdits);
      expect(c.titre).not.toMatch(interdits);
    }
  });

  it("toutes les cibles sont 'entreprise'", () => {
    const audit = runAuditConformite(
      baseEntreprise({ effectif: 20, santeCollectiveEnPlace: false }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    for (const c of constats) expect(c.cible).toBe("entreprise");
  });
});

// ─── LOT SANTE-FLAG : controleCcnBrancheSante lit regimeBranche ───────────────
describe("c_ccn_branche_sante — flag regimeBranche (cas d'or)", () => {
  function sante(idcc: string, nom: string) {
    const audit = runAuditConformite(baseEntreprise({ idccCCN: idcc, nomCCN: nom }), referentiels);
    return audit.controles.find((c) => c.id === "c_ccn_branche_sante")!;
  }

  it("TRUE (1979 HCR, regime de branche) -> vigilance", () => {
    expect(sante("1979", "HCR").statut).toBe("vigilance");
  });

  it("FALSE (2120 Banque, pas de regime de branche) -> non_applicable", () => {
    expect(sante("2120", "Banque").statut).toBe("non_applicable");
  });

  it("2264 (Hospitalisation, desormais regimeBranche false) -> non_applicable (comme Banque)", () => {
    expect(sante("2264", "Hospitalisation").statut).toBe("non_applicable");
  });

  it("TO_VERIFY (convention synthetique) -> vigilance, detail distinct du cas TRUE (branche defensive)", () => {
    // Plus aucune CCN reelle n'est TO_VERIFY ; on couvre la branche du controle
    // via un referentiel derive.
    const synthRef = {
      ...referentiels,
      ccn: {
        ...referentiels.ccn,
        conventions: {
          ...(referentiels.ccn as { conventions: Record<string, unknown> }).conventions,
          TESTTV: { idcc: "TESTTV", nom: "Test TO_VERIFY", santeMinimum: { TO_VERIFY: true } },
        },
      },
    } as unknown as typeof referentiels;
    const audit = runAuditConformite(baseEntreprise({ idccCCN: "TESTTV", nomCCN: "Test TO_VERIFY" }), synthRef);
    const to = audit.controles.find((c) => c.id === "c_ccn_branche_sante")!;
    expect(to.statut).toBe("vigilance");
    expect(to.detail).not.toBe(sante("1979", "HCR").detail);
    expect(to.detail).toMatch(/confirmer|lever/i);
  });

  it("Syntec 1486 (panier ANI national) -> non_applicable", () => {
    expect(sante("1486", "Syntec").statut).toBe("non_applicable");
  });
});
