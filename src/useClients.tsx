import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Copy, Pencil, FolderOpen, Database, Cloud, CloudOff, RefreshCw, Search } from "lucide-react";
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

export function useClients(userId: string) {
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

    loadLocal().then((localClients) => {
      setClients(localClients);

      // 2. Tenter sync Supabase en parallèle
      setSyncStatus("syncing");
      fetchFromSupabase(userId)
        .then(async (remoteClients) => {
          // Fusionner local + remote
          const merged = mergeClients(localClients, remoteClients);
          setClients(merged);
          saveClientsLocal(userId, merged);

          // Pousser les modifications locales en attente
          if (pendingRef.current.size > 0) {
            const toSync = merged.filter((c) => pendingRef.current.has(c.id));
            await Promise.all(toSync.map((c) => upsertToSupabase(userId, c)));
            // Supprimer les dossiers supprimés hors-ligne
            await Promise.all([...deletedRef.current].map((id) => deleteFromSupabase(userId, id)));
            pendingRef.current.clear();
            deletedRef.current.clear();
            savePendingIds(userId, pendingRef.current);
          }

          setSyncStatus("synced");
        })
        .catch(() => {
          // Hors-ligne — utiliser uniquement le local
          setSyncStatus(pendingRef.current.size > 0 ? "pending" : "offline");
        });
    });
  }, [userId]);

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
}: ClientManagerProps) {
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  // Extraire le nom du client depuis le payload
  const getClientPersonName = (client: ClientRecord): string | null => {
    const d = (client.payload as any)?.data;
    if (!d) return null;
    const full = [d.person1FirstName, d.person1LastName].filter(Boolean).join(" ").trim();
    return full || null;
  };

  // Filtrer par recherche (nom dossier + nom client)
  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (c.displayName.toLowerCase().includes(q)) return true;
    const personName = getClientPersonName(c);
    if (personName && personName.toLowerCase().includes(q)) return true;
    return false;
  });

  // Couleur indicateur ancienneté
  const getAgeColor = (updatedAt: string): string => {
    const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) return colorGold;   // or = récent
    if (days < 30) return colorSky;   // sky = < 30j
    return "#9ca3af";                 // gris = plus ancien
  };

  // Dernière sync (plus récent updatedAt)
  const lastSyncDate = clients.length > 0
    ? new Date(Math.max(...clients.map(c => new Date(c.updatedAt).getTime())))
    : null;

  const SURFACE_APP = `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`;

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

  const CITATIONS = [
    "« La gestion de patrimoine, c'est l'art de transformer l'épargne en sérénité. »",
    "« Chaque dossier bien préparé est une promesse de confiance tenue. »",
    "« Anticiper, c'est protéger ceux qui comptent. »",
    "« Le patrimoine se construit jour après jour, avec méthode et vision. »",
  ];
  const citation = CITATIONS[new Date().getDay() % CITATIONS.length];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: SURFACE_APP }}>
      {/* Header imposant */}
      <div
        className="w-full px-6 py-6 shadow-xl"
        style={{ background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 60%, ${colorGold} 100%)` }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logoSrc} alt={cabinetName} className="h-16 w-auto object-contain drop-shadow-md" />
              <div>
                <div className="text-white font-bold text-xl leading-tight">{cabinetName}</div>
                <div className="text-white/60 text-xs font-medium tracking-wide mt-0.5">Gestion des dossiers clients</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/70 text-sm">
              <SyncIndicator />
            </div>
          </div>
          {/* Stats bar */}
          <div className="flex items-center gap-6 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="flex items-center gap-2 text-white/90">
              <Database className="h-4 w-4" />
              <span className="text-sm font-semibold">{clients.length}</span>
              <span className="text-xs text-white/60">dossier{clients.length !== 1 ? "s" : ""}</span>
            </div>
            {lastSyncDate && (
              <div className="text-xs text-white/50">
                Dernière modification : {lastSyncDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 flex-1 w-full">

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

        {/* Barre de recherche */}
        {clients.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom de dossier ou nom du client…"
              className="rounded-2xl text-sm pl-10 h-11"
              style={{ borderColor: "rgba(227,175,100,0.25)", background: "rgba(255,255,255,0.95)" }}
            />
          </div>
        )}

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

        {/* Liste des dossiers */}
        <div className="space-y-3">
          {filteredClients.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {clients.length === 0
                ? "Aucun dossier client. Créez-en un ci-dessus."
                : "Aucun dossier ne correspond à votre recherche."}
            </div>
          ) : (
            filteredClients.map((client) => {
              const personName = getClientPersonName(client);
              const showSubtitle = personName && personName !== client.displayName;
              const ageColor = getAgeColor(client.updatedAt);

              return (
                <Card
                  key={client.id}
                  className="rounded-2xl border-0 shadow-md shadow-slate-100/80 hover:shadow-lg transition-shadow"
                  style={{ background: "rgba(255,255,255,0.95)", overflow: "hidden" }}
                >
                  <CardContent className="p-0 flex items-stretch">
                    {/* Indicateur coloré d'ancienneté */}
                    <div className="w-1.5 shrink-0 rounded-l-2xl" style={{ background: ageColor }} />

                    <div className="p-4 flex items-center gap-4 flex-1 min-w-0">
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
                            {showSubtitle && (
                              <div className="text-xs font-medium mt-0.5 truncate" style={{ color: colorNavy, opacity: 0.55 }}>
                                {personName}
                              </div>
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
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Footer — citation inspirante */}
      <div className="w-full py-8 px-6 mt-auto">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm italic" style={{ color: colorNavy, opacity: 0.35 }}>{citation}</p>
          <p className="text-xs mt-3" style={{ color: "#9ca3af" }}>© Vision Ecopatrimoine</p>
        </div>
      </div>
    </div>
  );
}
