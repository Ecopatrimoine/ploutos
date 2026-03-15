import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const LAST_VERIFIED_KEY = "ecopatrimoine_last_verified";
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 heures

export type AuthState =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "grace"
  | "expired";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [error, setError] = useState<string>("");
  // Éviter le double appel verifySession (getSession + onAuthStateChange INITIAL_SESSION)
  const initializedRef = useRef(false);

  const checkGracePeriod = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(LAST_VERIFIED_KEY);
      if (!raw) return false;
      return Date.now() - parseInt(raw, 10) < GRACE_PERIOD_MS;
    } catch { return false; }
  }, []);

  const markVerified = useCallback(() => {
    localStorage.setItem(LAST_VERIFIED_KEY, Date.now().toString());
  }, []);

  // Purge complète du token Supabase dans le localStorage
  const purgeSupabaseTokens = useCallback(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, []);

  const verifySession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setUser(null);
      setAuthState(checkGracePeriod() ? "grace" : "unauthenticated");
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser();

      // Refresh token invalide ou introuvable → purge + déconnexion propre
      if (error) {
        const isInvalidToken =
          error.message?.includes("Invalid Refresh Token") ||
          error.message?.includes("Refresh Token Not Found") ||
          error.message?.includes("token is expired") ||
          error.status === 400 || error.status === 401;

        if (isInvalidToken) {
          purgeSupabaseTokens();
          await supabase.auth.signOut({ scope: "local" }); // local : pas d'appel réseau si token mort
          localStorage.removeItem(LAST_VERIFIED_KEY);
          setUser(null);
          setSession(null);
          setAuthState("unauthenticated");
          return;
        }

        // Autre erreur (ex: réseau) → grace period
        setUser(null);
        setAuthState(checkGracePeriod() ? "grace" : "expired");
        return;
      }

      if (!data.user) {
        setUser(null);
        setAuthState(checkGracePeriod() ? "grace" : "expired");
        return;
      }

      const isActive = data.user.user_metadata?.active !== false;
      if (!isActive) {
        setUser(null);
        setAuthState("expired");
        return;
      }

      markVerified();
      setUser(data.user);
      setAuthState("authenticated");
    } catch {
      // Hors-ligne ou erreur réseau → grace period sans purge
      setAuthState(checkGracePeriod() ? "grace" : "expired");
    }
  }, [checkGracePeriod, markVerified, purgeSupabaseTokens]);

  useEffect(() => {
    // Première initialisation via getSession
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      initializedRef.current = true;
      verifySession(session);
    });

    // onAuthStateChange — ignorer INITIAL_SESSION (déjà géré par getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION est géré par getSession ci-dessus
      if (event === "INITIAL_SESSION") return;

      // TOKEN_REFRESHED : mettre à jour la session silencieusement sans re-vérifier
      if (event === "TOKEN_REFRESHED" && session) {
        setSession(session);
        setUser(session.user);
        setAuthState("authenticated");
        return;
      }

      // SIGNED_OUT explicite (autre onglet, révocation…)
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setAuthState("unauthenticated");
        return;
      }

      setSession(session);
      verifySession(session);
    });

    return () => subscription.unsubscribe();
  }, [verifySession]);

  const signUp = useCallback(async (email: string, password: string, cabinetName: string) => {
    setError("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { cabinet_name: cabinetName, active: true } },
    });
    if (error) { setError(error.message); return false; }
    return true;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect." : error.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LAST_VERIFIED_KEY);
    setUser(null);
    setSession(null);
    setAuthState("unauthenticated");
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); return false; }
    return true;
  }, []);

  return { user, session, authState, error, signUp, signIn, signOut, resetPassword };
}
