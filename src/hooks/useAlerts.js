import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'

/**
 * What needs attention right now: invoices past their due date, and
 * transactions still waiting to clear. Drives the sidebar's invoice badge and
 * the topbar's bell indicator.
 */
export function useAlerts() {
  return (
    useLiveQuery(async () => {
      const today = new Date().toISOString().slice(0, 10)

      const [overdue, dueSoon, pending] = await Promise.all([
        db.invoices.where('status').equals('overdue').count(),
        db.invoices
          .where('status')
          .anyOf('sent', 'viewed')
          .filter((i) => i.dueDate < today)
          .count(),
        db.transactions.where('status').equals('pending').count(),
      ])

      // An invoice can be past due before anything has re-stamped its status,
      // so count those alongside the ones already marked overdue.
      const overdueInvoices = overdue + dueSoon
      return { overdueInvoices, pendingTransactions: pending, unread: overdueInvoices + pending }
    }, []) ?? { overdueInvoices: 0, pendingTransactions: 0, unread: 0 }
  )
}

export default useAlerts
