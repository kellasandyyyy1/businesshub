/**
 * Edits and deletes the assistant proposes, carried out once the person taps
 * the card.
 *
 * The model only ever names the fields it wants changed. Each one is checked
 * against a per-table list and against real data (a category that exists, a
 * payment method that is saved, a date that is a date); anything else is
 * dropped rather than written. Amounts stay unsigned, as everywhere in this
 * database, so changing an expense's amount keeps it an expense.
 *
 * Deletes go through the same trash table the pages use: the row leaves every
 * list and total at once, Undo puts it back with its id, and the window
 * closing (or the next app load) lets it go for good.
 */

import { db } from '../db/db'
import { updateTransactionWithDraw } from '../db/queries'
import { SAVINGS_CATEGORY } from '../db/categoryData'
import { resolveCategory } from './assistantAction'
import { balanceOf, computeTotals, ratesOf } from './invoice'
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from './netWorth'
import { matchMethod, methodFields } from './paymentMethods'
import { commit, remove, restore } from './softDelete'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const text = (value) => String(value ?? '').trim()
const positive = (value) => {
  const n = Math.abs(Number(value))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}
const isoDate = (value) => (ISO_DATE.test(value ?? '') ? value : null)
const oneOf = (list) => (value) => (list.includes(value) ? value : null)
const nonEmpty = (value) => text(value) || null

/**
 * Per table, the fields chat may change and how each is checked. A checker
 * returns the value to write, or null to drop the field. `ctx` carries the
 * profile's categories and saved payment methods.
 */
const FIELDS = {
  transactions: {
    amount: { label: 'Amount', kind: 'signed', check: positive },
    description: { label: 'Description', check: nonEmpty },
    category: { label: 'Category', check: (v, r, ctx) => resolveCategory(v, ctx.categories, r.type) || null },
    date: { label: 'Date', kind: 'date', check: isoDate },
    notes: { label: 'Notes', check: text },
    paymentMethod: { label: 'Paid with', check: (v, r, ctx) => matchMethod(v, ctx.methods, { partial: true })?.name ?? null },
    status: { label: 'Status', check: oneOf(['cleared', 'pending']) },
  },
  invoices: {
    amount: { label: 'Amount', kind: 'money', check: positive },
    status: { label: 'Status', check: oneOf(['draft', 'sent', 'paid']) },
    dueDate: { label: 'Due', kind: 'date', check: isoDate },
    notes: { label: 'Notes', check: text },
  },
  goals: {
    name: { label: 'Name', check: nonEmpty },
    target: { label: 'Target', kind: 'money', check: positive },
    deadline: { label: 'Deadline', kind: 'date', check: isoDate },
    notes: { label: 'Notes', check: text },
  },
  budgets: {
    amount: { label: 'Limit', kind: 'money', check: positive },
    period: { label: 'Period', check: oneOf(['monthly', 'quarterly', 'yearly']) },
    name: { label: 'Name', check: nonEmpty },
  },
  clients: {
    name: { label: 'Name', check: nonEmpty },
    company: { label: 'Company', check: text },
    email: { label: 'Email', check: text },
    phone: { label: 'Phone', check: text },
    notes: { label: 'Notes', check: text },
  },
  netWorth: {
    name: { label: 'Name', check: nonEmpty },
    amount: { label: 'Value', kind: 'money', check: positive },
    category: {
      label: 'Category',
      check: (v, r) => {
        const known = r.type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES
        return known.find((c) => c.toLowerCase() === text(v).toLowerCase()) ?? null
      },
    },
  },
}

/** The model's words for a field, mapped to the field. "limit" is a budget's amount. */
const FIELD_ALIASES = { value: 'amount', limit: 'amount', targetAmount: 'target', label: 'name', due: 'dueDate', method: 'paymentMethod' }

/** The figure a field shows today, for the before side of the card. */
function currentValue(entity, record, field) {
  if (entity === 'invoices' && field === 'amount') return record.items?.length === 1 ? Number(record.items[0].rate) : record.subtotal
  return record[field]
}

/**
 * Checks the model's changes against the record and the books.
 *
 * @returns { changes, diff, problem }: `changes` holds only fields that are
 *   valid and actually different; `diff` is one { field, label, kind, before,
 *   after } row per change, for the card.
 */
export function normalizeChanges(entity, record, raw = {}, ctx = {}) {
  const fields = FIELDS[entity] ?? {}
  const changes = {}
  const diff = []
  for (const [key, value] of Object.entries(raw ?? {})) {
    const field = fields[key] ? key : FIELD_ALIASES[key]
    const spec = fields[field]
    if (!spec || value === undefined || value === null) continue
    const next = spec.check(value, record, ctx)
    if (next === null) continue
    const before = currentValue(entity, record, field)
    if (String(before ?? '') === String(next)) continue
    changes[field] = next
    diff.push({ field, label: spec.label, kind: spec.kind ?? 'text', before, after: next })
  }

  let problem = null
  if (entity === 'invoices' && 'amount' in changes && (record.items?.length ?? 0) > 1) {
    problem = 'This invoice has several lines. Change the amount in the invoice editor.'
  } else if (diff.length === 0) {
    problem = Object.keys(raw ?? {}).length
      ? 'Nothing to change. It already reads that way, or that is not a value this record can take.'
      : 'No change found.'
  }
  return { changes, diff, problem }
}

/** What the write for each table looks like, given checked changes. */
function patchFor(entity, record, changes) {
  const now = new Date().toISOString()
  switch (entity) {
    case 'invoices': {
      const patch = {}
      if ('dueDate' in changes) patch.dueDate = changes.dueDate
      if ('notes' in changes) patch.notes = changes.notes
      if ('amount' in changes) {
        const items = record.items.map((item, i) => (i === 0 ? { ...item, rate: changes.amount, amount: changes.amount * (Number(item.quantity) || 1) } : item))
        const { taxRate, discountRate } = ratesOf(record)
        Object.assign(patch, { items }, computeTotals(items, taxRate, discountRate))
      }
      if (changes.status === 'paid') {
        // Settled in full, the same record Mark as paid writes on the invoice itself.
        const settled = { ...record, ...patch }
        const owed = balanceOf(settled)
        patch.status = 'paid'
        patch.paidAt = now
        if (owed > 0) patch.payments = [...(record.payments ?? []), { date: now.slice(0, 10), amount: owed, method: 'Recorded manually' }]
      } else if (changes.status === 'sent') {
        Object.assign(patch, { status: 'sent', sentAt: record.sentAt ?? now })
      } else if (changes.status === 'draft') {
        patch.status = 'draft'
      }
      return patch
    }
    default:
      return { ...changes }
  }
}

/**
 * Writes the checked changes. Returns { before, after } so Undo can put the
 * exact previous row back.
 */
export async function editRecordDirect(entity, id, changes, ctx = {}) {
  const table = db.table(entity)
  const before = await table.get(id)
  if (!before) throw new Error('That record is no longer there.')

  // Re-checked against the row as it is now, not as it was when the card was drawn.
  const { changes: checked } = normalizeChanges(entity, before, changes, ctx)
  // The saved method's id travels with its name, as the form writes it.
  if ('paymentMethod' in checked) Object.assign(checked, methodFields(matchMethod(checked.paymentMethod, ctx.methods ?? [])))
  const patch = { ...patchFor(entity, before, checked), updatedAt: new Date().toISOString() }

  if (entity === 'transactions' && before.linkedTransactionId) {
    // An owner draw has a twin on the other side; amount and date move together.
    await updateTransactionWithDraw(id, { ...before, ...patch })
  } else {
    await table.update(id, patch)
  }
  return { before, after: await table.get(id) }
}

/** Puts a record back exactly as it was before an edit. */
export async function restoreRecord(entity, before) {
  if (entity === 'transactions' && before.linkedTransactionId) {
    await updateTransactionWithDraw(before.id, before)
    return
  }
  await db.table(entity).put(before)
}

/**
 * Takes the row out into the trash. Returns the trash id that `restoreDeleted`
 * and `commitDeleted` take, or null when the row was already gone.
 */
export async function deleteRecordDirect(entity, id) {
  if (entity === 'clients') {
    // Invoices point at the client by id. Each one keeps the name it was
    // billed to, so it still says who it was for once the client is gone.
    const client = await db.clients.get(id)
    if (client) {
      await db.invoices
        .where('clientId')
        .equals(id)
        .modify((invoice) => {
          invoice.clientName = invoice.clientName ?? (client.company || client.name)
        })
    }
  }
  return remove(entity, id)
}
export const restoreDeleted = (trashId) => restore(trashId)
export const commitDeleted = (trashId) => commit(trashId)

/**
 * One-line warnings for the card: what else is tied to this record, and what
 * happens to it.
 */
export async function recordWarnings(kind, entity, record) {
  const notes = []
  if (entity === 'invoices' && record.status === 'paid') {
    notes.push(kind === 'delete' ? 'This invoice is marked paid. The payment transaction stays.' : 'This invoice is already paid.')
  }
  if (kind === 'delete' && entity === 'clients') {
    const count = await db.invoices.where('clientId').equals(record.id).count()
    if (count) notes.push(`Has ${count} ${count === 1 ? 'invoice' : 'invoices'}. They keep the client name.`)
  }
  if (kind === 'delete' && entity === 'goals') {
    const label = `Saved for ${record.name}`
    const deposits = await db.transactions.filter((t) => t.category === SAVINGS_CATEGORY && t.description === label).count()
    if (deposits || Number(record.current) > 0) notes.push('Past deposits stay in your transactions.')
  }
  if (kind === 'delete' && entity === 'transactions' && record.linkedTransactionId) {
    notes.push('This is one half of a transfer. The other side keeps its entry.')
  }
  return notes
}
