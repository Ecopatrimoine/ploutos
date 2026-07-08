import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Trash2, Copy, Pencil, FolderOpen, Folder, MoreHorizontal, LayoutGrid, List, CloudOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BRAND, SURFACE, FIELD } from "./constants";
import {
  EMPTY_CRITERIA,
  anyCriteria,
  draftDossierName,
  matchesCriteria,
  dossierName,
  dossierMeta,
  dossierResume,
  formatRelativeDate,
  formatBirthDateFr,
  departementFrom,
  type SearchCriteria,
  type SortMode,
  type DossierData,
} from "./lib/accueil/dossierResume";
import { AccueilHeader } from "./components/AccueilHeader";

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
  recommandations?: unknown;  // Lot 7 — Recommandation[] (cf. lib/conformite/recommandations)
  piecesJointes?: unknown;    // Lot 8e — PieceJointe[] (cf. lib/conformite/piecesJointes)
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
  colorBlue?: string;
  conseiller?: string;
  orias?: string;
  onOpenParametres: () => void;
  onOpenCalc?: () => void;
  isInstallable?: boolean;
  onInstall?: () => void;
  // Nouveaux props
  onSignOut?: () => void;
  licence?: { type: string | null; status: string; isValid: boolean; trialDaysLeft?: number } | null;
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
  colorBlue,
  conseiller,
  orias,
  onOpenParametres,
  onOpenCalc,
  isInstallable = false,
  onInstall,
  onSignOut,
  licence,
  userId = "",
}: ClientManagerProps) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("modif");
  const [view, setView] = useState<"cards" | "list">("cards");

  const setCrit = (key: keyof SearchCriteria, value: string) =>
    setCriteria((c) => ({ ...c, [key]: value }));

  // "+ Nouveau dossier" et "Créer ce dossier" : comportement de création existant
  // (onCreate crée puis ouvre), nom pré-alimenté depuis les critères Nom/Prénom.
  const handleNewDossier = () => onCreate(draftDossierName(criteria));

  const handleReset = () => setCriteria(EMPTY_CRITERIA);

  const handleRenameConfirm = (id: string) => {
    const val = renameValue.trim();
    if (val) onRename(id, val);
    setRenamingId(null);
    setRenameValue("");
  };

  // Fermer le menu contextuel au clic extérieur. Le clic sur le kebab et sur le
  // menu stoppe la propagation : ce listener n'attrape que les clics "ailleurs".
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const SURFACE_APP = "linear-gradient(135deg, #f5f0e8 0%, #fdf8f0 40%, #f0ece4 100%)";

  // ── État d'abonnement (R2) — source : useLicense (licence.trialDaysLeft/status) ──
  const isTrial = licence?.type === "trial";
  const trialDays = licence?.trialDaysLeft ?? 0;
  const abonnementBadge = isTrial && licence?.status === "active" ? `Essai · ${trialDays} j` : undefined;
  // Bouton Abonnement visible pour l'essai (badge) OU l'abonnement payant actif.
  const showAbonnement =
    !!userId && (isTrial || (licence?.type === "paid" && licence?.status === "active"));
  // Bannière pleine largeur seulement si essai <= 5 jours restants OU expiré.
  const showTrialBanner =
    !!userId && isTrial && ((licence?.status === "active" && trialDays <= 5) || licence?.status === "expired");

  // Action Abonnement : portail Stripe si payant, page d'abonnement sinon (essai).
  // Les deux URLs préexistent dans le code (portail + app.ploutos-cgp.fr).
  const handleAbonnement = async () => {
    if (licence?.type === "paid") {
      const res = await fetch("https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, return_url: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } else {
      window.open("https://app.ploutos-cgp.fr", "_blank");
    }
  };

  // Couleurs de l'accueil v2 : custom properties posées inline depuis les tokens
  // BRAND / SURFACE / FIELD (aucune couleur codée en dur dans index.css).
  const accVars = {
    ["--acc-navy" as any]: BRAND.navy,
    ["--acc-gold" as any]: BRAND.gold,
    ["--acc-gold-deep" as any]: FIELD.borderFocus,
    ["--acc-muted" as any]: BRAND.muted,
    ["--acc-inactive" as any]: BRAND.inactive,
    ["--acc-card" as any]: SURFACE.card,
    ["--acc-border" as any]: SURFACE.border,
    ["--acc-field" as any]: FIELD.fill,
    ["--acc-field-border" as any]: FIELD.border,
    ["--acc-danger" as any]: BRAND.danger,
    ["--acc-danger-bg" as any]: BRAND.dangerBg,
    ["--acc-success" as any]: BRAND.success,
    ["--acc-shadow" as any]: SURFACE.cardShadow,
    ["--acc-shadow-hover" as any]: SURFACE.cardShadowHover,
  } as React.CSSProperties;

  const dataOf = (c: ClientRecord): DossierData => (c.payload?.data ?? {}) as DossierData;

  const byRecent = (a: ClientRecord, b: ClientRecord) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  // Reprendre là où vous en étiez : 4 dossiers les plus récents (toujours, hors filtre).
  const recents = useMemo(() => [...clients].sort(byRecent).slice(0, 4), [clients]);

  // Filtre multi-critères (cumulatif) puis tri (dernière modification par défaut, ou nom A→Z).
  const visibleClients = useMemo(() => {
    const filtered = anyCriteria(criteria)
      ? clients.filter((c) => matchesCriteria(dataOf(c), criteria))
      : clients;
    const sorted = [...filtered];
    if (sortMode === "alpha") {
      sorted.sort((a, b) =>
        dossierName(dataOf(a), a.displayName).localeCompare(
          dossierName(dataOf(b), b.displayName),
          "fr",
          { sensitivity: "base" },
        ),
      );
    } else {
      sorted.sort(byRecent);
    }
    return sorted;
  }, [clients, criteria, sortMode]);

  // Indicateur de sync (global, offline-first existant) affiché au pied de chaque carte.
  const renderSync = () => {
    const map: Record<string, { cls: string; label: string }> = {
      synced:  { cls: "ok",   label: "Synchronisé" },
      pending: { cls: "wait", label: "En attente" },
      syncing: { cls: "wait", label: "Synchronisation…" },
      offline: { cls: "off",  label: "Hors ligne" },
    };
    const s = map[syncStatus] ?? map.syncing;
    return (
      <span className={`acc-sync ${s.cls}`}>
        <i /> {s.label}
      </span>
    );
  };

  const renderCard = (client: ClientRecord) => {
    const d = dataOf(client);
    const name = dossierName(d, client.displayName);
    const meta = dossierMeta(d);
    const resume = dossierResume(d);
    const isRenaming = renamingId === client.id;
    const isConfirming = confirmDeleteId === client.id;
    const menuOpen = openMenuId === client.id;
    return (
      <div
        key={client.id}
        className="acc-card"
        tabIndex={0}
        role="button"
        onClick={() => { if (!isRenaming && !isConfirming) onOpen(client); }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isRenaming && !isConfirming) {
            e.preventDefault();
            onOpen(client);
          }
        }}
      >
        <div className="acc-card-top">
          {isRenaming ? (
            <div className="acc-rename" onClick={(e) => e.stopPropagation()}>
              <input
                className="ploutos-field"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameConfirm(client.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
              />
              <button className="acc-rename-ok" onClick={() => handleRenameConfirm(client.id)}>OK</button>
              <button className="acc-rename-cancel" onClick={() => setRenamingId(null)}>Annuler</button>
            </div>
          ) : (
            <>
              <div style={{ minWidth: 0 }}>
                <div className="acc-card-name">{name}</div>
                {meta && <div className="acc-card-meta">{meta}</div>}
              </div>
              <button
                className="acc-kebab"
                title="Actions du dossier"
                aria-label="Actions du dossier"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : client.id); }}
              >
                <MoreHorizontal size={19} />
              </button>
            </>
          )}

          {menuOpen && !isRenaming && (
            <div className="acc-menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setOpenMenuId(null); onOpen(client); }}>
                <FolderOpen /> Ouvrir
              </button>
              <button onClick={() => { setOpenMenuId(null); setRenamingId(client.id); setRenameValue(client.displayName); }}>
                <Pencil /> Renommer
              </button>
              <button onClick={() => { setOpenMenuId(null); onDuplicate(client.id); }}>
                <Copy /> Dupliquer (scénario)
              </button>
              <hr />
              <button className="dg" onClick={() => { setOpenMenuId(null); setConfirmDeleteId(client.id); }}>
                <Trash2 /> Supprimer…
              </button>
            </div>
          )}
        </div>

        {!isRenaming && resume && <div className="acc-card-sum">{resume}</div>}

        {!isRenaming && (
          <div className="acc-card-foot">
            {isConfirming ? (
              <div className="acc-confirm" onClick={(e) => e.stopPropagation()}>
                <span>Supprimer ce dossier ?</span>
                <button className="acc-confirm-yes" onClick={() => { onDelete(client.id); setConfirmDeleteId(null); }}>Oui</button>
                <button className="acc-confirm-no" onClick={() => setConfirmDeleteId(null)}>Non</button>
              </div>
            ) : (
              <>
                <span>Modifié {formatRelativeDate(client.updatedAt)}</span>
                {renderSync()}
              </>
            )}
          </div>
        )}
      </div>
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
      {/* Bannière abonnement (R2) — pleine largeur, essai <= 5 j / expiré ou annulation */}
      {userId && (
        <div style={{ position:"relative", zIndex:2 }}>
          {showTrialBanner && (() => {
            const expired = licence?.status === "expired";
            return (
              <div className="w-full text-center py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-3"
                style={{
                  background: expired ? BRAND.dangerBg : BRAND.warningBg,
                  color: expired ? BRAND.danger : BRAND.warning,
                  borderBottom: `1px solid ${expired ? BRAND.dangerBorder : BRAND.warningBorder}`,
                }}>
                <span>
                  {expired
                    ? "Votre essai gratuit a expiré."
                    : `Essai gratuit — ${trialDays} jour${trialDays > 1 ? "s" : ""} restant${trialDays > 1 ? "s" : ""}.`}
                </span>
                <button onClick={handleAbonnement} className="underline font-bold">S'abonner →</button>
              </div>
            );
          })()}
          {licence?.status === "cancelling" && (
            <div className="w-full py-1.5 px-6 flex items-center justify-between text-xs font-semibold"
              style={{ background: BRAND.warningBg, color: BRAND.warning, borderBottom: `1px solid ${BRAND.warningBorder}` }}>
              <span>⚠️ Annulation prévue — accès maintenu jusqu'à fin de période</span>
              <button onClick={handleAbonnement} className="underline font-bold">Réactiver</button>
            </div>
          )}
        </div>
      )}


      {/* Main — Accueil v2 (Lot 1 + header Lot 2) */}
      <div className="acc-root" style={{ ...accVars, position:"relative", zIndex:1, width:"100%", padding:"26px 26px 60px" }}>

        {/* Header cabinet unifié (Lot 2) */}
        <AccueilHeader
          cabColors={{ navy: colorNavy, sky: colorSky, blue: colorBlue, gold: colorGold, cream: colorCream }}
          cabinetName={cabinetName}
          conseiller={conseiller}
          orias={orias}
          logoSrc={logoSrc}
          onOpenCalc={onOpenCalc}
          onOpenParametres={onOpenParametres}
          onAbonnement={showAbonnement ? handleAbonnement : undefined}
          abonnementBadge={abonnementBadge}
          onSignOut={onSignOut}
          isInstallable={isInstallable}
          onInstall={onInstall}
        />

        {/* Reprendre là où vous en étiez — dossiers récents */}
        {clients.length > 0 && (
          <>
            <div className="acc-sec-head">
              <div className="acc-sec-title">
                <span className="acc-sec-dot">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
                </span>
                Reprendre là où vous en étiez
              </div>
            </div>
            <div className="acc-recents">
              {recents.map((c) => (
                <button key={c.id} className="acc-recent" onClick={() => onOpen(c)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="acc-recent-name">{dossierName(dataOf(c), c.displayName)}</div>
                    <div className="acc-recent-when">Modifié {formatRelativeDate(c.updatedAt).toLowerCase()}</div>
                  </div>
                  <span className="acc-recent-chev">→</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Recherche multi-critères + Nouveau dossier */}
        <div className="acc-search">
          <div className="acc-fields">
            <div className="acc-fld">
              <label htmlFor="acc-q-nom">Nom</label>
              <input id="acc-q-nom" className="ploutos-field acc-input" type="text" autoComplete="off"
                placeholder="ex. Delacroix" value={criteria.nom}
                onChange={(e) => setCrit("nom", e.target.value)} />
            </div>
            <div className="acc-fld">
              <label htmlFor="acc-q-prenom">Prénom</label>
              <input id="acc-q-prenom" className="ploutos-field acc-input" type="text" autoComplete="off"
                placeholder="ex. Hélène" value={criteria.prenom}
                onChange={(e) => setCrit("prenom", e.target.value)} />
            </div>
            <div className="acc-fld">
              <label htmlFor="acc-q-naiss">Date de naissance</label>
              <input id="acc-q-naiss" className="ploutos-field acc-input" type="text" autoComplete="off"
                placeholder="même partielle : 1978, 03/1978…" value={criteria.naiss}
                onChange={(e) => setCrit("naiss", e.target.value)} />
            </div>
            <div className="acc-fld">
              <label htmlFor="acc-q-dept">Département</label>
              <input id="acc-q-dept" className="ploutos-field acc-input" type="text" autoComplete="off"
                placeholder="ex. 66" value={criteria.dept}
                onChange={(e) => setCrit("dept", e.target.value)} />
            </div>
          </div>
          <div className="acc-actions">
            {anyCriteria(criteria) && (
              <button className="acc-reset" onClick={handleReset}>Effacer</button>
            )}
            <button className="acc-new" onClick={handleNewDossier}>
              <span className="acc-new-plus">+</span> Nouveau dossier
            </button>
          </div>
        </div>

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

        {/* Dossiers */}
        <div className="acc-sec-head">
          <div className="acc-sec-title">
            <span className="acc-sec-dot"><Folder /></span>
            Dossiers clients <span className="acc-sec-count">({visibleClients.length})</span>
          </div>
          <div className="acc-toolbar">
            <select
              className="ploutos-field acc-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              title="Trier les dossiers"
            >
              <option value="modif">Tri : dernière modification</option>
              <option value="alpha">Tri : nom A → Z</option>
            </select>
            <div className="acc-viewtog">
              <button
                className={view === "cards" ? "on" : ""}
                onClick={() => setView("cards")}
                title="Vue cartes"
                aria-label="Vue cartes"
                aria-pressed={view === "cards"}
              >
                <LayoutGrid />
              </button>
              <button
                className={view === "list" ? "on" : ""}
                onClick={() => setView("list")}
                title="Vue liste"
                aria-label="Vue liste"
                aria-pressed={view === "list"}
              >
                <List />
              </button>
            </div>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="acc-empty">
            <b>Aucun dossier pour l'instant</b> — créez votre premier dossier client.<br />
            <button className="acc-empty-btn" onClick={handleNewDossier}>
              <span className="acc-empty-plus">+</span> Nouveau dossier
            </button>
          </div>
        ) : visibleClients.length === 0 ? (
          <div className="acc-empty">
            Aucun dossier ne correspond à cette recherche.<br />
            Vérifiez l'orthographe, ou créez ce dossier s'il n'existe pas encore.<br />
            <button className="acc-empty-btn" onClick={handleNewDossier}>
              <span className="acc-empty-plus">+</span> Créer ce dossier
            </button>
          </div>
        ) : view === "list" ? (
          <div className="acc-tablewrap">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Né(e) le</th>
                  <th>Dépt</th>
                  <th>Situation</th>
                  <th>Modifié</th>
                  <th>Sync</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((c) => {
                  const d = dataOf(c);
                  return (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onClick={() => onOpen(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(c); }
                      }}
                    >
                      <td className="tname">{dossierName(d, c.displayName)}</td>
                      <td className="tinfo">{formatBirthDateFr(d.person1BirthDate) || "—"}</td>
                      <td className="tinfo">{departementFrom(d.codePostal) || "—"}</td>
                      <td className="tsum">{dossierResume(d) || "—"}</td>
                      <td className="tdate">{formatRelativeDate(c.updatedAt)}</td>
                      <td>{renderSync()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="acc-grid">
            {visibleClients.map((client) => renderCard(client))}
          </div>
        )}
      </div>

      {/* Footer citation */}
      <div className="mt-auto py-6 text-center text-xs text-slate-400" style={{ position:"relative", zIndex:1 }}>
        <p style={{ fontStyle:"italic" }}>« La richesse ne consiste pas à avoir de nombreuses possessions, mais à avoir peu de besoins. »</p>
        <p className="mt-1">© Ploutos {new Date().getFullYear()} — Données stockées localement</p>
        {/* Badge version : version package.json + hash de commit (Netlify) — "dev" en local. */}
        <p className="mt-1" style={{ fontSize: 11, color: BRAND.muted }}>
          v{__APP_VERSION__} · {__COMMIT_HASH__}
        </p>
      </div>
    </div>
  );
}
