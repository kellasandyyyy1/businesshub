/**
 * Edit and delete requests from the chat, as confirmation cards.
 *
 * The model says which record it means and what should change; this module
 * finds that record on the device (resolveTarget), checks the change against
 * real data (saveActions), and returns a card that shows exactly what will
 * happen. Nothing is written until the person taps the card.
 *
 *   one match   → an edit card (before → after per changed field) or a
 *                 delete card (the whole record)
 *   2 to 5      → a "Which one?" list; the person picks, it is never guessed
 *   none        → no card, and the reply says it could not find it
 */

import { db } from '../db/db'
import { ofProfile } from '../db/queries'
import { formatCurrency, formatDate } from './format'
import { ENTITY_SIDE, entityOf, resolveTarget } from './resolveTarget'
import { normalizeChanges, recordWarnings } from './saveActions'

export const RECORD_TYPES = new Set(['EDIT_RECORD', 'DELETE_RECORD'])

/** Most edit or delete cards waiting for a tap at once; older ones fold away. */
export const MAX_PENDING_RECORD_CARDS = 5

export const ENTITY_WORD = {
  transactions: 'Transaction',
  invoices: 'Invoice',
  goals: 'Goal',
  budgets: 'Budget',
  clients: 'Client',
  netWorth: 'Net worth entry',
}

const SIDE_WORD = { business: 'Business', personal: 'Personal' }
const PERIOD_WORD = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }
const STATUS_WORD = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', paid: 'Paid', overdue: 'Overdue', cleared: 'Cleared', pending: 'Pending' }

/**
 * How a record reads on a card and in the assistant's context: a title, the
 * facts beside it, its date, and the figure, signed where the sign means
 * something (money out is negative).
 */
export function describeRecord(entity, record, { clientsById = {}, symbol } = {}) {
  const money = (v) => formatCurrency(Number(v) || 0, symbol)
  const client = clientsById[record.clientId]
  switch (entity) {
    case 'transactions': {
      const amount = Number(record.amount) || 0
      return {
        title: record.description || record.category || 'Transaction',
        meta: [record.category, record.paymentMethod, STATUS_WORD[record.status] && record.status !== 'cleared' && STATUS_WORD[record.status]],
        date: record.date,
        figure: { value: record.type === 'expense' ? -amount : amount, signed: record.type !== 'transfer' },
      }
    }
    case 'invoices':
      return {
        title: `${record.invoiceNumber} · ${client?.company || client?.name || record.clientName || 'No client'}`,
        meta: [STATUS_WORD[record.status], record.dueDate && `Due ${formatDate(record.dueDate)}`],
        date: record.issueDate,
        figure: { value: Number(record.total) || 0 },
      }
    case 'goals':
      return {
        title: record.name || 'Goal',
        meta: [`${money(record.current)} saved`, record.deadline && `By ${formatDate(record.deadline)}`],
        date: null,
        figure: { value: Number(record.target) || 0 },
      }
    case 'budgets':
      return {
        title: record.name || record.category || 'Budget',
        meta: [record.name !== record.category && record.category, PERIOD_WORD[record.period]],
        date: null,
        figure: { value: Number(record.amount) || 0 },
      }
    case 'clients':
      return {
        title: record.name || 'Client',
        meta: [record.company !== record.name && record.company, record.email || record.phone],
        date: null,
        figure: null,
      }
    case 'netWorth':
      return {
        title: record.name || 'Entry',
        meta: [record.category, record.type === 'liability' ? 'Liability' : 'Asset'],
        date: null,
        figure: { value: record.type === 'liability' ? -(Number(record.amount) || 0) : Number(record.amount) || 0, signed: true },
      }
    default:
      return { title: 'Record', meta: [], date: null, figure: null }
  }
}

async function lookupsFor(entity, ctx) {
  const symbol = ctx.settings?.symbol
  if (entity !== 'transactions' && entity !== 'invoices') return { symbol }
  const clients = await db.clients.filter(ofProfile(ctx.profile)).toArray()
  return { symbol, clientsById: Object.fromEntries(clients.map((c) => [c.id, c])) }
}

/**
 * The card for one known record. Used straight after a single match, and
 * again when the person picks a row from a "Which one?" list.
 */
export async function cardForRecord(card, record, ctx) {
  const { entity } = card
  const kind = card.type === 'DELETE_RECORD' ? 'delete' : 'edit'
  const view = describeRecord(entity, record, await lookupsFor(entity, ctx))
  const warnings = await recordWarnings(kind, entity, record)

  if (kind === 'delete') {
    return { ...card, status: 'pending', record, view, warnings, candidates: null, problem: null }
  }

  const { changes, diff, problem } = normalizeChanges(entity, record, card.rawChanges, ctx)
  return { ...card, status: 'pending', record, view, warnings, changes, diff, candidates: null, problem }
}

/**
 * Turns the model's EDIT_RECORD and DELETE_RECORD actions into cards.
 *
 * @returns { cards, missing }: `missing` holds a sentence for each request that
 *   matched nothing, which the assistant shows in place of a card.
 */
export async function prepareRecordCards(actions, ctx) {
  const stamp = Date.now()
  const cards = []
  const missing = []

  for (const [i, action] of actions.entries()) {
    const entity = entityOf(action.entity)
    const type = action.type
    const base = { id: `${stamp}-r${i}`, type, entity, rawChanges: action.changes ?? {} }

    if (!entity) {
      missing.push("I couldn't tell which kind of record that is. Say whether it is a transaction, invoice, goal, budget, client or net worth entry.")
      continue
    }

    // A one-sided record asked for on the other side: say where it lives
    // instead of searching books it cannot be in.
    const side = ENTITY_SIDE[entity]
    if (side && side !== ctx.profile) {
      missing.push(`${ENTITY_WORD[entity]}s are in your ${SIDE_WORD[side]} data. Switch to ${SIDE_WORD[side]} to change them.`)
      continue
    }

    const found = await resolveTarget(entity, action.target, ctx.profile, ctx.lastSaved)
    if (found.status === 'none') {
      missing.push("I couldn't find that. Try the description or date.")
      continue
    }

    if (found.status === 'many') {
      const lookups = await lookupsFor(entity, ctx)
      cards.push({
        ...base,
        status: 'choosing',
        candidates: found.records.map((record) => ({ record, view: describeRecord(entity, record, lookups) })),
      })
      continue
    }

    cards.push(await cardForRecord(base, found.record, ctx))
  }

  return { cards, missing }
}

/**
 * The newest records the assistant saved or changed, as lines for its
 * context, so "that one" and "the last one" have something to point at. The
 * labels are record text: data, never instructions.
 */
export function recentRecordLines(recent) {
  if (!recent.length) return 'none yet'
  return recent
    .map((r) => `- ${r.entity} #${r.id}: "${String(r.label).replace(/["\n]/g, ' ').slice(0, 60)}"${r.date ? `, ${r.date}` : ''}`)
    .join('\n')
}

/** Which table each add card writes to, so a confirmed add can become "the last one". */
export const ADD_ENTITY = {
  ADD_TRANSACTION: 'transactions',
  ADD_TRANSFER: 'transactions',
  UPDATE_GOAL: 'goals',
  ADD_SAVINGS_ENTRY: 'goals',
  SET_BUDGET: 'budgets',
  ADD_INVOICE: 'invoices',
  ADD_CLIENT: 'clients',
  UPDATE_NET_WORTH: 'netWorth',
}

/** The id an add card's save produced, whatever shape that save returns. */
export function savedId(card, result) {
  if (card.existing?.id) return card.existing.id
  if (typeof result === 'number') return result
  return result?.id ?? null
}

/**
 * Where an edit card's full form lives, and the record to open it with, the
 * changes already applied. Null where the form could not show the change (a
 * new amount on an invoice is a line item, which the editor builds itself).
 */
export function recordFormTarget(card, profile) {
  if (!card.record || card.type !== 'EDIT_RECORD') return null
  const { changes = {} } = card
  const record = { ...card.record, ...changes }
  switch (card.entity) {
    case 'transactions':
      return {
        path: profile === 'personal' ? '/personal/transactions' : '/transactions',
        action: { type: 'ADD_TRANSACTION', prefill: record },
      }
    case 'invoices':
      if ('amount' in changes) return null
      return { path: '/invoices', action: { type: 'ADD_INVOICE', record } }
    case 'goals':
      return { path: '/personal/goals', action: { type: 'UPDATE_GOAL', record } }
    case 'budgets':
      return { path: profile === 'personal' ? '/personal/budgets' : '/budgets', action: { type: 'SET_BUDGET', record } }
    case 'clients':
      return { path: '/clients', action: { type: 'ADD_CLIENT', record } }
    case 'netWorth':
      return { path: '/personal/net-worth', action: { type: 'UPDATE_NET_WORTH', record } }
    default:
      return null
  }
}

/** Where a record is listed, for "Show this transaction". Pages that open a row by ?id= get it. */
export function recordPage(entity, id, profile) {
  switch (entity) {
    case 'transactions':
      return `${profile === 'personal' ? '/personal/transactions' : '/transactions'}${id ? `?id=${id}` : ''}`
    case 'invoices':
      return `/invoices${id ? `?id=${id}` : ''}`
    case 'goals':
      return '/personal/goals'
    case 'budgets':
      return profile === 'personal' ? '/personal/budgets' : '/budgets'
    case 'clients':
      return '/clients'
    case 'netWorth':
      return '/personal/net-worth'
    default:
      return null
  }
}
