import Dexie from 'dexie'
import { seedDatabase } from './seed'

/**
 * Business Finance Hub — local-only database.
 *
 * Everything lives in IndexedDB via Dexie; there is no backend. Only the
 * fields listed in each store string are indexed — every record still carries
 * the full shape documented alongside it.
 */
export const db = new Dexie('business-finance-hub')

db.version(1).stores({
  // { id, date, description, amount, type: income|expense|transfer, category,
  //   clientId, status: cleared|pending, notes, receiptUrl, paymentMethod, createdAt }
  transactions: '++id, date, type, category, clientId, status, paymentMethod, createdAt',

  // { id, name, email, phone, company, notes, createdAt }
  clients: '++id, name, email, company, createdAt',

  // { id, clientId, invoiceNumber, status: draft|sent|viewed|paid|overdue,
  //   items, subtotal, tax, discount, total, dueDate, notes, createdAt, sentAt, paidAt }
  invoices: '++id, clientId, &invoiceNumber, status, dueDate, createdAt, sentAt, paidAt',

  // { id, name, category, amount, period: monthly|quarterly|yearly, createdAt }
  budgets: '++id, name, category, period, createdAt',

  // { id, name, type: income|expense, icon, createdAt }
  categories: '++id, name, type, createdAt',

  // { id, key, value }
  settings: '++id, &key',
})

/**
 * v2 adds the AI layer's two stores. Existing tables are unchanged, so Dexie
 * upgrades in place without touching a single row.
 */
db.version(2).stores({
  // Every confirmed categorisation, used as few-shot examples on later calls.
  // { id, description, amount, category, confirmedAt }
  categorizationHistory: '++id, category, confirmedAt',

  // Cached model output keyed by feature. { id, key, value, generatedAt, dataHash }
  aiCache: '++id, &key',
})

/**
 * v3 deletes any Groq key stored by the old in-app key field. The key now
 * comes from the build environment, so a copy left in the database is both
 * dead weight and a credential worth clearing out.
 */
db.version(3)
  .stores({})
  .upgrade((tx) => tx.table('settings').where('key').equals('groqApiKey').delete())

/** Enum-ish constants so pages and forms never hand-write these strings. */
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer']
export const TRANSACTION_STATUSES = ['cleared', 'pending']
export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue']
export const BUDGET_PERIODS = ['monthly', 'quarterly', 'yearly']

/**
 * Upserts a setting by key. `key` is a unique index, so a plain add or put
 * without the row's id would raise a ConstraintError the second time a value
 * is written — which aborts the transaction and surfaces through the live
 * query as a render-time throw.
 */
export async function putSetting(key, value) {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) await db.settings.update(existing.id, { value })
  else await db.settings.add({ key, value })
}

/**
 * Opens the database, seeding sample data the first time it is created.
 * Safe to call more than once — seeding is skipped once tables hold rows.
 */
export async function initDb() {
  await db.open()
  const count = await db.settings.count()
  if (count === 0) await seedDatabase(db)
  return db
}

export default db
