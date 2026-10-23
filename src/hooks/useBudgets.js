import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { recurringExpenses } from '../lib/expenses'
import { budgetWindow, budgetsForTotals, spendForBudget } from '../lib/budget'

/**
 * Budgets with their live spend. Each budget is measured over its own calendar
 * window, so a monthly and a yearly budget are both judged against the period
 * they actually cover.
 */
export function useBudgetsData(profile = BUSINESS_PROFILE) {
  return useLiveQuery(async () => {
    const inProfile = ofProfile(profile)
    const today = new Date().toISOString().slice(0, 10)
    const [budgets, transactions, categories] = await Promise.all([
      db.budgets.orderBy('name').filter(inProfile).toArray(),
      db.transactions.filter(inProfile).toArray(),
      db.categories.orderBy('name').filter(inProfile).toArray(),
    ])

    const rows = budgets.map((budget) => {
      const window = budgetWindow(budget.period, today)
      const spent = spendForBudget(transactions, budget, window)
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
      // For the form: what each category has actually cost, to suggest a limit.
      expenses: transactions.filter((t) => t.type === 'expense'),
      // Charges that come back every month — Spotify, Netflix, rent — each
      // with the budget already watching it, if there is one.
      recurring: recurringExpenses(
        transactions.filter((t) => t.type === 'expense'),
        today,
      ).map((r) => ({
        ...r,
        budget:
          rows.find(
            (b) => b.category === r.category && b.match && r.description.toLowerCase().includes(b.match.toLowerCase()),
          ) ?? null,
      })),
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
      // A narrower budget inside a whole-category one is already counted by it.
      totals: {
        budgeted: budgetsForTotals(rows).reduce((t, b) => t + b.amount, 0),
        spent: budgetsForTotals(rows).reduce((t, b) => t + b.spent, 0),
        remaining: budgetsForTotals(rows).reduce((t, b) => t + b.remaining, 0),
      },
    }
  }, [profile])
}

export default useBudgetsData
