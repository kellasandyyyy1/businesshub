import {
  IconBell,
  IconBuilding,
  IconChevronsDown,
  IconMenu2,
  IconMessageCircle,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'

import ModeSheet from './ModeSheet'
import NotificationsMenu from './NotificationsMenu'

import { PERIODS, usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import useAlerts from '../hooks/useAlerts'
import useGreeting from '../hooks/useGreeting'
import { useIsMobile } from '../hooks/useMediaQuery'
import useSettings from '../hooks/useSettings'

export default function Topbar({ onOpenMenu, onAsk }) {
  const [bellOpen, setBellOpen] = useState(false)
  const settings = useSettings()
  const alerts = useAlerts()
  const { periodId, setPeriodId } = usePeriod()
  const { isPersonal } = useProfile()
  const { greeting, mode } = useGreeting()
  const isMobile = useIsMobile()
  // The sidebar carries the switcher on a desktop; on a phone that sidebar is
  // a drawer, so the greeting stands in for it.
  const [modeOpen, setModeOpen] = useState(false)

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

        {/* One row, two behaviours: a heading on a desktop, and the mode
            control on a phone. A button either way would put a control in the
            page's first heading slot where there is nothing to control. */}
        {isMobile ? (
          <button
            type="button"
            className="bfh-greetingtap"
            onClick={() => setModeOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${greeting}. Currently in ${mode} mode. Change mode`}
          >
            <span className="bfh-greeting">
              {greeting}
              <IconChevronsDown
                size={11}
                stroke={1.5}
                aria-hidden="true"
                className="bfh-greeting__hint"
              />
            </span>
            <span className="bfh-modebadge">
              {isPersonal ? (
                <IconUser size={10} stroke={1.5} aria-hidden="true" />
              ) : (
                <IconBuilding size={10} stroke={1.5} aria-hidden="true" />
              )}
              {mode}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <div className="bfh-greeting">{greeting}</div>
            {/* Which books are on screen, not whose they are — the greeting
                above already says that. */}
            <div className="bfh-micro bfh-greeting__sub">
              {dateLabel} · {mode}
            </div>
          </div>
        )}
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
      {modeOpen && <ModeSheet onClose={() => setModeOpen(false)} />}
    </header>
  )
}
