import { useState, useEffect } from 'react'
import { Key, CheckCircle, PauseCircle, XCircle, Clock, Users, ShieldCheck, Gem, Loader2 } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import { useLanguage } from '../contexts/LanguageContext'

const RESELLER_TYPE = {
  classic: 'Classic',
  rubi: 'Rubi'
}

export default function DashboardView({ user, onUserUpdate }) {
  const { t } = useLanguage()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    API.stats().then(data => {
      setStats(data)
      onUserUpdate({ ...user, credits: data.credits })
    }).catch(() => {})
  }, [])

  if (!stats) {
    return (
      <>
        <Topbar title={t('nav_dashboard')} />
        <section className="page-content">
          <div className="card">
            <div className="table-loading-state" style={{ padding: '60px 24px' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
              <span>Carregando estatísticas do painel...</span>
            </div>
          </div>
        </section>
      </>
    )
  }

  const isReseller = user?.role === 'reseller'
  const isMember = user?.role === 'member'

  const mainCards = []
  if (isMember) {
    mainCards.push(
      { label: 'Cargo Atual', value: 'Membro', icon: Users, color: '#00e5ff' },
      { label: 'Seus créditos', value: stats.credits, icon: Gem, color: '#ffd600' },
      { label: 'Próximo Cargo', value: 'Revendedor (+7 Bônus)', icon: ShieldCheck, color: '#00e676' }
    )
  } else if (!isReseller) {
    mainCards.push(
      { label: 'Keys totais', value: stats.keys.total, icon: Key, color: '#7c4dff' },
      { label: 'Perfis', value: stats.profiles.total, icon: Users, color: '#00e5ff' },
      { label: 'Revendedores', value: stats.profiles.resellers, icon: ShieldCheck, color: '#00e676' }
    )
  } else {
    mainCards.push(
      { label: 'Keys totais', value: stats.keys.total, icon: Key, color: '#7c4dff' },
      { label: 'Seus créditos', value: stats.credits, icon: Gem, color: '#ffd600' },
      { label: 'Tipo', value: RESELLER_TYPE[stats.reseller_type] || stats.reseller_type || '—', icon: ShieldCheck, color: '#00e5ff' }
    )
  }

  const statusMetrics = [
    { key: 'total', label: 'Keys Geradas', value: stats.keys.total, color: '#00e5ff' }
  ]

  const totalKeys = stats.keys.total
  const r = 70
  const circ = 2 * Math.PI * r

  let currentOffset = 0
  const donutSegments = statusMetrics.map(m => {
    const pct = totalKeys > 0 ? (m.value / totalKeys) : 0
    const strokeDash = pct * circ
    const offset = currentOffset
    currentOffset += strokeDash
    return { ...m, strokeDash, offset, pct }
  })

  return (
    <>
      <Topbar title={t('nav_dashboard')} />
      <section className="page-content">
        {isMember && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                Seja bem-vindo(a) à S7X Store! 🚀
              </h3>
              <p style={{ color: '#d1d5db', fontSize: '0.9rem', margin: 0, maxWidth: '650px' }}>
                Sua conta está registrada como <strong>Membro</strong>. Para desbloquear a <strong>geração de keys</strong> e ser promovido automaticamente para <strong>Revendedor</strong>, basta adquirir créditos na aba Carteira. Você ainda ganha <strong>+7 créditos bônus</strong> a partir de 10 créditos!
              </p>
            </div>
          </div>
        )}

        <div className="stats-grid">
          {mainCards.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="stat-card">
                <div className="stat-card-details">
                  <span className="label">{c.label}</span>
                  <span className="value" style={{ color: c.color }}>{c.value}</span>
                </div>
                <div className="stat-card-icon" style={{ background: `${c.color}15`, color: c.color }}>
                  <Icon size={24} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="dashboard-grid">
          <div className="card donut-chart-card">
            <div className="card-header">
              <h3>Visão Geral das Keys</h3>
            </div>
            <div className="card-body donut-chart-body">
              <div className="donut-chart-wrapper">
                <svg viewBox="0 0 200 200" className="donut-svg">
                  <circle
                    className="donut-ring"
                    cx="100"
                    cy="100"
                    r={r}
                  />
                  {totalKeys > 0 && donutSegments.map(seg => (
                    seg.value > 0 && (
                      <circle
                        key={seg.key}
                        className="donut-segment"
                        cx="100"
                        cy="100"
                        r={r}
                        stroke={seg.color}
                        strokeDasharray={`${seg.strokeDash} ${circ - seg.strokeDash}`}
                        strokeDashoffset={-seg.offset}
                      />
                    )
                  ))}
                </svg>
                <div className="donut-center-text">
                  <span className="total-num">{totalKeys}</span>
                  <span className="total-lbl">Total</span>
                </div>
              </div>

              <div className="chart-legends">
                {statusMetrics.map(m => {
                  const pct = totalKeys > 0 ? ((m.value / totalKeys) * 100).toFixed(0) : 0
                  return (
                    <div key={m.key} className="chart-legend-item">
                      <span className="legend-dot" style={{ background: m.color, color: m.color }} />
                      <div className="legend-info">
                        <span className="legend-name">{m.label}</span>
                        <div className="legend-value-row">
                          <span className="legend-qty">{m.value}</span>
                          <span className="legend-pct">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card progress-list-card">
            <div className="card-header">
              <h3>Resumo das Keys</h3>
            </div>
            <div className="card-body">
              <div className="progress-list">
                {statusMetrics.map(m => {
                  const pct = totalKeys > 0 ? ((m.value / totalKeys) * 100).toFixed(1) : 0
                  return (
                    <div key={m.key} className="progress-item">
                      <div className="progress-header">
                        <span className="progress-label">{m.label}</span>
                        <div className="progress-stats">
                          <span className="progress-qty">{m.value}</span>
                          <span className="progress-pct">({pct}%)</span>
                        </div>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${pct}%`,
                            background: m.color,
                            color: m.color
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
