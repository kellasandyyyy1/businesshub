import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'

const FALLBACKS = {
  businessName: 'Business Finance Hub',
  currency: 'PHP',
  symbol: '₱',
  locale: 'en-PH',
}

/**
 * The settings table, flattened to a plain `{ key: value }` object and kept
 * live — editing a setting anywhere re-renders every consumer.
 */
export function useSettings() {
  const rows = useLiveQuery(() => db.settings.toArray(), [], null)
  if (!rows) return FALLBACKS
  return { ...FALLBACKS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
}

export default useSettings
