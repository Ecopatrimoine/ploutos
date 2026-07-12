// src/tests/useLicense.isValid.test.ts
// Validité d'accès (computeIsValid) — logique pure extraite de useLicense.
// Couvre en particulier le statut 'cancelling' : accès maintenu jusqu'à cancel_at
// (un client payant en résiliation programmée ne doit PAS être verrouillé dehors).

import { describe, it, expect } from "vitest";
import { computeIsValid } from "../hooks/useLicense";

const NOW   = new Date("2026-07-12T12:00:00Z");
const FUTUR = new Date("2026-08-15T12:00:00Z"); // cancel_at a venir
const PASSE = new Date("2026-06-01T12:00:00Z"); // cancel_at depasse

describe("computeIsValid — acces selon le statut de licence", () => {
  it("active -> valide", () => {
    expect(computeIsValid("active", null, NOW)).toBe(true);
  });

  it("cancelling + cancel_at futur -> VALIDE (client payant, acces maintenu)", () => {
    expect(computeIsValid("cancelling", FUTUR, NOW)).toBe(true);
  });

  it("cancelling + cancel_at depasse -> invalide", () => {
    expect(computeIsValid("cancelling", PASSE, NOW)).toBe(false);
  });

  it("cancelled -> invalide", () => {
    expect(computeIsValid("cancelled", null, NOW)).toBe(false);
  });

  it("cancelling sans cancel_at -> VALIDE (defaut favorable au client payant)", () => {
    expect(computeIsValid("cancelling", null, NOW)).toBe(true);
  });

  it("expired / none -> invalide", () => {
    expect(computeIsValid("expired", null, NOW)).toBe(false);
    expect(computeIsValid("none", null, NOW)).toBe(false);
  });
});
