import { LayoutDashboard, Key, Users, ScrollText, Award, LogOut, ShieldCheck, PlusSquare, X, Wallet, Download, LifeBuoy, Settings, CloudUpload } from 'lucide-react'
import logo from '../assets/logo.jpg'
import { useLanguage } from '../contexts/LanguageContext'

const ICONS = {
  dashboard: LayoutDashboard,
  keys: Key,
  wallet: Wallet,
  download: Download,
  public_files: CloudUpload,
  support: LifeBuoy,
  profiles: Users,
  permissions: ShieldCheck,
  bulk_keys: PlusSquare,
  logs: ScrollText,
  credits: Award
}

const NAV_ITEMS = [
  { id: 'dashboard', labelKey: 'nav_dashboard' },
  { id: 'keys', labelKey: 'nav_keys' },
  { id: 'wallet', labelKey: 'nav_wallet' },
  { id: 'download', labelKey: 'nav_download' },
  { id: 'public_files', labelKey: 'nav_public_files' },
  { id: 'support', labelKey: 'nav_support' },
  { id: 'profiles', labelKey: 'nav_profiles' },
  { id: 'permissions', labelKey: 'nav_permissions' },
  { id: 'bulk_keys', labelKey: 'nav_bulk_keys' },
  { id: 'logs', labelKey: 'nav_logs' },
  { id: 'credits', labelKey: 'nav_credits' }
]

function canSee(page, role) {
  if (!role) return false
  if (role === 'download_admin') {
    return page === 'download' || page === 'public_files'
  }
  if (page === 'profiles' || page === 'logs') return role === 'owner' || role === 'admin'
  if (page === 'permissions' || page === 'bulk_keys') return role === 'owner'
  if (page === 'public_files') return role === 'owner' || role === 'admin'
  if (page === 'keys') return role === 'reseller'
  return true
}

export default function Sidebar({ user, page, onNavigate, onLogout, onEditProfile, isOpen, onClose }) {
  const { t } = useLanguage()
  const displayName = user?.display_name || user?.username || 'Usuário'
  const firstLetter = displayName.charAt(0).toUpperCase()
  const creditsNum = parseFloat(user?.credits || 0).toFixed(1)

  const roleLabel = t(`role_${user?.role}`) || user?.role || 'Membro'

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-mark small">
            <img src={logo} alt="S7X Logo" />
          </div>
          <div style={{ flex: 1 }}>
            <strong>S7X Store</strong>
            <span>{roleLabel}</span>
          </div>
          {onClose && (
            <button className="sidebar-close-btn" onClick={onClose} title={t('close')}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.filter(item => canSee(item.id, user?.role)).map(item => {
            const Icon = ICONS[item.id]
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(item.id)
                  if (onClose) onClose()
                }}
              >
                <Icon size={18} />
                {t(item.labelKey)}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div
            className="user-profile-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(20, 20, 26, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '10px 14px',
              marginBottom: '12px',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (onEditProfile) onEditProfile()
              if (onClose) onClose()
            }}
            title={t('profile_settings')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={displayName}
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    color: '#fff',
                    fontSize: '1.1rem'
                  }}
                >
                  {firstLetter}
                </div>
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#fff', lineHeight: 1.2 }}>
                  {displayName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.8rem' }}>🪙</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--success)' }}>
                    {creditsNum}
                  </span>
                </div>
              </div>
            </div>

            <button
              style={{
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)'
              }}
              title={t('profile_settings')}
            >
              <Settings size={18} />
            </button>
          </div>

          <button className="btn btn-ghost btn-block" onClick={onLogout}>
            <LogOut size={16} />
            {t('logout')}
          </button>
        </div>
      </aside>
    </>
  )
}
