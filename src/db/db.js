import Dexie from 'dexie'
import { OWNER_DRAW_CATEGORY, PERSONAL_CATEGORIES, seedDefaults } from './defaults'

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

/**
 * v4 removes the sample business the app used to seed on first run.
 *
 * Early builds populated a fictional company — transactions, clients,
 * invoices and budgets — so the interface never looked empty. That space
 * belongs to the user's own ledger, so the sample is cleared out here and
 * nothing takes its place.
 *
 * WARNING: this clears the four data tables outright. It cannot tell a seeded
 * row from one the user typed, so any real data on the device goes with it.
 * The AI tables go too — both hold output derived from the sample figures.
 *
 * Categories and settings survive; they are configuration, not data. The one
 * exception is a device that was seeded but never onboarded: its business name
 * came from the sample, so it is dropped and onboarding opens on next load.
 */
db.version(4)
  .stores({})
  .upgrade(async (tx) => {
    for (const name of ['transactions', 'clients', 'invoices', 'budgets']) {
      await tx.table(name).clear()
    }
    // Present from v2 onward; guarded so the upgrade cannot fail on a database
    // that predates them.
    for (const name of ['categorizationHistory', 'aiCache']) {
      if (tx.db.tables.some((t) => t.name === name)) await tx.table(name).clear()
    }

    const settings = tx.table('settings')
    await settings.where('key').equals('seededAt').delete()

    // A device that was seeded but never onboarded carries the sample
    // business's identity — its name and its invoice numbering. Both go, so
    // onboarding opens on the next load and invoice numbers restart at the
    // default prefix. A device the user really onboarded keeps what they typed.
    const onboarded = await settings.where('key').equals('onboarded').first()
    if (onboarded?.value !== true) {
      await settings.where('key').anyOf(['businessName', 'invoicePrefix']).delete()
    }
  })

/**
 * v5 splits the database into two profiles: business and personal.
 *
 * Every row that can belong to one side or the other gains a `profile` field,
 * and two tables arrive for the personal side to build on. Everything that
 * existed before this point was business data, so that is what it is tagged.
 *
 * Each store string below repeats the indexes the table already had. Dexie
 * replaces a table's schema wholesale when a version re-declares it, so an
 * index left out here would be dropped — including invoices' unique
 * `&invoiceNumber`, which InvoiceEditor both queries and relies on to catch
 * duplicate numbers.
 *
 * `settings` is not re-declared: it holds one row per key for the whole app,
 * not per profile, and its `&key` uniqueness is load-bearing for putSetting.
 */
db.version(5)
  .stores({
    transactions: '++id, date, type, category, clientId, status, paymentMethod, profile, createdAt',
    clients: '++id, name, email, company, profile, createdAt',
    invoices: '++id, clientId, &invoiceNumber, status, dueDate, profile, createdAt, sentAt, paidAt',
    budgets: '++id, name, category, period, profile, createdAt',
    categories: '++id, name, type, profile, createdAt',

    // { id, name, target, current, deadline, notes, profile, createdAt }
    goals: '++id, name, deadline, profile, createdAt',

    // { id, type: asset|liability, name, category, amount, notes, profile, updatedAt }
    netWorth: '++id, type, name, profile, updatedAt',
  })
  .upgrade(async (tx) => {
    for (const name of ['transactions', 'clients', 'invoices', 'budgets', 'categories']) {
      await tx.table(name).toCollection().modify({ profile: 'business' })
    }

    // The personal chart of accounts, so the profile is usable the moment it is
    // switched to. Guarded because this also runs while a database is being
    // created, where seedDefaults is about to lay down the same list.
    const categories = tx.table('categories')
    const alreadyPersonal = await categories.filter((c) => c.profile === 'personal').count()
    if (alreadyPersonal > 0) return

    const createdAt = new Date().toISOString()
    await categories.bulkAdd(
      PERSONAL_CATEGORIES.map((c) => ({ ...c, profile: 'personal', createdAt })),
    )
  })

/**
 * v6 adds the category an owner draw is booked under.
 *
 * Paying yourself is not the same as paying a contractor, and it is the one
 * business expense that is also personal income — the transfer flow keys off
 * this category to offer recording both sides at once. A database created
 * after this version gets it from seedDefaults instead.
 */
db.version(6)
  .stores({})
  .upgrade(async (tx) => {
    const categories = tx.table('categories')

    // Repair first. An earlier build let the version upgraders and the
    // first-run defaults both write the category lists, which left some
    // databases holding two of everything. Keep the oldest of each.
    const all = await categories.toArray()
    const seen = new Set()
    const duplicates = []
    for (const row of all.sort((a, b) => a.id - b.id)) {
      const key = `${row.profile}|${row.name}`
      if (seen.has(key)) duplicates.push(row.id)
      else seen.add(key)
    }
    if (duplicates.length) await categories.bulkDelete(duplicates)

    if (seen.has(`business|${OWNER_DRAW_CATEGORY}`)) return

    await categories.add({
      name: OWNER_DRAW_CATEGORY,
      type: 'expense',
      icon: 'arrows-exchange',
      profile: 'business',
      createdAt: new Date().toISOString(),
    })
  })

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
 * Opens the database, writing the default categories and settings the first
 * time it is created. No sample data is written — a new device starts with an
 * empty ledger and onboarding collects the rest.
 *
 * Safe to call more than once, and skipped after Settings → Data → clear all,
 * which leaves an `initialized` marker behind.
 */
export async function initDb() {
  await db.open()
  const count = await db.settings.count()
  if (count === 0) await seedDefaults(db)
  return db
}

export default db
