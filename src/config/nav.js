import {
  IconArrowsExchange,
  IconBulb,
  IconChartArea,
  IconFileInvoice,
  IconLayoutDashboard,
  IconReportAnalytics,
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
