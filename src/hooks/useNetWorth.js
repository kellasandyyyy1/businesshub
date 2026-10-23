import { useLiveQuery } from 'dexie-react-hooks'

import { getNetWorth } from '../db/queries'

/**
 * The personal profile's assets and liabilities.
 *
 * Like goals, net worth belongs to the personal side only, so this takes no
 * profile argument, a business measures itself through the balance sheet the
 * invoices and transactions already build.
 */
export function useNetWorthItems() {
  return useLiveQuery(() => getNetWorth('personal'), [])
}

export default useNetWorthItems
