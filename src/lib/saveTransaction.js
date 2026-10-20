import { recordCategorization } from '../components/ai/CategorySuggestion'
import { addTransaction } from '../db/queries'

/**
 * Saves a transaction the assistant extracted, once the person has confirmed
 * it on the card in the chat.
 *
 * `prefill` is the output of normalizeAction — already checked against the
 * profile's real categories, with an unsigned amount. Amounts are stored
 * unsigned everywhere in this app and `type` carries the direction; every
 * total, chart and export sums by type, so a negative amount here would be
 * counted the wrong way round.
 *
 * The profile is the one the assistant had loaded, never the model's guess.
 */
export async function saveTransactionDirect(prefill, profile) {
  const record = {
    description: prefill.description || 'Transaction',
    amount: Math.abs(Number(prefill.amount)),
    type: prefill.type,
    category: prefill.category,
    date: prefill.date || new Date().toISOString().slice(0, 10),
    clientId: null,
    paymentMethod: prefill.paymentMethod ?? '',
    paymentMethodId: prefill.paymentMethodId ?? null,
    notes: prefill.notes || '',
    status: 'cleared',
    receiptUrl: null,
  }

  const id = await addTransaction(profile, record)
  // A confirmed card is a confirmed categorisation, the same as a saved form.
  await recordCategorization(record)
  return { ...record, id }
}

/** Whether the card has enough to save without the form. */
export const isComplete = (prefill) =>
  Boolean(prefill && Number(prefill.amount) > 0 && prefill.category && prefill.date)

export default saveTransactionDirect
