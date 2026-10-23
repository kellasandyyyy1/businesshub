import { formatCurrency } from './format'

/**
 * How a transaction's money is shown in a list. Direction is spelled out with
 * a sign rather than left to colour, and a transfer, money moved between the
 * user's own accounts, carries none.
 */

/** Money in is positive, money out negative; a transfer moves neither way. */
export function signedAmount(tx) {
  if (tx.type === 'income') return tx.amount
  if (tx.type === 'expense') return -tx.amount
  return 0
}

/** "+₱1,200", "−₱450", the sign is spelled out so direction never rests on colour. */
export function signedLabel(value, symbol) {
  if (value === 0) return formatCurrency(0, symbol)
  return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value), symbol)}`
}

/** One row's figure: signed for money in and out, plain for a transfer. */
export function amountLabel(tx, symbol) {
  return tx.type === 'transfer' ? formatCurrency(tx.amount, symbol) : signedLabel(signedAmount(tx), symbol)
}
