// src/components/LicenceBanner.tsx
import React, { useState } from "react";
import { AlertTriangle, Settings, ArrowRight, Sparkles } from "lucide-react";
import type { LicenceInfo } from "../hooks/useLicense";
import { supabase, SUPABASE_FUNCTIONS_URL } from "../lib/supabase";

interface LicenceBannerProps {
  licence:   LicenceInfo;
  colorGold: string;
  colorNavy: string;
}

async function openStripePortal() {
  // L'utilisateur est identifié côté fonction via le JWT ; on n'envoie plus de
  // user_id (anti-IDOR, cf. L2). Sans session valide, on n'appelle pas.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) { console.error("Portail Stripe : session absente"); return; }

  const res = await fetch(
    `${SUPABASE_FUNCTIONS_URL}/create-portal-session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ return_url: window.location.origin }),
    }
  );
  const data = await res.json();
  if (data.url) window.open(data.url, "_blank");
  else console.error("Portail Stripe indisponible:", data.error);
}

export function LicenceBanner({ licence, colorGold, colorNavy }: LicenceBannerProps) {
  const [loading, setLoading] = useState(false);

  const handlePortal = async () => {
    setLoading(true);
    await openStripePortal();
    setLoading(false);
  };

  // Trial actif
  if (licence.type === "trial" && licence.status === "active") {
    const days = licence.trialDaysLeft;
    const urgency = days <= 3;
    return (
      <div className="w-full text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-3"
        style={{
          background: urgency ? "#FEF2F2" : `rgba(227,175,100,0.12)`,
          color: urgency ? "#991B1B" : colorNavy,
          borderBottom: `1px solid ${urgency ? "#FCA5A5" : "rgba(227,175,100,0.3)"}`,
        }}>
        <span className="inline-flex items-center gap-1.5">
          {urgency
            ? <><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> Essai gratuit — {days} jour{days > 1 ? "s" : ""} restant{days > 1 ? "s" : ""}</>
            : <><Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" /> Essai gratuit — {days} jours restants</>}
        </span>
        {urgency && (
          <a href="https://app.ploutos-cgp.fr" className="underline font-bold inline-flex items-center gap-1">
            S'abonner <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  // Abonnement payant actif — bouton discret "Gérer"
  if (licence.type === "paid" && licence.status === "active") {
    return (
      <div className="w-full text-center py-1 px-4 text-xs flex items-center justify-end gap-2"
        style={{ background: "rgba(16,27,59,0.04)", borderBottom: "1px solid rgba(16,27,59,0.08)" }}>
        <button
          onClick={handlePortal}
          disabled={loading}
          className="text-xs font-medium hover:underline disabled:opacity-50 transition-opacity"
          style={{ color: colorNavy }}
        >
          {loading ? "Chargement…" : <span className="inline-flex items-center gap-1.5"><Settings className="h-4 w-4" aria-hidden="true" /> Gérer mon abonnement</span>}
        </button>
      </div>
    );
  }

  // Annulation planifiée — avertissement + bouton réactiver
  if (licence.status === "cancelling") {
    return (
      <div className="w-full text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-3"
        style={{ background: "#FEF3C7", color: "#92400E", borderBottom: "1px solid #FCD34D" }}>
        <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> Abonnement annulé — accès maintenu jusqu'à la fin de la période</span>
        <button
          onClick={handlePortal}
          disabled={loading}
          className="underline font-bold disabled:opacity-50"
        >
          {loading ? "…" : "Réactiver"}
        </button>
      </div>
    );
  }

  return null;
}
