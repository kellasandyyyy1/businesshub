import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { balanceOf, effectiveStatus } from '../lib/invoice'
import { formatMonth } from '../lib/format'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/** First day of the month `offset` months from `iso`. */
function monthStart(iso, offset = 0) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 10)
}

/** Twelve months of income from one client, oldest first. */
function revenueSeries(transactions, today) {
  return Array.from({ length: 12 }, (_, i) => {
    const from = monthStart(today, -(11 - i))
    const to = monthStart(from, 1)
    const revenue = transactions
      .filter((t) => t.type === 'income' && t.date >= from && t.date < to)
      .reduce((total, t) => total + t.amount, 0)
    return { label: formatMonth(from), revenue }
  })
}

/**
 * Clients with everything the page derives from the ledger: revenue from
 * income transactions, outstanding from unsettled invoices. Nothing is stored
 * on the client record itself, so the figures can never drift from the books.
 */
export function useClientsData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [clients, transactions, invoices, categories] = await Promise.all([
      db.clients.orderBy('name').filter(inProfile).toArray(),
      db.transactions.orderBy('date').reverse().filter(inProfile).toArray(),
      db.invoices.orderBy('createdAt').reverse().filter(inProfile).toArray(),
      db.categories.filter(inProfile).toArray(),
    ])

    const enriched = clients.map((client) => {
      const clientTransactions = transactions.filter((t) => t.clientId === client.id)
      const clientInvoices = invoices
        .filter((i) => i.clientId === client.id)
        .map((i) => ({ ...i, effectiveStatus: effectiveStatus(i, today) }))

      const revenue = clientTransactions
        .filter((t) => t.type === 'income')
        .reduce((total, t) => total + t.amount, 0)

      const outstanding = clientInvoices
        .filter((i) => i.effectiveStatus !== 'paid' && i.effectiveStatus !== 'draft')
        .reduce((total, i) => total + balanceOf(i), 0)

      const overdue = clientInvoices
        .filter((i) => i.effectiveStatus === 'overdue')
        .reduce((total, i) => total + balanceOf(i), 0)

      // Whichever the books saw most recently: money in, or an invoice settled.
      const lastIncome = clientTransactions.find((t) => t.type === 'income')?.date ?? null
      const lastSettled = clientInvoices
        .filter((i) => i.paidAt)
        .map((i) => i.paidAt.slice(0, 10))
        .sort()
        .pop()
      const lastPayment = [lastIncome, lastSettled].filter(Boolean).sort().pop() ?? null

      return {
        ...client,
        transactions: clientTransactions,
        invoices: clientInvoices,
        revenue,
        outstanding,
        overdue,
        invoiceCount: clientInvoices.length,
        lastPayment,
        series: revenueSeries(clientTransactions, today),
      }
    })

    return {
      clients: enriched,
      clientsById: Object.fromEntries(clients.map((c) => [c.id, c])),
      categoryIcons: Object.fromEntries(categories.map((c) => [c.name, c.icon])),
    }
  }, [])
}

/** Name, company, and email all match the search box. */
export function filterClients(clients, search) {
  const needle = search.trim().toLowerCase()
  if (!needle) return clients
  return clients.filter((c) =>
    [c.name, c.company, c.email].filter(Boolean).some((f) => f.toLowerCase().includes(needle)),
  )
}

/** "Broadheader" → "BR", "Maria Santos" → "MS". */
export function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
