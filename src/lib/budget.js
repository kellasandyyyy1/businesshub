/** Budget periods and the calendar windows they are measured over. */

export const PERIOD_SUFFIX = { monthly: 'mo', quarterly: 'qtr', yearly: 'yr' }
export const PERIOD_WORD = { monthly: 'this month', quarterly: 'this quarter', yearly: 'this year' }

/**
 * The window a budget is judged against right now: the calendar month,
 * quarter, or year containing `today`.
 */
export function budgetWindow(period, today) {
  const d = new Date(`${today}T00:00:00Z`)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()

  if (period === 'yearly') return [`${year}-01-01`, `${year}-12-31`]

  if (period === 'quarterly') {
    const q = Math.floor(month / 3) * 3
    return [
      new Date(Date.UTC(year, q, 1)).toISOString().slice(0, 10),
      new Date(Date.UTC(year, q + 3, 0)).toISOString().slice(0, 10),
    ]
  }

  return [
    new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  ]
}

/** Spend counts as anything booked as an expense in that category and window. */
export function spendFor(transactions, category, [from, to]) {
  return transactions
    .filter((t) => t.type === 'expense' && t.category === category && t.date >= from && t.date <= to)
    .reduce((total, t) => total + t.amount, 0)
}

/** Over 80% of a budget is where the caution treatment kicks in. */
export const CAUTION_AT = 0.8
