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

/**
 * The starting chart of accounts for the business profile. Icon names are bare
 * Tabler names resolved by `config/categoryIcons.js` — no `ti-` prefix.
 */
export const BUSINESS_CATEGORIES = [
  // Income
  { name: 'Client Payments', type: 'income', icon: 'cash' },
  { name: 'Retainers', type: 'income', icon: 'repeat' },
  { name: 'Consulting', type: 'income', icon: 'briefcase' },
  { name: 'Interest Income', type: 'income', icon: 'percentage' },
  // Expense
  { name: 'Software & Subscriptions', type: 'expense', icon: 'device-laptop' },
  { name: 'Office & Rent', type: 'expense', icon: 'building' },
  { name: 'Utilities', type: 'expense', icon: 'bolt' },
  { name: 'Internet & Comms', type: 'expense', icon: 'wifi' },
  { name: 'Travel & Transport', type: 'expense', icon: 'car' },
  { name: 'Meals & Entertainment', type: 'expense', icon: 'tools-kitchen-2' },
  { name: 'Salaries & Contractors', type: 'expense', icon: 'users' },
  // Money the owner takes out for themselves, as opposed to paying a
  // contractor. It is the one expense that is also personal income.
  { name: 'Owner Draw / Salary', type: 'expense', icon: 'arrows-exchange' },
  { name: 'Marketing', type: 'expense', icon: 'speakerphone' },
  { name: 'Taxes & Government', type: 'expense', icon: 'receipt-tax' },
  { name: 'Equipment', type: 'expense', icon: 'device-desktop' },
  { name: 'Bank Fees', type: 'expense', icon: 'building-bank' },
  { name: 'Professional Services', type: 'expense', icon: 'scale' },
]

/**
 * The same for the personal profile — a household's categories rather than a
 * company's. "Business Draw" is the one that spans both: money the owner moves
 * out of the business and into personal life.
 */
export const PERSONAL_CATEGORIES = [
  // Income
  { name: 'Salary', type: 'income', icon: 'building-bank' },
  { name: 'Freelance', type: 'income', icon: 'briefcase' },
  { name: 'Investments', type: 'income', icon: 'trending-up' },
  { name: 'Business Draw', type: 'income', icon: 'arrows-exchange' },
  { name: 'Other Income', type: 'income', icon: 'plus' },
  // Expense
  { name: 'Housing', type: 'expense', icon: 'home' },
  { name: 'Food', type: 'expense', icon: 'tools-kitchen-2' },
  { name: 'Transport', type: 'expense', icon: 'car' },
  { name: 'Healthcare', type: 'expense', icon: 'heart-rate-monitor' },
  { name: 'Entertainment', type: 'expense', icon: 'device-tv' },
  { name: 'Subscriptions', type: 'expense', icon: 'repeat' },
  { name: 'Savings', type: 'expense', icon: 'pig-money' },
  { name: 'Debt Payment', type: 'expense', icon: 'credit-card' },
  { name: 'Other', type: 'expense', icon: 'dots' },
]

/** Both lists, each row already carrying the profile it belongs to. */
export const ALL_CATEGORIES = [
  ...BUSINESS_CATEGORIES.map((c) => ({ ...c, profile: 'business' })),
  ...PERSONAL_CATEGORIES.map((c) => ({ ...c, profile: 'personal' })),
]

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
    await db.settings.bulkAdd(DEFAULT_SETTINGS)
  })
}

export default seedDefaults
