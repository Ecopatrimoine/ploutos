// LOT 10c-bis — couche présentation conformité collective (ZÉRO moteur).
// Prouve : verdict qualitatif (conforme / N écarts), écarts = contrôles
// non_conforme|vigilance triés (non_conforme d'abord), montant € UNIQUEMENT sur
// l'écart cadres (constante référentiel, jamais inventé), fallback action, santé ANI.

import { describe, it, expect } from "vitest";
import {
  buildEcartsCollectifs,
  buildVerdictConformite,
  buildSanteAni,
} from "../lib/presentation/prevoyanceCollective";
import type { AuditConformite, ControleConformite, ControleStatut } from "../lib/prevoyance/types";
import { referentiels } from "../data/prevoyance";

function ctrl(id: string, statut: ControleStatut, over: Partial<ControleConformite> = {}): ControleConformite {
  return {
    id,
    axe: "prevoyance",
    libelle: `Libellé ${id}`,
    statut,
    reference: `Réf ${id}`,
    detail: `Détail ${id}`,
    ...over,
  };
}

function audit(controles: ControleConformite[]): AuditConformite {
  const applicables = controles.filter((c) => c.statut !== "non_applicable");
  const conformes = applicables.filter((c) => c.statut === "conforme").length;
  return {
    controles,
    scoreGlobal: applicables.length ? Math.round((conformes / applicables.length) * 100) : 100,
  };
}

describe("buildVerdictConformite — carte-roi qualitative (pas de chiffre-roi)", () => {
  it("tout conforme (+ non_applicable) -> Conforme, 0 écart", () => {
    const v = buildVerdictConformite(audit([ctrl("a", "conforme"), ctrl("b", "non_applicable")]));
    expect(v.conforme).toBe(true);
    expect(v.nbEcarts).toBe(0);
    expect(v.titre).toBe("Conforme");
  });

  it("non_conforme + vigilance -> 2 écarts détectés", () => {
    const v = buildVerdictConformite(audit([ctrl("a", "non_conforme"), ctrl("b", "vigilance"), ctrl("c", "conforme")]));
    expect(v.conforme).toBe(false);
    expect(v.nbEcarts).toBe(2);
    expect(v.titre).toBe("2 écarts détectés");
  });

  it("un seul écart -> singulier", () => {
    expect(buildVerdictConformite(audit([ctrl("a", "vigilance")])).titre).toBe("1 écart détecté");
  });
});

describe("buildEcartsCollectifs — écarts filtrés et triés", () => {
  it("ne garde que non_conforme|vigilance, non_conforme d'abord", () => {
    const ecarts = buildEcartsCollectifs(
      audit([ctrl("conf", "conforme"), ctrl("vig", "vigilance"), ctrl("nc", "non_conforme"), ctrl("na", "non_applicable")]),
    );
    expect(ecarts.map((e) => e.id)).toEqual(["nc", "vig"]);
    expect(ecarts.map((e) => e.severite)).toEqual(["non_conforme", "vigilance"]);
  });

  it("action corrective : fallback non vide quand le contrôle ne l'explicite pas", () => {
    const [e] = buildEcartsCollectifs(audit([ctrl("x", "non_conforme")]));
    expect(e.actionCorrective.length).toBeGreaterThan(0);
    // présente telle quelle quand fournie
    const [e2] = buildEcartsCollectifs(audit([ctrl("y", "non_conforme", { actionCorrective: "Faire X" })]));
    expect(e2.actionCorrective).toBe("Faire X");
  });
});

describe("risque « 3 PASS » — montant réel du référentiel, UNIQUEMENT sur l'écart cadres", () => {
  it("l'écart cadres porte le montant sanctionMontant (référentiel), les autres non", () => {
    const ecarts = buildEcartsCollectifs(
      audit([ctrl("c_cadres_15_t1", "vigilance"), ctrl("c_sante_ani_obligatoire", "non_conforme")]),
    );
    const cadres = ecarts.find((e) => e.id === "c_cadres_15_t1")!;
    const sante = ecarts.find((e) => e.id === "c_sante_ani_obligatoire")!;
    expect(cadres.risqueConditionnel).not.toBeNull();
    expect(cadres.risqueConditionnel!.montant).toBe(referentiels.pass.prevoyanceCadres1_50.sanctionMontant);
    expect(cadres.risqueConditionnel!.condition).toMatch(/cadres/i);
    expect(sante.risqueConditionnel).toBeNull(); // aucun autre écart n'est chiffré
  });

  it("un écart cadres CONFORME n'apparaît pas (donc pas de montant affiché à tort)", () => {
    const ecarts = buildEcartsCollectifs(audit([ctrl("c_cadres_15_t1", "conforme")]));
    expect(ecarts).toHaveLength(0);
  });
});

describe("buildSanteAni — extraction du contrôle santé ANI", () => {
  it("présent -> statut + label lisible", () => {
    const s = buildSanteAni(audit([ctrl("c_sante_ani_obligatoire", "non_conforme")]));
    expect(s).not.toBeNull();
    expect(s!.statut).toBe("non_conforme");
    expect(s!.label).toBe("Non conforme");
  });

  it("absent -> null", () => {
    expect(buildSanteAni(audit([ctrl("autre", "conforme")]))).toBeNull();
  });
});
