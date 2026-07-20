// @vitest-environment jsdom
//
// Turnstile / captcha — useAuth transmet le captchaToken aux 3 endpoints auth
// soumis au captcha (signUp, signInWithPassword, resetPasswordForEmail) et
// JAMAIS a updateUser (mode reset sans captcha, decision validee). Supabase
// mocke : aucun appel reseau reel.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Flush : microtasks + une macrotache, dans act(), pour laisser l'effet de
// montage de useAuth (getSession -> verifySession) se stabiliser.
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// vi.mock est hisse : le mock doit exister au moment du hoist -> vi.hoisted.
const { authMock } = vi.hoisted(() => ({
  authMock: {
    signUp: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    refreshSession: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
    signOut: vi.fn(async () => ({ error: null })),
  } as any,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: authMock },
  SUPABASE_FUNCTIONS_URL: "https://example.test/functions/v1",
}));

import { useAuth } from "../hooks/useAuth";

const TOKEN = "captcha-token-xyz";

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks efface l'historique mais garde les implementations ; on
  // reaffirme les defauts pour une isolation stricte quel que soit l'ordre.
  authMock.signUp.mockResolvedValue({ error: null });
  authMock.signInWithPassword.mockResolvedValue({ error: null });
  authMock.resetPasswordForEmail.mockResolvedValue({ error: null });
  authMock.updateUser.mockResolvedValue({ error: null });
  authMock.getSession.mockResolvedValue({ data: { session: null } });
  authMock.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
  authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } });
  localStorage.clear();
});

describe("useAuth — transmission du captchaToken", () => {
  it("signUp transmet le captchaToken dans options", async () => {
    const { result } = renderHook(() => useAuth());
    await settle();

    await act(async () => {
      await result.current.signUp("a@b.fr", "password12", "Cabinet X", TOKEN);
    });

    expect(authMock.signUp).toHaveBeenCalledTimes(1);
    const arg = authMock.signUp.mock.calls[0][0];
    expect(arg.options.captchaToken).toBe(TOKEN);
    // Non-regression : les metadonnees d'inscription restent presentes.
    expect(arg.options.data).toMatchObject({ cabinet_name: "Cabinet X", active: true });
  });

  it("signIn transmet le captchaToken dans options", async () => {
    const { result } = renderHook(() => useAuth());
    await settle();

    await act(async () => {
      await result.current.signIn("a@b.fr", "password12", TOKEN);
    });

    expect(authMock.signInWithPassword).toHaveBeenCalledTimes(1);
    const arg = authMock.signInWithPassword.mock.calls[0][0];
    expect(arg.email).toBe("a@b.fr");
    expect(arg.options.captchaToken).toBe(TOKEN);
  });

  it("resetPassword transmet le captchaToken et conserve redirectTo", async () => {
    const { result } = renderHook(() => useAuth());
    await settle();

    await act(async () => {
      await result.current.resetPassword("a@b.fr", TOKEN);
    });

    expect(authMock.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, opts] = authMock.resetPasswordForEmail.mock.calls[0];
    expect(email).toBe("a@b.fr");
    expect(opts.captchaToken).toBe(TOKEN);
    expect(opts.redirectTo).toBe(window.location.origin);
  });

  it("updatePassword n'envoie AUCUN captchaToken a updateUser", async () => {
    // Session active requise pour que updatePassword atteigne updateUser.
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    const { result } = renderHook(() => useAuth());
    await settle();

    await act(async () => {
      await result.current.updatePassword("nouveaupass12");
    });

    expect(authMock.updateUser).toHaveBeenCalledTimes(1);
    const arg = authMock.updateUser.mock.calls[0][0];
    expect(arg).toEqual({ password: "nouveaupass12" });
    expect(arg).not.toHaveProperty("captchaToken");
  });
});
