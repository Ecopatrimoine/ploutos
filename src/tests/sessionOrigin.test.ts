// Module pur sessionOrigin — decodeJwtPayload / isRecoverySession sur tokens
// FORGES (aucun reseau, aucune signature reelle). Couvre : recovery, password,
// amr absent, token malforme, segment manquant.

import { describe, it, expect } from "vitest";
import { decodeJwtPayload, isRecoverySession } from "../lib/sessionOrigin";

// Forge un JWT `header.payload.signature` : seul le payload compte ici, encode
// en base64url (sans padding, comme un vrai JWT). La signature est factice.
function forgeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig-factice`;
}

const RECOVERY_TOKEN = forgeJwt({
  sub: "user-1",
  aal: "aal1",
  amr: [{ method: "recovery", timestamp: 1_700_000_000 }],
});
const PASSWORD_TOKEN = forgeJwt({
  sub: "user-1",
  aal: "aal1",
  amr: [{ method: "password", timestamp: 1_700_000_000 }],
});
const NO_AMR_TOKEN = forgeJwt({ sub: "user-1", aal: "aal1" });
const MULTI_AMR_TOKEN = forgeJwt({
  sub: "user-1",
  amr: [{ method: "password" }, { method: "recovery" }],
});

describe("decodeJwtPayload", () => {
  it("decode le payload d'un token bien forme et expose amr", () => {
    const payload = decodeJwtPayload(RECOVERY_TOKEN);
    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({ sub: "user-1", aal: "aal1" });
    expect(Array.isArray((payload as { amr?: unknown }).amr)).toBe(true);
  });

  it("retourne null quand le token est vide, null ou undefined", () => {
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
  });

  it("retourne null quand un segment manque (pas exactement 3 parties)", () => {
    expect(decodeJwtPayload("header.payload")).toBeNull();
    expect(decodeJwtPayload("un-seul-segment")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
  });

  it("retourne null quand le payload est malforme (base64/JSON invalide)", () => {
    expect(decodeJwtPayload("header..sig")).toBeNull(); // segment payload vide
    expect(decodeJwtPayload("header.@@@invalide@@@.sig")).toBeNull(); // base64 invalide
    // base64url valide mais contenu non-JSON -> JSON.parse echoue -> null
    const notJson = Buffer.from("ceci n'est pas du json").toString("base64url");
    expect(decodeJwtPayload(`header.${notJson}.sig`)).toBeNull();
  });
});

describe("isRecoverySession", () => {
  it("true quand amr contient method: recovery", () => {
    expect(isRecoverySession(RECOVERY_TOKEN)).toBe(true);
  });

  it("true quand recovery est present parmi plusieurs methodes amr", () => {
    expect(isRecoverySession(MULTI_AMR_TOKEN)).toBe(true);
  });

  it("false pour une session password", () => {
    expect(isRecoverySession(PASSWORD_TOKEN)).toBe(false);
  });

  it("false quand le claim amr est absent", () => {
    expect(isRecoverySession(NO_AMR_TOKEN)).toBe(false);
  });

  it("false pour un token malforme", () => {
    expect(isRecoverySession("header.@@@.sig")).toBe(false);
  });

  it("false quand un segment manque", () => {
    expect(isRecoverySession("header.payload")).toBe(false);
  });

  it("false pour un token vide, null ou undefined", () => {
    expect(isRecoverySession("")).toBe(false);
    expect(isRecoverySession(null)).toBe(false);
    expect(isRecoverySession(undefined)).toBe(false);
  });
});
