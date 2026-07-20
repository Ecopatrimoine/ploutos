// @vitest-environment jsdom
//
// Validation email au signup (EF validate-signup-email + gate AuthGate).
// fetch mocke : aucun appel reseau reel. On verifie le contrat FAIL-OPEN et le
// cablage cote AuthGate :
//   - allowed true            -> signUp appele
//   - allowed false           -> signUp PAS appele + message affiche
//   - EF en erreur/timeout     -> signUp appele (FAIL-OPEN)
//   - login / forgot           -> l'EF n'est JAMAIS appelee
//
// AuthGate importe @/lib/supabase (throw si .env absent) et le module Turnstile
// (chargement d'un <script> distant impossible en jsdom) : les deux sont mockes.
// signupValidation.ts n'est PAS mocke (comportement reel pilote par fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

// Neutralise le throw de @/lib/supabase (env absent) et fixe une base EF connue.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
  SUPABASE_FUNCTIONS_URL: "https://example.test/functions/v1",
}));

// Turnstile : script distant non chargeable en jsdom. On simule un widget qui
// livre immediatement un token (sinon le bouton submit reste desactive).
vi.mock("../lib/turnstile", () => ({
  getTurnstileSiteKey: () => "test-site-key",
  loadTurnstileScript: () => Promise.resolve(),
}));

import { AuthGate } from "../components/AuthGate";

const EF_URL = "https://example.test/functions/v1/validate-signup-email";

// Flush : microtasks + une macrotache, dans act() (laisse l'effet Turnstile
// poser le captchaToken -> le bouton submit s'active).
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function makeAuthHook(): any {
  return {
    user: null,
    session: null,
    authState: "unauthenticated",
    error: "",
    signUp: vi.fn(async () => true),
    signIn: vi.fn(async () => true),
    signOut: vi.fn(async () => {}),
    resetPassword: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
  };
}

function renderGate(authHook: any) {
  return render(
    React.createElement(AuthGate, {
      authHook,
      logoSrc: "logo.svg",
      colorNavy: "#101B3B",
      colorGold: "#E3AF64",
      colorSky: "#26428B",
      colorCream: "#FBECD7",
    }),
  );
}

function efWasCalled(): boolean {
  return fetchMock.mock.calls.some((c) => String(c[0]).includes("validate-signup-email"));
}

beforeEach(() => {
  // Defaut : EF autorise (allowed true).
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ allowed: true }) }));
  vi.stubGlobal("fetch", fetchMock);
  (window as any).turnstile = {
    render: (_el: unknown, opts: any) => { opts.callback?.("captcha-tok"); return "widget-1"; },
    reset: vi.fn(),
    remove: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as any).turnstile;
});

// Passe en mode inscription et remplit un formulaire valide (token deja pose).
async function goToRegisterAndFill(email: string) {
  fireEvent.click(screen.getByText("Pas encore de compte ? S'inscrire"));
  fireEvent.change(screen.getByPlaceholderText("Ex : Dupont Patrimoine"), { target: { value: "Cabinet Test" } });
  fireEvent.change(screen.getByPlaceholderText("votre@email.com"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("8 caractères minimum"), { target: { value: "password123" } });
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
}

describe("validation email au signup — cablage AuthGate (register)", () => {
  it("allowed true : l'EF est appelee (POST, sans Authorization) puis signUp", async () => {
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle(); // token Turnstile pose

    await goToRegisterAndFill("user@good.com");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    });
    await settle();

    // EF appelee avec la bonne URL, en POST, appel NU (aucun header Authorization).
    expect(efWasCalled()).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(EF_URL);
    expect(opts.method).toBe("POST");
    expect(opts.headers?.Authorization).toBeUndefined();
    expect(opts.headers?.["Content-Type"]).toBe("application/json");

    // signUp appele avec le token captcha courant.
    expect(authHook.signUp).toHaveBeenCalledTimes(1);
    expect(authHook.signUp).toHaveBeenCalledWith("user@good.com", "password123", "Cabinet Test", "captcha-tok");
  });

  it("allowed false : signUp N'est PAS appele et un message est affiche", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ allowed: false, reason: "blocked_domain" }) });
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle();

    await goToRegisterAndFill("jetable@yopmail.com");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    });
    await settle();

    expect(efWasCalled()).toBe(true);
    expect(authHook.signUp).not.toHaveBeenCalled();
    expect(screen.getByText(/adresse email semble invalide ou jetable/i)).toBeInTheDocument();
  });

  it("EF en erreur reseau : FAIL-OPEN, signUp est appele", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle();

    await goToRegisterAndFill("user@erreur.com");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    });
    await settle();

    expect(efWasCalled()).toBe(true);
    expect(authHook.signUp).toHaveBeenCalledTimes(1);
  });

  it("EF non-2xx (401) : FAIL-OPEN, signUp est appele", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle();

    await goToRegisterAndFill("user@flag-oublie.com");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    });
    await settle();

    expect(efWasCalled()).toBe(true);
    expect(authHook.signUp).toHaveBeenCalledTimes(1);
  });
});

describe("validation email au signup — login / forgot n'appellent jamais l'EF", () => {
  it("login : signIn appele, l'EF n'est jamais appelee", async () => {
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle();

    fireEvent.change(screen.getByPlaceholderText("votre@email.com"), { target: { value: "user@good.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    });
    await settle();

    expect(authHook.signIn).toHaveBeenCalledTimes(1);
    expect(efWasCalled()).toBe(false);
  });

  it("forgot : resetPassword appele, l'EF n'est jamais appelee", async () => {
    const authHook = makeAuthHook();
    renderGate(authHook);
    await settle();

    fireEvent.click(screen.getByText("Mot de passe oublié ?"));
    fireEvent.change(screen.getByPlaceholderText("votre@email.com"), { target: { value: "user@good.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
    });
    await settle();

    expect(authHook.resetPassword).toHaveBeenCalledTimes(1);
    expect(efWasCalled()).toBe(false);
  });
});
