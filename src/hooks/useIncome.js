import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'

/**
 * Every income transaction on record, plus the lookups the page needs to name
 * a client or draw a category icon.
 *
 * The full history comes back rather than just the selected window: the
 * recurring-revenue card has to look across months to tell a repeat source from
 * a one-off, and the period filter is applied in memory afterwards.
 */
export function useIncomeData() {
  return useLiveQuery(async () => {
    const [income, categories, clients] = await Promise.all([
      db.transactions.where('type').equals('income').toArray(),
      db.categories.orderBy('name').toArray(),
      db.clients.orderBy('name').toArray(),
    ])

    income.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    return {
      income,
      categories,
      clients,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
      paymentMethods: [...new Set(income.map((t) => t.paymentMethod).filter(Boolean))].sort(),
    }
  }, [])
}

export default useIncomeData
