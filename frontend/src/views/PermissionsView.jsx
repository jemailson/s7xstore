import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Key, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

function hexFromInt(n) {
  if (!n) return null
  const hex = (n >>> 0).toString(16).padStart(6, '0')
  return `#${hex}`
}

export default function PermissionsView() {
  const toast = useToast()
  const [permissions, setPermissions] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ discordId: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadPermissions() {
    setRefreshing(true)
    try {
      const data = await API.listPermissions()
      setPermissions(data.permissions || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setRefreshing(false)
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  async function handleAdd() {
    if (!form.discordId.trim()) {
      toast('ID oficial do Discord é obrigatório', 'error')
      return
    }
    setLoading(true)
    try {
      await API.addPermission({
        discordId: form.discordId.trim(),
        name: form.name.trim()
      })
      toast('ID do Discord autorizado com sucesso!')
      setShowAdd(false)
      setForm({ discordId: '', name: '' })
      loadPermissions()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(p) {
    const displayName = p.global_name || p.username || p.name || p.discord_id
    if (!window.confirm(`Revogar permissão de ${displayName} (ID: ${p.discord_id})?`)) return
    try {
      await API.deletePermission(p.id)
      toast('Permissão revogada com sucesso!')
      loadPermissions()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const filtered = permissions.filter(p => {
    const term = search.toLowerCase()
    return (
      p.discord_id.toLowerCase().includes(term) ||
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.username && p.username.toLowerCase().includes(term)) ||
      (p.global_name && p.global_name.toLowerCase().includes(term))
    )
  })

  return (
    <>
      <Topbar title="Gerenciar Permissões Discord">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadPermissions} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <UserPlus size={16} />
            Autorizar ID
          </button>
        </div>
      </Topbar>

      <section className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="toolbar" style={{ width: '100%' }}>
              <input
                className="search"
                placeholder="Buscar por ID, Nome ou @Username do Discord..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '260px' }}>Usuário Discord</th>
                  <th>ID do Discord</th>
                  <th>Identificador / Nota</th>
                  <th>Status</th>
                  <th>Keys Geradas</th>
                  <th>Último Resgate</th>
                  <th>Data de Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {initialLoading || refreshing ? (
                  <tr>
                    <td colSpan="8">
                      <div className="table-loading-state">
                        <Loader2 size={28} className="spin" style={{ color: 'var(--primary)' }} />
                        <span>Carregando permissões do Discord...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty">Nenhum usuário autorizado encontrado</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const avatarSrc = p.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'
                    const bannerSrc = p.banner_url || null
                    const accentHex = hexFromInt(p.accent_color)
                    const mainName = p.global_name || p.username || p.name || 'Usuário Discord'
                    const tag = p.username ? `@${p.username}` : null

                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="user-discord-pill">
                            {bannerSrc && (
                              <div className="pill-banner-layer">
                                <img src={bannerSrc} alt="Banner" className="pill-banner-img" />
                                <div className="pill-banner-fade" />
                              </div>
                            )}
                            {accentHex && !bannerSrc && (
                              <div
                                className="pill-accent-layer"
                                style={{
                                  background: `linear-gradient(90deg, transparent 40%, ${accentHex}33 100%)`
                                }}
                              />
                            )}
                            <div className="pill-content">
                              <div className="pill-avatar-wrap">
                                <img
                                  src={avatarSrc}
                                  alt="Avatar"
                                  className="pill-avatar"
                                  onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                                />
                                <span
                                  className={`pill-status-dot ${p.status === 'active' ? 'dot-active' : 'dot-inactive'}`}
                                  title={p.status === 'active' ? 'Ativo' : 'Inativo'}
                                />
                              </div>
                              <div className="pill-user-names">
                                <span className="pill-display-name">{mainName}</span>
                                {tag && <span className="pill-tag-name mono">{tag}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mono text-glow" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                            {p.discord_id}
                          </span>
                        </td>
                        <td>{p.name || <span className="muted">—</span>}</td>
                        <td>
                          <span className={`badge ${p.status === 'active' ? 'badge-active' : 'badge-paused'}`}>
                            <ShieldCheck size={12} style={{ marginRight: 4 }} />
                            {p.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-awaiting" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Key size={12} />
                            {p.keys_generated || 0}
                          </span>
                        </td>
                        <td>
                          {p.last_key ? (
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{p.last_key}</div>
                              <div className="mono muted" style={{ fontSize: '0.78rem' }}>{p.last_key_at}</div>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{p.created_at}</td>
                        <td>
                          <div className="actions">
                            <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(p)}>
                              <Trash2 size={14} style={{ marginRight: 4 }} />
                              Revogar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {showAdd && (
        <Modal
          title="Autorizar novo ID do Discord"
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
                {loading ? 'Buscando e Autorizando...' : 'Autorizar'}
              </button>
            </>
          }
        >
          <div className="input-group">
            <label>ID Oficial do Discord (Apenas números)</label>
            <input
              placeholder="Ex: 1305296438783250454"
              value={form.discordId}
              onChange={e => setForm({ ...form, discordId: e.target.value.replace(/\D/g, '') })}
            />
            <span className="muted" style={{ fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
              O sistema irá buscar automaticamente o nome, foto e banner do usuário no Discord.
            </span>
          </div>
          <div className="input-group" style={{ marginTop: '16px' }}>
            <label>Nota / Identificador (Opcional)</label>
            <input
              placeholder="Ex: Revendedor Oficial #1"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </>
  )
}
