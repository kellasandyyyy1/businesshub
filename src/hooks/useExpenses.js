import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/**
 * Every expense on record, plus budgets and the category lookups the page needs.
 *
 * The full history comes back rather than just the selected window: recurring
 * detection looks across the last three months, and the budget strip always
 * measures the current calendar month, neither of which follows the period
 * switcher. The period filter is applied in memory afterwards.
 */
export function useExpensesData() {
  return useLiveQuery(async () => {
    const [expenses, categories, budgets, clients] = await Promise.all([
      db.transactions.where('type').equals('expense').filter(inProfile).toArray(),
      db.categories.orderBy('name').filter(inProfile).toArray(),
      db.budgets.orderBy('name').filter(inProfile).toArray(),
      db.clients.orderBy('name').filter(inProfile).toArray(),
    ])

    expenses.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    return {
      expenses,
      categories,
      budgets,
      clients,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
      paymentMethods: [...new Set(expenses.map((t) => t.paymentMethod).filter(Boolean))].sort(),
    }
  }, [])
}

export default useExpensesData
