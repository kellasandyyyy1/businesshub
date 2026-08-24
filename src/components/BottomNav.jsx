import {
  IconArrowsExchange,
  IconDots,
  IconFileInvoice,
  IconLayoutDashboard,
  IconScale,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react'
import { NavLink, useLocation } from 'react-router-dom'

import { useDevice } from '../context/BreakpointContext'
import { useProfile } from '../context/ProfileContext'

/** The four destinations that earn a permanent slot; the rest live in More. */
const BUSINESS_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: IconArrowsExchange },
  { to: '/invoices', label: 'Invoices', icon: IconFileInvoice },
  { to: '/clients', label: 'Clients', icon: IconUsers },
]

/** Invoices and clients have no personal counterpart; goals and net worth do. */
const PERSONAL_ITEMS = [
  { to: '/personal', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/personal/transactions', label: 'Transactions', icon: IconArrowsExchange },
  { to: '/personal/goals', label: 'Goals', icon: IconTargetArrow },
  { to: '/personal/net-worth', label: 'Net Worth', icon: IconScale },
]

/** Paths that live behind More, so the button can show as active for them. */
const BUSINESS_MORE = ['/income', '/expenses', '/budgets', '/cashflow', '/reports', '/insights', '/settings']
const PERSONAL_MORE = ['/personal/income', '/personal/expenses', '/personal/reports', '/settings']

export default function BottomNav({ onOpenMore, moreOpen }) {
  const { isMobile, isTablet } = useDevice()
  const { pathname } = useLocation()
  const { isPersonal } = useProfile()
  const ITEMS = isPersonal ? PERSONAL_ITEMS : BUSINESS_ITEMS
  const MORE_PATHS = isPersonal ? PERSONAL_MORE : BUSINESS_MORE

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
