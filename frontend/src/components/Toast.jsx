import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext()

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div id="toast-container">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || ICONS.info
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon size={18} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button className="modal-close-btn" onClick={() => removeToast(t.id)}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
