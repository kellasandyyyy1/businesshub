import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { buildNotifications } from '../lib/notifications'
import { triggerPush } from '../lib/push'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/**
 * Live notification conditions, derived from IndexedDB.
 *
 * A live query re-runs on every write, so the same condition can resolve dozens
 * of times in a session. This set stops the app hammering the backend for
 * something it has already asked to deliver; the server's once-per-type-per-day
 * rule is the real guarantee, this is just good manners.
 */
const requestedThisSession = new Set()

export function useNotifications() {
  const items = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [transactions, invoices, budgets, settings] = await Promise.all([
      db.transactions.filter(inProfile).toArray(),
      db.invoices.filter(inProfile).toArray(),
      db.budgets.filter(inProfile).toArray(),
      db.settings.toArray(),
    ])

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const currentCash =
      Number(settingsMap.openingBalance ?? 0) +
      transactions
        .filter((t) => t.status === 'cleared' && (t.type === 'income' || t.type === 'expense'))
        .reduce((total, t) => total + (t.type === 'income' ? t.amount : -t.amount), 0)

    return buildNotifications({
      transactions,
      invoices,
      budgets,
      currentCash,
      today,
      symbol: settingsMap.symbol ?? '₱',
      settings: settingsMap,
    })
  }, [])

  useEffect(() => {
    if (!items) return
    for (const item of items) {
      if (item.priority !== 'high') continue
      if (requestedThisSession.has(item.type)) continue
      requestedThisSession.add(item.type)
      triggerPush(item)
    }
  }, [items])

  return items ?? []
}

export default useNotifications
