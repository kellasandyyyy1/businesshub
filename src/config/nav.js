import {
  IconArrowsExchange,
  IconBulb,
  IconChartArea,
  IconFileInvoice,
  IconLayoutDashboard,
  IconReportAnalytics,
  IconScale,
  IconTableExport,
  IconTargetArrow,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react'

/**
 * Sidebar structure. `badge` names a key on the alerts object; the item shows
 * a count pill whenever that key is non-zero.
 */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
      { to: '/transactions', label: 'Transactions', icon: IconArrowsExchange },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/income', label: 'Income', icon: IconTrendingUp },
      { to: '/expenses', label: 'Expenses', icon: IconTrendingDown },
      { to: '/invoices', label: 'Invoices', icon: IconFileInvoice, badge: 'overdueInvoices' },
      { to: '/clients', label: 'Clients', icon: IconUsers },
    ],
  },
  {
    label: 'Plan',
    items: [
      { to: '/budgets', label: 'Budgets', icon: IconTargetArrow },
      { to: '/cashflow', label: 'Cash Flow', icon: IconChartArea },
      { to: '/reports', label: 'Reports', icon: IconReportAnalytics },
      { to: '/export', label: 'Export', icon: IconTableExport },
      { to: '/insights', label: 'Insights', icon: IconBulb },
    ],
  },
]

/**
 * The personal side. Same grouping so the eye lands in the same places when the
 * profile changes; the rows a household has no use for — invoices, clients,
 * export — are simply not here, and goals and net worth take their place.
 *
 * No badges: the alerts they count are invoice and budget conditions that only
 * the business profile has.
 */
export const PERSONAL_NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/personal', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
      { to: '/personal/transactions', label: 'Transactions', icon: IconArrowsExchange },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/personal/income', label: 'Income', icon: IconTrendingUp },
      { to: '/personal/expenses', label: 'Expenses', icon: IconTrendingDown },
    ],
  },
  {
    label: 'Plan',
    items: [
      { to: '/personal/goals', label: 'Goals', icon: IconTargetArrow },
      { to: '/personal/net-worth', label: 'Net Worth', icon: IconScale },
      { to: '/personal/reports', label: 'Reports', icon: IconReportAnalytics },
    ],
  },
]

/** Where each profile starts, and where a switch lands. */
export const PROFILE_HOME = { business: '/', personal: '/personal' }

export const navGroupsFor = (profile) =>
  profile === 'personal' ? PERSONAL_NAV_GROUPS : NAV_GROUPS

/**
 * Every path the business profile owns. The personal profile has no page for
 * these, so reaching one — by typing it, or from a bookmark — sends the user
 * to the personal home instead of a screen full of the other profile's data.
 */
export const BUSINESS_ONLY_PATHS = [
  '/',
  '/transactions',
  '/income',
  '/expenses',
  '/invoices',
  '/clients',
  '/budgets',
  '/cashflow',
  '/reports',
  '/export',
  '/insights',
]
