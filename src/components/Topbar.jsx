import { IconBell, IconMenu2, IconMessageCircle } from '@tabler/icons-react'
import { useState } from 'react'

import NotificationsMenu from './NotificationsMenu'

import { PERIODS, usePeriod } from '../context/PeriodContext'
import useAlerts from '../hooks/useAlerts'
import useSettings from '../hooks/useSettings'

function greetingFor(date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Topbar({ onOpenMenu, onAsk }) {
  const [bellOpen, setBellOpen] = useState(false)
  const settings = useSettings()
  const alerts = useAlerts()
  const { periodId, setPeriodId } = usePeriod()

  const now = new Date()
  const dateLabel = now.toLocaleDateString(settings.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="bfh-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="bfh-icon-btn bfh-hamburger"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <IconMenu2 size={16} stroke={1.5} aria-hidden="true" />
        </button>

        <div className="min-w-0">
          <div className="bfh-greeting">
            {greetingFor(now)}, {settings.businessName}
          </div>
          <div className="bfh-micro bfh-greeting__sub">
            {dateLabel} · {settings.businessName}
          </div>
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <div className="bfh-periods" role="group" aria-label="Reporting period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="bfh-period"
              aria-pressed={periodId === p.id}
              onClick={() => setPeriodId(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* The floating button is out of thumb reach on a phone, so the ask
            control also lives here at mobile widths. */}
        <button
          type="button"
          className="bfh-icon-btn bfh-icon-btn--mobile"
          onClick={onAsk}
          aria-label="Ask anything"
        >
          <IconMessageCircle size={16} stroke={1.5} aria-hidden="true" />
        </button>

        <span className="bfh-bellwrap">
          <button
            type="button"
            className="bfh-icon-btn"
            data-bell="true"
            aria-haspopup="dialog"
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((open) => !open)}
            aria-label={
              alerts.unread > 0
                ? `Notifications, ${alerts.unread} needing attention`
                : 'Notifications, none right now'
            }
          >
            <IconBell size={16} stroke={1.5} aria-hidden="true" />
            {alerts.unread > 0 && <span className="bfh-icon-btn__dot" aria-hidden="true" />}
          </button>

          {bellOpen && <NotificationsMenu onClose={() => setBellOpen(false)} />}
        </span>
      </div>
    </header>
  )
}
