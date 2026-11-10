import { useState, useEffect, useMemo } from 'react'
import { Plus, Loader2, Package, Copy, Check } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useLanguage } from '../contexts/LanguageContext'

const DEFAULT_DURATIONS = [
  { days: 1, label: '1 dia', credits: 1.0 },
  { days: 7, label: '7 dias', credits: 2.0 },
  { days: 30, label: '30 dias', credits: 4.0 },
]

function formatDuration(days) {
  const d = parseFloat(days)
  if (isNaN(d) || d <= 0) return '—'
  if (d < 1) {
    const hours = Math.round(d * 24)
    return hours === 1 ? '1 hora' : `${hours} horas`
  }
  if (d >= 3650) return 'Permanente'
  const roundedDays = Math.round(d)
  return roundedDays === 1 ? '1 dia' : `${roundedDays} dias`
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    const [datePart, timePart] = dateStr.split(' ')
    if (!datePart) return dateStr
    const [year, month, day] = datePart.split('-')
    const time = timePart ? timePart.slice(0, 5) : ''
    if (!year || !month || !day) return dateStr
    return time ? `${day}/${month}/${year} às ${time}` : `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

export default function KeysView({ user, onUserUpdate }) {
  const toast = useToast()
  const [keys, setKeys] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(DEFAULT_DURATIONS[0])
  const [generating, setGenerating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState(null)
  const [copied, setCopied] = useState(false)
  const limit = 50

  const [quantity, setQuantity] = useState(1)

  const uniquePlatforms = useMemo(() => {
    const seen = new Set()
    return products.filter(p => {
      if (seen.has(p.platform)) return false
      seen.add(p.platform)
      return true
    })
  }, [products])

  const availableDurations = useMemo(() => {
    if (!selectedPlatform) return DEFAULT_DURATIONS
    const matching = products.filter(p => p.platform === selectedPlatform)
    if (matching.length === 0) {
      return DEFAULT_DURATIONS
    }
    return matching.map(p => ({
      days: p.duration_days,
      label: p.duration_label || formatDuration(p.duration_days),
      credits: p.credits !== undefined ? p.credits : 1.0,
      count: p.count || 0
    }))
  }, [products, selectedPlatform])

  useEffect(() => {
    if (availableDurations.length > 0) {
      const exists = availableDurations.some(d => Math.abs(d.days - (selectedDuration?.days || 0)) < 0.0001)
      if (!exists) {
        setSelectedDuration(availableDurations[0])
      } else {
        const current = availableDurations.find(d => Math.abs(d.days - (selectedDuration?.days || 0)) < 0.0001)
        if (current && (current.credits !== selectedDuration.credits || current.label !== selectedDuration.label)) {
          setSelectedDuration(current)
        }
      }
    }
  }, [availableDurations, selectedDuration])

  const platformStock = useMemo(() => {
    const map = {}
    for (const p of products) {
      const key = `${p.platform}__${p.duration_days}`
      map[key] = parseInt(p.count || 0, 10)
    }
    return map
  }, [products])

  const currentStock = platformStock[`${selectedPlatform}__${selectedDuration?.days}`] ?? 0
  const totalCost = parseFloat(((selectedDuration?.credits || 1.0) * quantity).toFixed(2))

  async function loadKeys() {
    setLoading(true)
    try {
      const data = await API.listKeys({ search, offset, limit })
      setKeys(data.keys || [])
      setTotal(data.total || 0)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    setLoadingProducts(true)
    try {
      const data = await API.listProducts()
      const list = data.products || []
      setProducts(list)
      if (list.length > 0 && !selectedPlatform) {
        setSelectedPlatform(list[0].platform)
      }
    } catch (err) {
      toast('Erro ao carregar produtos.', 'error')
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => { loadKeys() }, [offset])

  function handleFilter() {
    setOffset(0)
    loadKeys()
  }

  function openModal() {
    setShowModal(true)
    setQuantity(1)
    loadProducts()
  }

  async function handleClaim() {
    if (!selectedPlatform) {
      toast('Selecione um produto.', 'error')
      return
    }
    if (quantity < 1) {
      toast('Quantidade inválida.', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await API.claimKeyFromStock({
        platform: selectedPlatform,
        duration_days: selectedDuration.days,
        quantity
      })
      if (res.keys && res.keys.length > 0) {
        setGeneratedKey(res.keys.map(k => k.key_code).join('\n'))
      }
      const me = await API.me()
      onUserUpdate(me.user)
      loadKeys()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy() {
    if (!generatedKey) return
    navigator.clipboard.writeText(generatedKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function closeModal() {
    setShowModal(false)
    setGeneratedKey(null)
    setCopied(false)
  }

  const { t } = useLanguage()

  return (
    <>
      <Topbar title={t('keys_title')}>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={16} />
          {t('keys_generate')}
        </button>
      </Topbar>

      <section className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="toolbar" style={{ width: '100%' }}>
              <input
                className="search"
                placeholder="Buscar por key, produto, IP, data..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFilter()}
              />
              <button className="btn btn-secondary" onClick={handleFilter}>Filtrar</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Duração</th>
                  <th>Produto / Dispositivo</th>
                  <th>IP</th>
                  <th>Início / Ativação</th>
                  <th>Expira em (Dia e Horário)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-loading-state">
                        <Loader2 size={28} className="spin" style={{ color: 'var(--primary)' }} />
                        <span>Carregando keys...</span>
                      </div>
                    </td>
                  </tr>
                ) : keys.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty">Nenhuma key encontrada</div></td></tr>
                ) : keys.map(key => (
                  <tr key={key.id}>
                    <td className="mono">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{key.key_code}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '3px 6px', height: 'auto', minHeight: 'auto', color: 'var(--text-muted)' }}
                          onClick={() => {
                            navigator.clipboard.writeText(key.key_code)
                            toast('Key copiada!')
                          }}
                          title="Copiar Key"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td>{formatDuration(key.duration_days)}</td>
                    <td>
                      <div className="device-cell" title={key.device_info || key.device_id || ''}>
                        {key.device_info || key.device_id || '—'}
                      </div>
                    </td>
                    <td className="mono">{key.activation_ip || '—'}</td>
                    <td>{formatDateTime(key.activated_at)}</td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                        {formatDateTime(key.expires_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{total} registro(s)</span>
            <div className="pagination-buttons">
              <button className="btn btn-secondary btn-sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button>
              <button className="btn btn-secondary btn-sm" disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>Próxima</button>
            </div>
          </div>
        </div>
      </section>

      {showModal && (
        <Modal
          title={generatedKey ? 'Key(s) Gerada(s) com Sucesso! 🎉' : 'Gerar Key'}
          onClose={closeModal}
          footer={
            generatedKey ? (
              <>
                <button className="btn btn-ghost" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado!' : 'Copiar Key(s)'}
                </button>
                <button className="btn btn-primary" onClick={closeModal}>
                  Ir para Dashboard
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={handleClaim}
                  disabled={generating || !selectedPlatform || loadingProducts}
                  style={{ fontWeight: '800' }}
                >
                  {generating ? <Loader2 size={16} className="spin" /> : '+ GERAR AGORA'}
                </button>
              </>
            )
          }
        >
          {generatedKey ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔑</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                {generatedKey.includes('\n') ? 'Suas keys foram geradas' : 'Sua key foi gerada'}. Copie e guarde em um lugar seguro!
              </p>
              <div
                onClick={handleCopy}
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1.5px solid rgba(139,92,246,0.4)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  userSelect: 'all',
                  color: '#e2d9f3',
                  transition: 'background 0.2s',
                  marginBottom: '10px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                {generatedKey}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Clique na(s) key(s) para selecioná-la(s), ou use o botão abaixo para copiar.
              </p>
            </div>
          ) : loadingProducts ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="spin" /> Carregando produtos...
            </div>
          ) : uniquePlatforms.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              <Package size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
              Nenhum produto cadastrado.
            </div>
          ) : (
            <>
              <div className="input-group">
                <label>PRODUTO</label>
                <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} style={{ width: '100%' }}>
                  {uniquePlatforms.map((p, i) => (
                    <option key={i} value={p.platform}>{p.platform_name || p.platform}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginTop: '16px' }}>
                <label>DURAÇÃO DO ACESSO</label>
                <select
                  value={selectedDuration?.days}
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    const found = availableDurations.find(d => Math.abs(d.days - val) < 0.0001)
                    if (found) setSelectedDuration(found)
                  }}
                  style={{ width: '100%' }}
                >
                  {availableDurations.map((d, i) => (
                    <option key={i} value={d.days}>
                      {d.label} — {d.credits} crédito{d.credits !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="input-group" style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>
                  Quantidade de Licenças
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="100" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                  style={{ 
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '2px solid rgba(139, 92, 246, 0.8)',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: 'var(--text)',
                    outline: 'none',
                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)'
                  }}
                />
              </div>

              <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(139,92,246,0.06)', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Custo Total:</span>
                  <strong style={{ color: 'var(--primary)' }}>{totalCost} crédito{totalCost !== 1 ? 's' : ''}</strong>
                </div>
                {user?.role === 'reseller' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Seus créditos:</span>
                    <strong style={{ color: parseFloat(user.credits) >= totalCost ? 'var(--success)' : 'var(--danger)' }}>
                      {parseFloat(user.credits || 0).toFixed(2)}
                    </strong>
                  </div>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  )
}

