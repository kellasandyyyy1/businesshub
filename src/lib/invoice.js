/**
 * Invoice arithmetic, kept pure so the editor can recompute on every keystroke
 * and the summary cards can reuse the same rules.
 *
 * Records store tax and discount as *amounts* (that is what the seed and any
 * exported document need), while the editor works in percentages. The rate
 * fields are written alongside the amounts; for older rows without them the
 * rates are recovered from the amounts.
 */

const round2 = (n) => Math.round(n * 100) / 100

// Rates are recovered from stored amounts, so they need enough precision to
// reproduce those amounts to the centavo when recomputed.
const round6 = (n) => Math.round(n * 1e6) / 1e6

export const lineTotal = (item) => (Number(item.quantity) || 0) * (Number(item.rate) || 0)

export function computeTotals(items, taxRate, discountRate) {
  const subtotal = round2(items.reduce((total, item) => total + lineTotal(item), 0))
  const discount = round2(subtotal * ((Number(discountRate) || 0) / 100))
  const taxable = subtotal - discount
  const tax = round2(taxable * ((Number(taxRate) || 0) / 100))
  return { subtotal, discount, tax, total: round2(taxable + tax) }
}

/** Percentages for the editor, from stored rates or back-calculated amounts. */
export function ratesOf(invoice, fallbackTaxRate = 12) {
  if (!invoice) return { taxRate: fallbackTaxRate, discountRate: 0 }
  if (invoice.taxRate !== undefined && invoice.discountRate !== undefined) {
    return { taxRate: invoice.taxRate, discountRate: invoice.discountRate }
  }
  const subtotal = invoice.subtotal || 0
  const discount = invoice.discount || 0
  const taxable = subtotal - discount
  return {
    taxRate: taxable > 0 ? round6((invoice.tax / taxable) * 100) : fallbackTaxRate,
    discountRate: subtotal > 0 ? round6((discount / subtotal) * 100) : 0,
  }
}

/** The date an invoice was issued — newer rows carry it explicitly. */
export const issueDateOf = (invoice) => invoice.issueDate ?? invoice.createdAt?.slice(0, 10) ?? ''

/**
 * What the invoice *is* right now, as opposed to what was last written to it.
 * A sent invoice past its due date reads as overdue everywhere without being
 * rewritten behind the user's back.
 */
export function effectiveStatus(invoice, today) {
  if (invoice.status === 'sent' || invoice.status === 'viewed') {
    return invoice.dueDate < today ? 'overdue' : invoice.status
  }
  return invoice.status
}

export const amountPaid = (invoice) =>
  round2((invoice.payments ?? []).reduce((total, p) => total + (Number(p.amount) || 0), 0))

export const balanceOf = (invoice) => round2(invoice.total - amountPaid(invoice))

/** Next number in the sequence, e.g. BH-2026-009. */
export function nextInvoiceNumber(invoices, prefix) {
  const highest = invoices
    .map((i) => {
      const match = i.invoiceNumber?.match(/(\d+)$/)
      return match ? Number(match[1]) : 0
    })
    .reduce((max, n) => Math.max(max, n), 0)
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

/* ---- Words for where an invoice stands ----------------------------------- */

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso) => `${SHORT[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * One line on where the invoice stands against the calendar — what a person
 * would say about it, rather than a status word and a date to compare in
 * their head: "Due in 11 days", "20 days overdue", "Paid Aug 25".
 */
export function dueLabel(invoice, today) {
  const status = invoice.effectiveStatus ?? effectiveStatus(invoice, today)
  if (status === 'draft') return 'Not sent yet'
  if (status === 'paid') {
    const paidOn = (invoice.paidAt ?? invoice.payments?.at?.(-1)?.date ?? '').slice(0, 10)
    return paidOn ? `Paid ${shortDate(paidOn)}` : 'Paid'
  }
  const days = dayDiff(today, invoice.dueDate)
  if (days < 0) return `${plural(-days, 'day')} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${plural(days, 'day')}`
}

/** Status words in sentence case, for pills and sentences alike. */
export const STATUS_WORDS = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  overdue: 'Overdue',
  paid: 'Paid',
}

const ACTION_ORDER = { overdue: 0, sent: 1, viewed: 1, draft: 2, paid: 3 }

/**
 * The list in the order it needs attention: late first, then whatever falls
 * due soonest, then drafts waiting to go out, then the paid record — newest
 * payment first.
 */
export function sortForAction(invoices) {
  return [...invoices].sort((a, b) => {
    const rank = ACTION_ORDER[a.effectiveStatus] - ACTION_ORDER[b.effectiveStatus]
    if (rank !== 0) return rank
    if (a.effectiveStatus === 'paid') return (b.paidAt ?? '').localeCompare(a.paidAt ?? '')
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
  })
}
