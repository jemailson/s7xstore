import { useState, useEffect } from 'react'
import { UserPlus, Loader2, Shield, Ban, Eye } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const ROLE_MAP = {
  owner: { label: 'Owner', class: 'badge-awaiting' },
  admin: { label: 'Administrador', class: 'badge-active' },
  reseller: { label: 'Revendedor', class: 'badge-paused' },
  member: { label: 'Membro', class: 'badge-deactivated' },
  download_admin: { label: 'Admin Downloads', class: 'badge-active' }
}

const STATUS_MAP = {
  active: { label: 'Ativo', class: 'badge-active' },
  inactive: { label: 'Inativo', class: 'badge-deactivated' },
  suspended: { label: 'Banido', class: 'badge-expired' },
  paused: { label: 'Pausado', class: 'badge-paused' }
}

const RESELLER_TYPE = { classic: 'Classic', rubi: 'Rubi' }

const TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'reseller', label: 'Revendedores' },
  { key: 'inactive', label: 'Inativos / Sem Recarga' },
  { key: 'suspended', label: 'Banidos' }
]

export default function ProfilesView({ user }) {
  const toast = useToast()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showCredits, setShowCredits] = useState(null)
  const [showPerms, setShowPerms] = useState(null)
  const [permsData, setPermsData] = useState([])
  const [permsLoading, setPermsLoading] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'reseller', reseller_type: 'classic', credits: 0 })
  const [crAmount, setCrAmount] = useState(10)
  const [crSet, setCrSet] = useState('')

  async function loadProfiles() {
    setLoading(true)
    try {
      const data = await API.listUsers({ search })
      setProfiles(data.profiles || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfiles() }, [])

  async function openPerms(p) {
    setShowPerms(p)
    setPermsLoading(true)
    try {
      const data = await API.getUserProductPermissions(p.id)
      setPermsData(data.permissions || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setPermsLoading(false)
    }
  }

  async function savePerms() {
    try {
      await API.setUserProductPermissions(showPerms.id, permsData)
      toast('Permissões salvas com sucesso')
      setShowPerms(null)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  function togglePerm(slug) {
    setPermsData(prev => prev.map(p =>
      p.platform_slug === slug ? { ...p, allowed: !p.allowed } : p
    ))
  }

  async function handleCreate() {
    try {
      await API.createUser({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        reseller_type: form.reseller_type,
        credits: parseInt(form.credits, 10) || 0
      })
      setShowCreate(false)
      toast('Perfil criado com sucesso')
      setForm({ username: '', password: '', role: 'reseller', reseller_type: 'classic', credits: 0 })
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleStatus(p, newStatus) {
    const labels = { active: 'ativado', suspended: 'banido', paused: 'pausado', inactive: 'inativado' }
    try {
      await API.updateUserStatus(p.id, newStatus)
      toast(`Perfil ${labels[newStatus] || newStatus}`)
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleBan(p) {
    if (!window.confirm(`Banir o usuário "${p.username}"? Ele não conseguirá mais acessar o sistema.`)) return
    await handleStatus(p, 'suspended')
  }

  async function handleUnban(p) {
    await handleStatus(p, 'active')
  }

  async function handleCreditsAdd() {
    if (!showCredits) return
    try {
      await API.updateCredits(showCredits.id, crAmount)
      toast('Créditos alterados')
      setShowCredits(null)
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleCreditsSet() {
    if (!showCredits || crSet === '') return
    try {
      await API.updateCredits(showCredits.id, parseInt(crSet, 10), true)
      toast('Créditos definidos')
      setShowCredits(null)
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Excluir perfil ${p.username}?`)) return
    try {
      await API.deleteUser(p.id)
      toast('Perfil excluído')
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleResetDevice(p) {
    if (!window.confirm(`Remover dispositivo vinculado da conta ${p.username}?`)) return
    try {
      await API.resetUserDevice(p.id)
      toast('Dispositivo desvinculado e conta liberada')
      loadProfiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  // Filtragem por aba
  const filteredProfiles = profiles.filter(p => {
    if (activeTab === 'all') return true
    if (activeTab === 'reseller') return p.role === 'reseller'
    if (activeTab === 'suspended') return p.status === 'suspended'
    if (activeTab === 'inactive') {
      // Inativos: não são revendedores/admin/owner, nunca fizeram recarga (créditos = 0 e sem keys criadas)
      return (p.role === 'member' || p.status === 'inactive') && (!p.keys_created || p.keys_created === 0)
    }
    return true
  })

  return (
    <>
      <Topbar title="Painel de Perfis">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} />
          Novo perfil
        </button>
      </Topbar>

      <section className="page-content">
        {/* Abas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '7px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                background: activeTab === tab.key ? 'var(--primary)' : 'var(--card)',
                color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: 7,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: '0.78rem'
              }}>
                {tab.key === 'all' ? profiles.length
                  : tab.key === 'reseller' ? profiles.filter(p => p.role === 'reseller').length
                  : tab.key === 'suspended' ? profiles.filter(p => p.status === 'suspended').length
                  : profiles.filter(p => (p.role === 'member' || p.status === 'inactive') && (!p.keys_created || p.keys_created === 0)).length
                }
              </span>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="toolbar" style={{ width: '100%' }}>
              <input
                className="search"
                placeholder="Buscar usuário, tipo, status..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadProfiles()}
              />
              <button className="btn btn-secondary" onClick={loadProfiles}>Filtrar</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Tipo</th>
                  <th>Revendedor</th>
                  <th>Status</th>
                  <th>Créditos</th>
                  <th>Keys criadas</th>
                  <th>Ativas</th>
                  <th>Expiradas</th>
                  <th>Disp. Keys</th>
                  <th>Disp. Conta</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11">
                      <div className="table-loading-state">
                        <Loader2 size={28} className="spin" style={{ color: 'var(--primary)' }} />
                        <span>Carregando perfis...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr><td colSpan="11"><div className="empty">Nenhum perfil encontrado nesta categoria</div></td></tr>
                ) : filteredProfiles.map(p => {
                  const role = ROLE_MAP[p.role] || { label: p.role, class: 'badge-deactivated' }
                  const statusInfo = STATUS_MAP[p.status] || { label: p.status, class: 'badge-deactivated' }
                  const isEditable = p.role !== 'owner' && p.id !== user?.id
                  const isBanned = p.status === 'suspended'
                  return (
                    <tr key={p.id} style={isBanned ? { opacity: 0.6 } : {}}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{p.username}</span>
                        {isBanned && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--danger)' }}>🚫 Banido</span>}
                      </td>
                      <td><span className={`badge ${role.class}`}>{role.label}</span></td>
                      <td>{p.reseller_type ? (RESELLER_TYPE[p.reseller_type] || p.reseller_type) : '—'}</td>
                      <td><span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span></td>
                      <td>{p.credits}</td>
                      <td>{p.keys_created}</td>
                      <td>{p.keys_active}</td>
                      <td>{p.keys_expired}</td>
                      <td>
                        <div className="device-cell" title={p.last_device || ''}>{p.last_device || '—'}</div>
                        <div className="mono muted">{p.last_ip || ''}</div>
                      </td>
                      <td>
                        {p.device_id ? (
                          <span className="mono text-glow" style={{ color: 'var(--primary-hover)', fontSize: '0.82rem' }}>{p.device_id}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="actions" style={{ flexWrap: 'wrap', gap: 4 }}>
                          {isEditable && (
                            <>
                              <button className="btn btn-info btn-sm" onClick={() => { setShowCredits(p); setCrAmount(10); setCrSet('') }}>Créditos</button>

                              {/* Permissões de produto */}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => openPerms(p)}
                                title="Configurar quais produtos este usuário pode gerar"
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Shield size={12} />
                                Produtos
                              </button>

                              {/* Ban / Unban */}
                              {isBanned ? (
                                <button className="btn btn-success btn-sm" onClick={() => handleUnban(p)} title="Desbanir usuário">
                                  Desbanir
                                </button>
                              ) : (
                                <>
                                  {p.status === 'active' ? (
                                    <button className="btn btn-warning btn-sm" onClick={() => handleStatus(p, 'paused')}>Pausar</button>
                                  ) : (
                                    <button className="btn btn-success btn-sm" onClick={() => handleStatus(p, 'active')}>Ativar</button>
                                  )}
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleBan(p)}
                                    title="Banir permanentemente"
                                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Ban size={12} />
                                    Banir
                                  </button>
                                </>
                              )}

                              <button className="btn btn-secondary btn-sm" onClick={() => handleResetDevice(p)} title="Desvincular Dispositivo da Conta">
                                Resetar Disp.
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>Excluir</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal Criar Perfil */}
      {showCreate && (
        <Modal
          title="Criar Novo Perfil"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Criar Perfil</button>
            </>
          }
        >
          <div className="input-group">
            <label>Usuário</label>
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="input-group" style={{ marginTop: 16 }}>
            <label>Senha</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="input-group" style={{ marginTop: 16 }}>
            <label>Tipo de Perfil</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="reseller">Revendedor</option>
              {user?.role === 'owner' && <option value="download_admin">Admin Downloads</option>}
              {user?.role === 'owner' && <option value="admin">Administrador</option>}
            </select>
          </div>
          {form.role === 'reseller' && (
            <div className="input-group" style={{ marginTop: 16 }}>
              <label>Tipo de Revendedor</label>
              <select value={form.reseller_type} onChange={e => setForm({ ...form, reseller_type: e.target.value })}>
                <option value="classic">Classic (Keys com prefixo S7X-XXX)</option>
                <option value="rubi">Rubi (Keys com prefixo customizável)</option>
              </select>
            </div>
          )}
          <div className="input-group" style={{ marginTop: 16 }}>
            <label>Créditos Iniciais</label>
            <input type="number" min="0" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })} />
          </div>
        </Modal>
      )}

      {/* Modal Créditos */}
      {showCredits && (
        <Modal
          title={`Gerenciar Créditos — ${showCredits.username}`}
          onClose={() => setShowCredits(null)}
          footer={<button className="btn btn-ghost" onClick={() => setShowCredits(null)}>Fechar</button>}
        >
          <p style={{ marginBottom: 16 }}>Créditos atuais: <strong>{showCredits.credits}</strong></p>
          <div className="input-group">
            <label>Adicionar / Remover</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={crAmount} onChange={e => setCrAmount(parseInt(e.target.value, 10) || 0)} />
              <button className="btn btn-primary" onClick={handleCreditsAdd}>Aplicar</button>
            </div>
          </div>
          <div className="input-group" style={{ marginTop: 20 }}>
            <label>Definir valor exato</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min="0" placeholder="Ex: 50" value={crSet} onChange={e => setCrSet(e.target.value)} />
              <button className="btn btn-secondary" onClick={handleCreditsSet}>Definir</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Permissões de Produto */}
      {showPerms && (
        <Modal
          title={`Permissões de Produto — ${showPerms.username}`}
          onClose={() => setShowPerms(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowPerms(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePerms}>Salvar Permissões</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
            Defina quais produtos este revendedor pode gerar keys. Por padrão todos os produtos são permitidos.
          </p>
          {permsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : permsData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum produto cadastrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {permsData.map(perm => (
                <label
                  key={perm.platform_slug}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: `1px solid ${perm.allowed ? 'var(--primary)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'border 0.15s'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{perm.platform_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: perm.allowed ? 'var(--success)' : 'var(--danger)' }}>
                      {perm.allowed ? '✅ Permitido' : '🚫 Bloqueado'}
                    </span>
                    <input
                      type="checkbox"
                      checked={perm.allowed}
                      onChange={() => togglePerm(perm.platform_slug)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>
                </label>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
