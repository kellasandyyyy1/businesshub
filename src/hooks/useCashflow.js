import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { buildEvents, buildProjection } from '../lib/cashflow'
import { shiftDays } from '../lib/format'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/**
 * Cash today, what is expected to land, and the balance that follows.
 *
 * Current cash is the opening balance the user sets in settings plus every
 * cleared movement since — with no opening balance recorded, it is the ledger
 * movement alone and the page says so.
 */
export function useCashflowData(days) {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [transactions, invoices, settings] = await Promise.all([
      db.transactions.filter(inProfile).toArray(),
      db.invoices.filter(inProfile).toArray(),
      db.settings.toArray(),
    ])

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const openingBalance = settingsMap.openingBalance
    const hasOpeningBalance = openingBalance !== undefined && openingBalance !== null

    const cleared = transactions.filter(
      (t) => t.status === 'cleared' && (t.type === 'income' || t.type === 'expense'),
    )
    const movement = cleared.reduce(
      (total, t) => total + (t.type === 'income' ? t.amount : -t.amount),
      0,
    )
    const currentCash = (hasOpeningBalance ? Number(openingBalance) : 0) + movement

    const { income, expenses } = buildEvents({ transactions, invoices, today, days })
    const series = buildProjection({ currentCash, income, expenses, today, days })

    // The headline "expected" figures always describe the next 30 days,
    // whatever horizon the chart is showing.
    const in30 = shiftDays(today, 30)
    const expectedIncome = income
      .filter((e) => e.date <= in30)
      .reduce((total, e) => total + e.amount, 0)
    const expectedExpenses = expenses
      .filter((e) => e.date <= in30)
      .reduce((total, e) => total + e.amount, 0)

    return {
      today,
      currentCash,
      hasOpeningBalance,
      openingBalance: hasOpeningBalance ? Number(openingBalance) : 0,
      expectedIncome,
      expectedExpenses,
      projectedCash: currentCash + expectedIncome - expectedExpenses,
      income,
      expenses,
      series,
    }
  }, [days])
}

export default useCashflowData
