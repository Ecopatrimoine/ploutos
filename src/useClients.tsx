import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Copy, Pencil, FolderOpen, Database } from "lucide-react";

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

// ─── HOOK ─────────────────────────────────────────────────────────────────────

// Détection Electron
const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const electronAPI = isElectron ? (window as any).electronAPI : null;

function storageKey(userId: string) {
  return `ecopatrimoine_clients_${userId}`;
}

function loadClientsFromStorage(userId: string): ClientRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClientsToStorage(userId: string, clients: ClientRecord[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(clients));
}

export function useClients(userId: string) {
  const [clients, setClients] = useState<ClientRecord[]>([]);

  // Charger selon l'environnement (Electron = fichier, Web = localStorage)
  useEffect(() => {
    if (!userId) { setClients([]); return; }
    if (isElectron && electronAPI) {
      electronAPI.readClients(userId).then((data: ClientRecord[]) => {
        setClients(Array.isArray(data) ? data : []);
      }).catch(() => setClients([]));
    } else {
      setClients(loadClientsFromStorage(userId));
    }
  }, [userId]);

  // Persister selon l'environnement
  const persist = useCallback((uid: string, data: ClientRecord[]) => {
    if (isElectron && electronAPI) {
      electronAPI.writeClients(uid, data).catch(console.error);
    } else {
      saveClientsToStorage(uid, data);
    }
  }, []);

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
      persist(userId, next);
      return next;
    });
    return client;
  }, [userId, persist]);

  const saveClient = useCallback((id: string, payload: ClientPayload, displayName: string) => {
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === id
          ? { ...c, payload, displayName, updatedAt: new Date().toISOString() }
          : c
      );
      persist(userId, next);
      return next;
    });
  }, [userId, persist]);

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(userId, next);
      return next;
    });
  }, [userId, persist]);

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
      persist(userId, next);
      return next;
    });
    return duplicated;
  }, [userId, persist]);

  const renameClient = useCallback((id: string, newName: string) => {
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, displayName: newName, updatedAt: new Date().toISOString() } : c
      );
      persist(userId, next);
      return next;
    });
  }, [userId, persist]);

  const sortedClients = [...clients].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" })
  );

  return { clients: sortedClients, createClient, saveClient, deleteClient, duplicateClient, renameClient };
}

// ─── CLIENT MANAGER COMPONENT ─────────────────────────────────────────────────

type ClientManagerProps = {
  clients: ClientRecord[];
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

  const SURFACE_APP = `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`;

  return (
    <div
      className="min-h-screen"
      style={{ background: SURFACE_APP }}
    >
      {/* Header */}
      <div
        className="w-full px-6 py-5 flex items-center justify-between shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 60%, ${colorGold} 100%)`,
        }}
      >
        <div className="flex items-center gap-4">
          <img src={logoSrc} alt={cabinetName} className="h-14 w-auto object-contain drop-shadow-md" />
          <div>
            <div className="text-white font-bold text-lg leading-tight">{cabinetName}</div>
            <div className="text-white/60 text-xs font-medium tracking-wide">Gestion des dossiers clients</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Database className="h-4 w-4" />
          <span>{clients.length} dossier{clients.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

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

        {/* Liste des dossiers */}
        <div className="space-y-3">
          {clients.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Aucun dossier client. Créez-en un ci-dessus.
            </div>
          ) : (
            clients.map((client) => (
              <Card
                key={client.id}
                className="rounded-2xl border-0 shadow-md shadow-slate-100/80 hover:shadow-lg transition-shadow"
                style={{ background: "rgba(255,255,255,0.95)" }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Nom / renommage */}
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
                        <Button
                          onClick={() => handleRenameConfirm(client.id)}
                          className="rounded-lg text-xs h-8 px-3"
                          style={{ background: colorNavy, color: "#fff" }}
                        >OK</Button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >Annuler</button>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-sm truncate" style={{ color: colorNavy }}>
                          {client.displayName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Modifié le {new Date(client.updatedAt).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {renamingId !== client.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        title="Renommer"
                        onClick={() => { setRenamingId(client.id); setRenameValue(client.displayName); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Dupliquer"
                        onClick={() => onDuplicate(client.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      {confirmDeleteId === client.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 font-medium">Confirmer ?</span>
                          <button
                            onClick={() => { onDelete(client.id); setConfirmDeleteId(null); }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-0.5 rounded-lg bg-red-50"
                          >Oui</button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >Non</button>
                        </div>
                      ) : (
                        <button
                          title="Supprimer"
                          onClick={() => setConfirmDeleteId(client.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <Button
                        onClick={() => onOpen(client)}
                        className="rounded-xl px-4 h-8 text-xs font-semibold shadow-sm ml-1"
                        style={{ background: colorNavy, color: "#fff" }}
                      >
                        <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                        Ouvrir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
