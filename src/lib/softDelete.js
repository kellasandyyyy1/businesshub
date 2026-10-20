import { db } from '../db/db'

/**
 * Deletes that can be taken back.
 *
 * `remove` moves the row into the trash table in one transaction, so it is
 * gone from every list and total at once but still held on the device.
 * `restore` moves it back with the same id — links from other rows (a client,
 * the other half of a transfer) still point at it. `commit` lets it go for good.
 */
export async function remove(table, id) {
  return db.transaction('rw', db.table(table), db.trash, async () => {
    const row = await db.table(table).get(id)
    if (!row) return null
    const trashId = await db.trash.add({ table, row, deletedAt: new Date().toISOString() })
    await db.table(table).delete(id)
    return trashId
  })
}

export async function restore(trashId) {
  const entry = await db.trash.get(trashId)
  if (!entry) return false
  await db.transaction('rw', db.table(entry.table), db.trash, async () => {
    await db.table(entry.table).put(entry.row)
    await db.trash.delete(trashId)
  })
  return true
}

export async function commit(trashId) {
  await db.trash.delete(trashId)
}

/**
 * The whole pattern in one call: take the row out, offer Undo, and either put
 * it back or let it go when the window closes. A failed delete says so.
 *
 *   await removeWithUndo(toast, 'transactions', tx.id, 'Income deleted', 'Income restored')
 */
export async function removeWithUndo(toast, table, id, message, restoredMessage = 'Restored') {
  let trashId
  try {
    trashId = await remove(table, id)
  } catch {
    toast.error("Couldn't delete. Try again.")
    return false
  }
  if (trashId === null) return false

  toast.undo(
    message,
    async () => {
      try {
        if (await restore(trashId)) toast.info(restoredMessage)
      } catch {
        toast.error("Couldn't restore. Try again.")
      }
    },
    () => commit(trashId).catch(() => {}),
  )
  return true
}
