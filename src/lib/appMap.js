/**
 * Where everything is, for the assistant's "where is…?" answers.
 *
 * The one place that lists what a person might look for: every page, every
 * Settings tab, and the handful of controls people ask about by name. The
 * assistant may only point at an id from this list, and Show me reads the
 * route and anchor from it, so a new feature that should be findable is added
 * here and nowhere else.
 *
 * Pages that exist on both sides carry `routes: { business, personal }` and
 * open on whichever side is loaded; everything else has a single `route`.
 * `anchor` is the `data-help-id` on the element to highlight. A page entry
 * (`kind: 'page'`) points at its nav item, which differs per side, so its
 * anchor is worked out from the route it opens. `needsBoth` marks the few
 * things that only exist while both sides are switched on.
 */

/** The data-help-id a nav item carries, from the path it links to. */
export const navAnchor = (to) => `nav-${to === '/' ? 'home' : to.replace(/^\//, '').replace(/\//g, '-')}`

const page = (id, label, routes, mode, keywords, summary) => ({
  id,
  label,
  // A page on one side only says which, so the path is a real way there.
  path: `${mode === 'personal' ? 'Personal' : mode === 'business' ? 'Business' : 'Menu'} > ${label}`,
  kind: 'page',
  ...(typeof routes === 'string' ? { route: routes } : { routes }),
  anchor: navAnchor(typeof routes === 'string' ? routes : (routes.business ?? routes.personal)),
  mode,
  keywords,
  summary,
})

const settingsTab = (section, label, keywords, summary) => ({
  id: `settings.${section}`,
  label,
  path: `Settings > ${label}`,
  route: `/settings?section=${section}`,
  anchor: `settings-${section}`,
  mode: 'both',
  keywords,
  summary,
})

const control = (id, label, path, route, anchor, keywords, summary, mode = 'both') => ({
  id,
  label,
  path,
  route,
  anchor,
  mode,
  keywords,
  summary,
})

export const APP_MAP = [
  /* ---- Pages ---- */
  page('page.dashboard', 'Dashboard', { business: '/', personal: '/personal' }, 'both', ['home', 'dashboard', 'summary', 'start'], 'The month at a glance.'),
  { ...page('page.overview', 'Overview', '/overview', 'both', ['overview', 'complete picture', 'both sides', 'combined', 'total'], 'Business and personal on one page.'), needsBoth: true },
  page('page.transactions', 'Transactions', { business: '/transactions', personal: '/personal/transactions' }, 'both', ['transactions', 'ledger', 'history', 'entries', 'records', 'list'], 'Every income and expense, searchable.'),
  page('page.income', 'Income', { business: '/income', personal: '/personal/income' }, 'both', ['income', 'revenue', 'sales', 'sweldo', 'kita', 'earnings'], 'What came in, and from where.'),
  page('page.expenses', 'Expenses', { business: '/expenses', personal: '/personal/expenses' }, 'both', ['expenses', 'spending', 'gastos', 'costs', 'bills'], 'What went out, by category.'),
  page('page.invoices', 'Invoices', '/invoices', 'business', ['invoices', 'billing', 'bill client', 'receivables', 'overdue', 'singil'], 'Bill clients and track who has paid.'),
  page('page.clients', 'Clients', '/clients', 'business', ['clients', 'customers', 'contacts'], 'The people and companies you bill.'),
  page('page.budgets', 'Budgets', { business: '/budgets', personal: '/personal/budgets' }, 'both', ['budget', 'limit', 'spending limit', 'subscriptions', 'repeating charges'], 'Limits for what you spend, and how close you are.'),
  page('page.cashflow', 'Cash Flow', '/cashflow', 'business', ['cash flow', 'cashflow', 'runway', 'forecast', 'projection'], 'Where your cash is heading.'),
  page('page.reports', 'Reports', { business: '/reports', personal: '/personal/reports' }, 'both', ['reports', 'profit and loss', 'p&l', 'summary report', 'statement'], 'Ready-made reports to read or download.'),
  page('page.export', 'Export', '/export', 'business', ['export', 'download', 'spreadsheet', 'csv', 'excel', 'xlsx'], 'Download your records as a spreadsheet.'),
  page('page.insights', 'Insights', '/insights', 'business', ['insights', 'tips', 'advice', 'analysis'], 'What the numbers suggest doing next.'),
  page('page.goals', 'Goals', '/personal/goals', 'personal', ['goals', 'savings goal', 'ipon', 'target', 'emergency fund'], 'Savings goals and how close you are.'),
  page('page.networth', 'Net Worth', '/personal/net-worth', 'personal', ['net worth', 'assets', 'debts', 'liabilities', 'utang'], 'What you own less what you owe.'),
  page('page.howitworks', 'How it works', '/how-it-works', 'both', ['how it works', 'help', 'guide', 'tutorial', 'learn'], 'A short guide to the app.'),
  page('page.settings', 'Settings', '/settings', 'both', ['settings', 'preferences', 'options', 'setup'], 'Everything you can set up.'),

  /* ---- Settings tabs ---- */
  settingsTab('business', 'Business', ['business details', 'business name', 'company', 'your name'], 'Your name, business name, currency and year.'),
  settingsTab('categories', 'Categories', ['categories', 'category', 'add category', 'rename category'], 'Add, rename or remove categories.'),
  settingsTab('methods', 'Payment Methods', ['payment methods', 'gcash', 'maya', 'bank', 'card', 'paid via'], 'The ways money moves in and out.'),
  settingsTab('transfers', 'Transfers', ['transfers', 'owner draw', 'salary', 'business to personal'], 'Money you paid yourself from the business.'),
  settingsTab('notifications', 'Notifications', ['notifications', 'alerts', 'reminders'], 'What Dual tells you about, and how.'),
  settingsTab('appearance', 'Appearance', ['appearance', 'theme', 'dark mode', 'light mode', 'modes'], 'Theme and which sides are switched on.'),
  settingsTab('data', 'Data', ['data', 'backup', 'restore', 'import', 'erase'], 'Back up, restore or erase your data.'),
  settingsTab('about', 'About', ['about', 'version', 'privacy'], 'Version and how your data is kept.'),

  /* ---- Controls ---- */
  control('settings.business.currency', 'Currency', 'Settings > Business > Currency', '/settings?section=business', 'currency-field', ['currency', 'peso', 'php', 'symbol', 'usd', 'dollar'], 'Pick your currency; the symbol follows it.'),
  control('settings.business.openingBalance', 'Opening cash balance', 'Settings > Business > Opening cash balance', '/settings?section=business', 'opening-balance-field', ['opening balance', 'starting balance', 'starting cash', 'beginning balance'], 'The cash you had before your first entry.'),
  control('settings.business.fiscalYear', 'Financial year', 'Settings > Business > Financial year starts', '/settings?section=business', 'fiscal-year-field', ['financial year', 'fiscal year', 'year start'], 'The month your financial year begins.'),
  control('settings.business.name', 'Business name', 'Settings > Business > Business name', '/settings?section=business', 'business-name-field', ['business name', 'company name', 'rename business'], 'Shown on invoices, reports and the dashboard.'),
  control('settings.business.photo', 'Profile picture', 'Settings > Business > Add photo', '/settings?section=business', 'profile-picture', ['photo', 'picture', 'avatar', 'logo', 'profile picture'], 'Add or change your photo or logo.'),
  control('settings.methods.add', 'Add a payment method', 'Settings > Payment Methods > Add a method', '/settings?section=methods', 'payment-method-add', ['add payment method', 'new payment method', 'add gcash', 'add bank'], 'Type a name and tap Add.'),
  control('settings.categories.list', 'Categories', 'Settings > Categories', '/settings?section=categories', 'categories-list', ['add category', 'new category', 'edit category'], 'Add a category with the button at the top.'),
  control('settings.notifications.push', 'Push notifications', 'Settings > Notifications > Push notifications', '/settings?section=notifications', 'push-toggle', ['push', 'push notifications', 'alerts on phone', 'notify me'], 'Get alerts when you are away from the app.'),
  control('settings.notifications.voice', 'Voice input', 'Settings > Notifications > Voice input', '/settings?section=notifications', 'toggle-voiceInput', ['voice', 'microphone', 'mic', 'speak', 'dictation'], 'Show or hide the microphone in the assistant.'),
  control('settings.appearance.modes', 'Active modes', 'Settings > Appearance > Active modes', '/settings?section=appearance', 'active-modes', ['active modes', 'turn on personal', 'turn off business', 'business only', 'personal only', 'enable mode'], 'Choose whether Dual tracks business, personal, or both.'),
  control('settings.data.backup', 'Back up your data', 'Settings > Data > Export your data', '/settings?section=data', 'data-backup', ['backup', 'back up', 'export all', 'save a copy'], 'Download a backup file of everything.'),
  control('settings.data.restore', 'Restore from backup', 'Settings > Data > Restore from backup', '/settings?section=data', 'data-restore', ['restore', 'import', 'load backup', 'move to new phone'], 'Bring back data from a backup file.'),
  control('settings.data.erase', 'Erase all data', 'Settings > Data > Danger zone', '/settings?section=data', 'erase-data', ['erase', 'delete everything', 'reset', 'clear all data', 'start over'], 'Remove everything on this device.'),
  control('control.addTransaction', 'Add transaction', 'Add transaction button', null, 'add-transaction', ['add transaction', 'new entry', 'log expense', 'record income', 'plus button'], 'The button that opens the transaction form.'),
  { ...control('control.profileSwitcher', 'Profile switcher', 'Business / Personal switcher', null, 'profile-switcher', ['switch', 'personal mode', 'business mode', 'change profile', 'switch side'], 'Switch between your business and personal books.'), needsBoth: true },
  control('control.bell', 'Notifications', 'Bell at the top right', null, 'notification-bell', ['bell', 'notifications', 'alerts', 'what is new'], 'Alerts about invoices, budgets and goals.'),
]

const BY_ID = new Map(APP_MAP.map((entry) => [entry.id, entry]))

export function findEntry(id) {
  return BY_ID.get(id) ?? null
}

/** Whether an entry exists on a side that is switched on. */
const reachable = (entry, activeMode) =>
  entry.mode === 'both' || activeMode === 'both' || activeMode === entry.mode

/**
 * The map as the model sees it: one line per entry, no routes or selectors.
 * Entries on a side that is switched off stay in, so the assistant can say
 * where they live instead of claiming they do not exist.
 */
export function appMapForPrompt(activeMode = 'both') {
  return APP_MAP.map((e) => {
    const off = reachable(e, activeMode) ? '' : ' (mode switched off)'
    return `${e.id} | ${e.label} | ${e.path} | ${e.mode}${off} | ${e.keywords.join(', ')}`
  }).join('\n')
}

export default APP_MAP
