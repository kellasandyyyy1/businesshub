/**
 * First-run configuration.
 *
 * This module holds *configuration only* — the category list a new business
 * picks from and the baseline settings. It deliberately contains no
 * transactions, clients, invoices or budgets: a new device opens the app with
 * an empty ledger and fills it in itself.
 *
 * Payment methods are not here. They already have a code-level default in
 * `hooks/useSettingsData.js` (DEFAULT_PAYMENT_METHODS) and are only written to
 * the database once the user edits the list.
 */

/**
 * The business category an owner draw is booked under, and the personal one it
 * arrives as. Named here because the migration, the transaction form and the
 * transfer list all have to agree on the exact strings.
 */
export const OWNER_DRAW_CATEGORY = 'Owner Draw / Salary'
export const PERSONAL_DRAW_CATEGORY = 'Business Draw'

import { ALL_CATEGORIES } from './categoryData'

/**
 * The category lists live in categoryData.js, shared with the migration that
 * reshapes an existing database so the two can never disagree.
 */
export { ALL_CATEGORIES, BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from './categoryData'

/**
 * Baseline settings. `businessName` is intentionally absent — its absence is
 * what makes the onboarding gate in App.jsx open on a fresh device. Currency
 * and locale are overwritten by whatever the user picks during onboarding.
 */
export const DEFAULT_SETTINGS = [
  { key: 'currency', value: 'PHP' },
  { key: 'symbol', value: '₱' },
  { key: 'locale', value: 'en-PH' },
  { key: 'taxRate', value: 0.12 },
  { key: 'fiscalYearStart', value: '01-01' },
  { key: 'theme', value: 'system' },
]

/** Writes the defaults. Runs once, on a database that has just been created. */
export async function seedDefaults(db) {
  await db.transaction('rw', db.categories, db.settings, async () => {
    const createdAt = new Date().toISOString()

    // Only what is missing. Dexie runs the version upgraders while creating a
    // database, so by the time this is reached the categories they add are
    // already there — writing the list wholesale would file every one of them
    // a second time.
    const existing = await db.categories.toArray()
    const seen = new Set(existing.map((c) => `${c.profile}|${c.name}`))
    const missing = ALL_CATEGORIES.filter((c) => !seen.has(`${c.profile}|${c.name}`))

    if (missing.length) await db.categories.bulkAdd(missing.map((c) => ({ ...c, createdAt })))

    // Settings the same way. `key` is a unique index, so re-adding one that
    // already exists throws a ConstraintError that aborts the whole
    // transaction — taking the categories above down with it.
    const settings = await db.settings.toArray()
    const keys = new Set(settings.map((row) => row.key))
    const newSettings = DEFAULT_SETTINGS.filter((row) => !keys.has(row.key))
    if (newSettings.length) await db.settings.bulkAdd(newSettings)
  })
}

export default seedDefaults
