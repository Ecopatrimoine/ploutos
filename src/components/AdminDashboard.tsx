// src/components/AdminDashboard.tsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminDashboard } from "../hooks/useAdmin";
import type { AdminUser } from "../hooks/useAdmin";

interface AdminDashboardProps {
  colorNavy: string;
  colorSky: string;
  colorGold: string;
  colorCream: string;
  onClose: () => void;
}

const BADGE: Record<string, { bg: string; text: string; label: string }> = {
  "trial-active":       { bg: "bg-blue-100",   text: "text-blue-700",   label: "Trial actif" },
  "trial-expired":      { bg: "bg-orange-100", text: "text-orange-700", label: "Trial expiré" },
  "paid-active":        { bg: "bg-green-100",  text: "text-green-700",  label: "Payant" },
  "paid-cancelling":    { bg: "bg-amber-100",  text: "text-amber-700",  label: "Annulation prévue" },
  "lifetime-active":    { bg: "bg-purple-100", text: "text-purple-700", label: "Lifetime" },
  "paid-cancelled":     { bg: "bg-red-100",    text: "text-red-700",    label: "Annulé" },
  "paid-expired":       { bg: "bg-red-100",    text: "text-red-700",    label: "Expiré" },
};

function LicenceBadge({ user }: { user: AdminUser }) {
  const key = `${user.licence?.type ?? "none"}-${user.licence?.status ?? "none"}`;
  const style = BADGE[key] ?? { bg: "bg-slate-100", text: "text-slate-600", label: key };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function TrialDays({ user }: { user: AdminUser }) {
  if (user.licence?.type === "trial" && user.licence.trial_end) {
    const days = Math.max(0, Math.ceil((new Date(user.licence.trial_end).getTime() - Date.now()) / 86400000));
    return <span className="text-xs text-slate-500">{days}j restants</span>;
  }
  if (user.licence?.type === "paid" && user.subDetails) {
    const d = user.subDetails;
    const plan = d.interval === "year" ? "Annuel" : "Mensuel";
    const renewal = d.current_period_end
      ? new Date(d.current_period_end).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    if (d.cancel_at_period_end) {
      return <span className="text-xs text-amber-600">Annulation le {renewal}</span>;
    }
    return <span className="text-xs text-slate-500">{plan} · renouvellement {renewal}</span>;
  }
  return null;
}

export function AdminDashboard({ colorNavy, colorSky, colorGold, colorCream, onClose }: AdminDashboardProps) {
  const { users, loading, error, fetchUsers, setLifetime, revokeLicence, extendTrial, resetUserPassword } = useAdminDashboard(true);
  const [actionMsg, setActionMsg] = useState("");
  const [search, setSearch] = useState("");

  const notify = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 3000); };

  const handleResetDirect = async (u: AdminUser) => {
    const ok = await resetUserPassword(u.email);
    notify(ok ? `✅ Email de reset envoyé à ${u.email}` : "❌ Erreur reset");
  };

  const handleContactDirect = (u: AdminUser) => {
    window.location.href = `mailto:${u.email}`;
  };

  const handleLifetime = async (u: AdminUser) => {
    const ok = await setLifetime(u.id);
    notify(ok ? `✅ ${u.email} → Lifetime` : "❌ Erreur");
  };

  const handleRevoke = async (u: AdminUser) => {
    if (!confirm(`Révoquer la licence de ${u.email} ?`)) return;
    const ok = await revokeLicence(u.id);
    notify(ok ? `✅ Licence révoquée` : "❌ Erreur");
  };

  const handleExtend = async (u: AdminUser, days: number) => {
    const ok = await extendTrial(u.id, days);
    notify(ok ? `✅ Trial prolongé de ${days}j` : "❌ Erreur");
  };



  // Stats
  const stats = {
    total: users.length,
    trial: users.filter(u => u.licence?.type === "trial" && u.licence?.status === "active").length,
    paid: users.filter(u => u.licence?.type === "paid" && u.licence?.status === "active").length,
    lifetime: users.filter(u => u.licence?.type === "lifetime").length,
    expired: users.filter(u => u.licence?.status === "expired" || u.licence?.status === "cancelled").length,
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.cabinet_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 overflow-y-auto z-50" style={{ background: `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)` }}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colorNavy }}>Dashboard Admin</h1>
            <p className="text-sm text-slate-500">Ploutos — Gestion des licences</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchUsers} variant="outline" className="rounded-xl text-sm h-9">
              ↻ Actualiser
            </Button>
            <Button onClick={onClose} className="rounded-xl text-sm h-9"
              style={{ background: colorNavy, color: "#fff" }}>
              ← Retour à l'app
            </Button>
          </div>
        </div>

        {/* Message action */}
        {actionMsg && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium bg-slate-800 text-white">
            {actionMsg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: colorNavy },
            { label: "Trial actif", value: stats.trial, color: "#3B82F6" },
            { label: "Payants", value: stats.paid, color: "#10B981" },
            { label: "Lifetime", value: stats.lifetime, color: "#8B5CF6" },
            { label: "Expirés", value: stats.expired, color: "#EF4444" },
          ].map(s => (
            <Card key={s.label} className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>



        {/* Liste utilisateurs */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold" style={{ color: colorNavy }}>
                👥 Comptes ({users.length})
              </CardTitle>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="rounded-xl text-sm h-8 w-48"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-slate-500 text-center py-4">Chargement...</p>}
            {error && <p className="text-sm text-red-500 text-center py-4">{error}</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Aucun compte trouvé</p>
            )}
            <div className="space-y-2">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-xl p-3 border"
                  style={{ borderColor: "rgba(185,145,60,0.2)", background: "rgba(255,255,255,0.8)" }}>

                  {/* Infos */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: colorNavy }}>
                        {u.cabinet_name || u.email}
                      </div>
                      {u.email && (
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      )}
                    </div>
                    <LicenceBadge user={u} />
                    <TrialDays user={u} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Prolonger trial */}
                    {u.licence?.type === "trial" && (
                      <Button variant="outline"
                        className="rounded-lg h-7 text-xs px-2"
                        onClick={() => handleExtend(u, 15)}
                        title="Prolonger de 15 jours">
                        +15j
                      </Button>
                    )}

                    {/* Passer en lifetime */}
                    {u.licence?.type !== "lifetime" && (
                      <Button variant="outline"
                        className="rounded-lg h-7 text-xs px-2 text-purple-700 border-purple-200 hover:bg-purple-50"
                        onClick={() => handleLifetime(u)}
                        title="Passer en lifetime">
                        ∞ Lifetime
                      </Button>
                    )}

                    {/* Révoquer */}
                    {u.licence?.status === "active" && (
                      <Button variant="outline"
                        className="rounded-lg h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRevoke(u)}
                        title="Révoquer la licence">
                        ✕
                      </Button>
                    )}

                    {/* Reset MDP direct */}
                    <Button variant="outline"
                      className="rounded-lg h-7 text-xs px-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                      onClick={() => handleResetDirect(u)}
                      disabled={!u.email}
                      title={u.email ? `Envoyer reset MDP à ${u.email}` : "Email inconnu"}>
                      🔑
                    </Button>

                    {/* Voir sur Stripe */}
                    {u.licence?.stripe_sub && (
                      <Button variant="outline"
                        className="rounded-lg h-7 text-xs px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => window.open(`https://dashboard.stripe.com/subscriptions/${u.licence!.stripe_sub}`, "_blank")}
                        title="Voir l'abonnement sur Stripe">
                        Stripe →
                      </Button>
                    )}

                    {/* Contacter direct */}
                    <Button variant="outline"
                      className="rounded-lg h-7 text-xs px-2 text-sky-700 border-sky-200 hover:bg-sky-50"
                      onClick={() => handleContactDirect(u)}
                      disabled={!u.email}
                      title={u.email ? `Contacter ${u.email}` : "Email inconnu"}>
                      ✉
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
