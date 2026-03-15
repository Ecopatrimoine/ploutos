// ─── Hook gestion multi-clients ───────────────────────────────────────────────
import { useState, useCallback } from 'react'
import type { ClientRecord, ClientList, ClientPayload } from '../types/client'
import { CLIENTS_STORAGE_KEY } from '../types/client'

function loadClients(): ClientList {
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ClientList
  } catch {
    return []
  }
}

function saveClients(clients: ClientList): void {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients))
  } catch (e) {
    console.warn('EcoPatrimoine: impossible de sauvegarder les clients', e)
  }
}

function generateId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useClients() {
  const [clients, setClients] = useState<ClientList>(() => loadClients())

  // ── Créer un nouveau client ──
  const createClient = useCallback((displayName: string): ClientRecord => {
    const now = new Date().toISOString()
    const newClient: ClientRecord = {
      id: generateId(),
      displayName,
      createdAt: now,
      updatedAt: now,
      payload: {
        clientName: displayName,
        notes: '',
        data: null,
        irOptions: null,
        successionData: null,
        hypotheses: [],
        baseSnapshot: { savedAt: null, data: null, successionData: null, irOptions: null },
        mission: null,
      },
    }
    const updated = [newClient, ...clients]
    setClients(updated)
    saveClients(updated)
    return newClient
  }, [clients])

  // ── Sauvegarder le payload d'un client ──
  const saveClient = useCallback((id: string, payload: ClientPayload, displayName?: string) => {
    const updated = clients.map(c =>
      c.id === id
        ? { ...c, displayName: displayName || c.displayName, payload, updatedAt: new Date().toISOString() }
        : c
    )
    setClients(updated)
    saveClients(updated)
  }, [clients])

  // ── Supprimer un client ──
  const deleteClient = useCallback((id: string) => {
    const updated = clients.filter(c => c.id !== id)
    setClients(updated)
    saveClients(updated)
  }, [clients])

  // ── Dupliquer un client ──
  const duplicateClient = useCallback((id: string): ClientRecord | null => {
    const source = clients.find(c => c.id === id)
    if (!source) return null
    const now = new Date().toISOString()
    const copy: ClientRecord = {
      ...source,
      id: generateId(),
      displayName: `${source.displayName} (copie)`,
      createdAt: now,
      updatedAt: now,
    }
    const updated = [copy, ...clients]
    setClients(updated)
    saveClients(updated)
    return copy
  }, [clients])

  // ── Renommer un client ──
  const renameClient = useCallback((id: string, newName: string) => {
    const updated = clients.map(c =>
      c.id === id ? { ...c, displayName: newName, updatedAt: new Date().toISOString() } : c
    )
    setClients(updated)
    saveClients(updated)
  }, [clients])

  return {
    clients,
    createClient,
    saveClient,
    deleteClient,
    duplicateClient,
    renameClient,
  }
}
