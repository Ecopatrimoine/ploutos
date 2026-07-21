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

// Correctif 21/07 : le verrou doit etre synchrone des le rendu 0 (init
// paresseuse), tenir pendant l'enchainement reel TOKEN_REFRESHED + verifySession,
// et etre leve par une connexion mot de passe reussie (flag orphelin).
describe("useAuth — verrou synchrone au boot (correctif 21/07)", () => {
  it("(a) flag pose : le rendu 0 est deja verrouille (lecture immediate, sans settle)", async () => {
    localStorage.setItem(FLAG, "1");
    authMock.getSession.mockResolvedValue({ data: { session: null } });

    // Lecture AVANT toute macrotache : l'init paresseuse doit deja avoir verrouille.
    const { result } = renderHook(() => useAuth());
    expect(result.current.isPasswordRecovery).toBe(true);
    await settle(); // flush l'effet de montage (getSession) dans act, sans bruit
  });

  it("(b) enchainement reel : refreshSession emet TOKEN_REFRESHED puis resout, jamais deverrouille", async () => {
    localStorage.setItem(FLAG, "1");
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: PASSWORD_TOKEN } } });
    // gotrue emet TOKEN_REFRESHED PENDANT refreshSession, avant de resoudre : ce
    // handler pose authState=authenticated SANS lire le flag. Puis la continuation
    // de verifySession s'execute. Le verrou (init paresseuse) ne doit jamais ceder.
    authMock.refreshSession.mockImplementation(async () => {
      authCallback?.("TOKEN_REFRESHED", { access_token: PASSWORD_TOKEN, user: { id: "u1", user_metadata: {} } });
      return {
        data: { session: { access_token: PASSWORD_TOKEN }, user: { id: "u1", user_metadata: {} } },
        error: null,
      };
    });

    const seen: boolean[] = [];
    function useProbe() {
      const a = useAuth();
      seen.push(a.isPasswordRecovery);
      return a;
    }
    const { result } = renderHook(() => useProbe());
    expect(seen[0]).toBe(true); // rendu 0 deja verrouille (init paresseuse)
    await settle();

    expect(result.current.authState).toBe("authenticated");
    expect(result.current.isPasswordRecovery).toBe(true);
    // Invariant cle : aucun rendu intermediaire deverrouille (la fenetre que la
    // faille reelle exploitait via TOKEN_REFRESHED).
    expect(seen.every((v) => v === true)).toBe(true);
  });

  it("(c) signIn succes : flag efface et verrou leve", async () => {
    localStorage.setItem(FLAG, "1");
    authMock.getSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());
    await settle();
    expect(result.current.isPasswordRecovery).toBe(true); // verrouille au boot

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.signIn("a@b.fr", "password12");
    });

    expect(ok).toBe(true);
    expect(authMock.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(FLAG)).toBeNull();
    expect(result.current.isPasswordRecovery).toBe(false);
  });

  it("(d) flag orphelin + login normal : l'utilisateur n'est PAS enferme", async () => {
    // Flag laisse par un lien de reset abandonne sans signOut ; l'utilisateur
    // revient et se connecte normalement -> il doit pouvoir entrer.
    localStorage.setItem(FLAG, "1");
    authMock.getSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());
    await settle();
    expect(result.current.isPasswordRecovery).toBe(true); // verrouille tant qu'aucune preuve

    await act(async () => {
      await result.current.signIn("a@b.fr", "password12");
    });

    // Preuve apportee : le verrou tombe et le flag orphelin est nettoye.
    expect(result.current.isPasswordRecovery).toBe(false);
    expect(localStorage.getItem(FLAG)).toBeNull();
  });
});

// Micro-lot : fin de reset sans fenetre de transition. updatePassword doit
// DECONNECTER avant de lever l'etat recovery ; sinon un rendu authenticated &&
// !isPasswordRecovery arme le latch de transition d'App.tsx puis la session
// meurt dessous (symptome prod : bloque sur "chargement du profil").
describe("useAuth — fin de reset : invariant de transition (micro-lot)", () => {
  it("updatePassword -> signOut : aucun rendu authenticated && !isPasswordRecovery", async () => {
    localStorage.setItem(FLAG, "1");
    authMock.getSession.mockResolvedValue({ data: { session: { access_token: RECOVERY_TOKEN } } });
    authMock.refreshSession.mockResolvedValue({
      data: { session: { access_token: RECOVERY_TOKEN }, user: { id: "u1", user_metadata: {} } },
      error: null,
    });
    authMock.updateUser.mockResolvedValue({ error: null });
    // signOut TENU en attente (deferred) : on garde la session "en cours de
    // fermeture" pour observer l'etat pendant que la session reelle n'est pas
    // encore morte -- exactement la fenetre que la latence reseau ouvre en prod
    // et que act() masquerait avec un mock qui resout tout de suite.
    let resolveSignOut: ((v: unknown) => void) | null = null;
    authMock.signOut.mockImplementation(() => new Promise((r) => { resolveSignOut = r; }));

    const seen: Array<{ auth: string; rec: boolean }> = [];
    function useProbe() {
      const a = useAuth();
      seen.push({ auth: a.authState, rec: a.isPasswordRecovery });
      return a;
    }
    const { result } = renderHook(() => useProbe());
    await settle();
    // Depart : session recovery active et verrouillee.
    expect(result.current.authState).toBe("authenticated");
    expect(result.current.isPasswordRecovery).toBe(true);

    seen.length = 0; // on ne surveille que la sequence updatePassword -> signOut
    let updatePromise: Promise<boolean> | undefined;
    await act(async () => {
      updatePromise = result.current.updatePassword("nouveaupass12");
      // Flush des microtaches : React committe les updates deja posees ALORS que
      // signOut est encore en attente (session pas encore fermee).
      await Promise.resolve();
      await Promise.resolve();
    });

    // signOut appele, session pas encore fermee : c'est ICI que la faille se
    // manifeste si setIsPasswordRecovery(false) precede la deconnexion.
    expect(authMock.signOut).toHaveBeenCalled();
    const faille = seen.filter((s) => s.auth === "authenticated" && s.rec === false);
    expect(faille).toEqual([]);

    // On termine la deconnexion.
    let ok: boolean | undefined;
    await act(async () => {
      resolveSignOut?.({ error: null });
      ok = await updatePromise;
    });
    expect(ok).toBe(true);
    // Fin de sequence : deconnecte, verrou leve.
    expect(result.current.authState).toBe("unauthenticated");
    expect(result.current.isPasswordRecovery).toBe(false);
  });
});
