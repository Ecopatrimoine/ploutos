// ─── Écran d'accueil — Gestionnaire de clients ────────────────────────────────
import { useState } from 'react'
import { Search, Plus, Trash2, Copy, Pencil, FolderOpen, Users, Calendar, ChevronRight } from 'lucide-react'
import type { ClientRecord } from '../types/client'

interface ClientManagerProps {
  clients: ClientRecord[]
  onOpen: (client: ClientRecord) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  logoSrc: string
  cabinetName: string
  colorNavy: string
  colorGold: string
  colorSky: string
  colorCream: string
}

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
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered = clients.filter(c =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    } catch { return '—' }
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setShowCreate(false)
  }

  const handleRename = (id: string) => {
    if (!renameValue.trim()) return
    onRename(id, renameValue.trim())
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(circle at top left, rgba(227,175,100,0.18) 0%, rgba(248,246,247,1) 34%, rgba(251,236,215,0.62) 62%, rgba(238,242,255,1) 100%)`,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 38%, #516AC7 68%, ${colorGold} 100%)`,
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 24px rgba(16,27,59,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={logoSrc} alt="Logo" style={{ height: '52px', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} />
          <div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Logiciel de gestion patrimoniale
            </div>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{cabinetName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
          <Users size={16} />
          <span>{clients.length} dossier{clients.length !== 1 ? 's' : ''} client{clients.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Titre + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: colorNavy, margin: 0 }}>Dossiers clients</h1>
            <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>Sélectionnez un dossier ou créez-en un nouveau</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`,
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16,27,59,0.2)',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={16} />
            Nouveau dossier
          </button>
        </div>

        {/* Modal création */}
        {showCreate && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(16,27,59,0.12)',
            border: `1px solid rgba(227,175,100,0.3)`,
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: colorNavy, marginBottom: '12px' }}>
              Nouveau dossier client
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Ex: DUPONT Jean & Marie"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false) }}
                style={{
                  flex: 1,
                  border: `1px solid rgba(227,175,100,0.4)`,
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button onClick={handleCreate} style={{
                background: colorGold, color: colorNavy, border: 'none',
                borderRadius: '10px', padding: '8px 18px', fontWeight: 700,
                cursor: 'pointer', fontSize: '14px',
              }}>
                Créer
              </button>
              <button onClick={() => setShowCreate(false)} style={{
                background: '#f1f1f1', color: '#666', border: 'none',
                borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '14px',
              }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Recherche */}
        {clients.length > 0 && (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid rgba(227,175,100,0.3)',
                borderRadius: '12px',
                padding: '10px 14px 10px 40px',
                fontSize: '14px',
                background: 'rgba(255,255,255,0.9)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Liste clients */}
        {filtered.length === 0 && clients.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: '#aaa', fontSize: '15px',
          }}>
            <FolderOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3, display: 'block' }} />
            <div style={{ fontWeight: 600, marginBottom: '8px', color: '#888' }}>Aucun dossier client</div>
            <div style={{ fontSize: '13px' }}>Cliquez sur "Nouveau dossier" pour commencer</div>
          </div>
        )}

        {filtered.length === 0 && clients.length > 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
            Aucun résultat pour "{search}"
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(client => (
            <div key={client.id} style={{
              background: 'rgba(255,255,255,0.92)',
              borderRadius: '14px',
              border: '1px solid rgba(227,175,100,0.2)',
              boxShadow: '0 2px 8px rgba(16,27,59,0.06)',
              overflow: 'hidden',
              transition: 'box-shadow 0.15s',
            }}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,27,59,0.12)')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,27,59,0.06)')}
            >
              {renamingId === client.id ? (
                <div style={{ display: 'flex', gap: '8px', padding: '14px 16px' }}>
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(client.id); if (e.key === 'Escape') setRenamingId(null) }}
                    style={{
                      flex: 1, border: `1px solid ${colorGold}`, borderRadius: '8px',
                      padding: '6px 12px', fontSize: '14px', outline: 'none',
                    }}
                  />
                  <button onClick={() => handleRename(client.id)} style={{
                    background: colorGold, color: colorNavy, border: 'none',
                    borderRadius: '8px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                  }}>OK</button>
                  <button onClick={() => setRenamingId(null)} style={{
                    background: '#eee', color: '#666', border: 'none',
                    borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px',
                  }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: '12px' }}>
                  {/* Icône */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: `linear-gradient(135deg, ${colorCream} 0%, rgba(227,175,100,0.2) 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid rgba(227,175,100,0.3)`,
                  }}>
                    <FolderOpen size={18} style={{ color: colorGold }} />
                  </div>

                  {/* Nom + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: colorNavy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.displayName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#999', fontSize: '12px', marginTop: '2px' }}>
                      <Calendar size={11} />
                      <span>Modifié le {formatDate(client.updatedAt)}</span>
                      <span style={{ margin: '0 4px' }}>·</span>
                      <span>Créé le {formatDate(client.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {/* Renommer */}
                    <button
                      title="Renommer"
                      onClick={() => { setRenamingId(client.id); setRenameValue(client.displayName) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#aaa', transition: 'color 0.15s' }}
                      onMouseOver={e => (e.currentTarget.style.color = colorSky)}
                      onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
                    >
                      <Pencil size={15} />
                    </button>
                    {/* Dupliquer */}
                    <button
                      title="Dupliquer"
                      onClick={() => onDuplicate(client.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#aaa', transition: 'color 0.15s' }}
                      onMouseOver={e => (e.currentTarget.style.color = colorSky)}
                      onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
                    >
                      <Copy size={15} />
                    </button>
                    {/* Supprimer */}
                    {confirmDeleteId === client.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#e74c3c', fontWeight: 600 }}>Confirmer ?</span>
                        <button onClick={() => { onDelete(client.id); setConfirmDeleteId(null) }}
                          style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>
                          Oui
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ background: '#eee', color: '#666', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        title="Supprimer"
                        onClick={() => setConfirmDeleteId(client.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#aaa', transition: 'color 0.15s' }}
                        onMouseOver={e => (e.currentTarget.style.color = '#e74c3c')}
                        onMouseOut={e => (e.currentTarget.style.color = '#aaa')}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {/* Ouvrir */}
                    <button
                      onClick={() => onOpen(client)}
                      style={{
                        background: `linear-gradient(135deg, ${colorNavy} 0%, ${colorSky} 100%)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginLeft: '8px',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '1')}
                    >
                      Ouvrir <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
