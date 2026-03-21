// src/hooks/useAdmin.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAdmin(userEmail: string | null | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) { setLoading(false); return; }
    supabase.from("admins").select("email").eq("email", userEmail).single()
      .then(({ data }) => { setIsAdmin(!!data); setLoading(false); });
  }, [userEmail]);

  return { isAdmin, loading };
}

// ── Types pour le dashboard ───────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  cabinet_name: string;
  created_at: string;
  licence: {
    type: "trial" | "paid" | "lifetime" | null;
    status: "active" | "expired" | "cancelled" | "cancelling" | "none";
    trial_end: string | null;
    stripe_sub: string | null;
    cancel_at: string | null;
  } | null;
  // Détails Stripe (chargés en arrière-plan)
  subDetails?: {
    interval: "month" | "year";
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
}

export function useAdminDashboard(isAdmin: boolean) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      // Récupérer toutes les licences
      const { data: licences, error: lErr } = await supabase
        .from("licences")
        .select("user_id, type, status, trial_end, stripe_sub, cancel_at");
      if (lErr) throw lErr;

      const licenceMap = new Map(licences?.map(l => [l.user_id, l]) ?? []);

      // Récupérer les noms de cabinets via la vue users_info
      const { data: usersInfo } = await supabase
        .from("users_info")
        .select("user_id, email, cabinet_name, created_at");

      const userMap = new Map<string, { name: string; email: string; created_at: string }>();
      usersInfo?.forEach(u => {
        userMap.set(u.user_id, {
          name: u.cabinet_name || u.email || u.user_id.slice(0, 12) + "...",
          email: u.email || "",
          created_at: u.created_at || "",
        });
      });

      // Construire la liste finale
      const result: AdminUser[] = [];
      licenceMap.forEach((lic, userId) => {
        const info = userMap.get(userId);
        result.push({
          id: userId,
          email: info?.email || "",          // vrai email pour reset/contact
          cabinet_name: info?.name || info?.email || userId.slice(0, 12) + "...", // nom affiché
          created_at: info?.created_at || "",
          licence: { ...lic, cancel_at: lic.cancel_at ?? null },
        });
      });

      setUsers(result);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    }
    setLoading(false);
  }, [isAdmin]);

  // Actions admin
  const setLifetime = useCallback(async (userId: string) => {
    const { error } = await supabase.from("licences").upsert({
      user_id: userId, type: "lifetime", status: "active", trial_end: null,
    });
    if (!error) await fetchUsers();
    return !error;
  }, [fetchUsers]);

  const revokeLicence = useCallback(async (userId: string) => {
    const { error } = await supabase.from("licences")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (!error) await fetchUsers();
    return !error;
  }, [fetchUsers]);

  const extendTrial = useCallback(async (userId: string, days: number) => {
    const newEnd = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase.from("licences")
      .update({ type: "trial", status: "active", trial_end: newEnd })
      .eq("user_id", userId);
    if (!error) await fetchUsers();
    return !error;
  }, [fetchUsers]);

  const resetUserPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return !error;
  }, []);

  // Charger les détails Stripe pour les abonnés payants
  const loadSubDetails = useCallback(async (userList: AdminUser[]) => {
    const paidUsers = userList.filter(u => u.licence?.type === "paid" && u.licence?.stripe_sub);
    if (paidUsers.length === 0) return;
    try {
      const res = await fetch(
        "https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/get-sub-details",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripe_sub_ids: paidUsers.map(u => u.licence!.stripe_sub) }),
        }
      );
      const details = await res.json();
      setUsers(prev => prev.map(u =>
        u.licence?.stripe_sub && details[u.licence.stripe_sub]
          ? { ...u, subDetails: details[u.licence.stripe_sub] }
          : u
      ));
    } catch { /* non bloquant */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { if (users.length > 0) loadSubDetails(users); }, [users.length]); // eslint-disable-line

  return { users, loading, error, fetchUsers, setLifetime, revokeLicence, extendTrial, resetUserPassword };
}
