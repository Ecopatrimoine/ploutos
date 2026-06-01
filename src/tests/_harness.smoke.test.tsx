// @vitest-environment jsdom
//
// Smoke test du harnais de test composant (Lot A — infra RTL + jsdom).
// Prouve uniquement que : (1) l'environnement jsdom est actif pour ce
// fichier .test.tsx, (2) React Testing Library monte un composant, (3) les
// matchers @testing-library/jest-dom (setupFiles) sont disponibles.
// AUCUNE logique métier ici — c'est un canari d'infrastructure.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("_harness — smoke test RTL + jsdom", () => {
  it("monte un composant trivial et le retrouve dans le DOM", () => {
    render(<div>ok</div>);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
