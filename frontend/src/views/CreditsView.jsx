import { useState, useEffect } from 'react'
import { ExternalLink, Crown, Briefcase, Code } from 'lucide-react'
import API from '../api'
import Topbar from '../components/Topbar'

export default function CreditsView() {
  const [credits, setCredits] = useState(null)

  useEffect(() => {
    API.creditsPage().then(data => setCredits(data.credits)).catch(() => {})
  }, [])

  if (!credits) {
    return (
      <>
        <Topbar title="Créditos" />
        <section className="page-content">
          <div className="empty">Carregando...</div>
        </section>
      </>
    )
  }

  const items = [
    { label: 'Discord oficial da S7X STORE', value: credits.discord, icon: ExternalLink, isLink: true },
    { label: 'Dono oficial', value: credits.owner, icon: Crown },
    { label: 'Gerente oficial', value: credits.manager, icon: Briefcase },
    { label: 'Desenvolvimento', value: credits.developer, icon: Code }
  ]

  return (
    <>
      <Topbar title="Créditos" />
      <section className="page-content">
        <div className="credits-grid">
          {items.map((item, i) => {
            const Icon = item.icon
            return (
              <div className="credit-card" key={i}>
                <h3>
                  <Icon size={14} style={{ verticalAlign: 'middle', marginRight: 8, opacity: 0.6 }} />
                  {item.label}
                </h3>
                {item.isLink ? (
                  <a href={item.value} target="_blank" rel="noopener noreferrer">{item.value}</a>
                ) : (
                  <p>{item.value}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
