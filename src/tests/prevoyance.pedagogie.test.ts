// ─── LOT TROU-CRITIQUE — detecterTrou (couche pédagogique BlocPedagogie) ─────
//
// Teste la fonction pure `detecterTrou` (exportée de BlocPedagogie). Le TROU C
// « critique » = aucun revenu de remplacement sur TOUTE la période d'arrêt
// (J0 → bascule invalidité), détecté en PRIORITÉ ABSOLUE (avant B et A) :
// cas CIPAV carence-affiliation sans Madelin. Non-régressions : la carence
// initiale simple ne le déclenche pas, B et A restent inchangés.

import { describe, it, expect } from "vitest";
import { detecterTrou } from "../components/prevoyance/BlocPedagogie";
import type { ProjectionResult } from "../lib/prevoyance/types";

type Pt = { jour: number; total?: number; oblig?: number };

// ProjectionResult minimal (seuls axe / series / bascule comptent pour
// detecterTrou). `oblig` alimente l'étage obligatoire (IJ) ; `total - oblig`
// l'étage complémentaire individuel ; le reste des 9 séries est à zéro.
function mkProj(pts: Pt[], bascule: number): ProjectionResult {
  const zeros = () => pts.map(() => 0);
  const series = {
    salaire: zeros(), maintienEmployeur: zeros(), ijObligatoire: zeros(),
    ijComplementaireCollective: zeros(), ijComplementaireIndividuelle: zeros(),
    pensionInvalObligatoire: zeros(), renteInvalCollective: zeros(),
    renteInvalIndividuelle: zeros(), renteInvalEnfants: zeros(),
  };
  pts.forEach((p, i) => {
    const oblig = p.oblig ?? 0;
    const total = p.total ?? oblig;
    series.ijObligatoire[i] = oblig;
    series.ijComplementaireIndividuelle[i] = Math.max(0, total - oblig);
  });
  const axe = pts.map((p) => ({
    jour: p.jour,
    date: "",
    phase: (p.jour < bascule ? "am" : "invalidite") as "am" | "invalidite",
  }));
  return { axe, series, basculeInvaliditeJour: bascule } as unknown as ProjectionResult;
}

const BASCULE = 1095;

describe("detecterTrou — TROU C critique (priorité critique > B > A)", () => {
  it("CRITIQUE : 0 € sur tout J0→bascule, pension obligatoire ~200 € à la bascule", () => {
    // Cas réel CIPAV carence-affiliation sans Madelin : rien pendant l'arrêt,
    // puis seulement la pension d'invalidité à la bascule (3 ans).
    const t = detecterTrou(mkProj(
      [{ jour: 0 }, { jour: 90 }, { jour: 547 }, { jour: 912 }, { jour: BASCULE, oblig: 200 }],
      BASCULE
    ));
    expect(t?.kind).toBe("critique");
    expect(t?.debutJour).toBe(0);
    expect(t?.finJour).toBe(BASCULE);
  });

  it("NON-RÉG carence : 0 € au début PUIS IJ > 0 avant la bascule → PAS de critique", () => {
    // La carence initiale (zéro suivi de revenu pré-bascule) ne doit pas
    // déclencher C ; ici IJ stable ensuite → aucun trou du tout.
    const t = detecterTrou(mkProj(
      [{ jour: 0 }, { jour: 3 }, { jour: 30, oblig: 1900 }, { jour: 547, oblig: 1900 }],
      BASCULE
    ));
    expect(t?.kind).not.toBe("critique");
    expect(t).toBeNull();
  });

  it("NON-RÉG B : total > 0 puis retour à 0 avant la bascule → trou « total » (B)", () => {
    const t = detecterTrou(mkProj(
      [{ jour: 0 }, { jour: 30, oblig: 2000 }, { jour: 91, total: 0 }, { jour: 547, total: 0 }],
      BASCULE
    ));
    expect(t?.kind).toBe("total");
  });

  it("NON-RÉG A : obligatoire à sec mais complémentaire comble → trou « obligatoire » (A)", () => {
    const t = detecterTrou(mkProj(
      [{ jour: 0 }, { jour: 30, total: 1700, oblig: 0 }, { jour: 547, total: 1700, oblig: 0 }],
      BASCULE
    ));
    expect(t?.kind).toBe("obligatoire");
  });
});
