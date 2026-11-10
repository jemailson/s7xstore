import { useState, useEffect } from 'react'
import { Download, Loader2, FileArchive, Shield, Apple, Gamepad2, Play } from 'lucide-react'
import API from '../api'
import LanguageSelector from '../components/LanguageSelector'

function ensureUrl(url) {
  if (!url) return ''
  const trimmed = String(url).trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function getFileExt(filename) {
  return filename ? filename.split('.').pop().toUpperCase() : 'FILE'
}

export default function PublicFileDownloadView({ slug }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await API.getPublicFileInfo(slug)
        setFile(res.file)
      } catch (err) {
        setError(err.message || 'Arquivo não encontrado')
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [slug])

  async function handleDownload() {
    setDownloading(true)
    try {
      const url = `/api/public-files/download/${slug}`
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      alert('Erro ao baixar o arquivo: ' + err.message)
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
        <Loader2 size={32} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error || !file) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: '#fff', flexDirection: 'column', gap: '16px' }}>
        <FileArchive size={48} style={{ color: '#ff4747', opacity: 0.5 }} />
        <h2 style={{ margin: 0 }}>Arquivo não encontrado</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>{error}</p>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: '8px', padding: '10px 24px', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', borderRadius: '10px', cursor: 'pointer' }}>
          Voltar ao Início
        </button>
      </div>
    )
  }

  const ext = getFileExt(file.filename)
  const updateDate = file.created_at ? file.created_at.split(' ')[0].split('-').reverse().join('/') : ''

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, #0a0a0c 60%)',
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
        background: 'rgba(15, 10, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '24px',
        padding: '48px 36px',
        width: '100%',
        maxWidth: '440px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)'
      }}>

        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(59,130,246,0.2))',
          border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: '0 0 30px rgba(139,92,246,0.2)'
        }}>
          <FileArchive size={40} style={{ color: '#a78bfa' }} />
        </div>

        <div style={{
          background: 'rgba(139,92,246,0.15)',
          border: '1px solid rgba(139,92,246,0.3)',
          color: '#a78bfa',
          padding: '3px 12px',
          borderRadius: '20px',
          fontSize: '0.7rem',
          fontWeight: '700',
          letterSpacing: '1px',
          marginBottom: '14px'
        }}>
          {ext}
        </div>

        <h1 style={{
          color: '#fff',
          fontSize: '1.4rem',
          fontWeight: '700',
          margin: '0 0 8px 0',
          textAlign: 'center',
          lineHeight: 1.3
        }}>
          {file.title}
        </h1>

        {file.description && (
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.85rem',
            textAlign: 'center',
            margin: '0 0 20px 0',
            lineHeight: 1.5
          }}>
            {file.description}
          </p>
        )}

        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nome do arquivo</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Tamanho</span>
            <span style={{ color: '#a78bfa', fontWeight: '600' }}>{formatBytes(file.filesize)}</span>
          </div>
          {updateDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Publicado em</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{updateDate}</span>
            </div>
          )}
        </div>

        {(file.tutorial_url || file.tutorial_link) && (
          <a
            href={ensureUrl(file.tutorial_url || file.tutorial_link)}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', width: '100%', marginBottom: '12px' }}
          >
            <button
              type="button"
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '14px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ff4d4d',
                fontSize: '0.95rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)'
              }}
            >
              <Play size={18} fill="#ff4d4d" color="#ff4d4d" />
              Assistir Tutorial
            </button>
          </a>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            background: downloading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: downloading ? 'none' : '0 4px 20px rgba(124,58,237,0.4)',
            transition: 'all 0.2s',
            letterSpacing: '0.3px'
          }}
        >
          {downloading
            ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Iniciando download...</>
            : <><Download size={20} /> Download ({formatBytes(file.filesize)})</>
          }
        </button>

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

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', marginTop: '20px', textAlign: 'center' }}>
          @s7xstore 2026
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
