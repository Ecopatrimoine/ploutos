import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const LAST_VERIFIED_KEY = "ecopatrimoine_last_verified";
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 heures

export type AuthState =
  | "loading"        // vérification en cours
  | "unauthenticated" // pas connecté
  | "authenticated"  // connecté + vérifié
  | "grace"          // hors-ligne mais dans les 72h
  | "expired";       // licence expirée ou révoquée

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [error, setError] = useState<string>("");

  // ── Vérification 72h hors-ligne ──
  const checkGracePeriod = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(LAST_VERIFIED_KEY);
      if (!raw) return false;
      const lastVerified = parseInt(raw, 10);
      return Date.now() - lastVerified < GRACE_PERIOD_MS;
    } catch {
      return false;
    }
  }, []);

  const markVerified = useCallback(() => {
    localStorage.setItem(LAST_VERIFIED_KEY, Date.now().toString());
  }, []);

  // ── Vérification de la session ──
  const verifySession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      // Pas de session — vérifier période de grâce
      if (checkGracePeriod()) {
        setAuthState("grace");
      } else {
        setAuthState("unauthenticated");
      }
      return;
    }

    try {
      // Vérifier que la session est toujours valide sur Supabase
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (checkGracePeriod()) {
          setAuthState("grace");
        } else {
          setAuthState("expired");
        }
        return;
      }

      // Vérifier si le compte est actif (champ custom dans user_metadata ou table profiles)
      const isActive = data.user.user_metadata?.active !== false;
      if (!isActive) {
        setAuthState("expired");
        return;
      }

      markVerified();
      setUser(data.user);
      setAuthState("authenticated");
    } catch {
      // Hors-ligne
      if (checkGracePeriod()) {
        setAuthState("grace");
      } else {
        setAuthState("expired");
      }
    }
  }, [checkGracePeriod, markVerified]);

  // ── Init : écouter les changements de session ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      verifySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      verifySession(session);
    });

    return () => subscription.unsubscribe();
  }, [verifySession]);

  // ── Inscription ──
  const signUp = useCallback(async (email: string, password: string, cabinetName: string) => {
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { cabinet_name: cabinetName, active: true },
      },
    });
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  }, []);

  // ── Connexion ──
  const signIn = useCallback(async (email: string, password: string) => {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message
      );
      return false;
    }
    return true;
  }, []);

  // ── Déconnexion ──
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LAST_VERIFIED_KEY);
    setUser(null);
    setSession(null);
    setAuthState("unauthenticated");
  }, []);

  // ── Mot de passe oublié ──
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
