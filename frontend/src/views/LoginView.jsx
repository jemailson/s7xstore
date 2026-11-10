import { useState, useEffect } from 'react'
import { User, Lock } from 'lucide-react'
import API from '../api'
import logo from '../assets/logo.jpg'
import LanguageSelector from '../components/LanguageSelector'
import { useLanguage } from '../contexts/LanguageContext'

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  )
}

export default function LoginView({ onLogin }) {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errCode = params.get('error')
    if (errCode === 'discord_error' || errCode === 'discord_user_failed' || errCode === 'discord_create_failed') {
      setError('Erro ao entrar com Discord. Tente novamente.')
    } else if (errCode === 'captcha_missing') {
      setError(t('login_captcha_required'))
    } else if (errCode === 'captcha_failed') {
      setError('Falha no CAPTCHA. Tente novamente.')
    } else if (errCode === 'captcha_error') {
      setError('Erro ao validar o CAPTCHA com o servidor.')
    }

    let widgetId = null

    window.onloadTurnstileCallback = function () {
      if (window.turnstile) {
        widgetId = window.turnstile.render('#cf-turnstile-widget', {
          sitekey: '0x4AAAAAAF6173mQ-ddiI42m',
          theme: 'dark',
          callback: function(token) { setTurnstileToken(token) }
        })
      }
    }

    if (window.turnstile) {
      widgetId = window.turnstile.render('#cf-turnstile-widget', {
        sitekey: '0x4AAAAAAF6173mQ-ddiI42m',
        theme: 'dark',
        callback: function(token) { setTurnstileToken(token) }
      })
    }

    return () => {
      if (widgetId !== null && window.turnstile) {
        window.turnstile.remove(widgetId)
      }
    }
  }, [t])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!turnstileToken) {
      setError(t('login_captcha_required') || 'Por favor, complete a verificação de segurança.')
      return
    }

    setLoading(true)

    try {
      const data = await API.login(username.trim(), password, turnstileToken)
      API.setToken(data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
      if (window.turnstile) {
        window.turnstile.reset()
        setTurnstileToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleDiscordLogin() {
    setError('')
    if (!turnstileToken) {
      setError(t('login_discord_captcha_required') || 'Por favor, complete a verificação antes de entrar com Discord.')
      return
    }
    window.location.href = `/api/auth/discord?ts=${turnstileToken}`
  }

  return (
    <div className="login-view" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 100 }}>
        <LanguageSelector />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="logo-mark">
            <img src={logo} alt="S7X Logo" />
          </div>
          <h1>{t('login_title')}</h1>
          <p>{t('login_subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={handleDiscordLogin}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '13px 20px',
            background: '#5865F2',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            marginBottom: '20px',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <DiscordIcon />
          {t('login_discord')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {t('login_or_user')}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{t('login_user')}</label>
            <div className="input-wrapper">
              <User size={18} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>
          <div className="input-group">
            <label>{t('login_password')}</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <div id="cf-turnstile-widget" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', minHeight: '65px' }}></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('login_submitting') : t('login_submit')}
          </button>
          {error && <div className="form-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
