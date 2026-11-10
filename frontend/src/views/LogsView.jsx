import { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, Radio } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import { useToast } from '../components/Toast'

const ACTION_LABELS = {
  key_created: 'Criação de Key',
  key_activated: 'Ativação',
  key_paused: 'Pausa',
  key_resumed: 'Retomada',
  key_restored: 'Restauração/desvinculação',
  key_deleted: 'Exclusão',
  key_hard_deleted: 'Exclusão permanente',
  key_expired: 'Expiração',
  access_attempt: 'Tentativa de acesso',
  credits_change: 'Alteração de créditos',
  credits_set: 'Definição de créditos',
  credits_key_generation: 'Créditos (geração de keys)',
  key_claimed_from_stock: 'Key gerada do estoque',
  discord_key_generated: 'Key gerada via Discord',
  bulk_keys_added: 'Keys importadas em lote',
  reservoir_key_deleted: 'Key removida do estoque',
  reservoir_bulk_keys_deleted: 'Limpeza de estoque',
  profile_created: 'Criação de perfil',
  profile_updated: 'Alteração de perfil',
  profile_status_changed: 'Status de perfil',
  profile_deleted: 'Exclusão de perfil',
  login_success: 'Login',
  login_failed: 'Falha de login'
}

const ACTION_COLORS = {
  key_claimed_from_stock: '#6366f1',
  discord_key_generated: '#5865f2',
  key_created: '#6366f1',
  key_activated: '#22c55e',
  key_paused: '#f59e0b',
  key_resumed: '#22c55e',
  key_deleted: '#ef4444',
  key_hard_deleted: '#dc2626',
  login_failed: '#ef4444',
  profile_deleted: '#ef4444',
  bulk_keys_added: '#8b5cf6',
  credits_change: '#06b6d4',
  credits_set: '#06b6d4'
}

function parseDetails(details) {
  if (!details) return ''
  try {
    const parsed = JSON.parse(details)
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ')
  } catch {
    return details
  }
}

export default function LogsView({ user }) {
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [realtimeOn, setRealtimeOn] = useState(false)
  const [filterUserId, setFilterUserId] = useState('')
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState(null)
  const intervalRef = useRef(null)
  const limit = 100
  const isAdmin = user?.role === 'owner' || user?.role === 'admin'

  async function loadLogs(silent = false) {
    if (!silent) setLoading(true)
    try {
      const params = { search, offset, limit }
      if (filterUserId) params.user_id = filterUserId
      const data = await API.listLogs(params)
      setLogs(data.logs || [])
      setTotal(data.total || 0)

      // Calcula estatísticas do usuário selecionado
      if (filterUserId && data.logs?.length > 0) {
        const keysGenerated = data.logs.filter(l =>
          l.action === 'key_claimed_from_stock' || l.action === 'key_created' || l.action === 'discord_key_generated'
        ).length
        setUserStats({ keysGenerated, total: data.total })
      } else {
        setUserStats(null)
      }
    } catch (err) {
      if (!silent) toast(err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Carrega lista de usuários para o seletor (apenas admin/owner)
  useEffect(() => {
    if (!isAdmin) return
    API.listUsers({}).then(data => {
      const list = (data.profiles || []).filter(p => p.role !== 'owner' || user?.role === 'owner')
      setUsers(list)
    }).catch(() => {})
  }, [])

  useEffect(() => { loadLogs() }, [offset, filterUserId])

  // Auto-refresh tempo real
  useEffect(() => {
    if (realtimeOn) {
      intervalRef.current = setInterval(() => loadLogs(true), 5000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [realtimeOn, search, offset, filterUserId])

  function handleFilter() {
    setOffset(0)
    loadLogs()
  }

  const selectedUser = filterUserId ? users.find(u => String(u.id) === String(filterUserId)) : null

  return (
    <>
      <Topbar title="Logs do Sistema">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn btn-sm ${realtimeOn ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setRealtimeOn(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title={realtimeOn ? 'Desativar atualização em tempo real' : 'Ativar atualização em tempo real (5s)'}
          >
            <Radio size={14} style={{ animation: realtimeOn ? 'spin 2s linear infinite' : 'none' }} />
            {realtimeOn ? 'Ao Vivo' : 'Tempo Real'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => loadLogs()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>
      </Topbar>

      <section className="page-content">
        {/* Painel de stats do usuário selecionado */}
        {selectedUser && userStats && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--primary)',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            gap: 32,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Monitorando</span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedUser.username}</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedUser.role} · {selectedUser.status}</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Keys geradas (nesta página)</div>
              <div style={{ fontWeight: 700, fontSize: '1.4rem', color: 'var(--primary)' }}>{userStats.keysGenerated}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total de logs</div>
              <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{userStats.total}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Créditos restantes</div>
              <div style={{ fontWeight: 700, fontSize: '1.4rem', color: 'var(--success)' }}>{selectedUser.credits}</div>
            </div>
            {realtimeOn && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: '0.85rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                Atualizando a cada 5s
              </div>
            )}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="toolbar" style={{ width: '100%', flexWrap: 'wrap', gap: 8 }}>
              {/* Seletor de usuário para filtrar logs */}
              {isAdmin && (
                <select
                  value={filterUserId}
                  onChange={e => { setFilterUserId(e.target.value); setOffset(0) }}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    padding: '8px 12px',
                    fontSize: '0.9rem',
                    minWidth: 180
                  }}
                >
                  <option value="">Todos os usuários</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </select>
              )}
              <input
                className="search"
                placeholder="Buscar ação, key, usuário..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFilter()}
                style={{ flex: 1, minWidth: 160 }}
              />
              <button className="btn btn-secondary" onClick={handleFilter}>Filtrar</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data / Horário</th>
                  <th>Responsável</th>
                  <th>Ação</th>
                  <th>Key</th>
                  <th>IP</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-loading-state">
                        <Loader2 size={28} className="spin" style={{ color: 'var(--primary)' }} />
                        <span>Carregando registros de logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty">Nenhum log encontrado</div></td></tr>
                ) : logs.map((log, i) => (
                  <tr key={log.id || i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{log.created_at}</td>
                    <td style={{ fontWeight: 600 }}>{log.username || 'sistema'}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: (ACTION_COLORS[log.action] || 'var(--border)') + '22',
                        color: ACTION_COLORS[log.action] || 'var(--text-muted)',
                        border: `1px solid ${ACTION_COLORS[log.action] || 'var(--border)'}44`
                      }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="mono">{log.key_code || '—'}</td>
                    <td className="mono">{log.ip_address || '—'}</td>
                    <td className="muted" style={{ maxWidth: 320, fontSize: '0.82rem' }}>{parseDetails(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{total} registro(s){filterUserId && selectedUser ? ` de ${selectedUser.username}` : ''}</span>
            <div className="actions">
              <button className="btn btn-secondary btn-sm" disabled={offset <= 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button>
              <button className="btn btn-secondary btn-sm" disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>Próxima</button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
