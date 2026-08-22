import {
  IconArrowsExchange,
  IconDots,
  IconFileInvoice,
  IconLayoutDashboard,
  IconUsers,
} from '@tabler/icons-react'
import { NavLink, useLocation } from 'react-router-dom'

import { useDevice } from '../context/BreakpointContext'

/** The five destinations that earn a permanent slot; the rest live in More. */
const ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: IconArrowsExchange },
  { to: '/invoices', label: 'Invoices', icon: IconFileInvoice },
  { to: '/clients', label: 'Clients', icon: IconUsers },
]

/** Paths that live behind More, so the button can show as active for them. */
const MORE_PATHS = ['/income', '/expenses', '/budgets', '/cashflow', '/reports', '/insights', '/settings']

export default function BottomNav({ onOpenMore, moreOpen }) {
  const { isMobile, isTablet } = useDevice()
  const { pathname } = useLocation()

  // The sidebar takes over from 1024px up.
  if (!isMobile && !isTablet) return null

  const moreActive = moreOpen || MORE_PATHS.some((p) => pathname.startsWith(p))

  return (
    <nav className="bfh-bottomnav" aria-label="Primary">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.to} to={item.to} end={item.end} className="bfh-bottomnav__item">
            <Icon size={20} stroke={1.5} aria-hidden="true" />
            <span className="bfh-bottomnav__label">{item.label}</span>
          </NavLink>
        )
      })}

      <button
        type="button"
        className="bfh-bottomnav__item"
        aria-current={moreActive ? 'true' : undefined}
        aria-expanded={moreOpen}
        onClick={onOpenMore}
      >
        <IconDots size={20} stroke={1.5} aria-hidden="true" />
        <span className="bfh-bottomnav__label">More</span>
      </button>
    </nav>
  )
}
