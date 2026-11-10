import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlusCircle, Database, RefreshCw, KeyRound, AlertCircle, CheckCircle, Loader2, Smartphone, Trash2, Plus, Pencil, ArrowLeft, Clock, Calendar, Save } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const DURATION_PRESETS = [
  { days: 0.0417, label: '1 hora', credits: 0.2 },
  { days: 0.0833, label: '2 horas', credits: 0.5 },
  { days: 0.25, label: '6 horas', credits: 0.8 },
  { days: 0.5, label: '12 horas', credits: 1.0 },
  { days: 1, label: '1 dia', credits: 1.0 },
  { days: 3, label: '3 dias', credits: 1.5 },
  { days: 7, label: '7 dias', credits: 2.0 },
  { days: 15, label: '15 dias', credits: 3.0 },
  { days: 30, label: '30 dias', credits: 4.0 },
]

function formatDuration(days) {
  const d = parseFloat(days)
  if (isNaN(d) || d <= 0) return '—'
  if (d < 1) {
    const hours = Math.round(d * 24)
    return hours === 1 ? '1 Hora' : `${hours} Horas`
  }
  if (d >= 3650) return 'Permanente'
  const roundedDays = Math.round(d)
  return roundedDays === 1 ? '1 Dia' : `${roundedDays} Dias`
}

export default function BulkKeysView() {
  const toast = useToast()
  const [stats, setStats] = useState({})
  const [platforms, setPlatforms] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [showPlatformModal, setShowPlatformModal] = useState(false)
  const [creatingPlatform, setCreatingPlatform] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState('')

  const [editingPlatform, setEditingPlatform] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDurations, setEditDurations] = useState([])
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [customAmount, setCustomAmount] = useState('1')
  const [customUnit, setCustomUnit] = useState('hours')
  const [customCredits, setCustomCredits] = useState('1.0')

  const [viewingStock, setViewingStock] = useState(null)
  const [stockKeys, setStockKeys] = useState([])
  const [loadingStockKeys, setLoadingStockKeys] = useState(false)

  const [form, setForm] = useState({
    platform: '',
    duration_days: '30',
    keys: ''
  })

  const loadStats = useCallback(async (selectSlug = null) => {
    try {
      const [statsData, platData] = await Promise.all([
        API.getReservoirStats().catch(() => null),
        API.listPlatforms().catch(() => null)
      ])

      const pMap = new Map()
      if (Array.isArray(statsData?.platforms)) {
        for (const p of statsData.platforms) {
          if (p?.slug) pMap.set(String(p.slug).toLowerCase(), p)
        }
      }
      if (Array.isArray(platData?.platforms)) {
        for (const p of platData.platforms) {
          if (p?.slug) pMap.set(String(p.slug).toLowerCase(), p)
        }
      }
      const platformList = Array.from(pMap.values())

      const rawStats = statsData?.stats?.stats ? statsData.stats.stats : (statsData?.stats || {})

      setStats(rawStats)
      setPlatforms(platformList)

      setForm(prev => {
        let currentSlug = selectSlug || prev.platform
        if (!platformList.some(p => p.slug === currentSlug)) {
          currentSlug = platformList[0]?.slug || ''
        }
        const platObj = platformList.find(p => p.slug === currentSlug)
        const platDurs = (platObj?.durations && platObj.durations.length > 0)
          ? platObj.durations
          : [{ days: 1, label: '1 Dia' }, { days: 7, label: '7 Dias' }, { days: 30, label: '30 Dias' }]
        
        const validDur = platDurs.some(d => String(d.days) === String(prev.duration_days))
        return {
          ...prev,
          platform: currentSlug,
          duration_days: validDur ? prev.duration_days : String(platDurs[0]?.days || 30)
        }
      })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoadingStats(false)
    }
  }, [toast])

  useEffect(() => {
    loadStats()

    const interval = setInterval(() => {
      loadStats()
    }, 8000)

    const onFocus = () => loadStats()
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadStats])

  async function handleOpenModal() {
    setShowPlatformModal(true)
    setEditingPlatform(null)
    await loadStats()
  }

  function handleStartEditPlatform(p) {
    setEditingPlatform(p)
    setEditName(p.name)
    const initialDurs = (p.durations && p.durations.length > 0)
      ? p.durations.map(d => ({
          days: parseFloat(d.days),
          label: d.label || (parseFloat(d.days) < 1 ? `${Math.round(parseFloat(d.days) * 24)} hora(s)` : `${d.days} dia(s)`),
          credits: d.credits !== undefined ? parseFloat(d.credits) : 1.0
        }))
      : [
          { days: 1, label: '1 dia', credits: 1.0 },
          { days: 7, label: '7 dias', credits: 2.0 },
          { days: 30, label: '30 dias', credits: 4.0 }
        ]
    setEditDurations(initialDurs)
  }

  function handleAddPreset(preset) {
    if (editDurations.some(d => Math.abs(d.days - preset.days) < 0.001)) {
      toast(`A opção "${preset.label}" já está adicionada.`, 'warning')
      return
    }
    const updated = [...editDurations, { ...preset }].sort((a, b) => a.days - b.days)
    setEditDurations(updated)
  }

  function handleAddCustomDuration(e) {
    if (e) e.preventDefault()
    const amount = parseFloat(customAmount)
    if (!amount || amount <= 0) {
      toast('Informe uma quantidade de tempo válida.', 'error')
      return
    }
    const days = customUnit === 'hours' ? parseFloat((amount / 24).toFixed(4)) : parseFloat(amount)
    if (editDurations.some(d => Math.abs(d.days - days) < 0.001)) {
      toast('Essa opção de duração já está adicionada.', 'warning')
      return
    }
    const credits = parseFloat(customCredits) || 1.0
    const label = customUnit === 'hours'
      ? `${amount} ${amount === 1 ? 'hora' : 'horas'}`
      : `${amount} ${amount === 1 ? 'dia' : 'dias'}`

    const updated = [...editDurations, { days, label, credits }].sort((a, b) => a.days - b.days)
    setEditDurations(updated)
  }

  function handleRemoveDuration(index) {
    if (editDurations.length <= 1) {
      toast('O produto precisa ter pelo menos 1 opção de duração.', 'error')
      return
    }
    setEditDurations(prev => prev.filter((_, i) => i !== index))
  }

  function handleUpdateDurationCredits(index, newCredits) {
    setEditDurations(prev => prev.map((d, i) => i === index ? { ...d, credits: newCredits } : d))
  }

  async function handleSavePlatform() {
    const trimmed = editName.trim()
    if (!trimmed) {
      toast('O nome do produto não pode ficar vazio.', 'error')
      return
    }
    if (editDurations.length === 0) {
      toast('Configure pelo menos 1 opção de duração para o produto.', 'error')
      return
    }

    setSavingPlatform(true)
    try {
      await API.updatePlatform(editingPlatform.id, {
        name: trimmed,
        durations: editDurations.map(d => ({
          days: d.days,
          label: d.label,
          credits: parseFloat(d.credits) || 1.0
        }))
      })
      toast(`Produto "${trimmed}" atualizado com sucesso!`)
      setEditingPlatform(null)
      await loadStats()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingPlatform(false)
    }
  }

  async function handleAddPlatform(e) {
    e.preventDefault()
    const name = newPlatformName.trim()
    if (!name) {
      toast('Nome do dispositivo é obrigatório', 'error')
      return
    }
    setCreatingPlatform(true)
    try {
      const res = await API.createPlatform({ name, slug: '', emoji: 'mobile' })
      toast(`Dispositivo "${name}" adicionado com sucesso!`)
      setNewPlatformName('')
      const createdSlug = res?.platform?.slug || res?.slug || null
      await loadStats(createdSlug)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setCreatingPlatform(false)
    }
  }

  async function handleDeletePlatform(p, fallbackSlug = null) {
    const slug = fallbackSlug || p?.slug || p?.id
    const targetId = p?.id || p?.slug || fallbackSlug
    const name = p?.name || slug
    if (!targetId || targetId === 'undefined' || targetId === 'null') {
      toast('Identificador inválido para exclusão.', 'error')
      return
    }
    if (!window.confirm(`Tem certeza que deseja excluir o gerador "${name}" e TODAS as suas keys no estoque?`)) return
    try {
      await API.deletePlatform(targetId, slug)
      toast(`Gerador "${name}" e seu estoque foram removidos com sucesso!`)
      await loadStats()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleViewStock(platformSlug, durationDays, platformName, durationLabel) {
    setViewingStock({ platformSlug, durationDays, platformName, durationLabel })
    setStockKeys([])
    await loadStockKeys(platformSlug, durationDays)
  }

  async function loadStockKeys(platform, duration_days) {
    setLoadingStockKeys(true)
    try {
      const res = await API.getReservoirStock(platform, duration_days)
      setStockKeys(res.keys || [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoadingStockKeys(false)
    }
  }

  async function handleDeleteBulkStock(platformSlug, durationDays) {
    if (!window.confirm(`Tem certeza que deseja apagar TODAS as keys deste produto (${durationDays} Dias)?`)) return
    try {
      await API.deleteBulkReservoirStock(platformSlug, durationDays)
      toast('Todas as keys do produto foram removidas do estoque!')
      setViewingStock(null)
      loadStats()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.keys.trim()) {
      toast('Por favor, insira pelo menos uma key', 'error')
      return
    }
    if (!form.platform) {
      toast('Selecione um dispositivo', 'error')
      return
    }
    setSubmitting(true)
    setLastResult(null)
    try {
      const res = await API.addBulkKeys({
        platform: form.platform,
        duration_days: parseFloat(form.duration_days),
        keys: form.keys
      })
      setLastResult(res)
      if (res.successCount > 0) {
        toast(`✅ ${res.successCount} key(s) adicionada(s) ao estoque! ${res.dupCount > 0 ? `(${res.dupCount} já existiam)` : ''}`)
        setForm(prev => ({ ...prev, keys: '' }))
      } else if (res.dupCount > 0) {
        toast(`⚠️ As ${res.dupCount} key(s) informadas já existem no estoque.`, 'warning')
      } else {
        toast('Nenhuma key válida identificada.', 'warning')
      }
      await loadStats()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const platformEntries = Object.entries(stats).filter(([key]) => key !== 'stats' && key !== 'platforms')

  const selectedPlatformObj = platforms.find(p => p.slug === form.platform)
  const currentFormDurations = (selectedPlatformObj?.durations && selectedPlatformObj.durations.length > 0)
    ? selectedPlatformObj.durations
    : [
        { days: 1, label: '1 Dia' },
        { days: 7, label: '7 Dias' },
        { days: 30, label: '30 Dias' }
      ]

  return (
    <>
      <Topbar title="Reservatório de Keys & Estoque">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => loadStats()} disabled={loadingStats}>
            <RefreshCw size={16} className={loadingStats ? 'spin' : ''} />
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Smartphone size={16} />
            Gerenciar Produtos
          </button>
        </div>
      </Topbar>

      <section className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loadingStats && platformEntries.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="table-loading-state" style={{ padding: '36px 0' }}>
                <Loader2 size={26} className="spin" style={{ color: 'var(--primary)' }} />
                <span>Carregando estoque de dispositivos...</span>
              </div>
            </div>
          ) : platformEntries.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="empty">Nenhum dispositivo configurado. Clique em "Gerenciar Produtos" para adicionar.</div>
            </div>
          ) : (
            (() => {
              const globalStock = platformEntries.reduce((totalAcc, [_, data]) => {
                return totalAcc + Object.values(data?.durations || {}).reduce((subAcc, cnt) => subAcc + (parseInt(cnt, 10) || 0), 0)
              }, 0)

              return (
                <>
                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Database size={18} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '1.05rem' }}>Estoque Global (Todos os Dispositivos)</h3>
                      </div>
                      <span className="badge badge-awaiting" style={{ fontSize: '0.75rem' }}>{globalStock} total</span>
                    </div>
                  </div>

                  {platformEntries.map(([platformSlug, data]) => {
                    const p = platforms.find(pl => 
                      pl.slug === platformSlug || 
                      String(pl.slug).toLowerCase() === String(platformSlug).toLowerCase() || 
                      String(pl.id) === String(platformSlug)
                    ) || {
                      id: data?.id || platformSlug,
                      slug: data?.slug || platformSlug,
                      name: data?.name || platformSlug,
                      emoji: data?.emoji || '📱'
                    }
                    const platDurs = (p.durations && p.durations.length > 0)
                      ? p.durations.map(d => ({ days: parseFloat(d.days), label: d.label || formatDuration(d.days) }))
                      : [{ days: 1, label: '1 Dia' }, { days: 7, label: '7 Dias' }, { days: 30, label: '30 Dias' }]

                    const allDurs = [...platDurs]
                    if (data?.durations) {
                      for (const durStr of Object.keys(data.durations)) {
                        const dNum = parseFloat(durStr)
                        if (!allDurs.some(item => Math.abs(item.days - dNum) < 0.001)) {
                          allDurs.push({ days: dNum, label: formatDuration(dNum) })
                        }
                      }
                    }
                    allDurs.sort((a, b) => a.days - b.days)

                    const total = Object.values(data?.durations || {}).reduce((a, b) => a + (parseInt(b, 10) || 0), 0)

                    return (
                      <div key={platformSlug} className="card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0 }}>{p.name}</h3>
                            <span className="badge badge-awaiting" style={{ fontSize: '0.7rem' }}>{total} total</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                handleStartEditPlatform(p)
                                setShowPlatformModal(true)
                              }}
                              title="Configurar Produto (Dias, Horas e Nome)"
                              style={{ padding: '5px 8px' }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeletePlatform(p, platformSlug)}
                              title="Excluir Gerador e Keys do Estoque"
                              style={{ padding: '5px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="card-body" style={{ padding: '12px 16px' }}>
                          {allDurs.map((row, idx) => {
                            let val = 0
                            for (const [sDur, cnt] of Object.entries(data?.durations || {})) {
                              if (Math.abs(parseFloat(sDur) - row.days) < 0.001) {
                                val += parseInt(cnt || 0, 10)
                              }
                            }
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < allDurs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <span>{row.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={`badge ${val > 0 ? 'badge-active' : 'badge-paused'}`}>{val} keys</span>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={val === 0}
                                    onClick={() => handleViewStock(platformSlug, row.days, p.name, row.label)}
                                    title="Ver e Gerenciar Keys no Estoque"
                                  >
                                    Ver Keys
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()
          )}
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: 'var(--primary)' }} />
            <h3>Adicionar Keys ao Estoque</h3>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="input-group">
                  <label>Dispositivo / Plataforma</label>
                  <select
                    value={form.platform}
                    onChange={e => {
                      const nextPlat = e.target.value
                      setForm(prev => {
                        const platObj = platforms.find(p => p.slug === nextPlat)
                        const platDurs = (platObj?.durations && platObj.durations.length > 0)
                          ? platObj.durations
                          : [{ days: 1, label: '1 Dia' }, { days: 7, label: '7 Dias' }, { days: 30, label: '30 Dias' }]
                        return {
                          ...prev,
                          platform: nextPlat,
                          duration_days: String(platDurs[0]?.days || 30)
                        }
                      })
                    }}
                  >
                    {platforms.map(p => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Duração do Produto</label>
                  <select
                    value={form.duration_days}
                    onChange={e => setForm(prev => ({ ...prev, duration_days: e.target.value }))}
                  >
                    {currentFormDurations.map((d, i) => (
                      <option key={i} value={d.days}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Insira as Keys (uma por linha ou separadas por vírgula)</label>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: '160px',
                    padding: '12px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                  placeholder="EXEMPLO-KEY-1&#10;EXEMPLO-KEY-2&#10;EXEMPLO-KEY-3"
                  value={form.keys}
                  onChange={e => setForm(prev => ({ ...prev, keys: e.target.value }))}
                />
              </div>

              {lastResult && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: lastResult.successCount > 0 ? 'var(--success-glow)' : 'var(--warning-glow)',
                  border: `1px solid ${lastResult.successCount > 0 ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 214, 0, 0.3)'}`,
                  fontSize: '0.88rem'
                }}>
                  <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {lastResult.successCount > 0
                      ? <CheckCircle size={16} color="var(--success)" />
                      : <AlertCircle size={16} color="var(--warning)" />}
                    Resultado: {lastResult.successCount} adicionada(s), {lastResult.dupCount} duplicada(s).
                  </div>
                  {lastResult.duplicateList?.length > 0 && (
                    <div className="mono muted" style={{ marginTop: '6px', fontSize: '0.78rem' }}>
                      Ignoradas: {lastResult.duplicateList.slice(0, 5).join(', ')}{lastResult.duplicateList.length > 5 ? '...' : ''}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !form.platform}
                style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '8px' }}
              >
                <KeyRound size={18} />
                {submitting ? 'Adicionando keys...' : 'Distribuir Keys para Reservatório'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {showPlatformModal && (
        <Modal
          title={editingPlatform ? `Configurar Produto: ${editingPlatform.name}` : "Gerenciar Produtos"}
          onClose={() => {
            setShowPlatformModal(false)
            setEditingPlatform(null)
          }}
          footer={
            editingPlatform ? (
              <>
                <button className="btn btn-ghost" onClick={() => setEditingPlatform(null)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSavePlatform} disabled={savingPlatform}>
                  <Save size={14} style={{ marginRight: 4 }} />
                  {savingPlatform ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setShowPlatformModal(false)}>Fechar</button>
            )
          }
        >
          {editingPlatform ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setEditingPlatform(null)}
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Voltar para a lista de produtos
              </button>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Nome do Produto</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Ex: PROXY ANDROID ADVANCED"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
                  Durações de Keys Disponíveis
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Configure as opções de dias/horas disponíveis para este produto ao gerar keys e o custo em créditos de cada uma:
                </p>

                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Adicionar opções pré-configuradas:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DURATION_PRESETS.map((preset, idx) => {
                      const isAdded = editDurations.some(d => Math.abs(d.days - preset.days) < 0.001)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddPreset(preset)}
                          disabled={isAdded}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            opacity: isAdded ? 0.4 : 1,
                            cursor: isAdded ? 'not-allowed' : 'pointer'
                          }}
                        >
                          + {preset.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', maxHeight: '180px', overflowY: 'auto' }}>
                  {editDurations.map((d, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {d.days < 1 ? <Clock size={14} style={{ color: '#a78bfa' }} /> : <Calendar size={14} style={{ color: '#38bdf8' }} />}
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{d.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Créditos:</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={d.credits}
                          onChange={e => handleUpdateDurationCredits(index, e.target.value)}
                          style={{
                            width: '65px',
                            padding: '4px 8px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '0.85rem',
                            textAlign: 'center'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDuration(index)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Remover esta opção"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                    Adicionar Duração Personalizada:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tempo:</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        style={{ width: '55px', padding: '4px 6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }}
                      />
                    </div>

                    <select
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value)}
                      style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                    >
                      <option value="hours">Hora(s)</option>
                      <option value="days">Dia(s)</option>
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Créditos:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={customCredits}
                        onChange={e => setCustomCredits(e.target.value)}
                        style={{ width: '55px', padding: '4px 6px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomDuration}
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: 'auto', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    >
                      <Plus size={12} style={{ marginRight: 2 }} /> Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleAddPlatform} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '0.95rem', color: 'var(--text)' }}>Adicionar Novo Dispositivo</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                    <input
                      placeholder="Nome do dispositivo (ex: PC / Emulador)"
                      value={newPlatformName}
                      onChange={e => setNewPlatformName(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creatingPlatform}
                    style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    {creatingPlatform ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </form>

              <h4 style={{ marginBottom: '12px', fontSize: '0.95rem', color: 'var(--text)' }}>Dispositivos Cadastrados ({platforms.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {platforms.map(p => (
                  <div
                    key={p.id || p.slug}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{p.name}</strong>
                      <div className="mono muted" style={{ fontSize: '0.75rem' }}>slug: {p.slug}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStartEditPlatform(p)}
                        style={{ padding: '6px 10px' }}
                        title="Configurar dias/horas e trocar o nome do produto"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeletePlatform(p, p.slug)}
                        style={{ padding: '6px 10px' }}
                        title="Remover dispositivo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {viewingStock && (
        <Modal title={`Estoque: ${viewingStock.platformName} - ${viewingStock.durationLabel}`} onClose={() => setViewingStock(null)}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', marginTop: 0 }}>
            Listagem das keys disponíveis para este produto.
          </p>
          
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {loadingStockKeys ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                Carregando keys...
              </div>
            ) : stockKeys.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma key disponível neste momento.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total: {stockKeys.length} key(s)</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteBulkStock(viewingStock.platformSlug, viewingStock.durationDays)}
                    title="Excluir todas as keys deste produto"
                  >
                    <Trash2 size={13} style={{ marginRight: 4 }} /> Apagar Todas
                  </button>
                </div>
                {stockKeys.map(k => (
                  <div
                    key={k.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <strong className="mono" style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{k.key_code}</strong>
                      <div className="muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>Adicionada em: {k.created_at}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
