// src/hooks/useLicense.ts
// ──────────────────────────────────────────────────────────────────────────────
// Hook de vérification de licence Vision EcoPat
// Types : trial (15j) | paid (Stripe) | lifetime (gratuit)
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type LicenceType   = "trial" | "paid" | "lifetime";
export type LicenceStatus = "active" | "expired" | "cancelled" | "cancelling" | "none";

export interface LicenceInfo {
  type:       LicenceType | null;
  status:     LicenceStatus;
  trialEnd:   Date | null;     // null sauf pour trial
  trialDaysLeft: number;       // 0 sauf pour trial actif
  isValid:    boolean;         // raccourci : peut utiliser l'app ?
  loading:    boolean;
}

const CACHE_KEY = "vep_licence_cache";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ── Cache local pour éviter les appels répétés ────────────────────────────────
function getCachedLicence(): LicenceInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCachedLicence(data: LicenceInfo) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

function clearLicenceCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useLicense(userId: string | null) {
  const [licence, setLicence] = useState<LicenceInfo>({
    type: null, status: "none", trialEnd: null,
    trialDaysLeft: 0, isValid: false, loading: true,
  });

  const fetchLicence = useCallback(async (force = false) => {
    if (!userId) {
      setLicence(prev => ({ ...prev, loading: false, isValid: false }));
      return;
    }

    // Cache
    if (!force) {
      const cached = getCachedLicence();
      if (cached) { setLicence(cached); return; }
    }

    try {
      const { data, error } = await supabase
        .from("licences")
        .select("type, status, trial_end")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        // Aucune ligne → créer un trial (cas migration anciens comptes)
        await supabase.from("licences").upsert({
          user_id: userId,
          type: "trial",
          status: "active",
          trial_end: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
        });
        return fetchLicence(true);
      }

      const trialEnd   = data.trial_end ? new Date(data.trial_end) : null;
      const now        = new Date();
      const msLeft     = trialEnd ? trialEnd.getTime() - now.getTime() : 0;
      const daysLeft   = trialEnd ? Math.max(0, Math.ceil(msLeft / 86400000)) : 0;

      // Un trial est actif seulement si la date n'est pas dépassée
      let effectiveStatus: LicenceStatus = data.status as LicenceStatus;
      if (data.type === "trial" && trialEnd && now > trialEnd) {
        effectiveStatus = "expired";
      }

      const info: LicenceInfo = {
        type:          data.type as LicenceType,
        status:        effectiveStatus,
        trialEnd,
        trialDaysLeft: data.type === "trial" ? daysLeft : 0,
        isValid:       effectiveStatus === "active",
        loading:       false,
      };

      setCachedLicence(info);
      setLicence(info);

    } catch {
      // Hors-ligne → on utilise le cache même périmé
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        try {
          const { data } = JSON.parse(raw);
          setLicence({ ...data, loading: false });
          return;
        } catch { /* ignore */ }
      }
      setLicence(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  useEffect(() => {
    clearLicenceCache();   // forcer un rafraîchissement à chaque mount
    fetchLicence(true);
  }, [fetchLicence]);

  return { licence, refreshLicence: () => fetchLicence(true) };
}
