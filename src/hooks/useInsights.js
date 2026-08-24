import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { buildInsights } from '../lib/insights'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

export function useInsightsData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [transactions, invoices, clients, budgets, settings] = await Promise.all([
      db.transactions.filter(inProfile).toArray(),
      db.invoices.filter(inProfile).toArray(),
      db.clients.filter(inProfile).toArray(),
      db.budgets.filter(inProfile).toArray(),
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
