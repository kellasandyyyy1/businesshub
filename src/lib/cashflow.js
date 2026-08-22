import { balanceOf, effectiveStatus } from './invoice'
import { shiftDays } from './format'

export const LOW_CASH_THRESHOLD = 100_000

export const HORIZONS = [
  { id: '30d', label: '30d', days: 30 },
  { id: '60d', label: '60d', days: 60 },
  { id: '90d', label: '90d', days: 90 },
  { id: '6mo', label: '6mo', days: 182 },
  { id: '12mo', label: '12mo', days: 365 },
]

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const daysApart = (a, b) =>
  Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000)

/**
 * Finds expenses that behave like subscriptions: the same payee, a stable
 * amount, and a roughly monthly cadence. Three occurrences is the minimum that
 * can establish a rhythm rather than a coincidence.
 */
export function detectRecurring(transactions, today) {
  const groups = new Map()

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const key = tx.description.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tx)
  }

  const recurring = []

  for (const rows of groups.values()) {
    if (rows.length < 3) continue

    const dates = rows.map((r) => r.date).sort()
    const gaps = dates.slice(1).map((d, i) => daysApart(dates[i], d))
    const cadence = median(gaps)
    // Monthly means roughly 28–34 days between charges.
    if (cadence < 25 || cadence > 35) continue

    const amounts = rows.map((r) => r.amount)
    const typical = median(amounts)
    // A stable amount: every charge within 20% of the median.
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.2)) continue

    const last = dates[dates.length - 1]
    // A charge that stopped months ago is not upcoming.
    if (daysApart(last, today) > cadence * 2) continue

    recurring.push({
      description: rows[rows.length - 1].description,
      category: rows[0].category,
      amount: typical,
      cadence: Math.round(cadence),
      lastDate: last,
    })
  }

  return recurring
}

/**
 * Everything expected to move money between tomorrow and the horizon:
 * unpaid invoices at their due date, transactions still pending, and the
 * projected instalments of each detected recurring expense.
 */
export function buildEvents({ transactions, invoices, today, days }) {
  const horizon = shiftDays(today, days)
  const income = []
  const expenses = []

  for (const invoice of invoices) {
    const status = effectiveStatus(invoice, today)
    if (status === 'paid' || status === 'draft') continue
    const balance = balanceOf(invoice)
    if (balance <= 0) continue
    // An invoice already past due is expected as soon as possible, not in the
    // past, so overdue balances land on today.
    const date = invoice.dueDate < today ? today : invoice.dueDate
    if (date > horizon) continue
    income.push({
      date,
      description: `${invoice.invoiceNumber} · ${status === 'overdue' ? 'overdue' : 'due'}`,
      amount: balance,
      source: 'invoice',
    })
  }

  for (const tx of transactions) {
    if (tx.status !== 'pending') continue
    const date = tx.date < today ? today : tx.date
    if (date > horizon) continue
    const entry = { date, description: tx.description, amount: tx.amount, source: 'pending' }
    if (tx.type === 'income') income.push(entry)
    else if (tx.type === 'expense') expenses.push(entry)
  }

  for (const item of detectRecurring(transactions, today)) {
    let next = shiftDays(item.lastDate, item.cadence)
    while (next <= horizon) {
      if (next > today) {
        expenses.push({
          date: next,
          description: item.description,
          amount: item.amount,
          source: 'recurring',
        })
      }
      next = shiftDays(next, item.cadence)
    }
  }

  const byDate = (a, b) => a.date.localeCompare(b.date)
  return { income: income.sort(byDate), expenses: expenses.sort(byDate) }
}

/** Daily running balance from today to the horizon. */
export function buildProjection({ currentCash, income, expenses, today, days }) {
  const delta = new Map()
  for (const e of income) delta.set(e.date, (delta.get(e.date) ?? 0) + e.amount)
  for (const e of expenses) delta.set(e.date, (delta.get(e.date) ?? 0) - e.amount)

  const series = []
  let balance = currentCash
  for (let i = 0; i <= days; i += 1) {
    const date = shiftDays(today, i)
    balance += delta.get(date) ?? 0
    series.push({ date, balance })
  }
  return series
}
