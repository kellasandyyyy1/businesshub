import { CAUTION_AT, PERIOD_WORD, budgetWindow, spendFor } from './budget'
import { daysBetween, formatCurrency, formatFullDate, shiftDays } from './format'
import { balanceOf, effectiveStatus } from './invoice'

/**
 * The conditions worth interrupting someone for.
 *
 * Each one collapses to a single notification however many rows triggered it —
 * the delivery layer sends at most one push per type per day, so an aggregate
 * ("3 invoices overdue") is the honest shape rather than three separate alerts
 * where only the first would arrive.
 *
 * Everything here is derived from IndexedDB. Nothing reads it but this file.
 */

/** Days a transaction can sit pending before it counts as stale. */
const STALE_AFTER_DAYS = 14
/** Invoices landing inside this window are worth a heads-up. */
const DUE_SOON_DAYS = 7
/** Below this many months of cover, runway stops being a statistic. */
const RUNWAY_MONTHS = 3

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/* ---- 1. Overdue invoices --------------------------------------------------- */

function overdueInvoices({ invoices, today, money }) {
  const overdue = invoices.filter((i) => effectiveStatus(i, today) === 'overdue')
  if (overdue.length === 0) return null

  const outstanding = overdue.reduce((total, i) => total + balanceOf(i), 0)
  const oldest = overdue.reduce((worst, i) => (i.dueDate < worst.dueDate ? i : worst))
  const days = daysBetween(oldest.dueDate, today)

  return {
    type: 'overdue-invoices',
    title: overdue.length === 1 ? `${oldest.invoiceNumber} is overdue` : `${plural(overdue.length, 'invoice')} overdue`,
    body:
      overdue.length === 1
        ? `${money(outstanding)} outstanding, ${plural(days, 'day')} past due.`
        : `${money(outstanding)} outstanding — the oldest is ${plural(days, 'day')} past due.`,
    link: '/invoices',
  }
}

/* ---- 2. Invoices due soon -------------------------------------------------- */

function invoicesDueSoon({ invoices, today, money }) {
  const horizon = shiftDays(today, DUE_SOON_DAYS)
  const soon = invoices.filter((i) => {
    const status = effectiveStatus(i, today)
    return (status === 'sent' || status === 'viewed') && i.dueDate >= today && i.dueDate <= horizon
  })
  if (soon.length === 0) return null

  const total = soon.reduce((sum, i) => sum + balanceOf(i), 0)
  const next = soon.reduce((first, i) => (i.dueDate < first.dueDate ? i : first))

  return {
    type: 'invoices-due-soon',
    title: `${plural(soon.length, 'invoice')} due within ${DUE_SOON_DAYS} days`,
    body: `${money(total)} expected. The first falls due ${formatFullDate(next.dueDate)}.`,
    link: '/invoices',
  }
}

/* ---- 3. Budget warnings ---------------------------------------------------- */

function budgetWarnings({ budgets, transactions, today }) {
  const breached = []

  for (const budget of budgets) {
    if (!budget.amount || budget.amount <= 0) continue
    const window = budgetWindow(budget.period, today)
    const spent = spendFor(transactions, budget.category, window)
    const ratio = spent / budget.amount
    if (ratio >= CAUTION_AT) breached.push({ ...budget, ratio })
  }

  if (breached.length === 0) return null
  const worst = breached.sort((a, b) => b.ratio - a.ratio)[0]
  const pct = Math.round(worst.ratio * 100)

  return {
    type: 'budget-warning',
    title:
      breached.length === 1
        ? `${worst.name} is at ${pct}% of budget`
        : `${plural(breached.length, 'budget')} past ${Math.round(CAUTION_AT * 100)}%`,
    body:
      breached.length === 1
        ? `Spending ${PERIOD_WORD[worst.period] ?? 'so far'} has reached ${pct}% of what you set aside.`
        : `${worst.name} is furthest along at ${pct}%.`,
    link: '/budgets',
  }
}

/* ---- 4. Low cash runway ---------------------------------------------------- */

function lowRunway({ transactions, currentCash, today, money }) {
  // Same 90-day burn the Insights page uses, so the two never disagree.
  const from = shiftDays(today, -89)
  const burn =
    transactions
      .filter((t) => t.type === 'expense' && t.date >= from && t.date <= today)
      .reduce((total, t) => total + t.amount, 0) / 3

  if (burn <= 0) return null
  const months = currentCash / burn
  if (months >= RUNWAY_MONTHS) return null

  return {
    type: 'low-runway',
    title: `Cash runway is under ${RUNWAY_MONTHS} months`,
    body: `${money(currentCash)} on hand covers about ${months.toFixed(1)} months at your recent rate of spending.`,
    link: '/cashflow',
  }
}

/* ---- 5. Stale pending transactions ----------------------------------------- */

function stalePending({ transactions, today, money }) {
  const cutoff = shiftDays(today, -STALE_AFTER_DAYS)
  const stale = transactions.filter((t) => t.status === 'pending' && t.date <= cutoff)
  if (stale.length === 0) return null

  const total = stale.reduce((sum, t) => sum + t.amount, 0)

  return {
    type: 'stale-pending',
    title: `${plural(stale.length, 'transaction')} still not cleared`,
    body: `${money(total)} has been pending for more than ${STALE_AFTER_DAYS} days.`,
    link: '/transactions',
  }
}

/**
 * The types this app can notify about, in the order Settings lists them. The
 * `setting` key is the existing Notifications toggle that gates each one;
 * runway has no toggle because it is the one alert worth never missing.
 */
export const NOTIFICATION_TYPES = [
  { type: 'overdue-invoices', label: 'Overdue invoices', setting: 'notifyOverdue' },
  { type: 'invoices-due-soon', label: 'Invoices due within 7 days', setting: 'notifyOverdue' },
  { type: 'budget-warning', label: 'Budget warnings (80%+)', setting: 'notifyBudgets' },
  { type: 'low-runway', label: 'Low cash runway (under 3 months)', setting: null },
  { type: 'stale-pending', label: 'Stale pending transactions', setting: 'notifyPending' },
]

/**
 * Builds the current notification list. A generator only returns something once
 * its threshold is crossed, so everything it produces is high priority by
 * definition — the field is kept so a gentler class of notice can be added
 * later without changing what gets pushed.
 */
export function buildNotifications({
  transactions,
  invoices,
  budgets,
  currentCash,
  today,
  symbol = '₱',
  settings = {},
}) {
  const money = (value) => formatCurrency(value, symbol)
  const context = { transactions, invoices, budgets, currentCash, today, money }

  const enabled = (key) => key === null || (settings[key] ?? true)

  return [
    overdueInvoices(context),
    invoicesDueSoon(context),
    budgetWarnings(context),
    lowRunway(context),
    stalePending(context),
  ]
    .filter(Boolean)
    .filter((item) => enabled(NOTIFICATION_TYPES.find((t) => t.type === item.type)?.setting))
    .map((item) => ({ ...item, priority: 'high' }))
}
