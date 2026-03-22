import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Copy, Pencil, FolderOpen, Database, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ClientPayload = {
  clientName?: string;
  notes?: string;
  data?: unknown;
  irOptions?: unknown;
  successionData?: unknown;
  hypotheses?: unknown;
  baseSnapshot?: unknown;
  mission?: unknown;
};

export type ClientRecord = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  payload: ClientPayload;
};

export type SyncStatus = "synced" | "pending" | "offline" | "syncing";

// ─── DÉTECTION ENVIRONNEMENT ──────────────────────────────────────────────────

const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const electronAPI = isElectron ? (window as any).electronAPI : null;

// ─── STOCKAGE LOCAL ───────────────────────────────────────────────────────────

function storageKey(userId: string) {
  return `ecopatrimoine_clients_${userId}`;
}

function pendingKey(userId: string) {
  return `ecopatrimoine_pending_${userId}`;
}

function loadClientsLocal(userId: string): ClientRecord[] {
  try {
    if (isElectron && electronAPI) return []; // géré via IPC
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveClientsLocal(userId: string, clients: ClientRecord[]) {
  if (isElectron && electronAPI) {
    electronAPI.writeClients(userId, clients).catch(console.error);
  }
  // Toujours sauvegarder dans localStorage comme backup
  try { localStorage.setItem(storageKey(userId), JSON.stringify(clients)); } catch {}
}

// File d'attente des modifications hors-ligne
function loadPendingIds(userId: string): Set<string> {
  try {
    // localStorage fonctionne en web ET en Electron
    const raw = localStorage.getItem(pendingKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function savePendingIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify([...ids]));
  } catch { /* ignore si localStorage indisponible */ }
}

// ─── SUPABASE SYNC ────────────────────────────────────────────────────────────

async function fetchFromSupabase(userId: string): Promise<ClientRecord[]> {
  if (!userId) throw new Error("userId vide — fetch annulé");

  const doFetch = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, display_name, created_at, updated_at, payload")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      displayName: row.display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payload: row.payload,
    }));
  };

  try {
    return await doFetch();
  } catch (err: any) {
    // Si erreur 401/403 (token expiré en mode grace) → tenter un refresh de session
    const status = err?.code || err?.status || err?.message || "";
    const isAuthError = String(status).includes("401") || String(status).includes("403")
      || String(err?.message).toLowerCase().includes("jwt")
      || String(err?.message).toLowerCase().includes("invalid");
    if (isAuthError) {
      // Tentative de refresh silencieux
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) {
        // Session rafraîchie → réessayer le fetch
        return await doFetch();
      }
    }
    throw err;
  }
}

async function upsertToSupabase(userId: string, client: ClientRecord): Promise<void> {
  if (!userId) throw new Error("userId vide — sync annulée");
  const { error } = await supabase.from("clients").upsert({
    id: client.id,
    user_id: userId,
    display_name: client.displayName,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    payload: client.payload,
    synced_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) throw error;
}

async function deleteFromSupabase(userId: string, clientId: string): Promise<void> {
  if (!userId) throw new Error("userId vide — delete annulé");
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) throw error;
}

// Fusion intelligente : le plus récent updated_at gagne
function mergeClients(local: ClientRecord[], remote: ClientRecord[]): ClientRecord[] {
  const map = new Map<string, ClientRecord>();
  for (const c of remote) map.set(c.id, c);
  for (const c of local) {
    const existing = map.get(c.id);
    if (!existing || new Date(c.updatedAt) > new Date(existing.updatedAt)) {
      map.set(c.id, c);
    }
  }
  return [...map.values()];
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export function useClients(userId: string, authState = "authenticated") {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const pendingRef = useRef<Set<string>>(new Set());
  const deletedRef = useRef<Set<string>>(new Set());

  // ── Nettoyage des clés orphelines (userId vide) au montage ──
  useEffect(() => {
    try {
      ["ecopatrimoine_clients_", "ecopatrimoine_pending_"].forEach(k => {
        if (localStorage.getItem(k) !== null) localStorage.removeItem(k);
      });
    } catch { /* ignore */ }
  }, []);

  // ── Chargement initial ──
  useEffect(() => {
    if (!userId) { setClients([]); setSyncStatus("offline"); return; }

    pendingRef.current = loadPendingIds(userId);

    // 1. Charger local immédiatement
    const loadLocal = async () => {
      if (isElectron && electronAPI) {
        const data = await electronAPI.readClients(userId).catch(() => []);
        return Array.isArray(data) ? data : [];
      }
      return loadClientsLocal(userId);
    };

    let cancelled = false; // éviter les mises à jour si le composant est démonté

    loadLocal().then((localClients) => {
      if (cancelled) return;
      setClients(localClients);

      // Nettoyer les pendingIds orphelins (IDs qui n'existent plus localement)
      const localIds = new Set(localClients.map(c => c.id));
      for (const id of [...pendingRef.current]) {
        if (!localIds.has(id)) pendingRef.current.delete(id);
      }
      savePendingIds(userId, pendingRef.current);

      // 2. Tenter sync Supabase en parallèle, avec timeout 15s
      // 2. Synchro Supabase uniquement si session authentifiée (pas en mode grace)
      if (authState !== "authenticated") {
        console.log("[useClients] Grace/offline — skipping Supabase sync");
        setSyncStatus(pendingRef.current.size > 0 ? "pending" : "offline");
        return;
      }
      console.log("[useClients] Starting sync for userId:", userId, "pending:", pendingRef.current.size);
      setSyncStatus("syncing");

      const fetchWithTimeout = Promise.race([
        fetchFromSupabase(userId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))
      ]);

      fetchWithTimeout
        .then(async (remoteClients) => {
          if (cancelled) return;
          const merged = mergeClients(localClients, remoteClients as ClientRecord[]);
          setClients(merged);
          saveClientsLocal(userId, merged);

          // Pousser les modifications locales en attente
          if (pendingRef.current.size > 0) {
            const toSync = merged.filter((c) => pendingRef.current.has(c.id));
            await Promise.all(toSync.map((c) => upsertToSupabase(userId, c)));
            await Promise.all([...deletedRef.current].map((id) => deleteFromSupabase(userId, id)));
            pendingRef.current.clear();
            deletedRef.current.clear();
            savePendingIds(userId, pendingRef.current);
          }

          console.log("[useClients] Sync success, merged:", merged.length, "clients");
          if (!cancelled) setSyncStatus("synced");
        })
        .catch((err: any) => {
          if (cancelled) return;
          console.log("[useClients] Sync failed:", err?.message || err);
          setSyncStatus(pendingRef.current.size > 0 ? "pending" : "offline");
        });
    });

    return () => { cancelled = true; };
  }, [userId, authState]);

  // ── Persister localement + marquer pour sync ──
  const persist = useCallback((uid: string, data: ClientRecord[], changedId?: string, deleted?: boolean) => {
    saveClientsLocal(uid, data);

    if (changedId) {
      if (deleted) {
        deletedRef.current.add(changedId);
        pendingRef.current.delete(changedId);
      } else {
        pendingRef.current.add(changedId);
      }
      savePendingIds(uid, pendingRef.current);
    }
  }, []);

  // ── Sync arrière-plan ──
  const syncOne = useCallback(async (uid: string, client: ClientRecord) => {
    if (!uid) return;
    try {
      await upsertToSupabase(uid, client);
      pendingRef.current.delete(client.id);
      savePendingIds(uid, pendingRef.current);
      if (pendingRef.current.size === 0) setSyncStatus("synced");
    } catch {
      setSyncStatus("pending");
    }
  }, []);

  const syncDelete = useCallback(async (uid: string, clientId: string) => {
    if (!uid) return;
    try {
      await deleteFromSupabase(uid, clientId);
      deletedRef.current.delete(clientId);
    } catch {
      setSyncStatus("pending");
    }
  }, []);

  // ── Sync manuelle ──
  const syncNow = useCallback(async () => {
    if (!userId) return;
    setSyncStatus("syncing");
    try {
      const remoteClients = await fetchFromSupabase(userId);

      // Un seul setState pour merger — on capture prev dans une ref pour la suite
      let mergedSnapshot: ClientRecord[] = [];
      setClients((prev) => {
        mergedSnapshot = mergeClients(prev, remoteClients);
        saveClientsLocal(userId, mergedSnapshot);
        return mergedSnapshot;
      });

      // Laisser React flusher le state avant de pousser les pending
      await Promise.resolve();

      const toSync = mergedSnapshot.filter((c) => pendingRef.current.has(c.id));
      if (toSync.length > 0) {
        await Promise.all(toSync.map((c) => upsertToSupabase(userId, c)));
      }
      await Promise.all([...deletedRef.current].map((id) => deleteFromSupabase(userId, id)));

      pendingRef.current.clear();
      deletedRef.current.clear();
      savePendingIds(userId, pendingRef.current);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("pending");
    }
  }, [userId]);

  // ── Re-sync automatique quand la session Supabase est rafraîchie ──
  useEffect(() => {
    if (!userId) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        setTimeout(() => syncNow(), 300);
      }
    });
    return () => subscription.unsubscribe();
  }, [userId, syncNow]);

  // ── CRUD ──

  const createClient = useCallback((name: string): ClientRecord => {
    const now = new Date().toISOString();
    const client: ClientRecord = {
      id: crypto.randomUUID(),
      displayName: name,
      createdAt: now,
      updatedAt: now,
      payload: { clientName: name },
    };
    setClients((prev) => {
      const next = [client, ...prev];
      persist(userId, next, client.id);
      return next;
    });
    // Side effects HORS du setState
    setSyncStatus("pending");
    syncOne(userId, client);
    return client;
  }, [userId, persist, syncOne]);

  const saveClient = useCallback((id: string, payload: ClientPayload, displayName: string) => {
    const updatedAt = new Date().toISOString();
    let updatedClient: ClientRecord | undefined;
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, payload, displayName, updatedAt } : c
      );
      persist(userId, next, id);
      updatedClient = next.find((c) => c.id === id);
      return next;
    });
    // Side effects HORS du setState
    if (updatedClient) { setSyncStatus("pending"); syncOne(userId, updatedClient); }
  }, [userId, persist, syncOne]);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(userId, next, id, true);
      return next;
    });
    // Side effects HORS du setState
    setSyncStatus("pending");
    syncDelete(userId, id);
  }, [userId, persist, syncDelete]);

  const duplicateClient = useCallback((id: string): ClientRecord | null => {
    let duplicated: ClientRecord | null = null;
    setClients((prev) => {
      const source = prev.find((c) => c.id === id);
      if (!source) return prev;
      const now = new Date().toISOString();
      duplicated = {
        ...source,
        id: crypto.randomUUID(),
        displayName: `${source.displayName} (copie)`,
        createdAt: now,
        updatedAt: now,
        payload: { ...source.payload, clientName: `${source.payload.clientName} (copie)` },
      };
      const next = [duplicated, ...prev];
      persist(userId, next, duplicated.id);
      return next;
    });
    // Side effects HORS du setState
    setSyncStatus("pending");
    if (duplicated) syncOne(userId, duplicated);
    return duplicated;
  }, [userId, persist, syncOne]);

  const renameClient = useCallback((id: string, newName: string) => {
    const updatedAt = new Date().toISOString();
    let updatedClient: ClientRecord | undefined;
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, displayName: newName, updatedAt } : c
      );
      persist(userId, next, id);
      updatedClient = next.find((c) => c.id === id);
      return next;
    });
    // Side effects HORS du setState
    if (updatedClient) { setSyncStatus("pending"); syncOne(userId, updatedClient); }
  }, [userId, persist, syncOne]);

  const sortedClients = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" })
  );

  return {
    clients: sortedClients,
    syncStatus,
    syncNow,
    createClient,
    saveClient,
    deleteClient,
    duplicateClient,
    renameClient,
  };
}

// ─── CLIENT MANAGER COMPONENT ─────────────────────────────────────────────────

type ClientManagerProps = {
  clients: ClientRecord[];
  syncStatus: SyncStatus;
  syncNow: () => void;
  onOpen: (client: ClientRecord) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  logoSrc: string;
  cabinetName: string;
  colorNavy: string;
  colorGold: string;
  colorSky: string;
  colorCream: string;
  isInstallable?: boolean;
  onInstall?: () => void;
  // Nouveaux props
  onSignOut?: () => void;
  onAdmin?: () => void;
  isAdmin?: boolean;
  licence?: { type: string | null; status: string; isValid: boolean } | null;
  userId?: string;
};

export function ClientManager({
  clients,
  syncStatus,
  syncNow,
  onOpen,
  onCreate,
  onDelete,
  onDuplicate,
  onRename,
  logoSrc,
  cabinetName,
  colorNavy,
  colorGold,
  colorSky,
  colorCream,
  isInstallable = false,
  onInstall,
  onSignOut,
  onAdmin,
  isAdmin = false,
  licence,
  userId = "",
}: ClientManagerProps) {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  };

  const handleRenameConfirm = (id: string) => {
    const val = renameValue.trim();
    if (val) onRename(id, val);
    setRenamingId(null);
    setRenameValue("");
  };

  const SURFACE_APP = "linear-gradient(135deg, #f5f0e8 0%, #fdf8f0 40%, #f0ece4 100%)";

  // Indicateur de sync
  const SyncIndicator = () => {
    const configs: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      synced:  { icon: <Cloud className="h-3.5 w-3.5" />,      label: "Synchronisé",       color: "#16a34a" },
      pending: { icon: <RefreshCw className="h-3.5 w-3.5" />,  label: "En attente",        color: "#d97706" },
      offline: { icon: <CloudOff className="h-3.5 w-3.5" />,   label: "Hors ligne",        color: "#6b7280" },
      syncing: { icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />, label: "Synchronisation…", color: "#3b82f6" },
    };
    const cfg = configs[syncStatus] ?? configs["syncing"];
    return (
      <button
        onClick={syncNow}
        title="Cliquer pour synchroniser"
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-white/20"
        style={{ color: cfg.color }}
      >
        {cfg.icon}
        <span>{cfg.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: SURFACE_APP, position:"relative", overflowX:"hidden", overflowY:"auto", display:"flex", flexDirection:"column" }}>

      {/* Formes géométriques fond dossiers */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", bottom:"-120px", left:"-80px", width:"420px", height:"420px",
          borderRadius:"50%", background:colorGold, opacity:0.13 }} />
        <div style={{ position:"absolute", top:"-40px", right:"-50px", width:"260px", height:"120px",
          borderRadius:"24px", background:colorNavy, opacity:0.12, transform:"rotate(-18deg)" }} />
        <div style={{ position:"absolute", top:"38%", right:"-30px", width:"180px", height:"180px",
          borderRadius:"24px", background:colorGold, opacity:0.14, transform:"rotate(12deg)" }} />
        <div style={{ position:"absolute", top:"80px", left:"5%", width:"140px", height:"140px",
          borderRadius:"50%", background:colorNavy, opacity:0.08 }} />
        <div style={{ position:"absolute", bottom:"22%", left:0, width:"100%", height:"5px",
          background:"linear-gradient(90deg, transparent 0%, rgba(227,175,100,0.4) 20%, rgba(227,175,100,0.4) 80%, transparent 100%)" }} />
        <div style={{ position:"absolute", bottom:"60px", right:"12%", width:"90px", height:"90px",
          borderRadius:"16px", background:colorNavy, opacity:0.10, transform:"rotate(25deg)" }} />
        <div style={{ position:"absolute", top:"-60px", left:"40%", width:"240px", height:"240px",
          borderRadius:"50%", background:colorGold, opacity:0.10 }} />
      </div>
      {/* Bannière abonnement */}
      {licence && userId && (
        <div style={{ position:"relative", zIndex:2 }}>
          {licence.type === "trial" && licence.status === "active" && (() => {
            return (
              <div className="w-full text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-3"
                style={{ background: `rgba(227,175,100,0.15)`, color: colorNavy, borderBottom: `1px solid rgba(227,175,100,0.3)` }}>
                <span>✦ Essai gratuit en cours</span>
                <a href="https://app.ploutos-cgp.fr" className="underline font-bold">S'abonner →</a>
              </div>
            );
          })()}
          {licence.type === "paid" && licence.status === "active" && null}
          {licence.status === "cancelling" && (() => {
            const handlePortal = async () => {
              const res = await fetch("https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/create-portal-session", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, return_url: window.location.origin }),
              });
              const data = await res.json();
              if (data.url) window.open(data.url, "_blank");
            };
            return (
              <div className="w-full py-1.5 px-6 flex items-center justify-between text-xs font-semibold"
                style={{ background: "#FEF3C7", color: "#92400E", borderBottom: "1px solid #FCD34D" }}>
                <span>⚠️ Annulation prévue — accès maintenu jusqu'à fin de période</span>
                <button onClick={handlePortal} className="underline font-bold">Réactiver</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Header imposant avec stats */}
      <div style={{ position:"relative", zIndex:1, background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 55%, ${colorGold} 100%)`, boxShadow:"0 4px 24px rgba(16,27,59,0.18)" }}>
        <div className="w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoSrc} alt={cabinetName} className="h-16 w-auto object-contain drop-shadow-md" />
            <div>
              <div className="text-white font-bold text-xl leading-tight">{cabinetName}</div>
              <div className="text-white/60 text-xs font-medium tracking-wide mt-0.5">Gestion des dossiers clients</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            {isAdmin && onAdmin && (
              <button onClick={onAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(227,175,100,0.25)", border: "1px solid rgba(227,175,100,0.6)", color: "#E3AF64" }}>
                ⚙ Admin
              </button>
            )}
            {licence?.type === "paid" && licence?.status === "active" && userId && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.8)" }}
                onClick={async () => {
                  const res = await fetch("https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/create-portal-session", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, return_url: window.location.origin }),
                  });
                  const data = await res.json();
                  if (data.url) window.open(data.url, "_blank");
                }}>
                Abonnement
              </button>
            )}
            {onSignOut && (
              <button onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.8)" }}>
                Déconnexion
              </button>
            )}
            {isInstallable && onInstall && (
              <button
                onClick={onInstall}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(227,175,100,0.25)", border: "1px solid rgba(227,175,100,0.6)", color: "#E3AF64" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Installer l'app
              </button>
            )}
          </div>
        </div>
        {/* Barre de stats */}
        <div className="w-full px-6 pb-4 flex items-center gap-6" style={{ borderTop:"1px solid rgba(255,255,255,0.12)" }}>
          <div className="flex items-center gap-2 pt-3">
            <Database className="h-4 w-4 text-white/50" />
            <span className="text-white font-semibold text-sm">{clients.length}</span>
            <span className="text-white/60 text-xs">dossier{clients.length !== 1 ? "s" : ""}</span>
          </div>
          {clients.length > 0 && (
            <div className="flex items-center gap-2 pt-3">
              <span className="text-white/50 text-xs">Dernière modif. :</span>
              <span className="text-white/80 text-xs">{
                new Date(Math.max(...clients.map(c => new Date(c.updatedAt).getTime())))
                  .toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" })
              }</span>
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8" style={{ position:"relative", zIndex:1 }}>

        {/* Barre de recherche */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de dossier ou nom du client…"
            className="w-full rounded-2xl text-sm pl-10 pr-4 py-3 border shadow-sm focus:outline-none focus:ring-2"
            style={{ borderColor:"rgba(227,175,100,0.3)", background:"rgba(255,255,255,0.97)" }}
          />
        </div>

        {/* Créer un nouveau dossier */}
        <Card className="rounded-3xl border-0 shadow-xl shadow-slate-200/60">
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-3" style={{ color: colorSky }}>
              NOUVEAU DOSSIER CLIENT
            </div>
            <div className="flex gap-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Nom du client (ex : Dupont Martin)"
                className="rounded-xl text-sm flex-1"
                style={{ borderColor: "rgba(227,175,100,0.3)", background: "rgba(255,255,255,0.98)" }}
              />
              <Button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-xl px-5 font-semibold shadow-md"
                style={{ background: colorNavy, color: "#fff" }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Créer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bannière hors-ligne */}
        {(syncStatus === "offline" || syncStatus === "pending") && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center justify-between"
            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}>
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4" />
              <span>
                {syncStatus === "offline"
                  ? "Mode hors ligne — vos données sont sauvegardées localement."
                  : "Modifications en attente de synchronisation."}
              </span>
            </div>
            <button onClick={syncNow} className="font-semibold underline text-xs">
              Synchroniser
            </button>
          </div>
        )}

        {/* Liste des dossiers filtrée */}
        {(() => {
          const q = searchQuery.toLowerCase().trim();
          const filtered = q === "" ? clients : clients.filter(c => {
            const byName = c.displayName.toLowerCase().includes(q);
            const p = c.payload?.data ?? {};
            const clientFullName = ((p as any).person1FirstName ?? "") + " " + ((p as any).person1LastName ?? "");
            const byClient = clientFullName.toLowerCase().includes(q);
            return byName || byClient;
          });
          return (
        <div className="space-y-3">
          {clients.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Aucun dossier client. Créez-en un ci-dessus.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Aucun dossier ne correspond à votre recherche.
            </div>
          ) : (
            filtered.map((client) => {
              // Indicateur ancienneté
              const daysSince = Math.floor((Date.now() - new Date(client.updatedAt).getTime()) / 86400000);
              const dotColor = daysSince < 7 ? "#E3AF64" : daysSince < 30 ? "#26428B" : "#94a3b8";
              // Nom du client depuis payload
              const p = client.payload?.data ?? {};
              const p1First = (p as any).person1FirstName ?? "";
              const p1Last = (p as any).person1LastName ?? "";
              const clientName = [p1First, p1Last].filter(Boolean).join(" ");
              const showClientName = clientName && clientName.toLowerCase() !== client.displayName.toLowerCase();
              return (
              <Card
                key={client.id}
                className="rounded-2xl border-0 shadow-md shadow-slate-100/80 hover:shadow-lg transition-shadow"
                style={{ background: "rgba(255,255,255,0.95)" }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Indicateur ancienneté */}
                  <div style={{ width:"4px", minHeight:"44px", borderRadius:"4px", background:dotColor, flexShrink:0 }} />
                  <div className="flex-1 min-w-0">
                    {renamingId === client.id ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameConfirm(client.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                          className="rounded-lg text-sm h-8"
                          style={{ borderColor: "rgba(227,175,100,0.4)" }}
                        />
                        <Button onClick={() => handleRenameConfirm(client.id)} className="rounded-lg text-xs h-8 px-3" style={{ background: colorNavy, color: "#fff" }}>OK</Button>
                        <button onClick={() => setRenamingId(null)} className="text-xs text-slate-400 hover:text-slate-600">Annuler</button>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-sm truncate" style={{ color: colorNavy }}>{client.displayName}</div>
                        {showClientName && (
                          <div className="text-xs font-medium mt-0.5" style={{ color: colorSky }}>{clientName}</div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">
                          Modifié le {new Date(client.updatedAt).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {renamingId !== client.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button title="Renommer" onClick={() => { setRenamingId(client.id); setRenameValue(client.displayName); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button title="Dupliquer" onClick={() => onDuplicate(client.id)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === client.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 font-medium">Confirmer ?</span>
                          <button onClick={() => { onDelete(client.id); setConfirmDeleteId(null); }} className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-0.5 rounded-lg bg-red-50">Oui</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-600">Non</button>
                        </div>
                      ) : (
                        <button title="Supprimer" onClick={() => setConfirmDeleteId(client.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Button onClick={() => onOpen(client)} className="rounded-xl px-4 h-8 text-xs font-semibold shadow-sm ml-1" style={{ background: colorNavy, color: "#fff" }}>
                        <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                        Ouvrir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            })
          )}
        </div>
          );
        })()}
      </div>

      {/* Footer citation */}
      <div className="mt-auto py-6 text-center text-xs text-slate-400" style={{ position:"relative", zIndex:1 }}>
        <p style={{ fontStyle:"italic" }}>« La richesse ne consiste pas à avoir de nombreuses possessions, mais à avoir peu de besoins. »</p>
        <p className="mt-1">© Ploutos {new Date().getFullYear()} — Données stockées localement</p>
      </div>
    </div>
  );
}
