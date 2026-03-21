// src/components/LicenceGate.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LicenceInfo } from "../hooks/useLicense";

interface LicenceGateProps {
  licence:    LicenceInfo;
  userId:     string;
  onSignOut:  () => void;
  colorNavy:  string;
  colorSky:   string;
  colorGold:  string;
  logoSrc:    string;
}

export function LicenceGate({ licence, userId, onSignOut, colorNavy, colorSky, colorGold, logoSrc }: LicenceGateProps) {
  const isExpiredTrial = licence.type === "trial" && licence.status === "expired";
  const SURFACE = `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`;

  const handleSolo = () => {
    window.open(
      `https://buy.stripe.com/aFaeVe90DdKM5lMeQD9fW01?client_reference_id=${userId}`,
      "_blank"
    );
  };

  const handleAnnuel = () => {
    window.open(
      `https://buy.stripe.com/28E7sMdgT5eg29A8sf9fW00?client_reference_id=${userId}`,
      "_blank"
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: SURFACE }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-3">
        {logoSrc && <img src={logoSrc} alt="Logo" className="h-16 w-auto object-contain drop-shadow-md" />}
        <div className="text-2xl font-bold" style={{ color: colorNavy }}>Ploutos</div>
      </div>

      <Card className="w-full max-w-lg rounded-3xl border-0 shadow-2xl shadow-slate-200/60">
        <CardContent className="p-8 space-y-6 text-center">

          <div className="text-6xl">{isExpiredTrial ? "⏱️" : "🔒"}</div>

          <h2 className="text-xl font-bold" style={{ color: colorNavy }}>
            {isExpiredTrial ? "Période d'essai terminée" : "Abonnement inactif"}
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            {isExpiredTrial
              ? "Votre période d'essai gratuite de 15 jours est terminée. Souscrivez un abonnement pour continuer."
              : "Votre abonnement n'est plus actif. Renouvelez pour retrouver l'accès."}
          </p>

          {/* Tarifs */}
          <div className="grid grid-cols-2 gap-3 text-left">

            {/* Plan Solo */}
            <div className="rounded-2xl p-4 border-2" style={{ borderColor: colorGold, background: "rgba(227,175,100,0.06)" }}>
              <div className="text-xs font-bold uppercase mb-1" style={{ color: colorSky }}>Plan Solo</div>
              <div className="text-2xl font-bold" style={{ color: colorNavy }}>
                30 €<span className="text-sm font-normal text-slate-500">/mois</span>
              </div>
              <ul className="text-xs text-slate-600 mt-2 space-y-1">
                <li>✓ Calculs IR, IFI, Succession revenus 2025</li>
                <li>✓ Rapports PDF aux couleurs du cabinet</li>
                <li>✓ Gestion multi-clients illimitée</li>
              </ul>
              <Button
                className="w-full mt-3 rounded-xl h-9 text-xs font-semibold"
                style={{ background: `linear-gradient(135deg, ${colorGold} 0%, #c49040 100%)`, color: "#fff" }}
                onClick={handleSolo}
              >
                Choisir Solo
              </Button>
            </div>

            {/* Plan Annuel */}
            <div className="rounded-2xl p-4 border-2 relative" style={{ borderColor: colorNavy, background: "rgba(16,27,59,0.04)" }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full text-white" style={{ background: colorNavy }}>
                Recommandé
              </div>
              <div className="text-xs font-bold uppercase mb-1" style={{ color: colorSky }}>Plan Annuel</div>
              <div className="text-2xl font-bold" style={{ color: colorNavy }}>
                25 €<span className="text-sm font-normal text-slate-500">/mois</span>
              </div>
              <div className="text-xs text-slate-500 mb-1">300 €/an · 2 mois offerts</div>
              <ul className="text-xs text-slate-600 mt-2 space-y-1">
                <li>✓ Toutes les fonctionnalités Solo</li>
                <li>✓ 2 mois offerts vs mensuel</li>
                <li>✓ Tarif bloqué à vie</li>
              </ul>
              <Button
                className="w-full mt-3 rounded-xl h-9 text-xs font-semibold"
                style={{ background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`, color: "#fff" }}
                onClick={handleAnnuel}
              >
                Choisir Annuel
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Paiement sécurisé par Stripe · Résiliation à tout moment
          </p>

          {/* Contact support */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <a
              href="mailto:contact@ploutos-cgp.fr?subject=Problème de licence Ploutos"
              className="text-xs font-medium hover:underline"
              style={{ color: colorSky }}
            >
              📧 Contacter le support
            </a>
            <button
              onClick={onSignOut}
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
            >
              Se déconnecter
            </button>
          </div>

        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 mt-6">© Ploutos 2026 — EcoPatrimoine Conseil · contact@ploutos-cgp.fr</p>
    </div>
  );
}
