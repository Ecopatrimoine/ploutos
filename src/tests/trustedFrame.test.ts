// Durcissement IPC Electron : isTrustedFrameUrl (module pur electron/trustedFrame.cjs).
// String-in / bool-out, aucune dependance electron -> testable en isolation.
//
// Allowlist : meme origine qu'APP_URL ; localhost:5173 UNIQUEMENT si isDev.
// Tout le reste (https tierce, file://, url absente/malformee) -> non fiable.

import { describe, it, expect } from "vitest";
import { isTrustedFrameUrl } from "../../electron/trustedFrame.cjs";

const APP_URL = "https://app.ploutos-cgp.fr";

describe("isTrustedFrameUrl — allowlist des frames IPC", () => {
  it("origine app exacte -> fiable", () => {
    expect(isTrustedFrameUrl(APP_URL, { appUrl: APP_URL, isDev: false })).toBe(true);
    expect(isTrustedFrameUrl(APP_URL + "/", { appUrl: APP_URL, isDev: false })).toBe(true);
  });

  it("sous-chemin de l'app -> fiable (l'origine seule compte)", () => {
    expect(
      isTrustedFrameUrl("https://app.ploutos-cgp.fr/dossiers/123?tab=ir", { appUrl: APP_URL, isDev: false }),
    ).toBe(true);
  });

  it("localhost:5173 -> fiable en DEV, rejete en PROD", () => {
    expect(isTrustedFrameUrl("http://localhost:5173/", { appUrl: APP_URL, isDev: true })).toBe(true);
    expect(isTrustedFrameUrl("http://localhost:5173/x", { appUrl: APP_URL, isDev: true })).toBe(true);
    expect(isTrustedFrameUrl("http://localhost:5173/", { appUrl: APP_URL, isDev: false })).toBe(false);
  });

  it("https tierce -> rejetee (meme en dev)", () => {
    expect(isTrustedFrameUrl("https://evil.example.com", { appUrl: APP_URL, isDev: false })).toBe(false);
    expect(isTrustedFrameUrl("https://evil.example.com", { appUrl: APP_URL, isDev: true })).toBe(false);
    // Meme hote mais schema/port different -> origine differente -> rejete.
    expect(isTrustedFrameUrl("http://app.ploutos-cgp.fr", { appUrl: APP_URL, isDev: false })).toBe(false);
  });

  it("file:// -> rejete (pas d'exception offline dans l'allowlist)", () => {
    expect(
      isTrustedFrameUrl("file:///C:/Users/x/AppData/offline.html", { appUrl: APP_URL, isDev: false }),
    ).toBe(false);
  });

  it("url absente ou malformee -> rejete (try/catch new URL)", () => {
    expect(isTrustedFrameUrl("", { appUrl: APP_URL, isDev: false })).toBe(false);
    expect(isTrustedFrameUrl("pas une url", { appUrl: APP_URL, isDev: false })).toBe(false);
    expect(isTrustedFrameUrl(undefined as unknown as string, { appUrl: APP_URL, isDev: false })).toBe(false);
  });
});
