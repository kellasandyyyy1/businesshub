/**
 * Which tone a status gets. One file decides, so a budget at 85% or an
 * invoice due in two days reads the same on every page that shows it.
 *
 * Tones: 'pos' good news · 'warn' a warning · 'neg' a problem · 'neutral'.
 * Anything ordinary, an expense, a sent invoice, a goal on pace, is
 * neutral or gets no badge at all, so colour keeps meaning something.
 */

const dayDiff = (from, to) =>
  Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000)

/** Days that count as "due soon" for an invoice. */
export const DUE_SOON_DAYS = 3

/** Days a pending entry can sit before it is worth a nudge. */
export const STALE_PENDING_DAYS = 7

/** The invoice's badge: tone and the word to show. */
export function invoiceSignal(invoice, today) {
  const status = invoice.effectiveStatus ?? invoice.status
  if (status === 'paid') return { tone: 'pos', label: 'Paid' }
  if (status === 'overdue') return { tone: 'neg', label: 'Overdue' }
  if (status === 'draft') return { tone: 'neutral', label: 'Draft' }
  if (invoice.dueDate && today && dayDiff(today, invoice.dueDate) <= DUE_SOON_DAYS) {
    return { tone: 'warn', label: 'Due soon' }
  }
  return { tone: 'neutral', label: status === 'viewed' ? 'Viewed' : 'Sent' }
}

/** Tone for an invoice's due-date text: red once late, amber when close. */
export function dueTone(invoice, today) {
  const status = invoice.effectiveStatus ?? invoice.status
  if (status === 'overdue') return 'neg'
  if ((status === 'sent' || status === 'viewed') && invoice.dueDate && today) {
    return dayDiff(today, invoice.dueDate) <= DUE_SOON_DAYS ? 'warn' : null
  }
  return null
}

/** Budget use (spent ÷ cap) to a tone: ink below 80%, amber to 100%, red past it. */
export function budgetTone(use, budget) {
  // A budget for one payee, a subscription, is used up by its single charge
  // every month, so "nearly there" is just normal. It only signals when the
  // charge comes in above the limit: a price rise, or a second charge.
  if (budget?.match) return use > 1 ? 'neg' : null
  if (use >= 1) return 'neg'
  if (use >= 0.8) return 'warn'
  return null
}

/** A pending entry only earns amber once it has been waiting a week. */
export function pendingTone(tx, today) {
  if (tx?.status !== 'pending' || !tx.date || !today) return 'neutral'
  return dayDiff(tx.date, today) > STALE_PENDING_DAYS ? 'warn' : 'neutral'
}

/** Months of cash: under three is a problem, three to six a warning. */
export function runwayTone(months) {
  if (months === null || months === undefined || !Number.isFinite(months)) return null
  if (months < 3) return 'neg'
  if (months < 6) return 'warn'
  return null
}

/** Goal status (from lib/goals) to its badge; on pace gets none. */
export const GOAL_SIGNALS = {
  completed: { tone: 'pos', label: 'Reached' },
  overdue: { tone: 'neg', label: 'Past deadline' },
  behind: { tone: 'warn', label: 'Behind' },
  'not-started': { tone: 'neutral', label: 'Not started' },
}

/** Notification type to the dot beside it in the bell. */
const NOTIFICATION_TONES = {
  'overdue-invoices': 'neg',
  'low-runway': 'neg',
  'spending-spike': 'neg',
  'invoices-due-soon': 'warn',
  'budget-warning': 'warn',
  'personal-budget-warning': 'warn',
  'stale-pending': 'warn',
  'personal-stale-pending': 'warn',
  'goal-deadline': 'warn',
  'savings-rate-drop': 'warn',
  'goal-reached': 'pos',
  'net-worth-milestone': 'pos',
}

export const notificationTone = (item) => item.tone ?? NOTIFICATION_TONES[item.type] ?? null
