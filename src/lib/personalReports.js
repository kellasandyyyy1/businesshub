import { shiftDays } from './format'
import { groupTotals, monthKey, shiftMonths, sum } from './ledger'
import { netWorthSummary } from './netWorth'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * "August 2026". The shared formatMonth returns the three-letter mono label a
 * chart axis wants; a report heading is read as a sentence and needs the word.
 */
export function monthLabel(month) {
  const [year, m] = month.slice(0, 7).split('-')
  return (MONTH_NAMES[Number(m) - 1] ?? '') + ' ' + year
}

/* -------------------------------------------------------------------------
   Periods
   ------------------------------------------------------------------------- */

export const PERIOD_PRESETS = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3', label: 'Last 3 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
]

const firstOf = (month) => `${month}-01`
const lastOf = (month) => {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * The window a preset means, and the one before it.
 *
 * Every report compares against the previous stretch of the same length, so
 * the comparison is like for like — a 3-month window is measured against the
 * 3 months before it, not against last month.
 */
export function resolveReportPeriod(preset, today, custom = {}) {
  const month = today.slice(0, 7)

  let from
  let to
  let label

  switch (preset) {
    case 'last-month': {
      const prev = shiftMonths(firstOf(month), -1).slice(0, 7)
      from = firstOf(prev)
      to = lastOf(prev)
      label = monthLabel(from)
      break
    }
    case 'last-3': {
      from = firstOf(shiftMonths(firstOf(month), -2).slice(0, 7))
      to = today
      label = 'Last 3 months'
      break
    }
    case 'this-year': {
      from = `${today.slice(0, 4)}-01-01`
      to = today
      label = today.slice(0, 4)
      break
    }
    case 'custom': {
      from = custom.from || firstOf(month)
      to = custom.to || today
      label = 'Custom range'
      break
    }
    default: {
      from = firstOf(month)
      to = today
      label = monthLabel(from)
    }
  }

  // The previous window is the same number of days, ending the day before.
  const span = daysBetweenInclusive(from, to)
  const prevTo = shiftDays(from, -1)
  const prevFrom = shiftDays(prevTo, -(span - 1))

  return { from, to, label, prevFrom, prevTo, days: span }
}

export function daysBetweenInclusive(from, to) {
  const ms = new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)
  return Math.max(Math.round(ms / 86400000) + 1, 1)
}

const inWindow = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to)
const expensesOf = (rows) => rows.filter((r) => r.type === 'expense')
const incomeOf = (rows) => rows.filter((r) => r.type === 'income')

/** "↑ 12%", "↓ 8%", or "New" when there is nothing to compare against. */
export function deltaLabel(current, previous) {
  if (!previous) return current ? 'New' : '—'
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 0.5) return 'Level'
  return `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(0)}%`
}

/* -------------------------------------------------------------------------
   1. Spending summary
   ------------------------------------------------------------------------- */

export function spendingSummary(transactions = [], period) {
  const rows = expensesOf(inWindow(transactions, period.from, period.to))
  const previous = expensesOf(inWindow(transactions, period.prevFrom, period.prevTo))

  const total = sum(rows)
  const previousTotal = sum(previous)

  const byPrevious = new Map(
    groupTotals(previous, (r) => r.category ?? '', (k) => k).map((g) => [g.key, g.value]),
  )

  const categories = groupTotals(
    rows,
    (r) => r.category ?? '',
    (key) => key || 'Uncategorised',
  ).map((entry) => ({
    ...entry,
    previous: byPrevious.get(entry.key) ?? 0,
    delta: deltaLabel(entry.value, byPrevious.get(entry.key) ?? 0),
  }))

  // Grouping is case-insensitive, so the label comes back from a real row.
  const labels = new Map()
  for (const row of rows) {
    const key = (row.description ?? '').trim().toLowerCase()
    if (key && !labels.has(key)) labels.set(key, row.description.trim())
  }
  const counts = new Map()
  for (const row of rows) {
    const key = (row.description ?? '').trim().toLowerCase()
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const merchants = groupTotals(
    rows.filter((r) => (r.description ?? '').trim()),
    (r) => r.description.trim().toLowerCase(),
    (key) => labels.get(key) ?? key,
  )
    .slice(0, 5)
    .map((entry) => ({ ...entry, count: counts.get(entry.key) ?? 0 }))

  return {
    total,
    previousTotal,
    dailyAverage: total / period.days,
    delta: deltaLabel(total, previousTotal),
    categories,
    max: categories.length ? categories[0].value : 0,
    merchants,
  }
}

/* -------------------------------------------------------------------------
   2. Income breakdown
   ------------------------------------------------------------------------- */

export function incomeBreakdown(transactions = [], period) {
  const rows = incomeOf(inWindow(transactions, period.from, period.to))
  const total = sum(rows)

  const counts = new Map()
  for (const row of rows) {
    const key = row.category ?? ''
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const sources = groupTotals(
    rows,
    (r) => r.category ?? '',
    (key) => key || 'Uncategorised',
  ).map((entry) => ({ ...entry, count: counts.get(entry.key) ?? 0 }))

  return {
    total,
    sources,
    max: sources.length ? sources[0].value : 0,
    sourceCount: sources.length,
    largest: sources[0] ?? null,
  }
}

/** The last `count` months of a total, newest last, each against the one before. */
export function monthlySeries(transactions = [], today, type, count = 6) {
  const months = []
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(shiftMonths(`${today.slice(0, 7)}-01`, -i).slice(0, 7))
  }

  const totals = months.map((month) => {
    const rows = transactions.filter((r) => monthKey(r.date) === month && r.type === type)
    return { month, label: monthLabel(month), value: sum(rows), count: rows.length }
  })

  return totals.map((entry, i) => ({
    ...entry,
    delta: i === 0 ? '—' : deltaLabel(entry.value, totals[i - 1].value),
  }))
}

/* -------------------------------------------------------------------------
   3. Savings
   ------------------------------------------------------------------------- */

/**
 * The 50/30/20 buckets, keyed off the personal category list.
 *
 * A category the app does not know about falls into wants: it is the bucket
 * where an unclassified expense does the least damage to the reading, since
 * calling something a need it is not would flatter the result.
 */
export const BUDGET_BUCKETS = {
  needs: ['Housing', 'Food', 'Transport', 'Healthcare'],
  savings: ['Savings', 'Debt Payment'],
}

export const BUCKET_TARGETS = { needs: 50, wants: 30, savings: 20 }

export function bucketOf(category) {
  if (BUDGET_BUCKETS.needs.includes(category)) return 'needs'
  if (BUDGET_BUCKETS.savings.includes(category)) return 'savings'
  return 'wants'
}

export function savingsReport(transactions = [], period, today) {
  const rows = inWindow(transactions, period.from, period.to)
  const income = sum(incomeOf(rows))
  const expenses = sum(expensesOf(rows))
  const leftOver = income - expenses
  const saved = Math.max(leftOver, 0)

  const buckets = { needs: 0, wants: 0, savings: 0 }
  for (const row of expensesOf(rows)) buckets[bucketOf(row.category)] += Number(row.amount) || 0

  const share = (value) => (income > 0 ? (value / income) * 100 : null)

  // Rate per month over the last six, so an unusual month is visible as one.
  const incomeMonths = monthlySeries(transactions, today, 'income', 6)
  const expenseMonths = monthlySeries(transactions, today, 'expense', 6)
  const rateHistory = incomeMonths.map((entry, i) => {
    const spent = expenseMonths[i].value
    const net = entry.value - spent
    return {
      month: entry.month,
      label: entry.label,
      income: entry.value,
      expenses: spent,
      saved: Math.max(net, 0),
      deficit: net < 0,
      rate: entry.value > 0 ? Math.max((net / entry.value) * 100, 0) : null,
    }
  })

  return {
    income,
    expenses,
    saved,
    leftOver,
    savingsRate: income > 0 ? (saved / income) * 100 : null,
    buckets: ['needs', 'wants', 'savings'].map((id) => ({
      id,
      label: id === 'savings' ? 'Savings & debt' : id[0].toUpperCase() + id.slice(1),
      value: buckets[id],
      share: share(buckets[id]),
      target: BUCKET_TARGETS[id],
    })),
    rateHistory,
  }
}

/* -------------------------------------------------------------------------
   4. Monthly snapshot
   ------------------------------------------------------------------------- */

/** Weeks of a month as rows of 7 day cells, Monday first; blanks pad the ends. */
export function monthGrid(month, transactions = []) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const spentByDay = new Map()
  for (const row of transactions) {
    if (row.type !== 'expense' || monthKey(row.date) !== month) continue
    spentByDay.set(row.date, (spentByDay.get(row.date) ?? 0) + (Number(row.amount) || 0))
  }

  // getUTCDay is Sunday-first; the grid reads Monday-first.
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7

  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    cells.push({ date, day, spent: spentByDay.get(date) ?? 0 })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const peak = Math.max(...[...spentByDay.values()], 0)
  return { weeks, peak, daysInMonth }
}

export function monthlySnapshot(transactions = [], month) {
  const rows = transactions.filter((r) => monthKey(r.date) === month)
  const income = sum(incomeOf(rows))
  const expenses = sum(expensesOf(rows))

  return {
    month,
    label: monthLabel(month),
    income,
    expenses,
    saved: Math.max(income - expenses, 0),
    net: income - expenses,
    savingsRate: income > 0 ? (Math.max(income - expenses, 0) / income) * 100 : null,
    byIncomeCategory: groupTotals(incomeOf(rows), (r) => r.category ?? '', (k) => k || 'Uncategorised'),
    byExpenseCategory: groupTotals(expensesOf(rows), (r) => r.category ?? '', (k) => k || 'Uncategorised'),
    grid: monthGrid(month, transactions),
    rows,
  }
}

/* -------------------------------------------------------------------------
   5. Net worth over time
   ------------------------------------------------------------------------- */

/**
 * The running position, month by month.
 *
 * Each entry holds only its current value and the date it was last touched,
 * so a month's figure is every item stated on or before that month's end —
 * a running position rather than only what changed that month, which would
 * read as if everything else had vanished.
 */
export function netWorthHistory(items = [], today) {
  if (!items.length) return []

  const stamped = items.filter((i) => i.updatedAt)
  if (!stamped.length) return []

  const first = stamped.reduce((min, i) => (i.updatedAt < min ? i.updatedAt : min), stamped[0].updatedAt)
  const months = []
  let cursor = `${first.slice(0, 7)}-01`
  const end = `${today.slice(0, 7)}-01`
  while (cursor <= end && months.length < 60) {
    months.push(cursor.slice(0, 7))
    cursor = shiftMonths(cursor, 1)
  }

  let previous = null
  return months.map((month) => {
    const upTo = stamped.filter((i) => i.updatedAt.slice(0, 7) <= month)
    const { assets, liabilities, net } = netWorthSummary(upTo)
    const row = {
      month,
      label: monthLabel(month),
      assets,
      liabilities,
      net,
      change: previous === null ? null : net - previous,
    }
    previous = net
    return row
  })
}

/* -------------------------------------------------------------------------
   6. Recurring
   ------------------------------------------------------------------------- */

/** Adds the details the report shows on top of the shared detection. */
export function recurringDetail(recurring = [], transactions = []) {
  return recurring.map((item) => {
    const matches = transactions.filter(
      (r) => (r.description ?? '').trim().toLowerCase() === item.key,
    )
    const last = matches.reduce((latest, r) => (!latest || r.date > latest ? r.date : latest), null)
    return {
      ...item,
      category: matches[0]?.category ?? 'Uncategorised',
      lastCharged: last,
    }
  })
}

/* -------------------------------------------------------------------------
   7. Category deep dive
   ------------------------------------------------------------------------- */

export function categoryDeepDive(transactions = [], period, category, today) {
  const rows = inWindow(transactions, period.from, period.to)
    .filter((r) => r.type === 'expense' && r.category === category)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const total = sum(rows)
  const inCategory = transactions.filter((r) => r.type === 'expense' && r.category === category)

  return {
    category,
    total,
    count: rows.length,
    average: rows.length ? total / rows.length : 0,
    largest: rows.reduce((max, r) => ((Number(r.amount) || 0) > max ? Number(r.amount) : max), 0),
    rows,
    history: monthlySeries(inCategory, today, 'expense', 6),
  }
}

/* -------------------------------------------------------------------------
   Export shapes

   One place that says what each report looks like as a spreadsheet, so the
   CSV and the Excel file can never drift from each other.
   ------------------------------------------------------------------------- */

const pct = (value) => (value == null ? '' : Number(value.toFixed(1)))

export function reportExport(id, view, { period, symbol } = {}) {
  switch (id) {
    case 'income':
      return {
        columns: [
          { key: 'source', label: 'source' },
          { key: 'amount', label: 'amount', numeric: true },
          { key: 'percentage', label: 'percentage', numeric: true },
          { key: 'transaction_count', label: 'transaction_count', numeric: true },
        ],
        rows: view.sources.map((s) => ({
          source: s.name,
          amount: s.value,
          percentage: pct(s.share * 100),
          transaction_count: s.count,
        })),
      }

    case 'savings':
      return {
        columns: [
          { key: 'month', label: 'month' },
          { key: 'income', label: 'income', numeric: true },
          { key: 'expenses', label: 'expenses', numeric: true },
          { key: 'saved', label: 'saved', numeric: true },
          { key: 'savings_rate_pct', label: 'savings_rate_pct', numeric: true },
        ],
        rows: view.rateHistory.map((m) => ({
          month: m.label,
          income: m.income,
          expenses: m.expenses,
          saved: m.saved,
          savings_rate_pct: pct(m.rate),
        })),
      }

    case 'monthly':
      return {
        columns: [
          { key: 'date', label: 'date' },
          { key: 'description', label: 'description' },
          { key: 'category', label: 'category' },
          { key: 'amount', label: 'amount', numeric: true },
          { key: 'type', label: 'type' },
        ],
        rows: view.rows.map((r) => ({
          date: r.date,
          description: r.description,
          category: r.category,
          amount: r.amount,
          type: r.type,
        })),
      }

    case 'networth':
      return {
        columns: [
          { key: 'month', label: 'month' },
          { key: 'total_assets', label: 'total_assets', numeric: true },
          { key: 'total_liabilities', label: 'total_liabilities', numeric: true },
          { key: 'net_worth', label: 'net_worth', numeric: true },
          { key: 'change', label: 'change', numeric: true },
        ],
        rows: view.history.map((m) => ({
          month: m.label,
          total_assets: m.assets,
          total_liabilities: m.liabilities,
          net_worth: m.net,
          change: m.change ?? '',
        })),
      }

    case 'recurring':
      return {
        columns: [
          { key: 'name', label: 'name' },
          { key: 'category', label: 'category' },
          { key: 'monthly_cost', label: 'monthly_cost', numeric: true },
          { key: 'annual_cost', label: 'annual_cost', numeric: true },
          { key: 'last_charged', label: 'last_charged' },
        ],
        rows: view.items.map((r) => ({
          name: r.description,
          category: r.category,
          monthly_cost: Math.round(r.monthlyCost),
          annual_cost: Math.round(r.annualised),
          last_charged: r.lastCharged ?? '',
        })),
      }

    case 'category': {
      let running = 0
      return {
        columns: [
          { key: 'date', label: 'date' },
          { key: 'description', label: 'description' },
          { key: 'amount', label: 'amount', numeric: true },
          { key: 'running_total', label: 'running_total', numeric: true },
        ],
        // Oldest first, so the running total climbs the way it happened.
        rows: [...view.rows]
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map((r) => {
            running += Number(r.amount) || 0
            return {
              date: r.date,
              description: r.description,
              amount: r.amount,
              running_total: running,
            }
          }),
      }
    }

    default:
      return {
        columns: [
          { key: 'category', label: 'category' },
          { key: 'amount', label: 'amount', numeric: true },
          { key: 'percentage', label: 'percentage', numeric: true },
          { key: 'vs_last_period', label: 'vs_last_period' },
        ],
        rows: view.categories.map((c) => ({
          category: c.name,
          amount: c.value,
          percentage: pct(c.share * 100),
          vs_last_period: c.delta,
        })),
      }
  }
}

/** "dual-personal-spending-summary-august-2026-2026-08-25.csv" */
export function reportFilename(id, label, extension, today) {
  const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `dual-personal-${slug(id)}-${slug(label)}-${today}.${extension}`
}
