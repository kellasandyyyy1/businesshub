import { useLiveQuery } from 'dexie-react-hooks'

import { getGoals, getNetWorth, recentTransactions } from '../db/queries'

/**
 * Both sets of books at once.
 *
 * The only place in the app that reads across the profile line on purpose, so
 * it asks for each side explicitly rather than going through whichever one
 * happens to be active.
 */
export function useOverviewData() {
  return useLiveQuery(async () => {
    const [businessTransactions, personalTransactions, netWorthItems, goals] = await Promise.all([
      recentTransactions('business'),
      recentTransactions('personal'),
      getNetWorth('personal'),
      getGoals('personal'),
    ])

    return { businessTransactions, personalTransactions, netWorthItems, goals }
  }, [])
}

export default useOverviewData
