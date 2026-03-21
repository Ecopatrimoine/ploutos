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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
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
      // Pas de session du tout → forcer l'écran de connexion
      // (grace uniquement si on avait une session récente qui a disparu pour cause réseau)
      // Si hasSession est false dès le départ, c'est que les tokens ont été purgés → reconnecter
      setAuthState("unauthenticated");
      return;
    }

    try {
      // Étape 1 : tenter un refreshSession silencieux d'abord
      // Cela renouvelle le JWT expiré si le refresh token est encore valide
      // et permet de passer directement en "authenticated" même si le JWT a expiré
      const { data: refreshData, error: refreshError } = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<{ data: { session: null; user: null }; error: { message: string } }>(
          (_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)
        )
      ]).catch(() => ({ data: { session: null, user: null }, error: { message: "timeout" } })) as any;

      if (!refreshError && refreshData?.user) {
        // Refresh OK → authentifié directement, pas besoin de getUser()
        const isActive = refreshData.user.user_metadata?.active !== false;
        if (!isActive) {
          setUser(null);
          setAuthState("expired");
          return;
        }
        markVerified();
        setSession(refreshData.session);
        setUser(refreshData.user);
        setAuthState("authenticated");
        return;
      }

      // Refresh échoué (token révoqué, réseau indispo…) → vérifier avec getUser()
      const isNetworkError = refreshError?.message === "timeout" ||
        refreshError?.message?.toLowerCase().includes("network") ||
        refreshError?.message?.toLowerCase().includes("fetch");

      if (isNetworkError) {
        // Pas de réseau → mode grace si session récente
        setUser(null);
        setAuthState(checkGracePeriod() ? "grace" : "expired");
        return;
      }

      // Token révoqué/invalide → purge et déconnexion
      const isInvalidToken =
        refreshError?.message?.includes("Invalid Refresh Token") ||
        refreshError?.message?.includes("Refresh Token Not Found") ||
        (refreshError as any)?.status === 400 || (refreshError as any)?.status === 401;

      if (isInvalidToken) {
        purgeSupabaseTokens();
        await supabase.auth.signOut({ scope: "local" });
        localStorage.removeItem(LAST_VERIFIED_KEY);
        setUser(null);
        setSession(null);
        setAuthState("unauthenticated");
        return;
      }

      // Autre cas → grace si session récente
      setUser(null);
      setAuthState(checkGracePeriod() ? "grace" : "expired");
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

      // PASSWORD_RECOVERY : l'utilisateur arrive depuis un lien de reset
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        return;
      }

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
    // Le trigger Supabase crée automatiquement une licence trial de 15 jours
    return true;
  }, []);

  // Utilitaire admin : attribuer une licence lifetime (à appeler manuellement)
  const grantLifetimeLicence = useCallback(async (targetUserId: string) => {
    const { error } = await supabase.from("licences").upsert({
      user_id: targetUserId,
      type: "lifetime",
      status: "active",
      trial_end: null,
    });
    return !error;
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
      redirectTo: window.location.origin,
    });
    if (error) { setError(error.message); return false; }
    return true;
  }, []);


  const updatePassword = useCallback(async (newPassword: string) => {
    setError("");
    try {
      // Vérifier que la session est bien active avant de mettre à jour
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        setError("Session expirée. Recommencez la procédure de réinitialisation.");
        return false;
      }
      // Timeout de 10s pour ne pas bloquer indéfiniment
      const updatePromise = supabase.auth.updateUser({ password: newPassword });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      );
      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;
      if (error) { setError(error.message === "timeout" ? "Délai dépassé. Réessayez." : error.message); return false; }
      setIsPasswordRecovery(false);
      return true;
    } catch (e) {
      setError("Erreur réseau. Vérifiez votre connexion.");
      return false;
    }
  }, []);

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);

  return { user, session, authState, error, signUp, signIn, signOut, resetPassword, updatePassword, grantLifetimeLicence, isPasswordRecovery, clearPasswordRecovery };
}
