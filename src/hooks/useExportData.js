import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** Everything the export builders read. One query for the whole page. */
export function useExportData() {
  return useLiveQuery(async () => {
    const [transactions, clients, invoices, budgets] = await Promise.all([
      db.transactions.orderBy('date').filter(inProfile).toArray(),
      db.clients.orderBy('name').filter(inProfile).toArray(),
      db.invoices.filter(inProfile).toArray(),
      db.budgets.orderBy('name').filter(inProfile).toArray(),
    ])

    return {
      transactions,
      clients,
      invoices,
      budgets,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      today: new Date().toISOString().slice(0, 10),
    }
  }, [])
}

export default useExportData
