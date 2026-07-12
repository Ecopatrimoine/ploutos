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
  cancelAt:   Date | null;     // échéance de résiliation (status "cancelling"), sinon null
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

// ── Validité d'accès (logique pure, testable) ─────────────────────────────────
// 'active' → valide. 'cancelling' → accès MAINTENU tant que cancel_at n'est pas
// atteint (client payant en résiliation programmée) ; sans cancel_at on reste
// favorable au client (le webhook subscription.deleted posera 'cancelled' le
// moment venu). Tout autre statut → invalide.
export function computeIsValid(
  status: LicenceStatus,
  cancelAt: Date | null,
  now: Date,
): boolean {
  if (status === "active") return true;
  if (status === "cancelling") return !cancelAt || now < cancelAt;
  return false;
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useLicense(userId: string | null) {
  const [licence, setLicence] = useState<LicenceInfo>({
    type: null, status: "none", trialEnd: null,
    trialDaysLeft: 0, cancelAt: null, isValid: false, loading: true,
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

    // Licence considérée absente : aucun accès, LicenceGate s'affiche (avec le
    // bouton « Contacter le support »). Fail-closed, aucune écriture cliente.
    const absente: LicenceInfo = {
      type: null, status: "none", trialEnd: null,
      trialDaysLeft: 0, cancelAt: null, isValid: false, loading: false,
    };

    try {
      const { data, error } = await supabase
        .from("licences")
        .select("type, status, trial_end, cancel_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // Erreur de lecture (réseau, RLS…) : ne PAS conclure à une absence de
        // licence (ne pas verrouiller un abonné payant sur un incident). On
        // conserve un cache valide s'il existe ; sinon fail-closed sans écriture.
        const cached = getCachedLicence();
        setLicence(cached ? { ...cached, loading: false } : absente);
        return;
      }

      if (!data) {
        // Aucune ligne licences. Le trigger Supabase la crée normalement à
        // l'inscription ; une absence est donc une anomalie (compte legacy ou
        // trigger en échec). On NE crée plus de trial côté client (policy RLS
        // d'écriture retirée le 2026-07-10) : licence absente → LicenceGate.
        // Non mis en cache : chaque refresh re-interroge pour capter une ligne
        // créée entre-temps.
        setLicence(absente);
        return;
      }

      const trialEnd   = data.trial_end ? new Date(data.trial_end) : null;
      const cancelAt   = data.cancel_at ? new Date(data.cancel_at) : null;
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
        cancelAt,
        isValid:       computeIsValid(effectiveStatus, cancelAt, now),
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
