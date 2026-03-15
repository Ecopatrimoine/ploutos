/**
 * usePersistence.ts
 * Hook de persistance localStorage pour EcoPatrimoine Conseil
 * Sauvegarde automatique de toutes les données importantes
 */

import { useState, useEffect, useCallback } from 'react'

// Clés de stockage
export const STORAGE_KEYS = {
  CABINET: 'ecp_cabinet_v1',
  LOGO: 'ecp_logo_v1',
  SIGNATURE: 'ecp_signature_v1',
  CLIENT_NAME: 'ecp_client_name_v1',
  DATA: 'ecp_data_v1',
  IR_OPTIONS: 'ecp_ir_options_v1',
  SUCCESSION_DATA: 'ecp_succession_data_v1',
  HYPOTHESES: 'ecp_hypotheses_v1',
  NOTES: 'ecp_notes_v1',
  MISSION: 'ecp_mission_v1',
  BASE_SNAPSHOT: 'ecp_base_snapshot_v1',
} as const

// ── Lecture sécurisée ──────────────────────────────────────────
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// ── Écriture sécurisée ─────────────────────────────────────────
export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // localStorage peut être plein (quota dépassé)
    console.warn('EcoPatrimoine: impossible de sauvegarder', key, e)
  }
}

// ── Hook useState persistant ────────────────────────────────────
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStorage(key, initialValue))

  // Sauvegarde automatique à chaque changement
  useEffect(() => {
    writeStorage(key, state)
  }, [key, state])

  return [state, setState]
}

// ── Hook pour les images en base64 (logo, signature) ───────────
export function usePersistedImage(
  key: string,
  initialValue: string
): [string, (src: string) => void] {
  const [src, setSrc] = useState<string>(() => readStorage(key, initialValue))

  const update = useCallback(
    (newSrc: string) => {
      setSrc(newSrc)
      try {
        localStorage.setItem(key, newSrc) // Stockage direct (pas JSON)
      } catch {
        console.warn('EcoPatrimoine: image trop grande pour localStorage', key)
      }
    },
    [key]
  )

  // Chargement initial (images stockées directement, pas JSON)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored && stored !== 'null') setSrc(stored)
    } catch {}
  }, [key])

  return [src, update]
}

// ── Utilitaire : effacer toutes les données d'un client ─────────
export function clearClientData(): void {
  const clientKeys = [
    STORAGE_KEYS.CLIENT_NAME,
    STORAGE_KEYS.DATA,
    STORAGE_KEYS.IR_OPTIONS,
    STORAGE_KEYS.SUCCESSION_DATA,
    STORAGE_KEYS.HYPOTHESES,
    STORAGE_KEYS.NOTES,
    STORAGE_KEYS.MISSION,
    STORAGE_KEYS.BASE_SNAPSHOT,
  ]
  clientKeys.forEach((k) => localStorage.removeItem(k))
}

// ── Utilitaire : taille utilisée ───────────────────────────────
export function getStorageUsageKb(): number {
  let total = 0
  for (const key of Object.values(STORAGE_KEYS)) {
    const item = localStorage.getItem(key)
    if (item) total += item.length * 2 // UTF-16 = 2 octets/char
  }
  return Math.round(total / 1024)
}
