import {
  IconBell,
  IconBuilding,
  IconChevronDown,
  IconMenu2,
  IconMessageCircle,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import ModeSheet from './ModeSheet'
import NotificationsMenu from './NotificationsMenu'

import { PERIODS, usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import useBellState from '../hooks/useBellState'
import useGreeting from '../hooks/useGreeting'
import { useIsMobile } from '../hooks/useMediaQuery'
import useSettings from '../hooks/useSettings'

// Pages with their own period choice, or none at all: a second switch up
// here would change nothing on them and suggest that it should.
const PERIODLESS = new Set(['/personal/goals', '/personal/net-worth', '/reports', '/personal/reports', '/invoices', '/cashflow', '/insights', '/clients', '/overview', '/export'])

export default function Topbar({ onOpenMenu, onAsk }) {
  const [bellOpen, setBellOpen] = useState(false)
  const settings = useSettings()
  const bell = useBellState()
  const { periodId, setPeriodId } = usePeriod()
  // Goals and net worth are standing totals, not a window of time; a period
  // switch there would change nothing and suggest that it should.
  const { pathname } = useLocation()
  const periodless = PERIODLESS.has(pathname)
  const { isPersonal, showSwitcher } = useProfile()
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
        {isMobile && showSwitcher ? (
          <button
            type="button"
            className="bfh-greetingtap"
            onClick={() => setModeOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${greeting}. Currently in ${mode} mode. Change mode`}
          >
            <span className="bfh-greeting">{greeting}</span>
            {/* The badge carries the chevron rather than the greeting: it is
                the badge that opens the picker, and a lone glyph under the
                name pointed at nothing. */}
            <span className="bfh-modebadge">
              {isPersonal ? (
                <IconUser size={11} stroke={2} aria-hidden="true" />
              ) : (
                <IconBuilding size={11} stroke={2} aria-hidden="true" />
              )}
              {mode}
              <IconChevronDown
                size={11}
                stroke={2}
                aria-hidden="true"
                className="bfh-modebadge__caret"
              />
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
        {!periodless && (
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
        )}

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
            className="bfh-icon-btn bfh-bell"
            data-bell="true"
            data-fresh={bell.fresh > 0 || undefined}
            data-tone={bell.fresh > 0 ? (bell.tone ?? 'ink') : undefined}
            data-ring={bell.ring || undefined}
            aria-haspopup="dialog"
            aria-expanded={bellOpen}
            onClick={() => {
              // Opening the list is reading it: the badge goes quiet until
              // something new arrives.
              if (!bellOpen) bell.markSeen()
              setBellOpen((open) => !open)
            }}
            aria-label={
              bell.fresh > 0
                ? `Notifications, ${bell.fresh} new`
                : bell.count > 0
                  ? `Notifications, ${bell.count}`
                  : 'Notifications, none right now'
            }
          >
            <IconBell className="bfh-bell__icon" size={17} stroke={1.6} aria-hidden="true" />
            {bell.fresh > 0 ? (
              <span className="bfh-bell__badge" aria-hidden="true">
                {bell.fresh > 9 ? '9+' : bell.fresh}
              </span>
            ) : (
              bell.count > 0 && <span className="bfh-bell__seen" aria-hidden="true" />
            )}
          </button>

          {bellOpen && <NotificationsMenu onClose={() => setBellOpen(false)} />}
        </span>
      </div>
      {modeOpen && <ModeSheet onClose={() => setModeOpen(false)} />}
    </header>
  )
}
