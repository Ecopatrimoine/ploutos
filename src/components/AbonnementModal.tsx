// src/components/AbonnementModal.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Modal « Abonnement » — accessible en permanence depuis l'accueil, quel que soit
// l'état de la licence. Consommateur PUR de l'existant :
//   • identité : email de session + nom du cabinet (lecture seule) ;
//   • statut   : dérivé de useLicense via mapLicenceToModal (lib/abonnement) ;
//   • actions  : Payment Links (essai / expiré) | portail Stripe (payant) | rien
//                (licence à vie).
// Le portail est appelé avec le JWT de session (anti-IDOR, même pattern que
// LicenceBanner post-lot S). États de chargement et d'erreur explicites : jamais
// de bouton mort.
// ──────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  CreditCard, Mail, Building2, ExternalLink, Settings,
  Clock, Crown, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase, SUPABASE_FUNCTIONS_URL } from "@/lib/supabase";
import { BRAND, SURFACE } from "@/constants";
import type { LicenceInfo } from "@/hooks/useLicense";
import {
  mapLicenceToModal,
  buildStripeCheckoutUrl,
  STRIPE_SOLO_URL,
  STRIPE_ANNUEL_URL,
  type AbonnementStatusKind,
} from "@/lib/abonnement";

interface AbonnementModalProps {
  open: boolean;
  onClose: () => void;
  licence: LicenceInfo;
  userEmail: string;
  cabinetName: string;
  userId: string;
  colorNavy?: string;
  colorGold?: string;
}

// Palette du bandeau de statut selon le type d'état (tokens BRAND — validés WCAG).
function statusPalette(kind: AbonnementStatusKind): { bg: string; border: string; fg: string } {
  switch (kind) {
    case "paid":
      return { bg: BRAND.successBg, border: BRAND.successBorder, fg: BRAND.success };
    case "cancelling":
      return { bg: BRAND.warningBg, border: BRAND.warningBorder, fg: BRAND.warning };
    case "inactive":
      return { bg: BRAND.dangerBg, border: BRAND.dangerBorder, fg: BRAND.danger };
    case "trial":
    case "lifetime":
    default:
      return { bg: "rgba(196,151,61,0.10)", border: "rgba(196,151,61,0.35)", fg: BRAND.goldText };
  }
}

function StatusIcon({ kind }: { kind: AbonnementStatusKind }) {
  const common = { size: 18, "aria-hidden": true } as const;
  switch (kind) {
    case "paid":       return <CheckCircle2 {...common} />;
    case "cancelling": return <AlertTriangle {...common} />;
    case "inactive":   return <AlertTriangle {...common} />;
    case "lifetime":   return <Crown {...common} />;
    case "trial":
    default:           return <Clock {...common} />;
  }
}

export default function AbonnementModal({
  open,
  onClose,
  licence,
  userEmail,
  cabinetName,
  userId,
  colorNavy = BRAND.navy,
  colorGold = BRAND.gold,
}: AbonnementModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = mapLicenceToModal(licence);
  const palette = statusPalette(view.statusKind);

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onClose();
  };

  // Ouvre un Payment Link Stripe, utilisateur rattaché (client_reference_id).
  const openPaymentLink = (baseUrl: string) => {
    window.open(buildStripeCheckoutUrl(baseUrl, userId), "_blank");
  };

  // Ouvre le portail Stripe. Erreur → message clair, bouton réactivé (jamais mort).
  const openPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Votre session a expiré. Reconnectez-vous puis réessayez.");
        return;
      }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ return_url: window.location.origin }),
      });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (res.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        console.error("Portail Stripe indisponible:", data.error ?? res.status);
        setError("Le portail de gestion est momentanément indisponible. Réessayez dans un instant ou contactez le support.");
      }
    } catch (e) {
      console.error("Portail Stripe — échec réseau:", e);
      setError("Connexion impossible. Vérifiez votre accès internet puis réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%", height: 44, borderRadius: 12, border: "none", cursor: "pointer",
    fontSize: 14, fontWeight: 600, color: "#fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: `linear-gradient(135deg, ${colorNavy} 0%, ${BRAND.sky} 100%)`,
  };
  const goldBtn: React.CSSProperties = {
    ...primaryBtn,
    background: `linear-gradient(135deg, ${colorGold} 0%, #c49040 100%)`,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        aria-describedby="abonnement-desc"
        className="max-w-md rounded-2xl"
        style={{ background: SURFACE.card, border: `1.5px solid ${colorGold}`, padding: 28 }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: colorNavy, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={20} aria-hidden="true" /> Abonnement
          </DialogTitle>
        </DialogHeader>
        <p id="abonnement-desc" style={{ fontSize: 12, color: BRAND.muted, margin: 0 }}>
          Consultez l'état de votre licence Ploutos et gérez votre abonnement.
        </p>

        {/* ── Identité (lecture seule) ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 10,
            background: SURFACE.cardSoft, border: `1px solid ${SURFACE.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Mail size={16} aria-hidden="true" style={{ color: BRAND.muted, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: BRAND.muted, width: 64, flexShrink: 0 }}>Compte</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: colorNavy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail || undefined}>
              {userEmail || "—"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Building2 size={16} aria-hidden="true" style={{ color: BRAND.muted, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: BRAND.muted, width: 64, flexShrink: 0 }}>Cabinet</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: colorNavy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cabinetName || undefined}>
              {cabinetName || "—"}
            </span>
          </div>
        </div>

        {/* ── Statut ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            background: palette.bg, border: `1px solid ${palette.border}`,
            borderRadius: 12, padding: "14px 16px", color: palette.fg,
          }}
        >
          <span style={{ marginTop: 1, flexShrink: 0 }}><StatusIcon kind={view.statusKind} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{view.statusTitle}</div>
            {view.statusLines.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, opacity: 0.95 }}>{line}</div>
            ))}
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        {view.action === "payment-links" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" style={goldBtn} onClick={() => openPaymentLink(STRIPE_SOLO_URL)}>
              <ExternalLink size={16} aria-hidden="true" /> Plan Solo — 50 €/mois
            </button>
            <button type="button" style={primaryBtn} onClick={() => openPaymentLink(STRIPE_ANNUEL_URL)}>
              <ExternalLink size={16} aria-hidden="true" /> Plan Annuel — 500 €/an (2 mois offerts)
            </button>
            <p style={{ fontSize: 11, color: BRAND.muted, textAlign: "center", margin: 0 }}>
              Paiement sécurisé par Stripe · Résiliation à tout moment
            </p>
          </div>
        )}

        {view.action === "portal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer" }}
              onClick={openPortal}
              disabled={loading}
            >
              {loading
                ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Ouverture du portail…</>
                : <><Settings size={16} aria-hidden="true" /> Gérer mon abonnement</>}
            </button>
            {error && (
              <div
                role="alert"
                style={{
                  fontSize: 12.5, fontWeight: 500, color: BRAND.danger,
                  background: BRAND.dangerBg, border: `1px solid ${BRAND.dangerBorder}`,
                  borderRadius: 10, padding: "10px 12px",
                }}
              >
                {error}
              </div>
            )}
            <p style={{ fontSize: 11, color: BRAND.muted, textAlign: "center", margin: 0 }}>
              Facturation, moyen de paiement et résiliation via le portail Stripe.
            </p>
          </div>
        )}

        {view.action === "none" && (
          <p style={{ fontSize: 12.5, color: BRAND.muted, textAlign: "center", margin: 0 }}>
            Aucune action requise — votre accès est permanent.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
