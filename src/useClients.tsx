import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, Copy, Pencil, FolderOpen, Folder, MoreHorizontal, LayoutGrid, List, CloudOff, RefreshCw, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
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

// Tombstones : ids de dossiers supprimes localement dont la suppression serveur
// n'est pas encore confirmee. Persiste (comme pending) pour survivre au reload —
// sinon un dossier supprime hors-ligne ressusciterait au merge suivant (C3).
function deletedKey(userId: string) {
  return `ecopatrimoine_deleted_${userId}`;
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

function loadDeletedIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(deletedKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDeletedIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(deletedKey(userId), JSON.stringify([...ids]));
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

// Retourne le NOMBRE de lignes reellement supprimees (via .select() = equivalent
// Prefer: return=representation). 0 = rien supprime (ligne inexistante ou refus RLS) ;
// c'est ce que l'appelant doit verifier pour ne pas mentir a l'utilisateur (C2).
async function deleteFromSupabase(userId: string, clientId: string): Promise<number> {
  if (!userId) throw new Error("userId vide — delete annulé");
  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

// La ligne existe-t-elle encore cote serveur ? Sert a lever l'ambiguite d'un DELETE
// a 0 ligne : soit deja supprimee / jamais synchronisee (sur de retirer localement),
// soit refusee et toujours presente (ne PAS retirer, resterait a l'ecran serveur).
async function existsOnSupabase(userId: string, clientId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

// Un dossier est "vide" tant que son payload ne porte pas de donnee metier
// (payload.data absent ou objet vide). C'est l'etat d'un dossier fraichement cree
// (createClient pose payload: { clientName }, sans cle data) ; le 1er autosave y
// injecte data. Fonction pure et testable.
export function hasClientData(record: ClientRecord | null | undefined): boolean {
  const data = record?.payload?.data;
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data as Record<string, unknown>).length > 0;
  return true; // valeur data non-objet non nulle → consideree presente
}

// LOT 10d N11 — résolution des Notes de synthèse au CHARGEMENT d'un dossier.
// Bug corrigé : `if (payload.notes) setNotes(...)` traitait la chaîne VIDE comme une
// absence (règle L1 « payload vide » appliquée au niveau CHAMP au lieu du niveau
// DOSSIER) -> une suppression volontaire était ignorée et l'ancienne note ressuscitait.
// Règle correcte : la protection L1 est de niveau dossier (un payload SANS data ne
// supplante pas -> on garde la note courante) ; pour un VRAI dossier (avec data), une
// note vide "" est une valeur légitime -> on l'applique. Pure & testable.
export function resolveLoadedNotes(payload: ClientPayload | null | undefined, currentNotes: string): string {
  if (!hasClientData({ payload } as ClientRecord)) return currentNotes; // L1 : ne pas écraser
  return typeof payload?.notes === "string" ? payload.notes : "";
}

// Departage pur entre deux versions d'un MEME dossier (meme id).
// Regle : le plus recent (updatedAt) gagne, SAUF s'il est vide face a un non-vide
// (un payload sans data ne supplante JAMAIS un payload avec data) ; a updatedAt
// egal, preference au non-vide ; a defaut de critere distinctif, statu quo sur `a`.
export function pickClientWinner(a: ClientRecord, b: ClientRecord): ClientRecord {
  const aHas = hasClientData(a);
  const bHas = hasClientData(b);
  // Vide vs non-vide : le non-vide gagne, quel que soit updatedAt.
  if (aHas !== bHas) return aHas ? a : b;
  // Meme richesse (deux vides ou deux non-vides) : le plus recent gagne.
  const ta = new Date(a.updatedAt).getTime();
  const tb = new Date(b.updatedAt).getTime();
  if (tb > ta) return b;
  return a; // ta > tb, ou egalite → statu quo sur `a`
}

// Fusion : remote sert de base, le local (souvent porteur des saisies non encore
// synchronisees) departage ensuite via pickClientWinner. Un record vide ne peut
// donc jamais ecraser un record porteur de donnees.
export function mergeClients(local: ClientRecord[], remote: ClientRecord[]): ClientRecord[] {
  const map = new Map<string, ClientRecord>();
  for (const c of remote) map.set(c.id, c);
  for (const c of local) {
    const existing = map.get(c.id);
    map.set(c.id, existing ? pickClientWinner(existing, c) : c);
  }
  return [...map.values()];
}

// N11 — anti-ecrasement de la synchro de fond par une edition de premier plan.
// La synchro de fond calcule son resultat a partir d'un INSTANTANE remote capture au
// montage (fetch en vol) + un freshLocal relu ensuite. Entre ce calcul et l'ecriture
// dans le state, une edition de premier plan (typiquement la SUPPRESSION d'une note)
// peut avoir atterri : ecrire l'instantane brut ecraserait alors cette edition, plus
// recente, par une version perimee (et la re-pousserait au serveur -> la note ressuscite).
// On re-departage donc chaque enregistrement de la synchro contre l'etat local COURANT
// (prev) via pickClientWinner : un enregistrement de la synchro ne remplace prev que
// s'il GAGNE (jamais une version plus ancienne n'ecrase une plus recente). Les dossiers
// presents dans prev mais absents de la synchro (crees en premier plan pendant la
// synchro) sont conserves ; les tombstones sont exclus. Pure & testable.
export function reconcileSyncResult(
  syncResult: ClientRecord[],
  prev: ClientRecord[],
  deletedIds: Set<string>,
): ClientRecord[] {
  const prevById = new Map(prev.map((c) => [c.id, c]));
  const byId = new Map<string, ClientRecord>();
  for (const c of syncResult) {
    if (deletedIds.has(c.id)) continue; // tombstone : ne pas ressusciter (C3)
    const cur = prevById.get(c.id);
    byId.set(c.id, cur ? pickClientWinner(c, cur) : c);
  }
  // Dossiers presents en local courant mais absents de la synchro (crees en premier plan
  // pendant qu'elle etait en vol) : les conserver, hors tombstones.
  for (const c of prev) {
    if (!byId.has(c.id) && !deletedIds.has(c.id)) byId.set(c.id, c);
  }
  return [...byId.values()];
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export function useClients(userId: string, authState = "authenticated") {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  // Message d'echec de suppression (C2 — honnetete) : non nul quand le serveur a
  // refuse la suppression (0 ligne, dossier toujours present). Efface au succes.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());
  const deletedRef = useRef<Set<string>>(new Set());

  // ── Nettoyage des clés orphelines (userId vide) au montage ──
  useEffect(() => {
    try {
      ["ecopatrimoine_clients_", "ecopatrimoine_pending_", "ecopatrimoine_deleted_"].forEach(k => {
        if (localStorage.getItem(k) !== null) localStorage.removeItem(k);
      });
    } catch { /* ignore */ }
  }, []);

  // Lecture du local PERSISTE (localStorage web / IPC Electron). Partage entre le
  // chargement initial ET syncNow : toute synchro doit merger contre le local persiste
  // (porteur des editions/suppressions de premier plan deja ecrites), JAMAIS contre un
  // etat React eventuellement vide au tout debut d'un reload — sinon mergeClients([],
  // remote) adopte le remote perime en bloc et ecrase la suppression locale (bug N11).
  const loadLocal = useCallback(async (): Promise<ClientRecord[]> => {
    if (isElectron && electronAPI) {
      const data = await electronAPI.readClients(userId).catch(() => []);
      return Array.isArray(data) ? data : [];
    }
    return loadClientsLocal(userId);
  }, [userId]);

  // ── LOT 3ter (T1/T2) — Reconciliation des tombstones contre le fetch AUTORITAIRE ──
  // Regle : un tombstone ne se leve QUE sur absence CONFIRMEE par LA MEME requete qui
  // pourrait le ressusciter (fetchFromSupabase, filtre user_id), ou apres un DELETE
  // serveur REELLEMENT abouti (removed>0). On N'UTILISE PLUS existsOnSupabase (filtre
  // id+user_id) pour lever : il peut diverger du fetch autoritaire (0 ligne alors que le
  // fetch renvoie encore le dossier) -> c'etait LE TROU du 3bis (levee a tort -> tombstone
  // remis a [] -> resurrection au reload suivant, diagnostic session propre du 10/07).
  // Tant qu'un id tombstone reste present cote serveur ET que le DELETE echoue (RLS /
  // course), on GARDE le tombstone (il filtre) et on RE-TENTE le DELETE (T2). Write-through
  // systematique via saveDeletedIds.
  const reconcileTombstones = useCallback(async (remoteClients: ClientRecord[]) => {
    if (deletedRef.current.size === 0) return;
    const remoteIds = new Set(remoteClients.map((c) => c.id));
    for (const id of [...deletedRef.current]) {
      if (!remoteIds.has(id)) {
        // Absent du fetch autoritaire : aucune resurrection possible -> lever.
        deletedRef.current.delete(id);
        continue;
      }
      // Encore present cote serveur : re-tenter la suppression ; ne lever QUE si aboutie.
      try {
        const removed = await deleteFromSupabase(userId, id);
        if (removed > 0) deletedRef.current.delete(id);
        // removed === 0 (refus RLS / course) : GARDER le tombstone, retry prochaine synchro.
      } catch { /* garder le tombstone */ }
    }
    saveDeletedIds(userId, deletedRef.current);
  }, [userId]);

  // ── Chargement initial ──
  useEffect(() => {
    if (!userId) { setClients([]); setSyncStatus("offline"); return; }

    pendingRef.current = loadPendingIds(userId);
    deletedRef.current = loadDeletedIds(userId); // tombstones persistes (C3)

    let cancelled = false; // éviter les mises à jour si le composant est démonté

    loadLocal().then((localClients) => {
      if (cancelled) return;
      // Ne jamais afficher un dossier tombstone (suppression locale non encore
      // confirmee cote serveur) — sinon il "clignoterait" avant le merge (C3).
      setClients(localClients.filter((c) => !deletedRef.current.has(c.id)));

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
          // Re-lecture FRAICHE du local au moment du merge : le snapshot capture au
          // montage (localClients) peut etre perime si un dossier a ete cree/saisi
          // pendant que le fetch Supabase etait en vol (course load/save). On merge
          // donc contre l'etat local courant, jamais contre l'instantane du montage.
          const freshLocal = await loadLocal();
          if (cancelled) return;
          const merged = mergeClients(freshLocal, remoteClients as ClientRecord[]);
          // Un dossier en attente de push (saisie locale non encore synchronisee) ne
          // doit JAMAIS etre ecrase par la version remote : on force la version locale
          // fraiche pour tout id present dans pendingRef. Et un dossier tombstone
          // (supprime localement, pas encore confirme serveur) ne doit JAMAIS revenir
          // du remote (C3 anti-resurrection).
          const freshById = new Map(freshLocal.map((c) => [c.id, c]));
          const guarded = merged
            .filter((c) => !deletedRef.current.has(c.id))
            .map((c) =>
              pendingRef.current.has(c.id) && freshById.has(c.id)
                ? (freshById.get(c.id) as ClientRecord)
                : c,
            );
          // N11 anti-course : re-departage le resultat de la synchro contre l'etat React
          // COURANT (prev). Une edition de premier plan atterrie entre-temps (ex :
          // suppression de note, plus recente) n'est JAMAIS ecrasee par l'instantane
          // remote perime. Meme garde que syncNow (merge contre prev), qui manquait ici.
          setClients((prev) => {
            const reconciled = reconcileSyncResult(guarded, prev, deletedRef.current);
            saveClientsLocal(userId, reconciled);
            return reconciled;
          });

          // Laisser React committer avant de pousser les pending.
          await Promise.resolve();

          // Pousser les upserts en attente — sur la base d'une RELECTURE fraiche du local
          // (porteuse d'une edition de premier plan deja persistee, ex : suppression de
          // note), re-departagee contre le resultat de synchro : on ne pousse jamais une
          // version perimee qui ferait ressusciter une suppression cote serveur.
          if (pendingRef.current.size > 0) {
            const freshest = await loadLocal();
            const reconciledForPush = reconcileSyncResult(guarded, freshest, deletedRef.current);
            const byId = new Map(reconciledForPush.map((c) => [c.id, c]));
            const toSync = [...pendingRef.current]
              .map((id) => byId.get(id))
              .filter((c): c is ClientRecord => !!c);
            await Promise.all(toSync.map((c) => upsertToSupabase(userId, c)));
            for (const c of toSync) pendingRef.current.delete(c.id);
            savePendingIds(userId, pendingRef.current);
          }
          // Reconciliation des tombstones contre le fetch AUTORITAIRE (T1/T2) : ne leve
          // que sur absence confirmee par CE fetch ou DELETE abouti ; re-tente sinon.
          await reconcileTombstones(remoteClients as ClientRecord[]);

          console.log("[useClients] Sync success, merged:", guarded.length, "clients");
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
        saveDeletedIds(uid, deletedRef.current);
      } else {
        pendingRef.current.add(changedId);
      }
      savePendingIds(uid, pendingRef.current);
    }
  }, []);

  // ── Sync arrière-plan ──
  // Retourne true si le push a effectivement abouti, false sinon. L'echec n'est PAS
  // avale silencieusement : il est journalise, le dossier reste "pending" (donc
  // reproposable a la synchro), et l'appelant (autosave) peut afficher un statut honnete.
  const syncOne = useCallback(async (uid: string, client: ClientRecord): Promise<boolean> => {
    if (!uid) return false;
    try {
      await upsertToSupabase(uid, client);
      pendingRef.current.delete(client.id);
      savePendingIds(uid, pendingRef.current);
      if (pendingRef.current.size === 0) setSyncStatus("synced");
      return true;
    } catch (err: any) {
      console.warn("[useClients] syncOne echec:", err?.message || err);
      setSyncStatus("pending");
      return false;
    }
  }, []);

  // ── Sync manuelle ──
  const syncNow = useCallback(async () => {
    if (!userId) return;
    setSyncStatus("syncing");
    try {
      const remoteClients = await fetchFromSupabase(userId);

      // Merger contre le local PERSISTE (jamais contre un prev React eventuellement vide
      // en tout debut de reload), puis reconcilier contre l'etat React courant pour ne
      // pas perdre une edition encore plus fraiche. Filtrer les tombstones (C3). Sans
      // cette base persistee, mergeClients([], remote) adopterait le remote perime en
      // bloc et ferait ressusciter une suppression de note (N11).
      const freshLocal = await loadLocal();
      const merged = mergeClients(freshLocal, remoteClients).filter((c) => !deletedRef.current.has(c.id));
      setClients((prev) => {
        const reconciled = reconcileSyncResult(merged, prev, deletedRef.current);
        saveClientsLocal(userId, reconciled);
        return reconciled;
      });

      // Laisser React flusher le state avant de pousser les pending
      await Promise.resolve();

      // Pousser les pending sur une relecture fraiche du local (reconciliee), et ne
      // retirer du pending QUE les ids reellement pousses (une edition arrivee entre-temps
      // reste pending pour la prochaine synchro).
      const freshest = await loadLocal();
      const reconciledForPush = reconcileSyncResult(merged, freshest, deletedRef.current);
      const byId = new Map(reconciledForPush.map((c) => [c.id, c]));
      const toSync = [...pendingRef.current]
        .map((id) => byId.get(id))
        .filter((c): c is ClientRecord => !!c);
      if (toSync.length > 0) {
        await Promise.all(toSync.map((c) => upsertToSupabase(userId, c)));
      }
      for (const c of toSync) pendingRef.current.delete(c.id);
      savePendingIds(userId, pendingRef.current);

      // Reconciliation des tombstones contre le fetch AUTORITAIRE (T1/T2).
      await reconcileTombstones(remoteClients);
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
    // Ne PAS pousser un dossier encore vide (payload.data absent) : un record vide
    // pousse a la creation gagnerait la course au reload face a la 1re saisie. Le
    // dossier reste marque "pending" (persist) ; le 1er autosave porteur de data le
    // poussera via saveClient. hasClientData(client) est faux ici par construction.
    if (hasClientData(client)) syncOne(userId, client);
    return client;
  }, [userId, persist, syncOne]);

  // Retourne une promesse resolue apres la tentative de push : true si le dossier
  // a ete effectivement synchronise, false sinon (echec reseau/serveur, ou id
  // introuvable). Permet a l'autosave d'afficher un indicateur honnete.
  const saveClient = useCallback((id: string, payload: ClientPayload, displayName: string): Promise<boolean> => {
    const updatedAt = new Date().toISOString();
    // Construire l'enregistrement a pousser de facon SYNCHRONE (depuis le state courant),
    // et NON depuis l'updater setClients : ce dernier peut etre differe par React quand le
    // fiber a une mise a jour en attente ("eager state"), auquel cas `updatedClient` etait
    // encore undefined au moment du test -> syncOne n'etait jamais appele et la sauvegarde
    // (ex : suppression de note) ne partait pas au serveur (elle attendait la prochaine
    // synchro). On garde le createdAt de l'existant ; a defaut, nouveau dossier.
    const existing = clients.find((c) => c.id === id);
    const updatedClient: ClientRecord = existing
      ? { ...existing, payload, displayName, updatedAt }
      : { id, displayName, createdAt: updatedAt, updatedAt, payload };
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, payload, displayName, updatedAt } : c
      );
      persist(userId, next, id);
      return next;
    });
    // Side effects HORS du setState
    setSyncStatus("pending");
    return syncOne(userId, updatedClient);
  }, [userId, persist, syncOne, clients]);

  // Retrait local d'un dossier (+ purge pending ; tombstone si suppression serveur
  // pas encore confirmee). saveClientsLocal ecrit le localStorage sans le dossier.
  const removeLocally = useCallback((id: string, tombstone: boolean) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveClientsLocal(userId, next);
      return next;
    });
    pendingRef.current.delete(id);
    if (tombstone) deletedRef.current.add(id); else deletedRef.current.delete(id);
    savePendingIds(userId, pendingRef.current);
    saveDeletedIds(userId, deletedRef.current);
  }, [userId]);

  // Suppression HONNETE (C2 + C3). On ne retire le dossier localement QUE si la
  // suppression est confirmee cote serveur (>0 ligne, ou ligne deja absente). Si le
  // serveur refuse (0 ligne + ligne toujours presente) : on garde le dossier et on
  // affiche une erreur.
  // Dans TOUS les retraits on pose un tombstone (meme suppression confirmee) : un fetch
  // initial encore en vol (demarre AVANT la suppression, donc avec la ligne encore
  // presente cote serveur) pourrait resoudre APRES et re-unir le dossier au merge. Le
  // tombstone filtre ce re-ajout ; il est leve au 1er sync qui confirme l'absence serveur.
  const deleteClient = useCallback(async (id: string): Promise<boolean> => {
    setDeleteError(null);
    if (!userId || authState !== "authenticated") {
      removeLocally(id, true);
      setSyncStatus("pending");
      return true;
    }
    setSyncStatus("syncing");
    try {
      const removed = await deleteFromSupabase(userId, id);
      if (removed > 0) {
        removeLocally(id, true);
        setSyncStatus(pendingRef.current.size > 0 ? "pending" : "synced");
        return true;
      }
      // 0 ligne : lever l'ambiguite (deja supprime / local-only vs refus serveur).
      const stillThere = await existsOnSupabase(userId, id);
      if (stillThere) {
        setDeleteError("Suppression refusée par le serveur — réessayez.");
        setSyncStatus(pendingRef.current.size > 0 ? "pending" : "synced");
        return false;
      }
      removeLocally(id, true);
      setSyncStatus(pendingRef.current.size > 0 ? "pending" : "synced");
      return true;
    } catch (err: any) {
      console.warn("[useClients] delete echec reseau:", err?.message || err);
      removeLocally(id, true);
      setSyncStatus("pending");
      return true;
    }
  }, [userId, authState, removeLocally]);

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

  const dismissDeleteError = useCallback(() => setDeleteError(null), []);

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
    deleteError,
    dismissDeleteError,
  };
}

// ─── CLIENT MANAGER COMPONENT ─────────────────────────────────────────────────

type ClientManagerProps = {
  clients: ClientRecord[];
  syncStatus: SyncStatus;
  syncNow: () => void;
  onOpen: (client: ClientRecord) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void | Promise<boolean>;
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
  // C2 — suppression honnete : message d'echec (refus serveur) + acquittement.
  deleteError?: string | null;
  dismissDeleteError?: () => void;
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
  deleteError,
  dismissDeleteError,
}: ClientManagerProps) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // C4 — position d'ancrage du menu kebab (rendu en portal document.body).
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
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

  // C4 — la fermeture au clic exterieur est desormais assuree par le backdrop du
  // portal (voir renderCard), qui capte les clics hors menu et reinitialise menuPos.

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
      // L'utilisateur est identifié côté fonction via le JWT ; plus de user_id
      // dans le body (anti-IDOR, cf. L2). Sans session valide, on n'appelle pas.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { console.error("Portail Stripe : session absente"); return; }
      const res = await fetch("https://ysbgfiqsuvdwzkcsiqir.supabase.co/functions/v1/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ return_url: window.location.origin }),
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
                onClick={(e) => {
                  e.stopPropagation();
                  // C4 — ancrer le menu sous le kebab, aligne a droite (coords viewport
                  // pour le portal en position:fixed).
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
                  setOpenMenuId(menuOpen ? null : client.id);
                }}
              >
                <MoreHorizontal size={19} />
              </button>
            </>
          )}

          {/* C4 — menu rendu en PORTAL (document.body) : au-dessus de toutes les cards
              (z-index eleve) + backdrop invisible qui capte les clics hors menu, pour
              qu'aucun clic ne traverse vers la card du dessous (ouvertures accidentelles). */}
          {menuOpen && !isRenaming && menuPos && createPortal(
            <>
              <div
                onClick={() => { setOpenMenuId(null); setMenuPos(null); }}
                style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }}
              />
              <div
                className="acc-menu"
                onClick={(e) => e.stopPropagation()}
                // C4-suite : le portal est rendu dans document.body, HORS de .acc-root
                // qui porte les custom properties --acc-*. On les re-pose ici (accVars)
                // pour que le style .acc-menu (fond de carte, bordure, coins, ombre,
                // padding, hover des items, separateur, couleur alerte de "Supprimer")
                // resolve correctement — sinon le conteneur reste transparent.
                style={{ ...accVars, position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              >
                <button onClick={() => { setOpenMenuId(null); setMenuPos(null); onOpen(client); }}>
                  <FolderOpen /> Ouvrir
                </button>
                <button onClick={() => { setOpenMenuId(null); setMenuPos(null); setRenamingId(client.id); setRenameValue(client.displayName); }}>
                  <Pencil /> Renommer
                </button>
                <button onClick={() => { setOpenMenuId(null); setMenuPos(null); onDuplicate(client.id); }}>
                  <Copy /> Dupliquer (scénario)
                </button>
                <hr />
                <button className="dg" onClick={() => { setOpenMenuId(null); setMenuPos(null); setConfirmDeleteId(client.id); }}>
                  <Trash2 /> Supprimer…
                </button>
              </div>
            </>,
            document.body,
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
                <button onClick={handleAbonnement} className="underline font-bold inline-flex items-center gap-1">S'abonner <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            );
          })()}
          {licence?.status === "cancelling" && (
            <div className="w-full py-1.5 px-6 flex items-center justify-between text-xs font-semibold"
              style={{ background: BRAND.warningBg, color: BRAND.warning, borderBottom: `1px solid ${BRAND.warningBorder}` }}>
              <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> Annulation prévue — accès maintenu jusqu'à fin de période</span>
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
                  <span className="acc-recent-chev"><ChevronRight className="h-4 w-4" aria-hidden="true" /></span>
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

        {/* C2 — Echec honnete de suppression : le serveur a refuse, le dossier reste visible */}
        {deleteError && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center justify-between"
            style={{ background: BRAND.dangerBg, color: BRAND.danger, border: `1px solid ${BRAND.danger}` }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span>{deleteError}</span>
            </div>
            {dismissDeleteError && (
              <button onClick={dismissDeleteError} className="font-semibold underline text-xs">Fermer</button>
            )}
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

        {/* Dossiers */}
        <div className="acc-sec-head">
          <div className="acc-sec-title">
            <span className="acc-sec-dot"><Folder /></span>
            Dossiers clients <span className="acc-sec-count">({visibleClients.length})</span>
            {(syncStatus === "pending" || syncStatus === "offline") && (
              <button className="acc-syncbtn" onClick={syncNow} title="Synchroniser maintenant">
                <RefreshCw /> Synchroniser
              </button>
            )}
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
                  <th>Naissance</th>
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
        <p className="mt-1">© Ploutos {new Date().getFullYear()} — Données synchronisées — copie locale de travail</p>
        {/* Badge version : version package.json ("dev" en local). Hash de commit retire de l'UI (Lot 6 C2). */}
        <p className="mt-1" style={{ fontSize: 11, color: BRAND.muted }}>
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
