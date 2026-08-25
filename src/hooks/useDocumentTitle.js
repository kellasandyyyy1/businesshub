import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const BRAND = 'Dual'

/**
 * What the browser tab says.
 *
 * Longest paths first, so /personal/transactions is matched before /personal.
 * A path with no entry falls back to the brand alone rather than keeping the
 * previous page's title, which is what makes a stale tab confusing.
 */
const TITLES = [
  ['/personal/transactions', 'Personal transactions'],
  ['/personal/net-worth', 'Net Worth'],
  ['/personal/expenses', 'Personal expenses'],
  ['/personal/reports', 'Personal reports'],
  ['/personal/income', 'Personal income'],
  ['/personal/goals', 'Goals'],
  ['/personal', 'Personal'],
  ['/transactions', 'Transactions'],
  ['/how-it-works', 'How it works'],
  ['/cashflow', 'Cash Flow'],
  ['/invoices', 'Invoices'],
  ['/insights', 'Insights'],
  ['/overview', 'Overview'],
  ['/settings', 'Settings'],
  ['/expenses', 'Expenses'],
  ['/budgets', 'Budgets'],
  ['/reports', 'Reports'],
  ['/clients', 'Clients'],
  ['/income', 'Income'],
  ['/export', 'Export'],
  ['/', 'Dashboard'],
]

export function titleFor(pathname) {
  const match = TITLES.find(([path]) => (path === '/' ? pathname === '/' : pathname.startsWith(path)))
  return match ? `${match[1]} — ${BRAND}` : BRAND
}

export function useDocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
}

export default useDocumentTitle
