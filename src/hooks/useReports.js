import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'

/** Raw material for every report; the builders do the arithmetic. */
export function useReportsData() {
  return useLiveQuery(async () => {
    const [transactions, clients, budgets] = await Promise.all([
      db.transactions.orderBy('date').toArray(),
      db.clients.toArray(),
      db.budgets.orderBy('name').toArray(),
    ])
    return { transactions, clients, budgets, today: new Date().toISOString().slice(0, 10) }
  }, [])
}

export default useReportsData
