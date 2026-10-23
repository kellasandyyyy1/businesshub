/**
 * Finds the record a chat request is about.
 *
 * The model never hands over a database id it made up. It describes the
 * record, and this module looks for it on the device: the one the assistant
 * just saved ("last"), an id it was shown in its context ("id"), or a search
 * on the words, amount and dates it heard ("search"). Only the loaded
 * profile is searched, and a row waiting out its undo window is already in
 * the trash table, so it can never be found.
 */

import { db } from '../db/db'
import { ofProfile } from '../db/queries'

/** What the model may call each table, mapped to the table itself. */
const ENTITY_ALIASES = {
  transaction: 'transactions',
  transactions: 'transactions',
  invoice: 'invoices',
  invoices: 'invoices',
  goal: 'goals',
  goals: 'goals',
  budget: 'budgets',
  budgets: 'budgets',
  client: 'clients',
  clients: 'clients',
  netWorth: 'netWorth',
  networth: 'netWorth',
  net_worth: 'netWorth',
  netWorthEntries: 'netWorth',
  netWorthEntry: 'netWorth',
}

export const ENTITIES = ['transactions', 'invoices', 'goals', 'budgets', 'clients', 'netWorth']

/** Business-only tables. A goal or net worth entry only exists on the personal side. */
export const ENTITY_SIDE = { invoices: 'business', clients: 'business', goals: 'personal', netWorth: 'personal' }

export const entityOf = (name) => ENTITY_ALIASES[String(name ?? '').trim()] ?? ENTITY_ALIASES[String(name ?? '').trim().toLowerCase()] ?? null

const MAX_CANDIDATES = 5
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const lower = (value) => String(value ?? '').trim().toLowerCase()

/** The words a record can be found by, joined, and the date and figure it sorts and matches on. */
const SHAPE = {
  transactions: {
    words: (r, { clientsById }) => [r.description, r.category, r.paymentMethod, clientsById[r.clientId]?.name, clientsById[r.clientId]?.company],
    date: (r) => r.date,
    amount: (r) => r.amount,
  },
  invoices: {
    words: (r, { clientsById }) => [
      r.invoiceNumber,
      clientsById[r.clientId]?.name,
      clientsById[r.clientId]?.company,
      ...(r.items ?? []).map((item) => item.description),
    ],
    date: (r) => r.issueDate ?? r.createdAt?.slice(0, 10),
    amount: (r) => r.total,
  },
  goals: { words: (r) => [r.name, r.notes], date: (r) => r.createdAt?.slice(0, 10), amount: (r) => r.target },
  budgets: { words: (r) => [r.name, r.category, r.match], date: (r) => r.createdAt?.slice(0, 10), amount: (r) => r.amount },
  clients: { words: (r) => [r.name, r.company, r.email], date: (r) => r.createdAt?.slice(0, 10), amount: () => null },
  netWorth: { words: (r) => [r.name, r.category], date: (r) => (r.updatedAt ?? r.createdAt)?.slice(0, 10), amount: (r) => r.amount },
}

/** Newest first: by its own date, then by when it was written, then by id. */
const newestFirst = (shape) => (a, b) =>
  String(shape.date(b) ?? '').localeCompare(String(shape.date(a) ?? '')) ||
  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) ||
  (b.id ?? 0) - (a.id ?? 0)

/** "groceries", "grocery" and "grocer" all come down to "grocer", so one finds the others. */
const stem = (word) => (word.length > 4 ? word.replace(/(ies|es|s|y)$/, '') : word)
const wordsOf = (value) => lower(value).split(/[^\p{L}\p{N}@.]+/u).filter(Boolean)

function matches(row, match, shape, lookups) {
  const text = lower(match.text)
  if (text) {
    const haystack = shape.words(row, lookups).filter(Boolean).map(lower).join(' ')
    const have = wordsOf(haystack).map(stem)
    // Every word has to be there, in any order and either number: "grocery"
    // finds "Groceries at SM", "grab ride" finds "Grab ride to the office".
    const found = (word) => haystack.includes(word) || have.some((h) => h.startsWith(stem(word)))
    if (!wordsOf(text).every(found)) return false
  }
  if (match.category && lower(row.category) !== lower(match.category) && !lower(row.category).includes(lower(match.category))) {
    return false
  }
  if (match.type && row.type !== match.type) return false
  const amount = Number(match.amount)
  if (Number.isFinite(amount) && amount > 0) {
    const have = Math.abs(Number(shape.amount(row)))
    if (!Number.isFinite(have) || Math.abs(have - Math.abs(amount)) > 0.5) return false
  }
  const date = shape.date(row) ?? ''
  if (ISO_DATE.test(match.dateFrom ?? '') && date < match.dateFrom) return false
  if (ISO_DATE.test(match.dateTo ?? '') && date > match.dateTo) return false
  return true
}

/** A search that names nothing at all would match everything, which is not a target. */
const saysSomething = (match = {}) =>
  Boolean(lower(match.text) || match.category || Number(match.amount) > 0 || match.dateFrom || match.dateTo)

/**
 * @param lastSaved { [entity]: id }, the newest record the assistant saved or
 *   changed in this conversation, per table.
 * @returns { status: 'one', record } | { status: 'many', records } | { status: 'none' }
 */
export async function resolveTarget(entityName, target, profile, lastSaved = {}) {
  const entity = entityOf(entityName)
  if (!entity) return { status: 'none' }
  const table = db.table(entity)
  const inProfile = ofProfile(profile)

  const one = (record) => (record && inProfile(record) ? { status: 'one', record } : { status: 'none' })

  const match = target?.match ?? {}

  // A pointer that misses, "last" with nothing saved here yet or an id that is
  // not on this side, still has its search terms to fall back on when the
  // model sent any; without them it is not found.
  if (target?.ref === 'last' || target?.ref === 'id') {
    const id = target.ref === 'last' ? lastSaved[entity] : Number(target.id)
    const pointed = Number.isInteger(id) && id > 0 ? one(await table.get(id)) : { status: 'none' }
    if (pointed.status === 'one') return pointed
    if (!saysSomething(match)) {
      if (target.ref === 'id') return pointed
      // "That one" about a record nothing in this chat saved: the person means
      // something recent, but which is theirs to say. The newest few are
      // offered to pick from; a single record is simply that record.
      const recent = (await table.filter(inProfile).toArray()).sort(newestFirst(SHAPE[entity])).slice(0, MAX_CANDIDATES)
      if (recent.length <= 1) return recent.length ? { status: 'one', record: recent[0] } : { status: 'none' }
      return { status: 'many', records: recent }
    }
  }

  if (!saysSomething(match)) return { status: 'none' }

  const shape = SHAPE[entity]
  const needsClients = entity === 'transactions' || entity === 'invoices'
  const [rows, clients] = await Promise.all([
    table.filter(inProfile).toArray(),
    needsClients ? db.clients.filter(inProfile).toArray() : [],
  ])
  const lookups = { clientsById: Object.fromEntries(clients.map((c) => [c.id, c])) }

  let found = rows.filter((row) => matches(row, match, shape, lookups)).sort(newestFirst(shape))
  // The words can miss when the record has none of them ("the income" for a
  // row with no description). An exact amount is a sharper fact than a word,
  // so it gets one more try on its own, with the dates and type still held.
  if (found.length === 0 && Number(match.amount) > 0 && (match.text || match.category)) {
    const loose = { ...match, text: null, category: null }
    found = rows.filter((row) => matches(row, loose, shape, lookups)).sort(newestFirst(shape))
  }
  if (found.length === 0) return { status: 'none' }
  // "My last grocery entry" is one record even when there have been many.
  if (found.length === 1 || (target?.sort ?? match.sort) === 'newest') return { status: 'one', record: found[0] }
  return { status: 'many', records: found.slice(0, MAX_CANDIDATES) }
}

export default resolveTarget
