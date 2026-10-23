import { daysBetween, formatDayMonth, formatMonth, shiftDays } from './format'

/**
 * Period maths shared by the ledger pages.
 *
 * Pure functions only, a page hands in rows read from Dexie and gets back
 * numbers. Nothing here touches the database or the DOM, and nothing here knows
 * whether the money was coming in or going out.
 */

/** How many days each period switcher option covers. */
export const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }

/**
 * The window a period covers, plus the equally long window before it that the
 * change badges compare against.
 */
export function periodBounds(periodId, today) {
  const days = PERIOD_DAYS[periodId] ?? PERIOD_DAYS['30d']
  const from = shiftDays(today, -(days - 1))
  return {
    days,
    from,
    to: today,
    prevFrom: shiftDays(from, -days),
    prevTo: shiftDays(from, -1),
  }
}

export const inRange = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to)

export const sum = (rows) => rows.reduce((total, r) => total + (Number(r.amount) || 0), 0)

/* ---- Chart buckets ---------------------------------------------------------- */

/** Days for a week, months for a year, the bar count stays readable either way. */
const BUCKETING = { '7d': 'day', '30d': 'week', '90d': 'week', '12m': 'month' }

/** First day of the month `n` months before `iso`. */
export function shiftMonths(iso, n) {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

export const monthKey = (iso) => iso.slice(0, 7)

/**
 * One bar per bucket, oldest first. Buckets are built from the calendar rather
 * than from the data, so a quiet week still shows as a gap instead of vanishing.
 */
export function buildSeries(rows, periodId, { from, to }) {
  const mode = BUCKETING[periodId] ?? 'week'

  if (mode === 'day') {
    const out = []
    for (let d = from; d <= to; d = shiftDays(d, 1)) {
      out.push({
        key: d,
        label: formatDayMonth(d),
        value: sum(rows.filter((r) => r.date === d)),
      })
    }
    return out
  }

  if (mode === 'month') {
    const start = shiftMonths(to, -11)
    const out = []
    for (let i = 0; i < 12; i += 1) {
      const monthStart = shiftMonths(start, i)
      const key = monthKey(monthStart)
      out.push({
        key,
        label: formatMonth(monthStart),
        value: sum(rows.filter((r) => monthKey(r.date) === key)),
      })
    }
    return out
  }

  // Weekly: anchor the last bucket on `to` so the newest bar is always a full
  // week ending today, and walk backwards from there.
  const span = daysBetween(from, to) + 1
  const weeks = Math.ceil(span / 7)
  const out = []
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = shiftDays(to, -7 * i)
    // The oldest bucket is a part-week; labelling it with a date before the
    // period began would claim a range the figures do not cover.
    const start = i === weeks - 1 ? from : shiftDays(end, -6)
    out.push({
      key: start,
      label: formatDayMonth(start),
      value: sum(inRange(rows, start, end)),
    })
  }
  return out
}

/* ---- Breakdowns ------------------------------------------------------------- */

/**
 * Totals per group, largest first, each with its share of the whole. `label`
 * resolves the key to something readable, a client id becomes a name.
 */
export function groupTotals(rows, keyOf, labelOf) {
  const totals = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    totals.set(key, (totals.get(key) ?? 0) + (Number(row.amount) || 0))
  }

  const total = [...totals.values()].reduce((a, b) => a + b, 0)
  return [...totals.entries()]
    .map(([key, value]) => ({
      key,
      name: labelOf(key),
      value,
      share: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value)
}


/**
 * How the monthly figure was arrived at. On a window shorter than a month it
 * is a pace, not a month actually earned, and the caption has to say so.
 */
export function monthlyCaption(period) {
  if (period.days < 30) return `a month at this ${period.name} pace`
  if (period.days > 31) return `average month over ${period.name}`
  return `the last ${period.name}`
}
