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

/* ---- Narrower budgets -----------------------------------------------------

   A budget can cover a whole category, or only the payments in it that
   mention a word, "Claude" and "Figma" can each have their own limit inside
   Software & Subscriptions. The word is matched in the description and the
   notes, ignoring case. */

const norm = (text) => String(text ?? '').trim().toLowerCase()

/** Whether a transaction counts against this budget. */
export function inBudget(tx, budget) {
  if (tx.type !== 'expense' || tx.category !== budget.category) return false
  const word = norm(budget.match)
  if (!word) return true
  return norm(tx.description).includes(word) || norm(tx.notes).includes(word)
}

/** Spend against a budget over a window, the budget-aware spendFor. */
export function spendForBudget(transactions, budget, [from, to]) {
  return transactions
    .filter((t) => t.date >= from && t.date <= to && inBudget(t, budget))
    .reduce((total, t) => total + t.amount, 0)
}

/** Two budgets clash only when they watch exactly the same payments. */
export const budgetKey = (budget) => `${budget.category}|${norm(budget.match)}`

/**
 * The budgets to add up for a total. A narrower budget inside a category
 * that also has a whole-category budget is already counted by that one, so
 * adding it again would double the figure.
 */
export function budgetsForTotals(budgets) {
  const whole = new Set(budgets.filter((b) => !norm(b.match)).map((b) => b.category))
  return budgets.filter((b) => !norm(b.match) || !whole.has(b.category))
}
