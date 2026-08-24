import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** Raw material for every report; the builders do the arithmetic. */
export function useReportsData() {
  return useLiveQuery(async () => {
    const [transactions, clients, budgets] = await Promise.all([
      db.transactions.orderBy('date').filter(inProfile).toArray(),
      db.clients.filter(inProfile).toArray(),
      db.budgets.orderBy('name').filter(inProfile).toArray(),
    ])
    return { transactions, clients, budgets, today: new Date().toISOString().slice(0, 10) }
  }, [])
}

export default useReportsData
