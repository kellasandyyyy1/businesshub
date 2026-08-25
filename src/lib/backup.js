/**
 * Whole-database export, import, and erase.
 *
 * The file is a plain JSON snapshot of every table, so it can be inspected,
 * diffed, or hand-edited before being restored.
 */

export const BACKUP_VERSION = 1
export const TABLES = ['transactions', 'clients', 'invoices', 'budgets', 'categories', 'settings']

export async function exportAll(db) {
  const data = {}
  for (const name of TABLES) data[name] = await db[name].toArray()

  return {
    meta: {
      app: 'Dual Finance',
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      counts: Object.fromEntries(TABLES.map((name) => [name, data[name].length])),
    },
    data,
  }
}

/** Bytes of the serialised snapshot, for the "estimated size" line. */
export const backupSize = (payload) => new Blob([JSON.stringify(payload)]).size

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Throws with a readable reason rather than half-importing a bad file. */
export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('That file is not a backup.')
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('That file has no data section.')
  }
  const missing = TABLES.filter((name) => !Array.isArray(payload.data[name]))
  if (missing.length === TABLES.length) throw new Error('That file has no recognisable tables.')
  return true
}

/** Replaces everything. Runs in one transaction, so a failure changes nothing. */
export async function importAll(db, payload) {
  validateBackup(payload)

  await db.transaction('rw', TABLES.map((name) => db[name]), async () => {
    for (const name of TABLES) {
      const rows = payload.data[name]
      if (!Array.isArray(rows)) continue
      await db[name].clear()
      if (rows.length) await db[name].bulkAdd(rows)
    }
  })
}

/**
 * Erases every row, then writes a single marker so the first-run defaults are
 * not immediately written back.
 */
export async function clearAll(db) {
  await db.transaction('rw', TABLES.map((name) => db[name]), async () => {
    for (const name of TABLES) await db[name].clear()
    await db.settings.add({ key: 'initialized', value: true })
  })
}
