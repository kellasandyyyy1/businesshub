import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { ofProfile } from '../db/queries'
import { methodsFromSetting, sortMethods } from '../lib/paymentMethods'

/**
 * The saved payment methods, live, as the transaction form and the filters
 * need them:
 *
 *   all       every method in Settings, active or not — for reading history
 *   active    the ones offered on new entries, most recently used first
 *   lastUsed  the id this profile picked most recently, or null
 *
 * "Recently used" is per profile: the business card and the household's
 * GCash are different habits even though the list is shared.
 */
export default function usePaymentMethods(profile) {
  return useLiveQuery(async () => {
    const [row, rows] = await Promise.all([
      db.settings.where('key').equals('paymentMethods').first(),
      db.transactions.filter(ofProfile(profile)).toArray(),
    ])
    const all = methodsFromSetting(row?.value)

    // The latest date each method was used on, with entry time breaking ties.
    const lastUsed = {}
    for (const t of rows) {
      if (!t.paymentMethodId) continue
      const stamp = `${t.date ?? ''}|${t.createdAt ?? ''}`
      if (!lastUsed[t.paymentMethodId] || stamp > lastUsed[t.paymentMethodId]) lastUsed[t.paymentMethodId] = stamp
    }

    const active = sortMethods(
      all.filter((m) => m.active),
      lastUsed,
    )
    const recent = active.find((m) => lastUsed[m.id])

    return { all, active, lastUsed: recent?.id ?? null }
  }, [profile])
}

/**
 * Just the saved list, live — for showing a transaction's method by its current
 * name. Lighter than the hook above: no transactions read.
 */
export function useMethodList() {
  return useLiveQuery(async () => {
    const row = await db.settings.where('key').equals('paymentMethods').first()
    return methodsFromSetting(row?.value)
  }, [])
}
