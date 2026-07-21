// @vitest-environment jsdom
//
// Verrou session recovery (faille prod 21/07) — cycle reel de useAuth.
// Supabase mocke, aucun reseau. On pilote getSession / refreshSession /
// onAuthStateChange pour reproduire le boot, le F5 et la fin de reset.
//
// Cas couverts :
//   (i)   boot avec session persistee, token amr:recovery -> verrou (verite JWT)
//   (ii)  boot avec flag present mais token amr:password  -> verrou (filet)
//   (iii) updatePassword reussi -> flag efface + signOut appele
//   (iv)  login normal amr:password sans flag            -> jamais bloque
//   (v)   purge 400/401                                  -> flag nettoye
//   (vi)  evenement PASSWORD_RECOVERY                    -> flag pose + verrou

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const FLAG = "ploutos_pw_recovery";

// Forge un JWT dont seul le payload compte (base64url, signature factice).
function forgeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig-factice`;
}
const RECOVERY_TOKEN = forgeJwt({ sub: "u1", amr: [{ method: "recovery" }] });
const PASSWORD_TOKEN = forgeJwt({ sub: "u1", amr: [{ method: "password" }] });

// Flush : microtasks + deux macrotaches, dans act(), pour laisser la chaine
// getSession -> verifySession -> refreshSession -> setState se stabiliser.
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

// Capture le callback passe a onAuthStateChange pour pouvoir emettre des events.
let authCallback: ((event: string, session: unknown) => void) | null = null;

const { authMock } = vi.hoisted(() => ({
  authMock: {
    signUp: vi.fn(async () => ({ error: null })),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    refreshSession: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: null })) })),
  } as any,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: authMock, from: authMock.from },
  SUPABASE_FUNCTIONS_URL: "https://example.test/functions/v1",
}));

import { useAuth } from "../hooks/useAuth";

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = null;
  authMock.signUp.mockResolvedValue({ error: null });
  authMock.signInWithPassword.mockResolvedValue({ error: null });
  authMock.resetPasswordForEmail.mockResolvedValue({ error: null });
  authMock.updateUser.mockResolvedValue({ error: null });
  authMock.getSession.mockResolvedValue({ data: { session: null } });
  authMock.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
  authMock.signOut.mockResolvedValue({ error: null });
  authMock.from.mockReturnValue({ upsert: vi.fn(() => Promise.resolve({ error: null })) });
  authMock.onAuthStateChange.mockImplementation((cb: any) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe: () => {} } } };
  });
  localStorage.clear();
});

describe("useAuth — verrou session recovery", () => {
  it("(i) boot avec session persistee amr:recovery -> isPasswordRecovery vrai (app non atteinte)", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: RECOVERY_TOKEN } } });
    authMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: RECOVERY_TOKEN }, user: { id: "u1", user_metadata: {} } },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await settle();

    // Session valide MAIS marquee recovery : App.tsx garde l'ecran reset tant
    // que isPasswordRecovery est vrai -> l'app n'est jamais atteinte.
    expect(result.current.authState).toBe("authenticated");
    expect(result.current.isPasswordRecovery).toBe(true);
  });

  it("(ii) boot avec flag present mais token amr:password -> verrou tenu par le filet", async () => {
    localStorage.setItem(FLAG, "1"); // amr perdu au refresh, le filet prend le relais
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: PASSWORD_TOKEN } } });
    authMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: PASSWORD_TOKEN }, user: { id: "u1", user_metadata: {} } },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await settle();

    expect(result.current.authState).toBe("authenticated");
    expect(result.current.isPasswordRecovery).toBe(true);
  });

  it("(iii) updatePassword reussi -> flag efface + signOut appele", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: PASSWORD_TOKEN } } });
    authMock.updateUser.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());
    await settle();

    localStorage.setItem(FLAG, "1"); // flag pose (venu du PASSWORD_RECOVERY initial)
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updatePassword("nouveaupass12");
    });

    expect(ok).toBe(true);
    expect(authMock.updateUser).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(FLAG)).toBeNull();
    expect(authMock.signOut).toHaveBeenCalled();
    expect(result.current.isPasswordRecovery).toBe(false);
  });

  it("(iv) login normal amr:password sans flag -> jamais bloque", async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: PASSWORD_TOKEN } } });
    authMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: PASSWORD_TOKEN }, user: { id: "u1", user_metadata: {} } },
      error: null,
    });

    const { result } = renderHook(() => useAuth());
    await settle();

    expect(result.current.authState).toBe("authenticated");
    expect(result.current.isPasswordRecovery).toBe(false);
  });

  it("(v) purge 400/401 -> flag nettoye", async () => {
    localStorage.setItem(FLAG, "1");
    localStorage.setItem("sb-abc-auth-token", "{}"); // token persiste factice
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: PASSWORD_TOKEN } } });
    authMock.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 400, message: "Invalid Refresh Token" },
    });

    const { result } = renderHook(() => useAuth());
    await settle();

    expect(result.current.authState).toBe("unauthenticated");
    expect(localStorage.getItem(FLAG)).toBeNull();
    expect(localStorage.getItem("sb-abc-auth-token")).toBeNull();
    expect(authMock.signOut).toHaveBeenCalled();
  });

  it("(vi) evenement PASSWORD_RECOVERY -> flag pose + isPasswordRecovery vrai", async () => {
    const { result } = renderHook(() => useAuth());
    await settle();

    expect(typeof authCallback).toBe("function");
    act(() => {
      authCallback!("PASSWORD_RECOVERY", null);
    });

    expect(localStorage.getItem(FLAG)).toBe("1");
    expect(result.current.isPasswordRecovery).toBe(true);
  });
});
