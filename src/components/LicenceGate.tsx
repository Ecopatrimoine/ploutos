import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LicenceInfo } from "../hooks/useLicense";

// ─── Liens Stripe LIVE ───────────────────────────────────────────────────────
const STRIPE_SOLO_URL   = "https://buy.stripe.com/aFaeVe90DdKM5lMeQD9fW01";
const STRIPE_ANNUEL_URL = "https://buy.stripe.com/28E7sMdgT5eg29A8sf9fW00";

// ─── Couleurs Ploutos ─────────────────────────────────────────────────────────
const colorNavy = "#101B3B";
const colorSky  = "#26428B";
const colorGold = "#E3AF64";

interface LicenceGateProps {
  licence: LicenceInfo | null;
  userId:    string;
  onSignOut: () => void;
}

export default function LicenceGate({ licence, userId, onSignOut }: LicenceGateProps) {
  const isExpiredTrial =
    licence?.type === "trial" && licence?.status !== "active";

  const [promoCode, setPromoCode] = useState("");

  const openStripe = (baseUrl: string) => {
    let url = `${baseUrl}?client_reference_id=${encodeURIComponent(userId)}`;
    if (promoCode.trim()) {
      url += `&prefilled_promo_code=${encodeURIComponent(promoCode.trim().toUpperCase())}`;
    }
    window.open(url, "_blank");
  };

  const handleSolo   = () => openStripe(STRIPE_SOLO_URL);
  const handleAnnuel = () => openStripe(STRIPE_ANNUEL_URL);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)",
        padding: "24px 16px",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <img
          src="/logo.ploutos.svg"
          alt="Ploutos"
          style={{ height: 48 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      <Card
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 24,
          border: `1.5px solid ${colorGold}`,
          boxShadow: "0 8px 40px rgba(16,27,59,0.10)",
        }}
      >
        <CardContent style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Icône + titre */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {isExpiredTrial ? "⏱️" : "🔒"}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: colorNavy, margin: 0 }}>
              {isExpiredTrial ? "Période d'essai terminée" : "Abonnement inactif"}
            </h2>
            <p style={{ fontSize: 14, color: "#4B5563", marginTop: 8, lineHeight: 1.6 }}>
              {isExpiredTrial
                ? "Votre période d'essai gratuite de 15 jours est terminée. Souscrivez un abonnement pour continuer."
                : "Votre abonnement n'est plus actif. Renouvelez pour retrouver l'accès."}
            </p>
          </div>

          {/* ─── Tarifs ─────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            {/* Plan Solo */}
            <div
              style={{
                borderRadius: 16,
                padding: 16,
                border: `2px solid ${colorGold}`,
                background: "rgba(227,175,100,0.06)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: colorSky, marginBottom: 4 }}>
                Plan Solo
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: colorNavy, lineHeight: 1 }}>
                50 €
                <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>/mois</span>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, marginBottom: 8 }}>
                Facturation mensuelle
              </div>
              <ul style={{ fontSize: 11, color: "#4B5563", margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                <li>✓ Calculs IR, IFI, Succession 2025</li>
                <li>✓ Rapports PDF aux couleurs du cabinet</li>
                <li>✓ Gestion multi-clients illimitée</li>
              </ul>
              <Button
                style={{
                  width: "100%",
                  marginTop: 12,
                  borderRadius: 12,
                  height: 36,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${colorGold} 0%, #c49040 100%)`,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={handleSolo}
              >
                Choisir Solo
              </Button>
            </div>

            {/* Plan Annuel */}
            <div
              style={{
                borderRadius: 16,
                padding: 16,
                border: `2px solid ${colorNavy}`,
                background: "rgba(16,27,59,0.04)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: colorNavy,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 99,
                  whiteSpace: "nowrap",
                }}
              >
                Recommandé
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: colorSky, marginBottom: 4 }}>
                Plan Annuel
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: colorNavy, lineHeight: 1 }}>
                41,67 €
                <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>/mois</span>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, marginBottom: 8 }}>
                500 €/an · 2 mois offerts
              </div>
              <ul style={{ fontSize: 11, color: "#4B5563", margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                <li>✓ Toutes les fonctionnalités Solo</li>
                <li>✓ 2 mois offerts vs mensuel</li>
                <li>✓ Tarif bloqué à vie</li>
              </ul>
              <Button
                style={{
                  width: "100%",
                  marginTop: 12,
                  borderRadius: 12,
                  height: 36,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={handleAnnuel}
              >
                Choisir Annuel
              </Button>
            </div>
          </div>

          {/* ─── Champ code promo — cadre doré discret, sans texte ───── */}
          <div
            style={{
              background: "rgba(227,175,100,0.08)",
              border: `1px dashed ${colorGold}`,
              borderRadius: 12,
              padding: "12px 16px",
            }}
          >
            <input
              type="text"
              placeholder="Code promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1.5px solid ${colorGold}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.05em",
                outline: "none",
                color: colorNavy,
                background: "#fff",
                fontFamily: "monospace",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colorNavy)}
              onBlur={(e)  => (e.currentTarget.style.borderColor = colorGold)}
            />
          </div>

          {/* ─── Footer ─────────────────────────────────────────────────── */}
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", margin: 0 }}>
            Paiement sécurisé par Stripe · Résiliation à tout moment
          </p>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <a
              href="mailto:contact@ploutos-cgp.fr?subject=Problème de licence Ploutos"
              style={{ fontSize: 12, fontWeight: 500, color: colorSky, textDecoration: "none" }}
            >
              📧 Contacter le support
            </a>
            <button
              onClick={onSignOut}
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Se déconnecter
            </button>
          </div>

        </CardContent>
      </Card>

      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 24 }}>
        © Ploutos 2026 — EcoPatrimoine Conseil · contact@ploutos-cgp.fr
      </p>
    </div>
  );
}
