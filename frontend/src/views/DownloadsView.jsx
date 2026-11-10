import { useState, useEffect } from 'react'
import { Download, PlusCircle, ExternalLink, Edit2, Trash2, Shield, Smartphone, Gamepad2, Package, Apple, Loader2, RefreshCw, X, Play, FolderGit2, MessageCircle } from 'lucide-react'
import API from '../api'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'

function ensureUrl(url) {
  if (!url) return ''
  const trimmed = String(url).trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const ICONS_MAP = {
  android: Shield,
  ios: Apple,
  proxy: Gamepad2,
  package: Package,
  mobile: Smartphone
}

const COLORS_MAP = {
  android: '#10b981',
  ios: '#0284c7',
  proxy: '#8b5cf6',
  package: '#ec4899',
  mobile: '#f59e0b'
}

export default function DownloadsView({ user }) {
  const toast = useToast()
  const [downloads, setDownloads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    platform_type: 'android',
    version: '',
    download_url: '',
    public_url: ''
  })

  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'download_admin'

  useEffect(() => {
    loadDownloads()
  }, [])

  async function loadDownloads() {
    setLoading(true)
    try {
      const res = await API.listDownloads()
      setDownloads(res.downloads || [])
    } catch (err) {
      toast(err.message || 'Erro ao carregar downloads', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenCreate() {
    setEditingItem(null)
    setForm({
      title: '',
      platform_type: 'android',
      version: '',
      download_url: '',
      public_url: '',
      tutorial_url: '',
      mt_manager_url: '',
      channel_url: ''
    })
    setModalOpen(true)
  }

  function handleOpenEdit(item) {
    setEditingItem(item)
    setForm({
      title: item.title,
      platform_type: item.platform_type || item.icon || 'android',
      version: item.version || '',
      download_url: item.download_url || item.direct_link || '',
      public_url: item.public_url || item.slug || '',
      tutorial_url: item.tutorial_url || item.tutorial_link || '',
      mt_manager_url: item.mt_manager_url || item.mt_manager_link || '',
      channel_url: item.channel_url || item.channel_link || ''
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title || !form.download_url) {
      toast('Título e Link de Download são obrigatórios.', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingItem) {
        await API.updateDownload(editingItem.id, form)
        toast('Download atualizado com sucesso!', 'success')
      } else {
        await API.createDownload(form)
        toast('Novo download cadastrado!', 'success')
      }
      setModalOpen(false)
      loadDownloads()
    } catch (err) {
      toast(err.message || 'Erro ao salvar', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Tem certeza que deseja excluir "${item.title}"?`)) return
    try {
      await API.deleteDownload(item.id)
      toast('Download removido com sucesso!', 'success')
      loadDownloads()
    } catch (err) {
      toast(err.message || 'Erro ao deletar', 'error')
    }
  }

  return (
    <>
      <Topbar title="Área de Download">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadDownloads} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <PlusCircle size={16} />
              Adicionar Download
            </button>
          )}
        </div>
      </Topbar>

      <section className="page-content">
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
          Baixe as versões mais recentes do APK MOD, Proxy Android, Proxy Menu e HS iOS Injetor.
        </p>

        {loading && downloads.length === 0 ? (
          <div className="card">
            <div className="table-loading-state" style={{ padding: '48px 0' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
              <span>Carregando área de downloads...</span>
            </div>
          </div>
        ) : downloads.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Download size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.5 }} />
              <h3>Nenhum download disponível no momento</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                {isAdmin ? 'Clique no botão acima para adicionar um novo aplicativo ou mod.' : 'Aguarde até que novos arquivos sejam publicados pelos administradores.'}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {downloads.map((item) => {
              const IconComponent = ICONS_MAP[item.platform_type] || Smartphone
              const color = COLORS_MAP[item.platform_type] || 'var(--primary)'

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '24px 20px',
                    border: `1px solid rgba(255,255,255,0.07)`,
                    position: 'relative'
                  }}
                >
                  {isAdmin && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '20px',
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: color
                      }}
                    >
                      <IconComponent size={34} />
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>{item.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Atualizado em {item.updated_at ? item.updated_at.split(' ')[0] : 'Recente'}.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(item.tutorial_url || item.tutorial_link) && (
                      <a
                        href={ensureUrl(item.tutorial_url || item.tutorial_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{
                          width: '100%',
                          background: 'rgba(239, 68, 68, 0.14)',
                          color: '#ff4d4d',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '12px',
                          borderRadius: '10px',
                          textAlign: 'center',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          textDecoration: 'none'
                        }}
                      >
                        <Play size={16} fill="#ff4d4d" />
                        Assistir Tutorial
                      </a>
                    )}

                    <a
                      href={ensureUrl(item.download_url || item.direct_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{
                        width: '100%',
                        background: color,
                        color: '#fff',
                        fontWeight: '800',
                        padding: '14px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        fontSize: '0.85rem',
                        letterSpacing: '0.04em',
                        boxShadow: `0 4px 14px ${color}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        textDecoration: 'none'
                      }}
                    >
                      <Download size={16} />
                      DOWNLOAD {item.title.split(' ')[0]}
                    </a>

                    {(item.mt_manager_url || item.mt_manager_link) && (
                      <a
                        href={ensureUrl(item.mt_manager_url || item.mt_manager_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          textDecoration: 'none'
                        }}
                      >
                        <FolderGit2 size={14} />
                        Download MT Manager
                      </a>
                    )}

                    {(item.channel_url || item.channel_link) && (
                      <a
                        href={ensureUrl(item.channel_url || item.channel_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          textDecoration: 'none'
                        }}
                      >
                        <MessageCircle size={14} />
                        Canal de Atualizações
                      </a>
                    )}

                    {(item.public_url || item.slug) && (
                      <a
                        href={(item.public_url || item.slug).startsWith('http') ? (item.public_url || item.slug) : `/d/${(item.public_url || item.slug).replace(/^\/d\//, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          textDecoration: 'none'
                        }}
                      >
                        <ExternalLink size={14} />
                        Abrir Página Pública
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {modalOpen && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '480px' }}>
              <div className="modal-header">
                <h3>{editingItem ? 'Editar Download' : 'Novo Download'}</h3>
                <button className="modal-close" onClick={() => setModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="input-group">
                    <label>Título do Download / Aplicativo</label>
                    <input
                      type="text"
                      placeholder="Ex: FFH4X V3.6 Versão External"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Ícone / Categoria</label>
                    <select
                      value={form.platform_type}
                      onChange={e => setForm({ ...form, platform_type: e.target.value })}
                    >
                      <option value="android">🛡️ Android (Escudo Verde)</option>
                      <option value="proxy">🎮 Proxy / Menu (Roxo)</option>
                      <option value="ios">🍎 iOS (Maçã Azul)</option>
                      <option value="package">📦 Pacote / APK (Rosa)</option>
                      <option value="mobile">📱 Mobile Geral (Amarelo)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Versão (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 6.0 ou v3.6"
                      value={form.version}
                      onChange={e => setForm({ ...form, version: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Link Direto de Download (APK / Arquivo) *</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.download_url}
                      onChange={e => setForm({ ...form, download_url: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Link do Tutorial (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.tutorial_url || ''}
                      onChange={e => setForm({ ...form, tutorial_url: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Link do MT Manager (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.mt_manager_url || ''}
                      onChange={e => setForm({ ...form, mt_manager_url: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Canal de Atualizações (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.channel_url || ''}
                      onChange={e => setForm({ ...form, channel_url: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label>Slug / Link da Página Pública (Ex: ffh4x)</label>
                    <input
                      type="text"
                      placeholder="Deixe em branco para gerar a partir do título"
                      value={form.public_url || ''}
                      onChange={e => setForm({ ...form, public_url: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : editingItem ? 'Salvar Alterações' : 'Adicionar Download'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
