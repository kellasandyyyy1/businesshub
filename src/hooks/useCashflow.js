import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { buildEvents, buildProjection } from '../lib/cashflow'

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

    // Everything below describes the same window the chart shows. The
    // headline once used a fixed 30 days beside a 90-day chart, so its figures
    // never added up to the line drawn under them.
    const expectedIncome = income.reduce((total, e) => total + e.amount, 0)
    const expectedExpenses = expenses.reduce((total, e) => total + e.amount, 0)
    // Months the cash lasts at the last 90 days' pace of spending — the same
    // burn the Insights page and the low-runway notice use.
    const from = new Date(Date.parse(`${today}T00:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10)
    const burn =
      cleared.filter((t) => t.type === 'expense' && t.date >= from && t.date <= today).reduce((total, t) => total + t.amount, 0) / 3
    const runwayMonths = burn > 0 ? Math.max(currentCash, 0) / burn : null

    const lowest = series.reduce((low, point) => (point.balance < low.balance ? point : low), series[0])

    return {
      today,
      currentCash,
      hasOpeningBalance,
      openingBalance: hasOpeningBalance ? Number(openingBalance) : 0,
      expectedIncome,
      expectedExpenses,
      projectedCash: series[series.length - 1]?.balance ?? currentCash,
      lowest,
      runwayMonths,
      income,
      expenses,
      series,
    }
  }, [days])
}

export default useCashflowData
