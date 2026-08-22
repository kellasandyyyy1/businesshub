import { budgetWindow, spendFor } from './budget'
import { PERIOD_DAYS, groupTotals, monthKey, shiftMonths, sum } from './ledger'

/**
 * Expense-specific derivations. The period maths lives in ./ledger.
 *
 * Amounts are stored unsigned — `type` carries the direction — so everything
 * here works in positive numbers and the minus sign is a display decision.
 */

/** Merchants are just the wording, normalised so casing and padding do not split a group. */
export const merchantKey = (row) => (row.description ?? '').trim().toLowerCase()

/** The three calendar months ending with the one containing `today`. */
function lastThreeMonths(today) {
  const thisMonth = `${today.slice(0, 8)}01`
  return [0, -1, -2].map((n) => monthKey(shiftMonths(thisMonth, n)))
}

/**
 * Expenses that arrive on a cycle.
 *
 * A merchant counts as recurring when it billed in at least two of the last
 * three calendar months. That window is deliberately fixed rather than tied to
 * the period switcher: a 7-day view cannot contain two months, so testing
 * against the visible rows would report nothing recurring on every short period.
 *
 * The monthly cost is the average of what that merchant charged, so a single
 * unusual invoice does not distort the annual figure.
 */
export function recurringExpenses(allExpenses, today) {
  const window = lastThreeMonths(today)
  const groups = new Map()

  for (const row of allExpenses) {
    const key = merchantKey(row)
    if (!key) continue
    if (!groups.has(key)) {
      groups.set(key, { key, description: row.description.trim(), rows: [], months: new Set() })
    }
    const group = groups.get(key)
    group.rows.push(row)
    if (window.includes(monthKey(row.date))) group.months.add(monthKey(row.date))
  }

  return [...groups.values()]
    .filter((g) => g.months.size >= 2)
    .map((g) => {
      const monthly = sum(g.rows) / g.rows.length
      return {
        key: g.key,
        description: g.description,
        monthsSeen: g.months.size,
        monthlyCost: monthly,
        annualised: monthly * 12,
      }
    })
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
}

/** Whether a row belongs to one of the recurring merchants. */
export const isRecurringExpense = (row, keys) => keys.has(merchantKey(row))

/* ---- Metrics ---------------------------------------------------------------- */

/**
 * The four cards. `allExpenses` is the full history, needed only to judge what
 * recurs; every figure returned describes the selected period.
 */
export function expenseMetrics({ rows, previousRows, allExpenses, periodId, today }) {
  const total = sum(rows)
  const previousTotal = sum(previousRows)

  const days = PERIOD_DAYS[periodId] ?? PERIOD_DAYS['30d']
  // Spend divided by the months the window spans. On a period shorter than a
  // month that is a monthly run rate rather than a month actually spent.
  const months = days / 30.44
  const average = total / months
  const previousAverage = previousTotal / months

  const byCategory = groupTotals(rows, (r) => r.category ?? '', (key) => key || 'Uncategorised')
  const largest = byCategory[0] ?? null

  const keys = new Set(recurringExpenses(allExpenses, today).map((r) => r.key))
  const recurringTotal = sum(rows.filter((r) => isRecurringExpense(r, keys)))

  return {
    total,
    previousTotal,
    average,
    previousAverage,
    largestCategory: largest ? largest.name : null,
    largestCategoryValue: largest ? largest.value : 0,
    recurringTotal,
    recurringShare: total > 0 ? recurringTotal / total : 0,
  }
}

/* ---- Budgets ---------------------------------------------------------------- */

/**
 * Each budget against what has been spent on it.
 *
 * Always the current calendar month, never the period switcher — a budget is a
 * monthly commitment, and it would be misleading for the same budget to look
 * blown simply because someone switched the page to a 90-day view.
 */
export function budgetUsage(budgets, allExpenses, today) {
  const window = budgetWindow('monthly', today)

  return budgets.map((budget) => {
    const spent = spendFor(allExpenses, budget.category, window)
    const limit = Number(budget.amount) || 0
    return {
      id: budget.id,
      name: budget.name,
      category: budget.category,
      spent,
      limit,
      ratio: limit > 0 ? spent / limit : 0,
    }
  })
}
