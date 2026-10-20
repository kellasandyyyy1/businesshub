import { ofProfile } from '../db/queries'

/**
 * Backups, split by profile.
 *
 * The whole-database snapshot in backup.js is still what "Clear all" reckons
 * against; this is the one people actually use, because a backup you cannot
 * restore by halves is a backup you hesitate to restore at all.
 *
 * Rows are matched with `ofProfile` rather than an equality query on the
 * profile index. A row written before the profile split has no such field and
 * reads as business — an indexed `equals('business')` would walk straight past
 * it, so an export would quietly omit the oldest rows in the ledger and an
 * import would leave them behind to be duplicated.
 */

export const EXPORT_VERSION = '1.0'

/** What each side is made of, and what to call it when counting. */
export const PROFILE_TABLES = {
  business: [
    ['transactions', 'Transactions'],
    ['clients', 'Clients'],
    ['invoices', 'Invoices'],
    ['budgets', 'Budgets'],
    ['categories', 'Custom categories'],
  ],
  personal: [
    ['transactions', 'Transactions'],
    ['goals', 'Goals'],
    ['netWorth', 'Net worth items'],
    ['categories', 'Custom categories'],
  ],
}

/**
 * Settings safe to carry between devices.
 *
 * A list of what to keep rather than what to drop: a key added later is then
 * left behind by default, which is the safe direction for a file that travels.
 */
export const PORTABLE_SETTINGS = [
  'activeMode',
  'businessName',
  'userName',
  'currency',
  'symbol',
  'locale',
  'openingBalance',
  'personalOpeningBalance',
  'fiscalYearStart',
  'paymentMethods',
  'theme',
  'notifyOverdue',
  'notifyBudgets',
  'notifyPending',
  'notifyWeekly',
  'notifyGoalDeadline',
  'notifyGoalReached',
  'notifySavingsRate',
  'notifySpendingSpike',
  'notifyNetWorth',
  'voiceInput',
]

/** The default set is re-seeded by the app, so only what someone added travels. */
const isCustom = (row) => !row.isDefault

const rowsFor = async (db, table, profile) => {
  const rows = await db[table].filter(ofProfile(profile)).toArray()
  return table === 'categories' ? rows.filter(isCustom) : rows
}

async function sideOf(db, profile) {
  const side = {}
  for (const [table] of PROFILE_TABLES[profile]) {
    side[table] = await rowsFor(db, table, profile)
  }
  return side
}

/** Builds the payload. Writing it to a file is the caller's business. */
export async function collectExport(db, mode, now = new Date()) {
  const payload = { exportedAt: now.toISOString(), version: EXPORT_VERSION, mode }

  if (mode === 'business' || mode === 'all') payload.business = await sideOf(db, 'business')
  if (mode === 'personal' || mode === 'all') payload.personal = await sideOf(db, 'personal')

  if (mode === 'all') {
    const settings = await db.settings.toArray()
    payload.settings = settings
      .filter((s) => PORTABLE_SETTINGS.includes(s.key))
      .map(({ key, value }) => ({ key, value }))
  }

  return payload
}

export const exportFilename = (mode, now = new Date()) =>
  `dual-${mode}-${now.toISOString().slice(0, 10)}.json`

/** Live counts for the line under each export button. */
export async function exportCounts(db) {
  const [business, personal] = await Promise.all([sideOf(db, 'business'), sideOf(db, 'personal')])
  return {
    business: Object.fromEntries(Object.entries(business).map(([k, v]) => [k, v.length])),
    personal: Object.fromEntries(Object.entries(personal).map(([k, v]) => [k, v.length])),
  }
}

/* ---- Reading a file back ---------------------------------------------------- */

export function validateExport(parsed) {
  if (!parsed || typeof parsed !== 'object') return "That file isn't a Dual backup."
  if (!parsed.exportedAt || !parsed.version || !parsed.mode) {
    return "That file isn't a Dual backup."
  }
  if (!parsed.business && !parsed.personal) return 'This backup has no data in it.'
  return null
}

/** What the file holds, in the order the modal lists it. */
export function buildPreview(parsed) {
  const sections = []

  for (const profile of ['business', 'personal']) {
    const side = parsed[profile]
    if (!side) continue
    sections.push({
      profile,
      label: profile === 'business' ? 'Business data' : 'Personal data',
      counts: PROFILE_TABLES[profile]
        .map(([table, label]) => ({ label, count: side[table]?.length ?? 0 }))
        .filter((row) => row.count > 0),
      total: PROFILE_TABLES[profile].reduce((n, [table]) => n + (side[table]?.length ?? 0), 0),
    })
  }

  return {
    mode: parsed.mode,
    exportedAt: parsed.exportedAt,
    sections,
    // Only an "everything" file carries settings, and only then can both sides
    // be restored, so this is what decides whether the chooser is offered.
    hasBoth: Boolean(parsed.business && parsed.personal),
    settingsCount: parsed.settings?.length ?? 0,
  }
}

/** Which sides a restore choice actually touches. */
export const sidesFor = (choice) => (choice === 'both' ? ['business', 'personal'] : [choice])

export function warningFor(choice) {
  if (choice === 'both') {
    return 'This will replace both your Business and Personal data. This cannot be undone.'
  }
  const replaced = choice === 'business' ? 'Business' : 'Personal'
  const spared = choice === 'business' ? 'Personal' : 'Business'
  return `This will replace all your current ${replaced} data. Your ${spared} data is not affected. This cannot be undone.`
}

/**
 * Replaces one or both sides from a file.
 *
 * Everything happens in one Dexie transaction: a restore that failed halfway
 * would leave someone with the rows deleted and nothing put back, which is the
 * one outcome a backup feature must never produce.
 *
 * Keys are dropped on the way in so Dexie assigns fresh ones. A file restored
 * onto a database that still holds the other profile would otherwise collide
 * on primary keys that are only unique within the file it came from.
 */
export async function runImport(db, parsed, choice) {
  const sides = sidesFor(choice).filter((profile) => parsed[profile])
  if (sides.length === 0) return { restored: {} }

  const tables = new Set(['transactions', 'categories'])
  for (const profile of sides) for (const [table] of PROFILE_TABLES[profile]) tables.add(table)
  if (choice === 'both' && parsed.settings) tables.add('settings')

  const restored = {}

  await db.transaction(
    'rw',
    [...tables].map((name) => db[name]),
    async () => {
      for (const profile of sides) {
        const side = parsed[profile]
        restored[profile] = 0

        for (const [table] of PROFILE_TABLES[profile]) {
          // Cleared through the same predicate the export used, so a legacy
          // row with no profile field goes rather than surviving as a duplicate.
          const doomed = await db[table].filter(ofProfile(profile)).toArray()
          const ids = doomed.filter((row) => table !== 'categories' || isCustom(row)).map((r) => r.id)
          if (ids.length) await db[table].bulkDelete(ids)

          const rows = side[table]
          if (!Array.isArray(rows) || rows.length === 0) continue
          await db[table].bulkAdd(
            rows.map(({ id: _id, ...rest }) => ({ ...rest, profile })),
          )
          restored[profile] += rows.length
        }
      }

      if (choice === 'both' && Array.isArray(parsed.settings)) {
        for (const { key, value } of parsed.settings) {
          if (!PORTABLE_SETTINGS.includes(key)) continue
          const existing = await db.settings.where('key').equals(key).first()
          // put, not modify: a key this device has never written would other-
          // wise be silently skipped rather than restored.
          if (existing) await db.settings.put({ ...existing, value })
          else await db.settings.add({ key, value })
        }
      }
    },
  )

  return { restored }
}
