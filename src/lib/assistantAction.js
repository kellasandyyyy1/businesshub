/**
 * Turns whatever the model put in the `action` key into something the Add
 * Transaction form can actually accept.
 *
 * A language model will occasionally hand back a negative amount, a category
 * this business does not use, or a date in the wrong shape. None of that should
 * reach the form, so every field is checked here and anything doubtful is left
 * blank for the person to fill in rather than guessed at.
 */

import { matchMethod, methodFields } from './paymentMethods'

const TYPES = new Set(['income', 'expense'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const todayISO = () => new Date().toISOString().slice(0, 10)

/** Matches the model's guess against the categories this business really has. */
export function resolveCategory(guess, categories, type) {
  if (!guess) return ''
  const wanted = String(guess).trim().toLowerCase()
  const allowed = categories.filter((c) => c.type === type || type === 'transfer')

  const exact = allowed.find((c) => c.name.toLowerCase() === wanted)
  if (exact) return exact.name

  // "Transport" should still find "Travel & Transport"; an unknown word finds
  // nothing and the field stays empty rather than inventing a category.
  const partial = allowed.find(
    (c) => c.name.toLowerCase().includes(wanted) || wanted.includes(c.name.toLowerCase()),
  )
  return partial ? partial.name : ''
}

/**
 * @returns a transaction-shaped object for the modal, or null if the action is
 *   not one we know how to carry out.
 */
export function normalizeAction(action, categories = [], methods = []) {
  if (action?.type !== 'ADD_TRANSACTION') return null

  const prefill = action.prefill ?? {}

  // Amounts are stored unsigned; direction lives in `type`. A model that returns
  // -500 for an expense still means five hundred.
  const amount = Math.abs(Number(prefill.amount))
  const type = TYPES.has(prefill.txType) ? prefill.txType : 'expense'
  const date = ISO_DATE.test(prefill.date) ? prefill.date : todayISO()

  return {
    description: String(prefill.description ?? '').trim(),
    // Kept as a number; the form stringifies it when it builds its own state.
    amount: Number.isFinite(amount) && amount > 0 ? amount : '',
    type,
    category: resolveCategory(prefill.category, categories, type),
    date,
    // Only a method the user has saved, matched on its name, or the one saved
    // name it is part of. No match, or more than one, leaves it empty.
    ...methodFields(matchMethod(prefill.paymentMethod, methods, { partial: true })),
    notes: String(prefill.notes ?? '').trim(),
    status: 'cleared',
  }
}

export default normalizeAction
