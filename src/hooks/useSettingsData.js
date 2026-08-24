import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** The default payment methods every business starts with. */
export const DEFAULT_PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'GCash',
  'PayMaya',
  'Credit Card',
]

/**
 * Everything the settings page edits, plus the usage counts it needs before
 * allowing a category to be removed.
 */
export function useSettingsData() {
  return useLiveQuery(async () => {
    const [settings, categories, transactions] = await Promise.all([
      db.settings.toArray(),
      db.categories.orderBy('name').filter(inProfile).toArray(),
      db.transactions.filter(inProfile).toArray(),
    ])

    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

    const categoryUse = new Map()
    const methodUse = new Map()
    for (const t of transactions) {
      categoryUse.set(t.category, (categoryUse.get(t.category) ?? 0) + 1)
      if (t.paymentMethod) methodUse.set(t.paymentMethod, (methodUse.get(t.paymentMethod) ?? 0) + 1)
    }

    // Stored methods win; anything already used in the ledger is folded in so
    // the list always reflects what the books actually contain.
    const stored = Array.isArray(map.paymentMethods) ? map.paymentMethods : null
    const base = stored ?? DEFAULT_PAYMENT_METHODS.map((name) => ({ name, active: true }))
    const names = new Set(base.map((m) => m.name))
    const paymentMethods = [
      ...base,
      ...[...methodUse.keys()]
        .filter((name) => !names.has(name))
        .map((name) => ({ name, active: true })),
    ]

    return {
      settings: map,
      categories,
      categoryUse: Object.fromEntries(categoryUse),
      methodUse: Object.fromEntries(methodUse),
      paymentMethods,
    }
  }, [])
}

export default useSettingsData
