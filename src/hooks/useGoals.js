import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { SAVINGS_CATEGORY } from '../db/categoryData'
import { getGoals } from '../db/queries'

/**
 * The personal profile's goals, newest first.
 *
 * Goals belong to the personal side only — a business saves through budgets and
 * cash flow — so this does not take a profile the way the shared hooks do.
 */
export function useGoals() {
  return useLiveQuery(async () => {
    const goals = await getGoals('personal')
    return goals.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [])
}

/**
 * Records money put towards a goal.
 *
 * Two writes that have to agree, so they share one transaction: the goal moves
 * forward and the ledger gains the contribution. Saving is spending as far as
 * the month is concerned — the money has left the pot the household spends
 * from — which is why it lands as an expense under Savings.
 *
 * `date` defaults to today; the assistant passes the day the person named.
 *
 * The amount is stored unsigned. Every expense in this database is, and the
 * minus is added when one is displayed; a negative here would subtract from
 * the spending totals instead of adding to them.
 */
export async function contributeToGoal(goal, amount, date) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return

  await db.transaction('rw', db.goals, db.transactions, async () => {
    const row = await db.goals.get(goal.id)
    if (!row) return

    await db.goals.update(goal.id, { current: (Number(row.current) || 0) + value })

    await db.transactions.add({
      date: date || new Date().toISOString().slice(0, 10),
      description: `Saved for ${row.name}`,
      amount: value,
      type: 'expense',
      category: SAVINGS_CATEGORY,
      status: 'cleared',
      paymentMethod: '',
      notes: '',
      clientId: null,
      profile: 'personal',
      createdAt: new Date().toISOString(),
    })
  })
}

export default useGoals
