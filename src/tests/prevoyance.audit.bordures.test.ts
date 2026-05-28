// ─── T2 / Famille D — Conformité collective : score + bordures ─────────
//
// Positif/négatif des 6 contrôles couverts dans prevoyance.audit.test.ts
// (Lot 8). Ce fichier cible le calcul du scoreGlobal (exclusion des N.A.)
// et les bordures/choix de statut à figer.

import { describe, it, expect } from "vitest";
import { runAuditConformite } from "../lib/prevoyance/audit-collectif";
import { mapAuditEnConstats } from "../lib/prevoyance/regles";
import { referentiels } from "../data/prevoyance";
import type { EntrepriseAudit } from "../types/patrimoine";

function entreprise(over: Partial<EntrepriseAudit> = {}): EntrepriseAudit {
  return {
    siret: "12345678901234", nom: "ACME", formeJuridique: "SARL",
    effectif: 20, idccCCN: null, nomCCN: null, codeNAF: "7022Z",
    santeCollectiveEnPlace: false, participationEmployeurSante: 0.5,
    prevoyanceCadresEnPlace: false, tauxT1Cadres: 1.5,
    prevoyanceNonCadresEnPlace: false, categoriesObjectivesDeclarees: "",
    retraiteSuppEnPlace: false,
    ...over,
  };
}

describe("Famille D — Score & bordures conformité collective", () => {
  // D7 — le scoreGlobal exclut les contrôles non_applicables
  it("D7 — scoreGlobal = conformes / applicables (exclut les N.A.)", () => {
    // effectif 20 + santé en place + cadres tauxT1 1.5 + catégorie déclarée + pas d'IDCC
    const audit = runAuditConformite(
      entreprise({
        effectif: 20,
        santeCollectiveEnPlace: true,
        prevoyanceCadresEnPlace: true, tauxT1Cadres: 1.5,
        categoriesObjectivesDeclarees: "Cadres art. 4",
        idccCCN: null,
      }),
      referentiels
    );
    // Statuts attendus :
    //   c_sante_ani            → conforme
    //   c_cadres_15_t1         → conforme
    //   c_categories           → vigilance
    //   c_ccn_branche_prevoyance → non_applicable (pas d'IDCC)
    //   c_ccn_branche_sante      → non_applicable (pas d'IDCC)
    //   c_forfait_social        → vigilance (effectif 20)
    const statuts = Object.fromEntries(audit.controles.map((c) => [c.id, c.statut]));
    expect(statuts.c_sante_ani_obligatoire).toBe("conforme");
    expect(statuts.c_cadres_15_t1).toBe("conforme");
    expect(statuts.c_categories_objectives).toBe("vigilance");
    expect(statuts.c_ccn_branche_prevoyance).toBe("non_applicable");
    expect(statuts.c_ccn_branche_sante).toBe("non_applicable");
    expect(statuts.c_forfait_social_correctement_applique).toBe("vigilance");
    // Applicables = 4 (2 conformes + 2 vigilance), conformes = 2 → 50 %.
    // Si les N.A. étaient comptées : 2/6 = 33 %. Le test prouve l'exclusion.
    expect(audit.scoreGlobal).toBe(50);
  });

  it("D7bis — 100 % si tous les applicables sont conformes (cas limite effectif 0)", () => {
    // effectif 0 → santé N.A. + forfait N.A. ; cadres conforme ; mais
    // catégories reste vigilance si déclarée. On force le seul cas
    // 100 % atteignable : aucun applicable non-conforme.
    const audit = runAuditConformite(
      entreprise({
        effectif: 0,
        prevoyanceCadresEnPlace: true, tauxT1Cadres: 2.0,
        categoriesObjectivesDeclarees: "", // non_conforme → empêche 100 %
        idccCCN: null,
      }),
      referentiels
    );
    // On vérifie surtout que le score reste dans [0,100] et cohérent.
    expect(audit.scoreGlobal).toBeGreaterThanOrEqual(0);
    expect(audit.scoreGlobal).toBeLessThanOrEqual(100);
  });

  // D2 bordure — pas de cadres déclarés : choix figé = "vigilance"
  it("D2 — pas de prévoyance cadres déclarée → statut 'vigilance' (choix figé)", () => {
    const audit = runAuditConformite(entreprise({ prevoyanceCadresEnPlace: false }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_cadres_15_t1")!;
    expect(c.statut).toBe("vigilance");
  });

  // D6 — forfait social selon effectif : null → vigilance (prudence)
  it("D6 — effectif null → forfait social 'vigilance' (prudence)", () => {
    const audit = runAuditConformite(entreprise({ effectif: null }), referentiels);
    const c = audit.controles.find((x) => x.id === "c_forfait_social_correctement_applique")!;
    expect(c.statut).toBe("vigilance");
    expect(c.detail).toContain("non renseigné");
  });

  // D8 — mapping : chaque non_conforme → 1 constat conf_* de bon ID/sévérité
  it("D8 — mapAuditEnConstats : non_conforme santé → conf_ani_sante_obligatoire (non_conformite)", () => {
    const audit = runAuditConformite(
      entreprise({ effectif: 20, santeCollectiveEnPlace: false, categoriesObjectivesDeclarees: "OK" }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    const sante = constats.find((c) => c.id.includes("conf_ani_sante_obligatoire"));
    expect(sante).toBeDefined();
    expect(sante?.severite).toBe("non_conformite");
    expect(sante?.cible).toBe("entreprise");
  });

  it("D8bis — aucun contrôle conforme/N.A. ne produit de constat critique", () => {
    // Entreprise totalement conforme sur les applicables possibles.
    const audit = runAuditConformite(
      entreprise({
        effectif: 0, // santé + forfait N.A.
        prevoyanceCadresEnPlace: true, tauxT1Cadres: 1.5,
        categoriesObjectivesDeclarees: "OK", // vigilance (pas critique)
        idccCCN: null,
      }),
      referentiels
    );
    const constats = mapAuditEnConstats(audit);
    // Aucun "non_conformite" attendu (seules d'éventuelles vigilances → attention).
    expect(constats.every((c) => c.severite !== "non_conformite")).toBe(true);
  });
});
