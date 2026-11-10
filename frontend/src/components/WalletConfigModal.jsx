import { useState, useEffect } from 'react'
import {
  Settings,
  X,
  Plus,
  Trash2,
  Flame,
  RotateCcw,
  Check,
  Loader2,
  Eye,
  Calculator
} from 'lucide-react'
import { useToast } from './Toast'
import API from '../api'

const DEFAULT_CONFIG = {
  base_price: 3.0,
  min_credits: 1,
  minCredits: 1,
  bonus_credits: 7,
  bonus_min_credits: 10,
  tiers: [
    { min_credits: 10, max_credits: 19, discount_percent: 0, unit_price: 3.0, label: '10 a 19 créditos', badge: null },
    { min_credits: 20, max_credits: 49, discount_percent: 10, unit_price: 2.7, label: 'A partir de 20 créditos', badge: '10% OFF' },
    { min_credits: 50, max_credits: 74, discount_percent: 20, unit_price: 2.4, label: 'A partir de 50 créditos', badge: '20% OFF' },
    { min_credits: 75, max_credits: 99, discount_percent: 25, unit_price: 2.25, label: 'A partir de 75 créditos', badge: '25% OFF' },
    { min_credits: 100, max_credits: 199, discount_percent: 30, unit_price: 2.1, label: 'A partir de 100 créditos', badge: '30% OFF' },
    { min_credits: 200, max_credits: null, discount_percent: 40, unit_price: 1.8, label: 'A partir de 200 créditos', badge: '40% OFF' }
  ]
}

function computePriceForQty(qtyVal, cfg) {
  const raw = parseInt(qtyVal || '0', 10)
  const qty = isNaN(raw) ? 0 : raw
  const basePrice = Number(cfg?.base_price) || 3.0
  let unitPrice = basePrice
  let discountPercent = 0

  const sortedTiers = [...(cfg?.tiers || [])].sort((a, b) => b.min_credits - a.min_credits)
  for (const tier of sortedTiers) {
    if (qty >= tier.min_credits) {
      unitPrice = Number(tier.unit_price)
      discountPercent = Number(tier.discount_percent)
      break
    }
  }

  const bonusMin = cfg?.bonus_min_credits !== undefined ? cfg.bonus_min_credits : 10
  const bonusCredits = (cfg?.bonus_credits > 0 && qty >= bonusMin) ? cfg.bonus_credits : 0
  const totalCredits = qty + bonusCredits
  const total = Number((qty * unitPrice).toFixed(2))
  const savings = Number((qty * basePrice - total).toFixed(2))

  return {
    quantity: qty,
    bonusCredits,
    totalCredits,
    unitPrice,
    discountPercent,
    total,
    savings: savings > 0 ? savings : 0,
    basePrice
  }
}

export default function WalletConfigModal({ isOpen, onClose, currentConfig, onSaved }) {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('tiers')
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 850 : false))

  const [editingConfig, setEditingConfig] = useState(DEFAULT_CONFIG)
  const [simulatedQty, setSimulatedQty] = useState(25)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 850)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile && activeTab === 'preview') {
      setActiveTab('tiers')
    }
  }, [isMobile, activeTab])

  useEffect(() => {
    if (isOpen) {
      const cfg = currentConfig ? JSON.parse(JSON.stringify(currentConfig)) : DEFAULT_CONFIG
      const minVal = cfg?.min_credits !== undefined ? cfg.min_credits : (cfg?.minCredits !== undefined ? cfg.minCredits : 1)
      cfg.min_credits = minVal
      cfg.minCredits = minVal
      setEditingConfig(cfg)
      setSimulatedQty(minVal ? Math.max(25, minVal * 2) : 25)
      setActiveTab('tiers')
    }
  }, [isOpen, currentConfig])

  if (!isOpen) return null

  function handleBasePriceChange(val) {
    const newBase = parseFloat(val) || 0
    const updatedTiers = (editingConfig.tiers || []).map(t => {
      const disc = Number(t.discount_percent) || 0
      return {
        ...t,
        unit_price: Number((newBase * (1 - disc / 100)).toFixed(2))
      }
    })
    setEditingConfig({
      ...editingConfig,
      base_price: val,
      tiers: updatedTiers
    })
  }

  function handleTierChange(index, field, value) {
    const tiers = [...editingConfig.tiers]
    const tier = { ...tiers[index] }
    const base = Number(editingConfig.base_price) || 3.0

    if (field === 'min_credits') {
      const minVal = parseInt(value, 10) || 0
      tier.min_credits = minVal
      if (!tier.custom_label) {
        tier.label = tier.max_credits ? `${minVal} a ${tier.max_credits} créditos` : `A partir de ${minVal} créditos`
      }
    } else if (field === 'max_credits') {
      const maxVal = value === '' ? null : (parseInt(value, 10) || null)
      tier.max_credits = maxVal
      if (!tier.custom_label) {
        tier.label = maxVal ? `${tier.min_credits} a ${maxVal} créditos` : `A partir de ${tier.min_credits} créditos`
      }
    } else if (field === 'discount_percent') {
      const disc = parseFloat(value) || 0
      tier.discount_percent = disc
      tier.unit_price = Number((base * (1 - disc / 100)).toFixed(2))
      if (!tier.custom_badge) {
        tier.badge = disc > 0 ? `${disc}% OFF` : null
      }
    } else if (field === 'unit_price') {
      const unit = parseFloat(value) || 0
      tier.unit_price = unit
      if (base > 0) {
        tier.discount_percent = Number((((base - unit) / base) * 100).toFixed(0))
      }
    } else if (field === 'label') {
      tier.label = value
      tier.custom_label = true
    } else if (field === 'badge') {
      tier.badge = value
      tier.custom_badge = true
    }

    tiers[index] = tier
    setEditingConfig({ ...editingConfig, tiers })
  }

  function handleAddTier() {
    const currentTiers = editingConfig.tiers || []
    const lastTier = currentTiers[currentTiers.length - 1]
    const newMin = lastTier ? (lastTier.max_credits ? lastTier.max_credits + 1 : lastTier.min_credits + 50) : 10
    const base = Number(editingConfig.base_price) || 3.0
    const discount = lastTier ? Math.min(90, (Number(lastTier.discount_percent) || 0) + 5) : 10
    const unit = Number((base * (1 - discount / 100)).toFixed(2))

    const newTier = {
      min_credits: newMin,
      max_credits: null,
      discount_percent: discount,
      unit_price: unit,
      label: `A partir de ${newMin} créditos`,
      badge: `${discount}% OFF`
    }
    setEditingConfig({
      ...editingConfig,
      tiers: [...currentTiers, newTier]
    })
  }

  function handleRemoveTier(index) {
    if (editingConfig.tiers.length <= 1) {
      toast('É necessário manter ao menos uma faixa de preço na tabela.', 'error')
      return
    }
    const updated = editingConfig.tiers.filter((_, i) => i !== index)
    setEditingConfig({ ...editingConfig, tiers: updated })
  }

  function handleResetDefaults() {
    if (window.confirm('Deseja restaurar as configurações padrão da tabela de descontos?')) {
      setEditingConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
      toast('Configurações padrão restauradas no formulário.', 'info')
    }
  }

  async function handleSaveConfig() {
    const base = parseFloat(editingConfig.base_price || editingConfig.basePrice)
    if (isNaN(base) || base <= 0) {
      toast('Informe um preço base válido maior que zero.', 'error')
      return
    }
    const rawMin = editingConfig.min_credits !== undefined ? editingConfig.min_credits : (editingConfig.minCredits !== undefined ? editingConfig.minCredits : '1')
    const minVal = parseFloat(String(rawMin).replace(',', '.'))
    if (isNaN(minVal) || minVal < 1) {
      toast('A quantidade mínima de compra deve ser de pelo menos 1 crédito.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...editingConfig,
        base_price: base,
        basePrice: base,
        min_credits: minVal,
        minCredits: minVal
      }
      const res = await API.updateWalletConfig(payload)
      const savedConfig = res?.config || res || payload
      if (onSaved) onSaved(savedConfig)
      toast('Tabela de descontos atualizada com sucesso!', 'success')
      onClose()
    } catch (err) {
      toast(err.message || 'Erro ao salvar configuração', 'error')
    } finally {
      setSaving(false)
    }
  }

  const livePreviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={18} style={{ color: 'var(--primary)' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>
            Preview em Tempo Real
          </h4>
        </div>
        <span className="badge badge-active" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
          ● Ao Vivo
        </span>
      </div>

      <div
        style={{
          background: 'rgba(15, 20, 32, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Flame size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.98rem', fontWeight: '700', margin: 0, color: '#fff' }}>
              Tabela de Descontos Progressivos
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Compre créditos em maior quantidade e ganhe descontos imperdíveis:
            </span>
          </div>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(editingConfig.tiers || []).map((tier, idx) => {
            const base = Number(editingConfig.base_price || 3.0)
            const hasDiscount = Number(tier.discount_percent) > 0
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#e5e7eb' }}>
                  {tier.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {tier.badge && (
                    <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '0.82rem' }}>
                      {tier.badge}
                    </span>
                  )}
                  {hasDiscount && (
                    <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.82rem' }}>
                      R$ {base.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                  <span style={{ color: hasDiscount ? 'var(--success)' : 'var(--text)', fontWeight: '700', fontSize: '0.9rem' }}>
                    R$ {Number(tier.unit_price).toFixed(2).replace('.', ',')} {idx === 0 && !hasDiscount ? '/créd.' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={16} style={{ color: 'var(--primary)' }} />
          <strong style={{ fontSize: '0.88rem', color: '#fff' }}>Simulador de Teste</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Testar Quantidade:
          </label>
          <input
            type="number"
            min="1"
            value={simulatedQty}
            onChange={e => setSimulatedQty(parseInt(e.target.value, 10) || 0)}
            style={{
              width: '85px',
              padding: '6px 10px',
              textAlign: 'center',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '700',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border)',
              color: '#fff'
            }}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>créditos</span>
        </div>

        {(() => {
          const sim = computePriceForQty(simulatedQty, editingConfig)
          return (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Preço Unitário Aplicado:</span>
                <strong style={{ color: sim.discountPercent > 0 ? 'var(--success)' : '#fff' }}>
                  R$ {sim.unitPrice.toFixed(2).replace('.', ',')}
                  {sim.discountPercent > 0 && ` (${sim.discountPercent}% OFF)`}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total a Pagar:</span>
                <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>
                  R$ {sim.total.toFixed(2).replace('.', ',')}
                </strong>
              </div>
              {sim.bonusCredits > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc' }}>
                  <span>Bônus Recebido:</span>
                  <strong>+{sim.bonusCredits} créditos (Total: {sim.totalCredits})</strong>
                </div>
              )}
              {sim.savings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Economia:</span>
                  <strong>R$ {sim.savings.toFixed(2).replace('.', ',')}</strong>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: isMobile ? '8px' : '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d121f',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          width: isMobile ? 'calc(100vw - 16px)' : 'min(1080px, calc(100vw - 32px))',
          maxHeight: isMobile ? 'calc(98dvh - 16px)' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            padding: isMobile ? '14px 16px' : '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                minWidth: '38px',
                maxWidth: '38px',
                minHeight: '38px',
                maxHeight: '38px',
                aspectRatio: '1 / 1',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
                flexGrow: 0,
                alignSelf: 'center'
              }}
            >
              <Settings size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: isMobile ? '1.02rem' : '1.2rem', fontWeight: '700', margin: 0, color: '#fff' }}>
                Configurar Tabela de Preços e Descontos
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isMobile ? 'Ajuste os valores ou veja o preview ao vivo' : 'Ajuste os valores à esquerda e acompanhe o preview em tempo real à direita'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '4px 16px',
            gap: '8px',
            overflowX: 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('tiers')}
            style={{
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'tiers' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'tiers' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🏷️ Faixas de Desconto ({editingConfig.tiers?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'general' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'general' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            ⚙️ Parâmetros Gerais
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              style={{
                padding: '10px 14px',
                fontSize: '0.84rem',
                fontWeight: 700,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'preview' ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === 'preview' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              👁️ Preview (Ao Vivo)
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              flex: isMobile ? 1 : 1.25,
              padding: isMobile ? '16px' : '22px',
              overflowY: 'auto',
              maxHeight: isMobile ? 'calc(98dvh - 170px)' : 'calc(92vh - 140px)',
              display: isMobile && activeTab === 'preview' ? 'none' : 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            {(activeTab === 'tiers' || (!isMobile && activeTab === 'tiers')) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Configure os descontos progressivos por quantidade de créditos:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetDefaults}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Restaurar padrão"
                    >
                      <RotateCcw size={13} />
                      Padrão
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddTier}
                      style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    >
                      <Plus size={14} />
                      Nova Faixa
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(editingConfig.tiers || []).map((tier, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '12px',
                        padding: isMobile ? '12px' : '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--primary)' }}>
                          Faixa #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          disabled={editingConfig.tiers.length <= 1}
                          title="Remover faixa"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: editingConfig.tiers.length <= 1 ? '#555' : 'var(--danger)',
                            cursor: editingConfig.tiers.length <= 1 ? 'not-allowed' : 'pointer',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem'
                          }}
                        >
                          <Trash2 size={13} />
                          Excluir
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Mínimo Créditos</label>
                          <input
                            type="number"
                            min="0"
                            value={tier.min_credits}
                            onChange={e => handleTierChange(idx, 'min_credits', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.88rem', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Máximo (ou vazio)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Sem limite"
                            value={tier.max_credits !== null && tier.max_credits !== undefined ? tier.max_credits : ''}
                            onChange={e => handleTierChange(idx, 'max_credits', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.88rem', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Desconto %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tier.discount_percent}
                            onChange={e => handleTierChange(idx, 'discount_percent', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.88rem', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Preço Unit. (R$)</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.01"
                            value={tier.unit_price}
                            onChange={e => handleTierChange(idx, 'unit_price', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.88rem', color: 'var(--success)', fontWeight: '700', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Texto / Rótulo</label>
                          <input
                            type="text"
                            value={tier.label || ''}
                            onChange={e => handleTierChange(idx, 'label', e.target.value)}
                            placeholder="Ex: 10 a 19 créditos"
                            style={{ padding: '8px 10px', fontSize: '0.84rem', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>Badge (Opcional)</label>
                          <input
                            type="text"
                            value={tier.badge || ''}
                            onChange={e => handleTierChange(idx, 'badge', e.target.value)}
                            placeholder="Ex: 10% OFF"
                            style={{ padding: '8px 10px', fontSize: '0.84rem', background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Ajuste os parâmetros base de compra e bônus da loja:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 600 }}>Preço Base / Crédito (R$)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={editingConfig.base_price}
                      onChange={e => handleBasePriceChange(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 600 }}>Mínimo Compra (Créditos)</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={editingConfig.min_credits !== undefined ? editingConfig.min_credits : ''}
                      onChange={e => setEditingConfig({ ...editingConfig, min_credits: e.target.value, minCredits: e.target.value })}
                      style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 600 }}>Bônus Revendedor (Créditos)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingConfig.bonus_credits}
                      onChange={e => setEditingConfig({ ...editingConfig, bonus_credits: parseInt(e.target.value, 10) || 0 })}
                      style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 600 }}>Mínimo p/ Bônus</label>
                    <input
                      type="number"
                      min="1"
                      value={editingConfig.bonus_min_credits}
                      onChange={e => setEditingConfig({ ...editingConfig, bonus_min_credits: parseInt(e.target.value, 10) || 1 })}
                      style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              flex: isMobile ? 1 : 1,
              background: '#090d16',
              borderLeft: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
              padding: isMobile ? '16px' : '22px',
              display: isMobile && activeTab !== 'preview' ? 'none' : 'flex',
              flexDirection: 'column',
              maxHeight: isMobile ? 'calc(98dvh - 170px)' : 'calc(92vh - 140px)',
              overflowY: 'auto'
            }}
          >
            {livePreviewContent}
          </div>
        </div>

        <div
          style={{
            padding: isMobile ? '12px 16px' : '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'stretch' : 'flex-end',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? '10px' : '12px',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
            style={{
              width: isMobile ? '100%' : 'auto',
              padding: '10px 18px',
              fontSize: '0.9rem'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={saving}
            style={{
              width: isMobile ? '100%' : 'auto',
              padding: '10px 22px',
              fontSize: '0.9rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
