import { db } from './db'
import { PERSONAL_DRAW_CATEGORY } from './defaults'

/**
 * Profile-scoped reads and writes.
 *
 * Business and personal records share the same tables and are told apart by a
 * `profile` field. Every query that touches a profiled table goes through here
 * so the filter lives in one place rather than at eighty call sites.
 *
 * Profiled tables: transactions, clients, invoices, budgets, categories, goals,
 * netWorth. `settings` is not one of them — it holds one row per key for the
 * whole app.
 */

/**
 * The profile every page built before the two-profile split reads from. Those
 * pages are business-only, and all data that existed before v5 is business
 * data, so they behave exactly as they always have. The parts that introduce
 * personal UI replace this with the active profile from ProfileContext — this
 * constant is the list of places they have to touch.
 */
export const BUSINESS_PROFILE = 'business'

export const PROFILED_TABLES = [
  'transactions',
  'clients',
  'invoices',
  'budgets',
  'categories',
  'goals',
  'netWorth',
]

/**
 * A row written before v5, or by a path that forgot to stamp one, reads as
 * business. Treating a missing profile as business keeps such a row visible
 * where it has always been rather than making it disappear from both sides.
 */
export const profileOf = (row) => row?.profile ?? 'business'

/**
 * Predicate for Dexie's `Collection.filter`. Use it to scope a query that has
 * to start from another index — `.where('date').between(...)` walks the date
 * index and this skips the rows belonging to the other profile, so the query
 * stays indexed and stays in index order.
 */
export const ofProfile = (profile) => (row) => profileOf(row) === profile

/* -------------------------------------------------------------------------
   Reads
   ------------------------------------------------------------------------- */

/** Every transaction in the profile, newest first, with optional filters. */
export async function getTransactions(profile, filters = {}) {
  const { startDate, endDate, type, status } = filters

  // A date range is the one filter worth handing to an index; the rest are
  // cheap comparisons over what it returns.
  const base =
    startDate && endDate
      ? db.transactions.where('date').between(startDate, endDate, true, true)
      : db.transactions.toCollection()

  const rows = await base.filter(ofProfile(profile)).toArray()

  return rows
    .filter((tx) => {
      if (!startDate || !endDate) {
        if (startDate && tx.date < startDate) return false
        if (endDate && tx.date > endDate) return false
      }
      if (type && tx.type !== type) return false
      if (status && tx.status !== status) return false
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Transactions inside a date range, in ascending date order. */
export function transactionsBetween(profile, startDate, endDate) {
  return db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .filter(ofProfile(profile))
    .toArray()
}

/** Everything dated before `date` — what a period's opening position needs. */
export function transactionsBefore(profile, date) {
  return db.transactions.where('date').below(date).filter(ofProfile(profile)).toArray()
}

/** Newest first, optionally capped — for "recent activity" style lists. */
export function recentTransactions(profile, limit) {
  const c = db.transactions.orderBy('date').reverse().filter(ofProfile(profile))
  return limit ? c.limit(limit).toArray() : c.toArray()
}

/** Ascending by date, which is what running-balance maths wants. */
export function transactionsByDate(profile) {
  return db.transactions.orderBy('date').filter(ofProfile(profile)).toArray()
}

export function getClients(profile) {
  return db.clients.orderBy('name').filter(ofProfile(profile)).toArray()
}

export function getInvoices(profile) {
  return db.invoices.filter(ofProfile(profile)).toArray()
}

/** Newest first — the order the invoice list shows. */
export function recentInvoices(profile) {
  return db.invoices.orderBy('createdAt').reverse().filter(ofProfile(profile)).toArray()
}

export function getBudgets(profile) {
  return db.budgets.orderBy('name').filter(ofProfile(profile)).toArray()
}

export function getCategories(profile) {
  return db.categories.orderBy('name').filter(ofProfile(profile)).toArray()
}

export function getGoals(profile) {
  return db.goals.filter(ofProfile(profile)).toArray()
}

export function getNetWorth(profile) {
  return db.netWorth.filter(ofProfile(profile)).toArray()
}

/** Row counts per profiled table, for "is there anything here yet?" checks. */
export async function profileCounts(profile) {
  const [transactions, clients, invoices, budgets] = await Promise.all([
    db.transactions.filter(ofProfile(profile)).count(),
    db.clients.filter(ofProfile(profile)).count(),
    db.invoices.filter(ofProfile(profile)).count(),
    db.budgets.filter(ofProfile(profile)).count(),
  ])
  return { transactions, clients, invoices, budgets }
}

/* -------------------------------------------------------------------------
   Writes

   A new row has to carry its profile or it belongs to neither side. These
   stamp it, so no caller has to remember.
   ------------------------------------------------------------------------- */

const stamped = (profile, data) => ({
  ...data,
  profile,
  createdAt: data.createdAt ?? new Date().toISOString(),
})

export function addTransaction(profile, data) {
  return db.transactions.add(stamped(profile, data))
}

export function addClient(profile, data) {
  return db.clients.add(stamped(profile, data))
}

export function addInvoice(profile, data) {
  return db.invoices.add(stamped(profile, data))
}

export function addBudget(profile, data) {
  return db.budgets.add(stamped(profile, data))
}

export function addCategory(profile, data) {
  return db.categories.add(stamped(profile, data))
}

export function addGoal(profile, data) {
  return db.goals.add(stamped(profile, data))
}

export function addNetWorthEntry(profile, data) {
  return db.netWorth.add({
    ...data,
    profile,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  })
}

/* -------------------------------------------------------------------------
   Business → personal transfers

   An owner paying themselves is one event on two sets of books: an expense to
   the business, income to the household. Recording it twice by hand is where
   the two drift, so the pair is written together and each row points at the
   other.
   ------------------------------------------------------------------------- */

/**
 * Writes the business expense and, when asked, the matching personal income.
 *
 * Both rows go in one Dexie transaction: a half-recorded transfer is worse
 * than an unrecorded one, because nothing on either side says it is missing.
 * The ids only exist after the rows do, so the link is closed in a second
 * pass inside the same transaction.
 *
 * Returns the business row's id either way.
 */
export async function addTransactionWithDraw(record, { alsoPersonal = false } = {}) {
  if (!alsoPersonal) return addTransaction(BUSINESS_PROFILE, record)

  return db.transaction('rw', db.transactions, async () => {
    const businessId = await db.transactions.add(
      stamped(BUSINESS_PROFILE, { ...record, isOwnerDraw: true }),
    )

    const personalId = await db.transactions.add(
      stamped('personal', {
        date: record.date,
        description: 'Owner draw from business',
        amount: record.amount,
        type: 'income',
        category: PERSONAL_DRAW_CATEGORY,
        status: record.status ?? 'cleared',
        paymentMethod: record.paymentMethod ?? '',
        notes: 'Auto-recorded from business transfer',
        clientId: null,
        receiptUrl: null,
        linkedTransactionId: businessId,
      }),
    )

    await db.transactions.update(businessId, { linkedTransactionId: personalId })
    return businessId
  })
}

/**
 * Keeps a linked pair in step when the business side is edited.
 *
 * Only the facts the two share travel across — what the money was and when it
 * moved. The personal row's own wording is left alone: it says where the money
 * came from, which does not change because the business description did.
 */
export async function updateTransactionWithDraw(id, record) {
  await db.transaction('rw', db.transactions, async () => {
    const existing = await db.transactions.get(id)
    await db.transactions.update(id, record)

    const linkedId = existing?.linkedTransactionId
    if (!linkedId) return

    const linked = await db.transactions.get(linkedId)
    if (!linked) return

    await db.transactions.update(linkedId, { amount: record.amount, date: record.date })
  })
}

/**
 * The most recent transfers, each with the personal row it created.
 *
 * A pair whose other half has been deleted is dropped rather than listed with
 * a blank beside it — the list is there to show what matched.
 */
export async function recentTransfers(limit = 5) {
  const business = await db.transactions
    .filter((row) => profileOf(row) === BUSINESS_PROFILE && Boolean(row.linkedTransactionId))
    .toArray()

  business.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const pairs = []
  for (const row of business) {
    if (pairs.length >= limit) break
    const personal = await db.transactions.get(row.linkedTransactionId)
    if (personal) pairs.push({ business: row, personal })
  }
  return pairs
}
