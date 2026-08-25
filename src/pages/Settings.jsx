import { IconArrowLeft, IconChevronRight } from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'

import AboutSection from '../components/settings/AboutSection'
import AppearanceSection from '../components/settings/AppearanceSection'
import BusinessSection from '../components/settings/BusinessSection'
import CategoriesSection from '../components/settings/CategoriesSection'
import DataSection from '../components/settings/DataSection'
import NotificationsSection from '../components/settings/NotificationsSection'
import PaymentMethodsSection from '../components/settings/PaymentMethodsSection'
import TransfersSection from '../components/settings/TransfersSection'
import useSettingsData from '../hooks/useSettingsData'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useThemeSync } from '../hooks/useTheme'

const SECTIONS = [
  { id: 'business', label: 'Business' },
  { id: 'categories', label: 'Categories' },
  { id: 'methods', label: 'Payment Methods' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
  { id: 'about', label: 'About' },
]

const APP_VERSION = '0.1.0'

export default function Settings() {
  const data = useSettingsData()
  const theme = useThemeSync()
  const isMobile = useIsMobile()
  // Held in the URL so the phone's back gesture returns to the section list
  // rather than leaving Settings altogether.
  const [params, setParams] = useSearchParams()

  const requested = params.get('section')
  // Two columns on desktop, so something always has to be showing there.
  const section = requested ?? (isMobile ? null : 'business')

  if (!data) return <div className="bfh-page" />

  const open = (id) => setParams(id ? { section: id } : {}, { replace: false })
  const current = SECTIONS.find((s) => s.id === section)

  const body = (
    <section className="bfh-card bfh-settings">
      {section === 'business' && (
        // Keyed so the form re-reads stored values after an import.
        <BusinessSection key={JSON.stringify(data.settings.businessName)} settings={data.settings} />
      )}
      {section === 'categories' && (
        <CategoriesSection categoryUse={data.categoryUse} />
      )}
      {section === 'methods' && (
        <PaymentMethodsSection paymentMethods={data.paymentMethods} methodUse={data.methodUse} />
      )}
      {section === 'transfers' && <TransfersSection />}
      {section === 'notifications' && <NotificationsSection settings={data.settings} />}
      {section === 'appearance' && <AppearanceSection theme={theme} />}
      {section === 'data' && <DataSection settings={data.settings} />}
      {section === 'about' && <AboutSection version={APP_VERSION} />}
    </section>
  )

  /* Phone: the list and the section are separate screens, the same way one
     client sits on its own route away from the client list. */
  if (isMobile) {
    if (!current) {
      return (
        <div className="bfh-page">
          <div className="bfh-block">
            <ul className="bfh-settingslist">
              {SECTIONS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="bfh-settingslist__item"
                    onClick={() => open(item.id)}
                  >
                    <span>{item.label}</span>
                    <IconChevronRight size={16} stroke={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    return (
      <div className="bfh-page">
        <div className="bfh-block">
          <button type="button" className="bfh-backlink" onClick={() => open(null)}>
            <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
            Settings
          </button>
        </div>
        <div className="bfh-block">{body}</div>
      </div>
    )
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-settings__grid">
        <aside className="bfh-reportnav" aria-label="Settings sections">
          <div className="bfh-reportnav__list">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="bfh-reportnav__item"
                aria-current={section === item.id ? 'true' : undefined}
                onClick={() => open(item.id)}
              >
                <span className="bfh-reportnav__dot" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {body}
      </div>
    </div>
  )
}
