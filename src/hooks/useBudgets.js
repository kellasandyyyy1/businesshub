import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { budgetWindow, spendFor } from '../lib/budget'

/**
 * Budgets with their live spend. Each budget is measured over its own calendar
 * window, so a monthly and a yearly budget are both judged against the period
 * they actually cover.
 */
export function useBudgetsData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [budgets, transactions, categories] = await Promise.all([
      db.budgets.orderBy('name').toArray(),
      db.transactions.toArray(),
      db.categories.orderBy('name').toArray(),
    ])

    const rows = budgets.map((budget) => {
      const window = budgetWindow(budget.period, today)
      const spent = spendFor(transactions, budget.category, window)
      return {
        ...budget,
        window,
        spent,
        remaining: budget.amount - spent,
        use: budget.amount > 0 ? spent / budget.amount : 0,
      }
    })

    return {
      budgets: rows,
      categories,
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
      totals: {
        budgeted: rows.reduce((t, b) => t + b.amount, 0),
        spent: rows.reduce((t, b) => t + b.spent, 0),
        remaining: rows.reduce((t, b) => t + b.remaining, 0),
      },
    }
  }, [])
}

export default useBudgetsData
