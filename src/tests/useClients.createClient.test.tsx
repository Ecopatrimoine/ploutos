// @vitest-environment jsdom
//
// LOT 1 (fix autosave) — L2 : createClient ne pousse PAS vers Supabase un dossier
// encore vide (payload.data absent). Le push interviendra au 1er autosave porteur
// de data (saveClient). On espionne l'upsert Supabase pour le prouver.
//
// Environnement jsdom local a ce fichier (renderHook). Supabase mocke : aucun
// appel reseau reel, l'upsert est une vi.fn observable.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Flush complet : microtasks + une macrotache, puis commit React. Necessaire pour
// que l'etat du hook soit pleinement stabilise (le chemin "eager state" de React,
// dont depend l'assignation de updatedClient dans saveClient, n'opere que sans
// mise a jour en attente sur le fiber).
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// vi.mock est hisse : la spy doit exister au moment du hoist -> vi.hoisted.
const { upsertSpy } = vi.hoisted(() => ({
  upsertSpy: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase", () => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: async () => ({ data: [], error: null }),
    delete: () => chain,
    upsert: (...args: any[]) => upsertSpy(...args),
  };
  return {
    supabase: {
      from: () => chain,
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        refreshSession: async () => ({ error: null }),
      },
    },
  };
});

import { useClients } from "../useClients";

// authState "offline" : le montage ne declenche aucun fetch Supabase (donc aucun
// upsert parasite) ; on isole ainsi le comportement de createClient / saveClient.
const OFFLINE = "offline";

beforeEach(() => {
  upsertSpy.mockClear();
  localStorage.clear();
});

describe("createClient — pas de push d'un dossier vide (L2)", () => {
  it("createClient n'appelle PAS l'upsert Supabase (payload.data absent)", async () => {
    const { result } = renderHook(() => useClients("user-1", OFFLINE));
    await settle(); // laisser l'effet de montage se resoudre

    act(() => { result.current.createClient("Dupont"); });
    await settle();

    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("controle positif (L3) : un dossier pending AVEC data est pousse en version porteuse de donnees", async () => {
    // Un dossier deja saisi (data present) marque "pending" en local : au montage
    // authentifie, le chemin de synchro des pending DOIT le pousser, et pousser la
    // version fraiche porteuse de donnees (jamais un record vide). Ce chemin await
    // reellement l'upsert (pas de dependance au timing "eager state" de React).
    const rec = {
      id: "id-avec-data",
      displayName: "Dupont Jean",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      payload: { clientName: "Dupont", data: { person1FirstName: "Jean" } },
    };
    localStorage.setItem("ecopatrimoine_clients_user-1", JSON.stringify([rec]));
    localStorage.setItem("ecopatrimoine_pending_user-1", JSON.stringify([rec.id]));

    renderHook(() => useClients("user-1", "authenticated"));
    await settle();

    expect(upsertSpy).toHaveBeenCalled();
    const pushed = upsertSpy.mock.calls[0][0] as any;
    expect(pushed.id).toBe("id-avec-data");
    expect(pushed.payload?.data?.person1FirstName).toBe("Jean"); // version porteuse de donnees
  });
});
