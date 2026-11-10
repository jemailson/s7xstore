import { LifeBuoy, MessageSquare, Send, ExternalLink } from 'lucide-react'
import Topbar from '../components/Topbar'

export default function SupportView() {
  return (
    <>
      <Topbar title="Suporte & Atendimento" />

      <section className="page-content">
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
          Precisa de ajuda com sua conta, recargas ou ativações de keys? Entre em contato pelos canais oficiais.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="card" style={{ border: '1px solid rgba(139, 92, 246, 0.3)', padding: '24px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: '16px' }}>
              <MessageSquare size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Comunidade Discord</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Acesse nosso servidor no Discord para suporte rápido através de tickets, atualizações e avisos gerais.
            </p>
            <a
              href="https://discord.gg/7ndtJqfFKV"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ExternalLink size={16} />
              Acessar Discord
            </a>
          </div>

          <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', padding: '24px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', marginBottom: '16px' }}>
              <Send size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px' }}>Atendimento Direto</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Dúvidas sobre pagamentos e créditos? Chame diretamente a administração oficial no chat.
            </p>
            <a
              href="https://discord.gg/7ndtJqfFKV"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ width: '100%', padding: '12px', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <LifeBuoy size={16} />
              Falar com Suporte
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
