import { useState, useEffect, useRef } from 'react'
import { Wallet, Flame, QrCode, Copy, Check, Loader2, RefreshCw, AlertCircle, CheckCircle2, Settings, ExternalLink } from 'lucide-react'
import API from '../api'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import WalletConfigModal from '../components/WalletConfigModal'
import { useLanguage } from '../contexts/LanguageContext'

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

function formatTransactionDate(dateStr) {
  if (!dateStr) return '—'
  const parts = String(dateStr).split(' ')
  if (parts.length === 2 && parts[0].includes('-')) {
    const [y, m, d] = parts[0].split('-')
    return `${d}/${m}/${y} ${parts[1]}`
  }
  return dateStr
}

function computePriceForQty(qtyVal, cfg) {
  const raw = parseFloat(String(qtyVal || '0').replace(',', '.'))
  const qty = isNaN(raw) || raw < 0 ? 0 : raw
  const basePrice = Number(cfg?.base_price || cfg?.basePrice) || 3.0
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
  const totalCredits = Number((qty + bonusCredits).toFixed(2))
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

export default function WalletView({ user, onUserUpdate }) {
  const { t } = useLanguage()
  const toast = useToast()
  const isAdmin = user?.role === 'owner' || user?.role === 'admin'
  const [walletConfig, setWalletConfig] = useState(DEFAULT_CONFIG)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [credits, setCredits] = useState('10')
  const [pricing, setPricing] = useState({ quantity: 10, unitPrice: 3.0, discountPercent: 0, total: 30.0, savings: 0, bonusCredits: 7, totalCredits: 17 })
  const [loadingPix, setLoadingPix] = useState(false)
  const [pixData, setPixData] = useState(null)
  const [copied, setCopied] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    loadConfig()
    loadTransactions()
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  async function loadConfig() {
    setLoadingConfig(true)
    try {
      const data = await API.getWalletConfig()
      if (data && data.tiers && data.tiers.length > 0) {
        setWalletConfig(data)
        calculatePrice(credits, data)
      } else {
        calculatePrice(credits, DEFAULT_CONFIG)
      }
    } catch (err) {
      console.error('Erro ao carregar configuração da carteira:', err)
      calculatePrice(credits, DEFAULT_CONFIG)
    } finally {
      setLoadingConfig(false)
    }
  }

  function calculatePrice(val, cfg = walletConfig) {
    const p = computePriceForQty(val, cfg)
    setPricing(p)
  }

  function handleCreditsChange(e) {
    let val = e.target.value.replace(',', '.')
    val = val.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('')
    }
    setCredits(val)
    calculatePrice(val, walletConfig)
  }

  async function loadTransactions() {
    setLoadingTx(true)
    try {
      const res = await API.listTransactions()
      setTransactions(res.transactions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTx(false)
    }
  }

  async function handleGeneratePix() {
    const rawMin = walletConfig?.min_credits !== undefined ? walletConfig.min_credits : (walletConfig?.minCredits !== undefined ? walletConfig.minCredits : 1)
    const minCredits = typeof rawMin === 'number' ? rawMin : (parseFloat(rawMin) || 1)
    const qty = parseFloat(String(credits || '0').replace(',', '.'))
    if (!qty || qty <= 0) {
      toast('Informe a quantidade de créditos desejada.', 'error')
      return
    }
    if (qty < minCredits) {
      toast(t('wallet_min_amount_error', { min: minCredits }), 'error')
      return
    }

    setLoadingPix(true)
    setPixData(null)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    try {
      const data = await API.createPixPayment({ credits: qty })
      setPixData(data)
      startPolling(data.id)
      toast(t('wallet_pix_created'), 'info')
    } catch (err) {
      toast(err.message || 'Erro ao gerar PIX', 'error')
    } finally {
      setLoadingPix(false)
    }
  }

  function startPolling(txId) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await API.checkPaymentStatus(txId)
        if (res.status === 'approved') {
          clearInterval(pollIntervalRef.current)
          setPixData(prev => prev ? { ...prev, status: 'approved' } : null)
          toast(`Pagamento aprovado! +${res.credits} créditos adicionados à sua conta.`, 'success')
          loadTransactions()
          if (onUserUpdate) {
            const meRes = await API.me()
            if (meRes.user) onUserUpdate(meRes.user)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }, 3000)
  }

  function handleReopenPix(tx) {
    setPixData({
      id: tx.id,
      paymentId: tx.payment_id,
      amount: parseFloat(tx.amount || 0),
      credits: parseFloat(tx.credits || 0),
      status: tx.status,
      qrCode: tx.qr_code,
      qrCodeBase64: tx.qr_code_base64,
      ticketUrl: tx.ticket_url
    })
    startPolling(tx.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast('Informações do PIX abertas acima!', 'info')
  }

  function copyPixCode() {
    if (!pixData?.qrCode) return
    navigator.clipboard.writeText(pixData.qrCode)
    setCopied(true)
    toast('Código PIX copiado com sucesso!', 'success')
    setTimeout(() => setCopied(false), 3000)
  }

  function handleConfigSaved(newCfg) {
    setWalletConfig(newCfg)
    calculatePrice(credits, newCfg)
  }

  return (
    <>
      <Topbar title={t('wallet_title')}>
        {isAdmin && (
          <button
            className="btn btn-secondary"
            onClick={() => setConfigModalOpen(true)}
            title="Configurar Tabela de Preços e Descontos"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Settings size={16} />
            <span className="hide-on-mobile">{t('wallet_config_btn')}</span>
          </button>
        )}
        <button className="btn btn-secondary" onClick={loadTransactions} disabled={loadingTx}>
          <RefreshCw size={16} className={loadingTx ? 'spin' : ''} />
          {t('confirm')}
        </button>
      </Topbar>

      <section className="page-content">
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
          {t('wallet_subtitle')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          <div className="card" style={{ border: '1px solid rgba(139, 92, 246, 0.4)', boxShadow: '0 0 30px rgba(139, 92, 246, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="card-body" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: '54px', height: '54px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Wallet size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>{t('wallet_add_credits')}</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Preço base por Crédito: <strong style={{ color: 'var(--primary)' }}>R$ {Number(walletConfig.base_price || 3.0).toFixed(2).replace('.', ',')}</strong>
              </p>

              {user?.role === 'member' && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  color: '#ddd'
                }}>
                  <div style={{ fontWeight: '700', color: '#c084fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⭐</span> Ativação de Cargo Revendedor
                  </div>
                  Ao adicionar créditos, sua conta é promovida automaticamente para <strong>Revendedor</strong> e recebe <strong>+{walletConfig.bonus_credits || 7} créditos extras de bônus</strong> (mínimo {walletConfig.bonus_min_credits || 10} créditos)!
                </div>
              )}

              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Quantidade de Créditos
                </label>
                <input
                  type="text"
                  value={credits}
                  onChange={handleCreditsChange}
                  style={{ width: '100%', padding: '14px 16px', fontSize: '1.25rem', fontWeight: '700', textAlign: 'center', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border)', borderRadius: '12px', color: '#fff' }}
                  placeholder={String(walletConfig?.min_credits || walletConfig?.minCredits || 1)}
                />

              </div>

              {pricing.bonusCredits > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: '#c084fc',
                  fontSize: '0.88rem',
                  fontWeight: '700'
                }}>
                  <span>🎁 Bônus de Revendedor: +{pricing.bonusCredits} créditos extras! (Total: {pricing.totalCredits} créditos)</span>
                </div>
              )}

              {pricing.discountPercent > 0 && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px dashed rgba(16, 185, 129, 0.4)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--success)',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}>
                  <span>🎉 Desconto de {pricing.discountPercent}% aplicado! Economia de R$ {pricing.savings.toFixed(2).replace('.', ',')}</span>
                </div>
              )}

              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Total a Pagar:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--success)', letterSpacing: '-0.02em' }}>
                    R$ {pricing.total.toFixed(2).replace('.', ',')}
                  </span>
                  {pricing.discountPercent > 0 && (
                    <span className="badge badge-active" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      {pricing.discountPercent}% OFF
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#a1a1aa', marginTop: '10px' }}>
                  Você receberá: <strong style={{ color: 'var(--success)' }}>{pricing.totalCredits || pricing.quantity} créditos</strong> {pricing.bonusCredits > 0 && <span style={{ color: '#c084fc', fontWeight: '600' }}>({pricing.quantity} + {pricing.bonusCredits} bônus)</span>}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGeneratePix}
                disabled={loadingPix}
                style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: '800', background: 'var(--primary)', boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' }}
              >
                {loadingPix ? <Loader2 size={20} className="spin" /> : t('wallet_pay_pix')}
              </button>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Flame size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Tabela de Descontos Progressivos</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compre créditos em maior quantidade e ganhe descontos imperdíveis:</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfigModalOpen(true)}
                  title="Configurar Tabela de Preços e Descontos"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Settings size={15} />
                  <span>Configurar</span>
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(walletConfig.tiers || []).map((tier, idx) => {
                const base = Number(walletConfig.base_price || 3.0)
                const hasDiscount = Number(tier.discount_percent) > 0
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.04)'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{tier.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {tier.badge && (
                        <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '0.85rem' }}>
                          {tier.badge}
                        </span>
                      )}
                      {hasDiscount && (
                        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.85rem' }}>
                          R$ {base.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                      <span style={{ color: hasDiscount ? 'var(--success)' : 'var(--text)', fontWeight: '700', fontSize: '0.95rem' }}>
                        R$ {Number(tier.unit_price).toFixed(2).replace('.', ',')} {idx === 0 && !hasDiscount ? '/créd.' : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <WalletConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          currentConfig={walletConfig}
          onSaved={handleConfigSaved}
        />

        {pixData && (
          <div className="card" style={{ marginBottom: '32px', border: '1px solid var(--primary)', background: 'rgba(139, 92, 246, 0.05)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <QrCode size={20} style={{ color: 'var(--primary)' }} />
                <h3>{t('wallet_qr_title')}</h3>
              </div>
              {pixData.status === 'approved' ? (
                <span className="badge badge-active" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> {t('wallet_payment_approved')}
                </span>
              ) : (
                <span className="badge badge-awaiting" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={14} className="spin" /> {t('wallet_waiting_payment')}
                </span>
              )}
            </div>
            <div className="card-body" style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
              {pixData.qrCodeBase64 && (
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                  <img
                    src={pixData.qrCodeBase64.startsWith('data:') ? pixData.qrCodeBase64 : `data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    style={{ width: '180px', height: '180px', display: 'block' }}
                  />
                </div>
              )}
              <div style={{ flex: 1, minWidth: '280px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  {t('wallet_copy_code')}:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={pixData.qrCode}
                    style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                  />
                  <button className="btn btn-primary" onClick={copyPixCode}>
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? t('wallet_copied') : t('wallet_copy_code')}
                  </button>
                </div>
                {pixData.ticketUrl && (
                  <div style={{ marginTop: '14px' }}>
                    <a
                      href={pixData.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.4)' }}
                    >
                      <ExternalLink size={14} />
                      {t('wallet_open_payment')}
                    </a>
                  </div>
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Abra o aplicativo do seu banco, escolha <strong>Pagar com Pix</strong> e cole o código acima ou escaneie o QR Code. A liberação dos seus créditos é imediata e automática!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3>{t('wallet_history')}</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap" style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 18px' }}>Data</th>
                    <th style={{ padding: '14px 18px' }}>Descrição</th>
                    <th style={{ padding: '14px 18px' }}>Valor</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTx ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>
                        <Loader2 size={24} className="spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        {t('wallet_no_tx')}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{formatTransactionDate(tx.created_at)}</td>
                        <td style={{ padding: '14px 18px', fontWeight: '600', fontSize: '0.92rem' }}>Compra de {parseFloat(tx.credits || 0).toFixed(0)} Créditos</td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '0.92rem' }}>
                          <strong style={{ color: 'var(--success)' }}>R$ {parseFloat(tx.amount || 0).toFixed(2).replace('.', ',')}</strong>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${tx.status === 'approved' ? 'badge-active' : tx.status === 'pending' ? 'badge-awaiting' : 'badge-paused'}`}>
                            {tx.status === 'approved' ? 'APROVADO' : tx.status === 'pending' ? 'PENDENTE' : tx.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {tx.status === 'pending' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleReopenPix(tx)}
                              style={{ padding: '6px 14px', fontSize: '0.8rem', gap: '6px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <QrCode size={14} />
                              Ver PIX / Pagar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </section>
    </>
  )
}
