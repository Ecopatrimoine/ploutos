// ─── Types client EcoPatrimoine ───────────────────────────────────────────────

export interface ClientRecord {
  id: string
  // Identité
  displayName: string        // Nom affiché dans la liste (ex: "DUPONT Jean & Marie")
  createdAt: string          // ISO date
  updatedAt: string          // ISO date
  // Données complètes sérialisées
  payload: ClientPayload
}

export interface ClientPayload {
  clientName: string
  notes: string
  data: unknown
  irOptions: unknown
  successionData: unknown
  hypotheses: unknown
  baseSnapshot: unknown
  mission: unknown
}

// Liste des clients stockée en localStorage
export type ClientList = ClientRecord[]

// Clé localStorage pour la liste
export const CLIENTS_STORAGE_KEY = 'ecp_clients_v1'
export const ACTIVE_CLIENT_KEY = 'ecp_active_client_v1'
