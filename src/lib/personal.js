import { sum } from './ledger'

/**
 * The four figures the personal dashboard leads with.
 *
 * Transfers are left out on both sides: money moved between the user's own
 * accounts is neither earned nor spent, and counting it would inflate income
 * and spending by the same amount while leaving the difference untouched.
 */
export function personalMetrics({ rows = [], previousRows = [] } = {}) {
  const totalOf = (list, type) => sum(list.filter((r) => r.type === type))

  const income = totalOf(rows, 'income')
  const expenses = totalOf(rows, 'expense')
  const previousIncome = totalOf(previousRows, 'income')
  const previousExpenses = totalOf(previousRows, 'expense')

  // What is actually left. Negative is a real answer, the "left over" card
  // shows it as one rather than hiding the month that went wrong.
  const leftOver = income - expenses

  // Nothing was put aside in a month that ran a deficit, so this floors at zero
  // rather than reporting negative savings.
  const saved = Math.max(leftOver, 0)

  // Undefined rather than zero when nothing came in: a rate needs something to
  // be a rate of, and 0% would read as "saved nothing from your income" when
  // the truth is there was no income to save from.
  const savingsRate = income > 0 ? (saved / income) * 100 : null

  return {
    income,
    expenses,
    previousIncome,
    previousExpenses,
    leftOver,
    saved,
    savingsRate,
  }
}

/** How far along a goal is, 0–1. A goal with no target cannot be measured. */
export function goalProgress(goal) {
  const target = Number(goal?.target) || 0
  const current = Number(goal?.current) || 0
  if (target <= 0) return 0
  return Math.min(Math.max(current / target, 0), 1)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * The deadline, worded the way it would be said out loud.
 *
 * A count of days is only useful while it is small enough to act on; past a
 * month and a half the month name says more than "63 days left" does.
 */
export function goalDeadlineLabel(goal, today) {
  if (!goal?.deadline) return null

  const days = Math.round(
    (new Date(`${goal.deadline}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000,
  )

  if (Number.isNaN(days)) return null
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  if (days === 1) return '1 day left'
  if (days <= 45) return `${days} days left`

  return `Due ${MONTHS[Number(goal.deadline.slice(5, 7)) - 1] ?? ''}`.trim()
}
