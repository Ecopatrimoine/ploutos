// @vitest-environment jsdom
//
// LOT 3bis — Suppression honnete (C2) + anti-resurrection (C3).
// Le DELETE Supabase renvoie le nombre de lignes reellement supprimees ; l'app ne
// retire le dossier localement que si la suppression est confirmee, garde un tombstone
// persistant sinon, et ne laisse jamais un dossier supprime ressusciter au merge.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Etat mutable pilote par chaque test (hoisted pour etre visible dans vi.mock).
const state = vi.hoisted(() => ({ v: { remote: [] as any[], deleteRows: [] as any[], exists: [] as any[] } }));

vi.mock("@/lib/supabase", () => {
  const build = () => {
    let op: "select" | "delete" = "select";
    const b: any = {
      select: () => b,
      delete: () => { op = "delete"; return b; },
      upsert: () => Promise.resolve({ error: null }),
      eq: () => b,
      order: () => Promise.resolve({ data: state.v.remote, error: null }),
      limit: () => Promise.resolve({ data: state.v.exists, error: null }),
      // rend le builder awaitable : chemin DELETE (.delete().eq().eq().select()).
      then: (onF: any, onR: any) =>
        Promise.resolve({ data: op === "delete" ? state.v.deleteRows : state.v.remote, error: null }).then(onF, onR),
    };
    return b;
  };
  return {
    supabase: {
      from: () => build(),
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        refreshSession: async () => ({ error: null }),
      },
    },
  };
});

import { useClients } from "../useClients";

const UID = "user-del";
const rec = (id: string, name: string) => ({
  id, displayName: name,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  payload: { clientName: name, data: { person1FirstName: name } },
});

async function settle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  localStorage.clear();
  state.v = { remote: [], deleteRows: [], exists: [] };
});

describe("useClients — suppression honnete (C2) + anti-resurrection (C3)", () => {
  it("C2 >0 lignes supprimees : le dossier est retire, aucune erreur", async () => {
    const r = rec("id-1", "Alpha");
    localStorage.setItem(`ecopatrimoine_clients_${UID}`, JSON.stringify([r]));
    state.v.remote = [r];
    const { result } = renderHook(() => useClients(UID, "authenticated"));
    await settle();

    state.v.deleteRows = [{ id: "id-1" }]; // suppression serveur : 1 ligne
    state.v.exists = [];
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.deleteClient("id-1"); });
    await settle();

    expect(ok).toBe(true);
    expect(result.current.clients.find((c) => c.id === "id-1")).toBeUndefined();
    expect(result.current.deleteError).toBeNull();
    // Tombstone transitoire pose meme sur suppression confirmee (protege d'un fetch
    // initial en vol qui re-unirait la ligne au merge) ; leve au 1er sync qui confirme
    // l'absence serveur.
    expect(JSON.parse(localStorage.getItem(`ecopatrimoine_deleted_${UID}`) || "[]")).toContain("id-1");
    state.v.remote = []; state.v.deleteRows = []; state.v.exists = [];
    await act(async () => { await result.current.syncNow(); });
    await settle();
    expect(JSON.parse(localStorage.getItem(`ecopatrimoine_deleted_${UID}`) || "[]")).not.toContain("id-1");
    expect(result.current.clients.find((c) => c.id === "id-1")).toBeUndefined();
  });

  it("C2 0 ligne + ligne toujours presente : dossier CONSERVE + erreur honnete", async () => {
    const r = rec("id-2", "Beta");
    localStorage.setItem(`ecopatrimoine_clients_${UID}`, JSON.stringify([r]));
    state.v.remote = [r];
    const { result } = renderHook(() => useClients(UID, "authenticated"));
    await settle();

    state.v.deleteRows = [];              // rien supprime
    state.v.exists = [{ id: "id-2" }];    // ... et la ligne existe toujours -> refus
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.deleteClient("id-2"); });
    await settle();

    expect(ok).toBe(false);
    expect(result.current.clients.find((c) => c.id === "id-2")).toBeDefined(); // NON retire
    expect(result.current.deleteError).toMatch(/refus/i);
  });

  it("C3 tombstone persistant : un dossier supprime ne ressuscite pas au merge (remote le contient encore)", async () => {
    const r = rec("id-3", "Gamma");
    // Etat post-suppression hors-ligne : retire du local, tombstone persiste, serveur l'a encore.
    localStorage.setItem(`ecopatrimoine_clients_${UID}`, JSON.stringify([]));
    localStorage.setItem(`ecopatrimoine_deleted_${UID}`, JSON.stringify(["id-3"]));
    state.v.remote = [r];                 // le serveur a encore la ligne
    state.v.deleteRows = [{ id: "id-3" }]; // le rejeu de suppression aboutit
    state.v.exists = [];
    const { result } = renderHook(() => useClients(UID, "authenticated"));
    await settle();

    // Ne doit PAS reapparaitre malgre le remote
    expect(result.current.clients.find((c) => c.id === "id-3")).toBeUndefined();
    // Tombstone leve apres suppression confirmee au rejeu
    expect(JSON.parse(localStorage.getItem(`ecopatrimoine_deleted_${UID}`) || "[]")).not.toContain("id-3");
  });
});
