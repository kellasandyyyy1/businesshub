import { useLiveQuery } from 'dexie-react-hooks'

import { getCategories, getGoals, recentTransactions } from '../db/queries'

const PROFILE = 'personal'

/**
 * Everything the personal dashboard reads, scoped to the personal profile.
 *
 * The full transaction history comes back rather than just the selected window.
 * The period filter is a comparison against two dates, cheap to apply in memory,
 * and holding the whole set means changing period does not go back to
 * IndexedDB — the same arrangement the business Income and Expenses pages use.
 */
export function usePersonalData() {
  return useLiveQuery(async () => {
    const [transactions, categories, goals] = await Promise.all([
      recentTransactions(PROFILE),
      getCategories(PROFILE),
      getGoals(PROFILE),
    ])

    return {
      transactions,
      categories,
      goals,
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    }
  }, [])
}

export default usePersonalData
