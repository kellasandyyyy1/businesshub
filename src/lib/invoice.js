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
