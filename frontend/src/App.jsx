import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import API from './api'
import logo from './assets/logo.jpg'
import { ToastProvider } from './components/Toast'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import LanguageSelector from './components/LanguageSelector'
import Sidebar from './components/Sidebar'
import LoginView from './views/LoginView'
import DashboardView from './views/DashboardView'
import KeysView from './views/KeysView'
import ProfilesView from './views/ProfilesView'
import LogsView from './views/LogsView'
import CreditsView from './views/CreditsView'
import PermissionsView from './views/PermissionsView'
import BulkKeysView from './views/BulkKeysView'
import WalletView from './views/WalletView'
import DownloadsView from './views/DownloadsView'
import SupportView from './views/SupportView'
import PublicDownloadView from './views/PublicDownloadView'
import PublicFilesAdminView from './views/PublicFilesAdminView'
import PublicFileDownloadView from './views/PublicFileDownloadView'

function PanelView({ user, onLogout, onUserUpdate }) {
  const { t } = useLanguage()
  const initialPage = user?.role === 'download_admin' ? 'download' : 'dashboard'
  const [page, setPage] = useState(initialPage)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleNavigate(p) {
    const role = user?.role
    if (role === 'download_admin') {
      if (p !== 'download' && p !== 'public_files') {
        p = 'download'
      }
      setPage(p)
      return
    }
    if ((p === 'profiles' || p === 'logs') && role !== 'owner' && role !== 'admin') {
      p = 'dashboard'
    }
    if ((p === 'permissions' || p === 'bulk_keys') && role !== 'owner') {
      p = 'dashboard'
    }
    if (p === 'keys' && role !== 'reseller' && role !== 'owner') {
      p = 'dashboard'
    }
    setPage(p)
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return <DashboardView user={user} onUserUpdate={onUserUpdate} />
      case 'keys':
        return <KeysView user={user} onUserUpdate={onUserUpdate} />
      case 'wallet':
        return <WalletView user={user} onUserUpdate={onUserUpdate} />
      case 'download':
        return <DownloadsView user={user} />
      case 'public_files':
        return <PublicFilesAdminView user={user} />
      case 'support':
        return <SupportView />
      case 'profiles':
        return <ProfilesView user={user} />
      case 'permissions':
        return <PermissionsView />
      case 'bulk_keys':
        return <BulkKeysView />
      case 'logs':
        return <LogsView user={user} />
      case 'credits':
        return <CreditsView />
      default:
        return <DashboardView user={user} onUserUpdate={onUserUpdate} />
    }
  }

  return (
    <div className="panel-layout">
      <div className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label={t('nav_dashboard')}
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand">
          <img src={logo} alt="Logo" className="mobile-logo-img" />
          <span className="mobile-brand-title">S7X Store</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LanguageSelector variant="compact" />
          <div className="mobile-user-badge">
            <span className="badge badge-awaiting">{t(`role_${user?.role}`) || user?.role}</span>
          </div>
        </div>
      </div>

      <Sidebar
        user={user}
        page={page}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        onEditProfile={() => setPage('profile_edit')}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        {page === 'profile_edit' ? (
          <ProfileEditView
            user={user}
            onUserUpdate={onUserUpdate}
            onBack={() => setPage('dashboard')}
          />
        ) : (
          renderPage()
        )}
      </main>
    </div>
  )
}

function ProfileEditView({ user, onUserUpdate, onBack }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    display_name: user?.display_name || user?.username || '',
    avatar_url: user?.avatar_url || '',
    password: '',
    custom_prefix: user?.custom_prefix || ''
  })
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const body = {}
      if (form.display_name !== user?.display_name) body.display_name = form.display_name
      if (form.avatar_url !== user?.avatar_url) body.avatar_url = form.avatar_url
      if (form.password) body.password = form.password
      if (form.custom_prefix !== user?.custom_prefix) body.custom_prefix = form.custom_prefix
      
      const res = await API.updateProfile(user.id, body)
      onUserUpdate(res.user)
      onBack()
      alert(t('profile_saved'))
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <h2>{t('profile_settings')}</h2>
        <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onBack}>{t('back')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{t('save')}</button>
          <LanguageSelector />
        </div>
      </header>
      <section className="page-content">
        <div className="card" style={{ maxWidth: '600px' }}>
          <div className="card-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Preview"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    color: '#fff',
                    fontSize: '1.6rem'
                  }}
                >
                  {(form.display_name || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{form.display_name || user?.username}</h3>
                <span className="badge badge-awaiting">{t(`role_${user?.role}`) || user?.role?.toUpperCase()}</span>
              </div>
            </div>

            <div className="input-group">
              <label>{t('profile_name')}</label>
              <input
                type="text"
                placeholder="Ex: s7xstore"
                value={form.display_name}
                onChange={e => setForm({ ...form, display_name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>{t('profile_avatar')}</label>
              <input
                type="url"
                placeholder="https://i.imgur.com/exemplo.png"
                value={form.avatar_url}
                onChange={e => setForm({ ...form, avatar_url: e.target.value })}
              />
              <span className="muted" style={{ fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                {t('profile_avatar_hint')}
              </span>
            </div>

            <div className="input-group">
              <label>{t('profile_new_password')}</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {user?.role === 'reseller' && user?.reseller_type === 'rubi' && (
              <div className="input-group">
                <label>{t('profile_custom_prefix')}</label>
                <input 
                  value={form.custom_prefix} 
                  onChange={e => setForm({
                    ...form,
                    custom_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
                  })} 
                  placeholder="Ex: ABC" 
                  maxLength={3} 
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function MainApp() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const pathname = window.location.pathname
  const downloadMatch = pathname.match(/^\/d\/(.+)$/)
  if (downloadMatch) {
    return <PublicDownloadView slug={downloadMatch[1]} />
  }

  const fileMatch = pathname.match(/^\/f\/(.+)$/)
  if (fileMatch) {
    return <PublicFileDownloadView slug={fileMatch[1]} />
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const discordToken = params.get('discord_token')
    const discordError = params.get('error')

    if (discordToken) {
      window.history.replaceState({}, '', '/')
      API.setToken(discordToken)
      API.me()
        .then(data => setUser(data.user))
        .catch(() => API.setToken(null))
        .finally(() => setLoading(false))
      return
    }

    if (discordError) {
      window.history.replaceState({}, '', '/')
    }

    if (API.getToken()) {
      API.me()
        .then(data => setUser(data.user))
        .catch(() => API.setToken(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  function handleLogin(userData) {
    setUser(userData)
  }

  function handleLogout() {
    API.setToken(null)
    setUser(null)
  }

  if (loading) return null

  return (
    <>
      {user ? (
        <PanelView user={user} onLogout={handleLogout} onUserUpdate={setUser} />
      ) : (
        <LoginView onLogin={handleLogin} />
      )}
    </>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </LanguageProvider>
  )
}
