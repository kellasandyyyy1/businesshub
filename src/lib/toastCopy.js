/**
 * Words for toasts, so each one says what it was about: "Income added",
 * "Marketing budget removed", never a bare "Saved".
 */

const TX_NOUNS = { income: 'Income', expense: 'Expense', transfer: 'Transfer' }

/** "Income", "Expense", "Transfer", what a transaction of this type is called. */
export const txNoun = (type) => TX_NOUNS[type] ?? 'Transaction'

/** A name short enough to sit in a toast beside its verb. */
export function short(name, max = 24) {
  const text = String(name ?? '').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
