import {
  IconBulb,
  IconChartArea,
  IconChartPie,
  IconReportAnalytics,
  IconSettings,
  IconTableExport,
  IconTargetArrow,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

import { navAnchor } from '../lib/appMap'

import { useProfile } from '../context/ProfileContext'
import useFocusTrap from '../hooks/useFocusTrap'

/** Everything the bottom bar has no room for. */
const BUSINESS_ITEMS = [
  { to: '/income', label: 'Income', icon: IconTrendingUp },
  { to: '/expenses', label: 'Expenses', icon: IconTrendingDown },
  { to: '/budgets', label: 'Budgets', icon: IconTargetArrow },
  { to: '/cashflow', label: 'Cash Flow', icon: IconChartArea },
  { to: '/reports', label: 'Reports', icon: IconReportAnalytics },
  { to: '/export', label: 'Export', icon: IconTableExport },
  { to: '/insights', label: 'Insights', icon: IconBulb },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

const PERSONAL_ITEMS = [
  { to: '/personal/income', label: 'Income', icon: IconTrendingUp },
  { to: '/personal/expenses', label: 'Expenses', icon: IconTrendingDown },
  { to: '/personal/budgets', label: 'Budgets', icon: IconChartPie },
  { to: '/personal/reports', label: 'Reports', icon: IconReportAnalytics },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

export default function MoreDrawer({ onClose }) {
  const trapRef = useFocusTrap()
  const { isPersonal } = useProfile()
  const ITEMS = isPersonal ? PERSONAL_ITEMS : BUSINESS_ITEMS

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="bfh-moredrawer" role="dialog" aria-modal="true" aria-label="More sections">
      <button
        type="button"
        className="bfh-moredrawer__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="bfh-moredrawer__sheet" ref={trapRef}>
        <span className="bfh-moredrawer__handle" aria-hidden="true" />

        <ul className="bfh-moredrawer__list">
          {ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink to={item.to} className="bfh-moredrawer__item" onClick={onClose} data-help-id={navAnchor(item.to)}>
                  <Icon size={18} stroke={1.5} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
