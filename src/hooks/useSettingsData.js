import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { matchMethod, methodsFromSetting } from '../lib/paymentMethods'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** Kept here for older imports; the list itself lives with the other method helpers. */
export { DEFAULT_PAYMENT_METHODS } from '../lib/paymentMethods'

/**
 * Everything the settings page edits, plus the usage counts it needs before
 * allowing a category to be removed.
 */
export function useSettingsData() {
  return useLiveQuery(async () => {
    const [settings, categories, transactions] = await Promise.all([
      db.settings.toArray(),
      db.categories.orderBy('name').filter(inProfile).toArray(),
      // Every transaction: the method list is shared by both profiles.
      db.transactions.toArray(),
    ])

    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]))

    const categoryUse = new Map()
    for (const t of transactions.filter(inProfile)) categoryUse.set(t.category, (categoryUse.get(t.category) ?? 0) + 1)

    // The list exactly as stored, the one the transaction form picks from.
    const paymentMethods = methodsFromSetting(map.paymentMethods)

    // Uses per method, by id; an older row with only a name counts toward the
    // method of that name.
    const methodUse = {}
    for (const t of transactions) {
      const id = t.paymentMethodId ?? matchMethod(t.paymentMethod, paymentMethods)?.id
      if (id) methodUse[id] = (methodUse[id] ?? 0) + 1
    }

    return {
      settings: map,
      categories,
      categoryUse: Object.fromEntries(categoryUse),
      methodUse,
      paymentMethods,
    }
  }, [])
}

export default useSettingsData
