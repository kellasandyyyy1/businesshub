import Dexie from 'dexie'
import { ALL_CATEGORIES, RENAMED_CATEGORIES } from './categoryData'
import { OWNER_DRAW_CATEGORY, PERSONAL_CATEGORIES, seedDefaults } from './defaults'
import { CARD_BRANDS, methodId, methodKey, methodsFromSetting, paymentKind, withIds } from '../lib/paymentMethods'

/**
 * Dual Finance, local-only database.
 *
 * Everything lives in IndexedDB via Dexie; there is no backend. Only the
 * fields listed in each store string are indexed, every record still carries
 * the full shape documented alongside it.
 */
/**
 * The database the app was called before the rebrand. Kept as a constant
 * because the one-time migration below is the only thing that still needs it,
 * and it has to be exactly right, a typo here silently abandons real data.
 */
const LEGACY_DB_NAME = 'business-finance-hub'

export const db = new Dexie('dual-finance')

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
 * Early builds populated a fictional company, transactions, clients,
 * invoices and budgets, so the interface never looked empty. That space
 * belongs to the user's own ledger, so the sample is cleared out here and
 * nothing takes its place.
 *
 * WARNING: this clears the four data tables outright. It cannot tell a seeded
 * row from one the user typed, so any real data on the device goes with it.
 * The AI tables go too, both hold output derived from the sample figures.
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
    // business's identity, its name and its invoice numbering. Both go, so
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
 * index left out here would be dropped, including invoices' unique
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
 * business expense that is also personal income, the transfer flow keys off
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

/**
 * v7 gives each profile its own chart of accounts.
 *
 * The lists were seeded when the app was business-only, so the personal side
 * inherited names that suit a company and the business side was missing a few
 * a company needs. This reshapes both.
 *
 * It does NOT clear the table. Two reasons: a category the user created
 * themselves is their data, and a transaction stores its category as a name
 * rather than a reference, so wiping the list would strand every row whose
 * name went with it. Renames are applied to the category and to the rows that
 * use it in the same pass, retired defaults are only removed when nothing
 * refers to them, and anything custom is left alone.
 */
db.version(7)
  .stores({
    // The compound index is what lets a dropdown ask for one profile's
    // categories of one type without walking the table.
    categories: '++id, name, type, profile, [profile+type], isDefault, createdAt',
  })
  .upgrade(async (tx) => {
    const categories = tx.table('categories')
    const transactions = tx.table('transactions')
    const budgets = tx.table('budgets')

    // ---- Renames, applied to the rows that point at them ------------------
    for (const { profile, type, from, to } of RENAMED_CATEGORIES) {
      const existing = await categories
        .filter((c) => c.profile === profile && c.type === type && c.name === from)
        .toArray()

      // A database that already has the new name keeps it; the old row is only
      // dropped once its rows have been moved across.
      const targetExists = await categories
        .filter((c) => c.profile === profile && c.type === type && c.name === to)
        .count()

      for (const row of existing) {
        if (targetExists > 0) await categories.delete(row.id)
        else await categories.update(row.id, { name: to })
      }

      if (existing.length > 0 || targetExists > 0) {
        await transactions
          .filter((t) => (t.profile ?? 'business') === profile && t.category === from)
          .modify({ category: to })
        await budgets
          .filter((b) => (b.profile ?? 'business') === profile && b.category === from)
          .modify({ category: to })
      }
    }

    // ---- Bring every default up to date, adding the ones that are missing --
    const current = await categories.toArray()
    const keyOf = (c) => `${c.profile}|${c.type}|${c.name}`
    const byKey = new Map(current.map((c) => [keyOf(c), c]))
    const createdAt = new Date().toISOString()

    for (const wanted of ALL_CATEGORIES) {
      const found = byKey.get(keyOf(wanted))
      if (found) {
        await categories.update(found.id, { icon: wanted.icon, isDefault: true })
      } else {
        await categories.add({ ...wanted, createdAt })
      }
    }

    // ---- Retire defaults that are no longer offered ------------------------
    const wantedKeys = new Set(ALL_CATEGORIES.map(keyOf))
    for (const row of current) {
      if (wantedKeys.has(keyOf(row))) continue
      // Anything the user made is theirs to keep; it is simply not a default.
      if (row.custom || row.isDefault === false) {
        await categories.update(row.id, { isDefault: false })
        continue
      }
      // A retired default that history still refers to stays, so the rows
      // using it keep a name the app can still resolve to an icon.
      const inUse = await transactions
        .filter((t) => (t.profile ?? 'business') === row.profile && t.category === row.name)
        .count()
      if (inUse > 0) await categories.update(row.id, { isDefault: false })
      else await categories.delete(row.id)
    }
  })

/**
 * v8, a holding table for the few seconds a delete can still be undone.
 *
 * A removed row moves here whole, in the same transaction that takes it out of
 * its own table, and moves back with the same id if the user taps Undo. While
 * it is here it is simply not in its table, so every total, report, budget and
 * notice leaves it out without any of them having to know. Whatever is still
 * here when the app opens again is purged: the tab closed before Undo.
 *
 *   { id, table, row, deletedAt }
 */
db.version(8).stores({
  trash: '++id, table, deletedAt',
})

/**
 * v9, GoTyme joins the payment methods. A list the user has never edited
 * comes from the defaults and picks it up there; one they have edited is
 * stored, so it gets GoTyme appended here, once. Removing it afterwards sticks.
 */
db.version(9).stores({}).upgrade(async (tx) => {
  const settings = tx.table('settings')
  const row = await settings.where('key').equals('paymentMethods').first()
  if (!row || !Array.isArray(row.value)) return
  if (row.value.some((m) => /go\s?tyme/i.test(m?.name ?? ''))) return
  await settings.update(row.id, { value: [...row.value, { name: 'GoTyme', active: true }] })
})

/**
 * v10, transactions point at a saved payment method by id.
 *
 * The method list gains ids and is written down for good (a never-edited list
 * was only ever the defaults in code). Names the ledger already used that the
 * list lacked are kept as methods: Settings has always listed them, so they
 * are methods as far as the user can tell, and dropping them would make
 * their history look orphaned. Every transaction whose free text matches a
 * method by name, ignoring case and stray spaces, then gets that method's
 * id; its text stays as the snapshot.
 */
db.version(10)
  .stores({
    transactions: '++id, date, type, category, clientId, status, paymentMethod, paymentMethodId, profile, createdAt',
  })
  .upgrade(async (tx) => {
    const settings = tx.table('settings')
    const transactions = tx.table('transactions')

    const row = await settings.where('key').equals('paymentMethods').first()
    const list = methodsFromSetting(row?.value)
    const known = new Set(list.map((m) => methodKey(m.name)))

    const extra = []
    await transactions.each((t) => {
      const name = String(t.paymentMethod ?? '').trim()
      if (name && !known.has(methodKey(name))) {
        known.add(methodKey(name))
        extra.push({ name, active: true })
      }
    })

    const methods = withIds([...list, ...extra])
    if (row) await settings.update(row.id, { value: methods })
    else await settings.add({ key: 'paymentMethods', value: methods })

    const byName = new Map(methods.map((m) => [methodKey(m.name), m]))
    await transactions.toCollection().modify((t) => {
      if (t.paymentMethodId) return
      const match = byName.get(methodKey(t.paymentMethod))
      if (match) t.paymentMethodId = match.id
    })
  })

/**
 * v11, Visa, Mastercard and PayPal join the payment methods, each with its
 * own mark. Matched by brand rather than exact name, so a list that already
 * has "VISA Debit" or "Paypal" is left alone. Removing one afterwards sticks.
 */
db.version(11).stores({}).upgrade(async (tx) => {
  const settings = tx.table('settings')
  const row = await settings.where('key').equals('paymentMethods').first()
  if (!row || !Array.isArray(row.value)) return
  const list = withIds(row.value)
  const held = new Set(list.map((m) => paymentKind(m.name).slug))
  const missing = CARD_BRANDS.filter((name) => !held.has(paymentKind(name).slug))
  if (!missing.length) return
  const ids = list.map((m) => m.id)
  const added = missing.map((name) => {
    const id = methodId(name, ids)
    ids.push(id)
    return { id, name, active: true }
  })
  await settings.update(row.id, { value: [...list, ...added] })
})

/** Enum-ish constants so pages and forms never hand-write these strings. */
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer']
export const TRANSACTION_STATUSES = ['cleared', 'pending']
export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue']
export const BUDGET_PERIODS = ['monthly', 'quarterly', 'yearly']

/**
 * Upserts a setting by key. `key` is a unique index, so a plain add or put
 * without the row's id would raise a ConstraintError the second time a value
 * is written, which aborts the transaction and surfaces through the live
 * query as a render-time throw.
 */
export async function putSetting(key, value) {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) await db.settings.update(existing.id, { value })
  else await db.settings.add({ key, value })
}

/**
 * Opens the database, writing the default categories and settings the first
 * time it is created. No sample data is written, a new device starts with an
 * empty ledger and onboarding collects the rest.
 *
 * Safe to call more than once, and skipped after Settings → Data → clear all,
 * which leaves an `initialized` marker behind.
 */
/** Storage keys that carried the old prefix, and what they are called now. */
const LEGACY_STORAGE_KEYS = {
  // Left side is the old name and must stay that way, it is the only record
  // of what these were called before the rename.
  'bfh-active-profile': 'dual-active-profile',
  'bfh-push-enabled': 'dual-push-enabled',
  'bfh-device-id': 'dual-device-id',
  'bfh-install-dismissed': 'dual-install-dismissed',
  'bfh-ai-hint-dismissed': 'dual-ai-hint-dismissed',
  'bfh-open-count': 'dual-open-count',
  'bfh-howto-dismissed': 'dual-howto-dismissed',
}

const MIGRATED_FLAG = 'dual-db-migrated'

function migrateStorageKeys() {
  try {
    for (const [before, after] of Object.entries(LEGACY_STORAGE_KEYS)) {
      const value = localStorage.getItem(before)
      if (value === null) continue
      // Never overwrite a newer choice with the value it replaced.
      if (localStorage.getItem(after) === null) localStorage.setItem(after, value)
      localStorage.removeItem(before)
    }
  } catch {
    // A browser refusing storage keeps its defaults; nothing here is essential.
  }
}

/**
 * Reads everything out of the pre-rebrand database, once.
 *
 * Renaming a Dexie database does not move the data, it opens a different,
 * empty one and leaves the original sitting there. So the rows are lifted out
 * before the new database is opened, and written in after, which also means
 * the first-run defaults never fire on top of a migrated set.
 *
 * The old schema is read rather than declared: Dexie opens an existing
 * database in dynamic mode when no versions are given, so this keeps working
 * whatever version the device happened to be on.
 */
async function readLegacyDatabase() {
  let migrated = null
  try {
    migrated = localStorage.getItem(MIGRATED_FLAG)
  } catch {
    return null
  }
  if (migrated) return null

  try {
    if (!(await Dexie.exists(LEGACY_DB_NAME))) return null

    const legacy = new Dexie(LEGACY_DB_NAME)
    await legacy.open()

    const payload = {}
    for (const table of legacy.tables) {
      const rows = await table.toArray()
      if (rows.length) payload[table.name] = rows
    }
    legacy.close()
    return payload
  } catch (err) {
    // A database that cannot be read is not worth blocking startup over, but
    // the flag is left unset so a later load can try again.
    console.warn('Dual: could not read the previous database:', err?.message)
    return null
  }
}

/**
 * Opens the database, writing the default categories and settings the first
 * time it is created, and carrying across anything left in the pre-rebrand
 * database before either happens.
 */
export async function initDb() {
  const legacy = await readLegacyDatabase()

  await db.open()

  // An undo window that never closed, the tab went first, commits now.
  try {
    await db.trash.clear()
  } catch (err) {
    console.warn('Dual: could not clear pending deletes:', err?.message)
  }

  if (legacy) {
    try {
      for (const [name, rows] of Object.entries(legacy)) {
        if (!db.tables.some((t) => t.name === name)) continue
        // put rather than add: the rows keep their ids, so a re-run cannot
        // duplicate them.
        await db.table(name).bulkPut(rows)
      }
      migrateStorageKeys()
      localStorage.setItem(MIGRATED_FLAG, 'true')
      console.info('Dual: carried your data over from the previous version.')
    } catch (err) {
      console.warn('Dual: migration incomplete:', err?.message)
    }
  } else {
    migrateStorageKeys()
    try {
      localStorage.setItem(MIGRATED_FLAG, 'true')
    } catch {
      // Nothing to remember on a browser without storage.
    }
  }

  // Categories are checked as well as settings: a database carried over from
  // a device that somehow held one without the other would otherwise open with
  // nothing to file a transaction under. seedDefaults only adds what is
  // missing, so this is safe to reach on a full database.
  const [settingsCount, categoryCount] = await Promise.all([
    db.settings.count(),
    db.categories.count(),
  ])
  if (settingsCount === 0 || categoryCount === 0) await seedDefaults(db)
  return db
}

export default db
