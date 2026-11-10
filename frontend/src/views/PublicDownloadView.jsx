import { useState, useEffect } from 'react'
import { Play, Download, FolderGit2, MessageCircle, Key, Loader2, Shield, Apple, Gamepad2 } from 'lucide-react'
import API from '../api'
import LanguageSelector from '../components/LanguageSelector'

function ensureUrl(url) {
  if (!url) return ''
  const trimmed = String(url).trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export default function PublicDownloadView({ slug }) {
  const [download, setDownload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchDownload() {
      try {
        const res = await API.getPublicDownload(slug)
        setDownload(res.download)
      } catch (err) {
        setError(err.message || 'Página de download não encontrada')
      } finally {
        setLoading(false)
      }
    }
    fetchDownload()
  }, [slug])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  if (error || !download) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'var(--text)', flexDirection: 'column', gap: '16px' }}>
        <h2>Download Inválido</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/'}>Voltar ao Início</button>
      </div>
    )
  }

  const updateDate = download.updated_at ? download.updated_at.split(' ')[0].split('-').reverse().join('/') : ''

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1a0b1c 0%, #0a0a0c 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
        <LanguageSelector />
      </div>
      <div style={{
        background: 'rgba(20, 10, 15, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 60, 60, 0.1)',
        borderRadius: '20px',
        padding: '40px 30px',
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        
        <div style={{ marginBottom: '16px' }}>
          {download.platform_type === 'ios' ? (
             <Apple size={64} color="#ff4747" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 71, 71, 0.5))' }} />
          ) : download.platform_type === 'android' ? (
             <Shield size={64} color="#ff4747" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 71, 71, 0.5))' }} />
          ) : (
             <Gamepad2 size={64} color="#ff4747" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 71, 71, 0.5))' }} />
          )}
        </div>

        <h1 style={{ 
          color: '#fff', 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          margin: '0 0 12px 0',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {download.title}
        </h1>

        {download.version && (
          <div style={{
            background: 'rgba(255, 71, 71, 0.1)',
            border: '1px solid rgba(255, 71, 71, 0.3)',
            color: '#ff4747',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600',
            marginBottom: '12px'
          }}>
            {download.version}
          </div>
        )}

        {updateDate && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginBottom: '24px' }}>
            Atualizado {updateDate}
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {(download.tutorial_url || download.tutorial_link) && (
            <a href={ensureUrl(download.tutorial_url || download.tutorial_link)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s'
              }}>
                <Play size={18} fill="#ff4747" color="#ff4747" /> Tutorial de Instalação
              </button>
            </a>
          )}

          {(download.download_url || download.direct_link) && (
            <a href={ensureUrl(download.download_url || download.direct_link)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
               <button style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(90deg, #ff4747, #ff2a2a)', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(255, 71, 71, 0.3)'
                }}>
                  <Download size={18} /> Download APK MOD
                </button>
            </a>
          )}

          {(download.mt_manager_url || download.mt_manager_link) && (
            <a href={ensureUrl(download.mt_manager_url || download.mt_manager_link)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: '#3b82f6', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}>
                <FolderGit2 size={18} /> Download MT MANAGER
              </button>
            </a>
          )}

          {(download.channel_url || download.channel_link) && (
            <>
              <a href={ensureUrl(download.channel_url || download.channel_link)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: '#10b981', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}>
                  <MessageCircle size={18} /> Canal de Atualizações
                </button>
              </a>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textAlign: 'center', marginTop: '-4px', marginBottom: '8px' }}>
                (receba atualizações e avisos importantes)
              </div>
            </>
          )}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 0' }}></div>

          <button onClick={() => window.location.href = '/'} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.2)',
            background: 'rgba(234, 179, 8, 0.05)', color: '#eab308', fontSize: '0.95rem', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer'
          }}>
            <Key size={18} /> Gerador de Keys
          </button>

        </div>

        <div style={{ marginTop: '24px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0', textAlign: 'center' }}>
            Fique por dentro das novidades! Siga o canal <strong>S7X Store</strong> no WhatsApp:
          </p>
          <a href="https://whatsapp.com/channel/0029Vb8XFAqElagqOu79CJ1l" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: '100%' }}>
            <button style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: '#25D366', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(37, 211, 102, 0.3)', transition: 'all 0.2s'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
              </svg>
              Entrar no Grupo
            </button>
          </a>
        </div>

        <div style={{ marginTop: '24px', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>
          @s7xstore 2026
        </div>

      </div>
    </div>
  )
}
