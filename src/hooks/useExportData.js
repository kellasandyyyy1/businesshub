import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'

/** Everything the export builders read. One query for the whole page. */
export function useExportData() {
  return useLiveQuery(async () => {
    const [transactions, clients, invoices, budgets] = await Promise.all([
      db.transactions.orderBy('date').toArray(),
      db.clients.orderBy('name').toArray(),
      db.invoices.toArray(),
      db.budgets.orderBy('name').toArray(),
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
