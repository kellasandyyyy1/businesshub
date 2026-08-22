import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { shiftDays } from '../lib/format'

export const DATE_RANGES = [
  { id: 'all', label: 'All time', days: null },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '12m', label: 'Last 12 months', days: 365 },
]

/** Everything the page needs from Dexie, live. Filtering happens in memory. */
export function useTransactionsData() {
  return useLiveQuery(async () => {
    const [transactions, categories, clients] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.categories.orderBy('name').toArray(),
      db.clients.orderBy('name').toArray(),
    ])

    return {
      transactions,
      categories,
      clients,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
      paymentMethods: [...new Set(transactions.map((t) => t.paymentMethod).filter(Boolean))].sort(),
    }
  }, [])
}

/**
 * Applies the toolbar to the row set. Search matches description, category,
 * payment method, notes, and the amount as typed.
 */
export function filterTransactions(rows, { search, type, category, dateRange, today }) {
  const needle = search.trim().toLowerCase()
  const range = DATE_RANGES.find((r) => r.id === dateRange)
  const from = range?.days ? shiftDays(today, -range.days) : null

  return rows.filter((row) => {
    if (type !== 'all' && row.type !== type) return false
    if (category !== 'all' && row.category !== category) return false
    if (from && row.date < from) return false
    if (!needle) return true

    return [row.description, row.category, row.paymentMethod, row.notes, String(row.amount)]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(needle))
  })
}

/** Income / expenses / net across whatever is currently in view. */
export function summarise(rows) {
  const income = rows.filter((r) => r.type === 'income').reduce((t, r) => t + r.amount, 0)
  const expenses = rows.filter((r) => r.type === 'expense').reduce((t, r) => t + r.amount, 0)
  return { income, expenses, net: income - expenses }
}
