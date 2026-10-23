import { db, putSetting } from '../db/db'
import { matchMethod, methodId, methodsFromSetting } from './paymentMethods'

/**
 * Reads and writes the one payment-method list, the `paymentMethods`
 * setting that Settings → Payment methods edits. The transaction form, the
 * assistant and the filters all use this; nothing keeps a second list.
 */

export async function readMethods() {
  const row = await db.settings.where('key').equals('paymentMethods').first()
  return methodsFromSetting(row?.value)
}

export const saveMethods = (list) => putSetting('paymentMethods', list)

/**
 * Adds a method by name. A name already on the list (ignoring case and
 * spaces) is not added again, the existing one comes back with `existed`.
 */
export async function addMethod(name) {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return { method: null, existed: false }
  const list = await readMethods()
  const existing = matchMethod(trimmed, list)
  if (existing) return { method: existing, existed: true }
  const method = { id: methodId(trimmed, list.map((m) => m.id)), name: trimmed, active: true }
  await saveMethods([...list, method])
  return { method, existed: false }
}

/**
 * Renames a method and refreshes the name snapshot on every transaction that
 * points at it, so exports and search read the new name too.
 */
export async function renameMethod(id, name) {
  const trimmed = String(name ?? '').trim()
  const list = await readMethods()
  const clash = matchMethod(trimmed, list)
  if (!trimmed || (clash && clash.id !== id)) return false
  await db.transaction('rw', db.settings, db.transactions, async () => {
    await saveMethods(list.map((m) => (m.id === id ? { ...m, name: trimmed } : m)))
    await db.transactions.where('paymentMethodId').equals(id).modify({ paymentMethod: trimmed })
  })
  return true
}

export { methodFields } from './paymentMethods'
