import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Loader2, FileArchive, RefreshCw, Copy, Check, CloudUpload, Edit2 } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'
import { useToast } from '../components/Toast'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export default function PublicFilesAdminView() {
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [copiedId, setCopiedId] = useState(null)
  const [editingFile, setEditingFile] = useState(null)

  const [form, setForm] = useState({ title: '', description: '', slug: '', tutorial_url: '' })
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => { loadFiles() }, [])

  async function loadFiles() {
    setLoading(true)
    try {
      const res = await API.listPublicFiles()
      setFiles(res.files || [])
    } catch (err) {
      toast(err.message || 'Erro ao carregar arquivos', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenModal() {
    setEditingFile(null)
    setForm({ title: '', description: '', slug: '', tutorial_url: '' })
    setSelectedFile(null)
    setUploadProgress(0)
    setModalOpen(true)
  }

  function handleOpenEdit(file) {
    setEditingFile(file)
    setForm({
      title: file.title,
      description: file.description || '',
      slug: file.slug || '',
      tutorial_url: file.tutorial_url || ''
    })
    setSelectedFile(null)
    setUploadProgress(0)
    setModalOpen(true)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setSelectedFile(file)
      if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.title.trim()) { toast('O nome é obrigatório.', 'error'); return }

    setUploading(true)

    if (editingFile) {
      try {
        await API.updatePublicFile(editingFile.id, {
          title: form.title,
          description: form.description,
          slug: form.slug,
          tutorial_url: form.tutorial_url
        })
        toast('Arquivo atualizado com sucesso!', 'success')
        setModalOpen(false)
        loadFiles()
      } catch (err) {
        toast(err.message || 'Erro ao atualizar', 'error')
      } finally {
        setUploading(false)
      }
      return
    }

    if (!selectedFile) { toast('Selecione um arquivo.', 'error'); setUploading(false); return }
    setUploadProgress(0)

    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('slug', form.slug || form.title)
      fd.append('tutorial_url', form.tutorial_url || '')

      const progressInterval = setInterval(() => {
        setUploadProgress(p => p < 90 ? p + 5 : p)
      }, 200)

      await API.uploadPublicFile(fd)
      clearInterval(progressInterval)
      setUploadProgress(100)

      toast('Arquivo enviado com sucesso!', 'success')
      setModalOpen(false)
      loadFiles()
    } catch (err) {
      toast(err.message || 'Erro no upload', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este arquivo permanentemente?')) return
    try {
      await API.deletePublicFile(id)
      toast('Arquivo removido.', 'success')
      loadFiles()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  function copyLink(slug) {
    const url = `${window.location.origin}/f/${slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(slug)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <>
      <Topbar title="Arquivos Públicos">
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <CloudUpload size={16} /> Upload de Arquivo
        </button>
        <button className="btn btn-secondary" onClick={loadFiles} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </Topbar>

      <section className="page-content">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Faça upload de arquivos (APK, ZIP, etc.) e compartilhe com um link público.
          A URL fica no formato: <code style={{ color: 'var(--primary)' }}>/f/seu-slug</code>
        </p>

        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px', color: 'var(--text-muted)' }}>
              <Loader2 size={20} className="spin" /> Carregando arquivos...
            </div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <FileArchive size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <p style={{ fontWeight: '600' }}>Nenhum arquivo enviado ainda</p>
              <p style={{ fontSize: '0.82rem' }}>Clique em "Upload de Arquivo" para começar</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Arquivo</th>
                    <th>Tamanho</th>
                    <th>URL Pública</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.id}>
                      <td><strong>{f.title}</strong>{f.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.description}</div>}</td>
                      <td className="mono" style={{ fontSize: '0.82rem' }}>{f.filename}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatBytes(f.filesize)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>/f/{f.slug}</code>
                          <button
                            onClick={() => copyLink(f.slug)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId === f.slug ? 'var(--success)' : 'var(--text-muted)', padding: '2px' }}
                          >
                            {copiedId === f.slug ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{f.created_at}</td>
                      <td>
                        <div className="actions" style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(f)} title="Editar">
                            <Edit2 size={14} /> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id)} title="Excluir">
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editingFile ? 'Editar Arquivo Público' : 'Upload de Arquivo'}</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <form onSubmit={handleUpload} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {!editingFile && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--primary)' : selectedFile ? 'var(--success)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    padding: '32px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? 'rgba(139,92,246,0.06)' : selectedFile ? 'rgba(16,185,129,0.05)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
                  {selectedFile ? (
                    <>
                      <FileArchive size={32} style={{ color: 'var(--success)', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ fontWeight: '600', color: 'var(--text)', margin: 0 }}>{selectedFile.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>{formatBytes(selectedFile.size)}</p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>Arraste o arquivo aqui ou <strong style={{ color: 'var(--primary)' }}>clique para selecionar</strong></p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>APK, ZIP, IPA, etc. (máx. 100MB)</p>
                    </>
                  )}
                </div>
              )}

              <div className="input-group">
                <label>Nome / Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: APK Android v3.6" required />
              </div>

              <div className="input-group">
                <label>Descrição (opcional)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Versão externa do FFH4X" />
              </div>

              <div className="input-group">
                <label>Link do Tutorial (opcional)</label>
                <input
                  type="url"
                  value={form.tutorial_url || ''}
                  onChange={e => setForm(f => ({ ...f, tutorial_url: e.target.value }))}
                  placeholder="https://youtube.com/... (ou puxa automático da Área de Download)"
                />
              </div>

              <div className="input-group">
                <label>Slug da URL pública (opcional)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="Ex: apk-android (gerado do título se vazio)"
                />
                {form.slug && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    URL: <code style={{ color: 'var(--primary)' }}>{window.location.origin}/f/{form.slug.toLowerCase().replace(/[^a-z0-9]/g, '-')}</code>
                  </span>
                )}
              </div>

              {uploading && (
                <div style={{ background: 'var(--bg)', borderRadius: '8px', overflow: 'hidden', height: '8px' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary)', borderRadius: '8px', transition: 'width 0.2s' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={uploading}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={uploading || (!editingFile && !selectedFile)}>
                  {uploading ? <><Loader2 size={16} className="spin" /> {editingFile ? 'Salvando...' : 'Enviando...'}</> : editingFile ? 'Salvar Alterações' : <><CloudUpload size={16} /> Enviar Arquivo</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
