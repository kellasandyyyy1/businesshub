import { useLiveQuery } from 'dexie-react-hooks'

import { getCategories, getGoals, getNetWorth, recentTransactions } from '../db/queries'

const PROFILE = 'personal'

/**
 * Everything the personal reports read.
 *
 * The whole history comes back rather than one window: the reports compare
 * against the previous period, chart six months at a time and detect recurring
 * charges across three, none of which follow the period selector.
 */
export function usePersonalReportsData() {
  return useLiveQuery(async () => {
    const [transactions, categories, goals, netWorthItems] = await Promise.all([
      recentTransactions(PROFILE),
      getCategories(PROFILE),
      getGoals(PROFILE),
      getNetWorth(PROFILE),
    ])

    return {
      transactions,
      categories,
      goals,
      netWorthItems,
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    }
  }, [])
}

export default usePersonalReportsData
