import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { balanceOf, effectiveStatus } from '../lib/invoice'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

export const STATUS_TABS = ['all', 'draft', 'sent', 'paid', 'overdue']

/** Invoices with their live status resolved, plus clients for the selector. */
export function useInvoicesData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [invoices, clients] = await Promise.all([
      db.invoices.orderBy('createdAt').reverse().filter(inProfile).toArray(),
      db.clients.orderBy('name').filter(inProfile).toArray(),
    ])

    return {
      today,
      clients,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      invoices: invoices.map((invoice) => ({
        ...invoice,
        effectiveStatus: effectiveStatus(invoice, today),
      })),
    }
  }, [])
}

/** Count and value per status, plus everything still owed to us. */
export function summariseInvoices(invoices) {
  const bucket = (status) => {
    const rows = invoices.filter((i) => i.effectiveStatus === status)
    return { status, count: rows.length, value: rows.reduce((t, i) => t + i.total, 0) }
  }

  const outstanding = invoices
    .filter((i) => i.effectiveStatus !== 'paid' && i.effectiveStatus !== 'draft')
    .reduce((total, i) => total + balanceOf(i), 0)

  return {
    draft: bucket('draft'),
    sent: bucket('sent'),
    paid: bucket('paid'),
    overdue: bucket('overdue'),
    viewed: bucket('viewed'),
    outstanding,
  }
}

/** The "Sent" tab covers everything issued and not yet settled. */
export function filterByTab(invoices, tab) {
  if (tab === 'all') return invoices
  if (tab === 'sent') {
    return invoices.filter((i) => i.effectiveStatus === 'sent' || i.effectiveStatus === 'viewed')
  }
  return invoices.filter((i) => i.effectiveStatus === tab)
}
