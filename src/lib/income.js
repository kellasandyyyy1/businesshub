import { PERIOD_DAYS, groupTotals, monthKey, sum } from './ledger'

/**
 * Income-specific derivations. The period maths lives in ./ledger.
 */

/* ---- Recurring revenue ------------------------------------------------------ */

/** A client is the strongest signal of a repeat source; otherwise the wording is. */
const recurringKey = (row) =>
  row.clientId ? `client:${row.clientId}` : `desc:${row.description?.trim().toLowerCase() ?? ''}`

/**
 * Which sources bill on a repeating cycle.
 *
 * A source counts as recurring once it appears in two consecutive calendar
 * months. That has to be judged against the whole history, not just the window
 * on screen, a 7-day period can never contain two months, so scoping the test
 * to the visible rows would report zero recurring revenue on every short period.
 */
export function recurringKeys(allIncome) {
  const months = new Map()
  for (const row of allIncome) {
    const key = recurringKey(row)
    if (!months.has(key)) months.set(key, new Set())
    months.get(key).add(monthKey(row.date))
  }

  const recurring = new Set()
  for (const [key, set] of months) {
    const sorted = [...set].sort()
    for (let i = 1; i < sorted.length; i += 1) {
      const [ay, am] = sorted[i - 1].split('-').map(Number)
      const [by, bm] = sorted[i].split('-').map(Number)
      if (by * 12 + bm - (ay * 12 + am) === 1) {
        recurring.add(key)
        break
      }
    }
  }
  return recurring
}

export const isRecurring = (row, keys) => keys.has(recurringKey(row))

/* ---- Metrics ---------------------------------------------------------------- */

/**
 * The four cards. `allIncome` is the full history, needed only to judge which
 * sources recur; every figure returned describes the selected period.
 */
export function incomeMetrics({ rows, previousRows, allIncome, clientName, periodId }) {
  const total = sum(rows)
  const previousTotal = sum(previousRows)

  const days = PERIOD_DAYS[periodId] ?? PERIOD_DAYS['30d']
  // Revenue divided by the months the window spans. On a period shorter than a
  // month that is a monthly run rate rather than a month actually earned, the
  // card's "monthly avg" caption is what tells the two apart.
  const months = days / 30.44
  const average = total / months
  const previousAverage = previousTotal / months

  // The strongest single source, whichever way the money arrives: a named
  // client if there is one, otherwise the category.
  const bySource = groupTotals(
    rows,
    (r) => (r.clientId ? `client:${r.clientId}` : `category:${r.category ?? ''}`),
    (key) => {
      const [kind, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      return kind === 'client' ? clientName(Number(value)) : value || 'Uncategorised'
    },
  )
  const top = bySource[0] ?? null

  const keys = recurringKeys(allIncome)
  const recurringTotal = sum(rows.filter((r) => isRecurring(r, keys)))

  return {
    total,
    previousTotal,
    average,
    previousAverage,
    topSource: top ? top.name : null,
    topSourceShare: top ? top.share : 0,
    recurringTotal,
    recurringShare: total > 0 ? recurringTotal / total : 0,
  }
}
