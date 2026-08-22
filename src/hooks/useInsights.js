import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { buildInsights } from '../lib/insights'

export function useInsightsData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [transactions, invoices, clients, budgets, settings] = await Promise.all([
      db.transactions.toArray(),
      db.invoices.toArray(),
      db.clients.toArray(),
      db.budgets.toArray(),
      db.settings.toArray(),
    ])

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const opening = Number(settingsMap.openingBalance ?? 0)
    const currentCash =
      opening +
      transactions
        .filter((t) => t.status === 'cleared' && (t.type === 'income' || t.type === 'expense'))
        .reduce((total, t) => total + (t.type === 'income' ? t.amount : -t.amount), 0)

    return {
      today,
      ...buildInsights({
        transactions,
        invoices,
        clients,
        budgets,
        currentCash,
        today,
        symbol: settingsMap.symbol ?? '₱',
      }),
    }
  }, [])
}

export default useInsightsData
