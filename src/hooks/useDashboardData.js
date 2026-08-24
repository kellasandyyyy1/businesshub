import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { usePeriod } from '../context/PeriodContext'
import { PERIOD_WORD, budgetWindow } from '../lib/budget'
import { daysBetween, formatDayMonth, formatMonth, shiftDays } from '../lib/format'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

const sumBy = (rows, type) =>
  rows.filter((r) => r.type === type).reduce((total, r) => total + r.amount, 0)

/** Transfers move money between our own accounts — never revenue or spend. */
const isOperating = (r) => r.type === 'income' || r.type === 'expense'

/**
 * Bucket granularity follows the period so the chart always has something to
 * compare: days over a week, weeks over a month, months over a quarter or year.
 */
function bucketPlan(periodId) {
  if (periodId === '7d') return { unit: 'day', size: 1 }
  if (periodId === '30d') return { unit: 'week', size: 7 }
  return { unit: 'month', months: periodId === '90d' ? 4 : 12 }
}

/** First day of the month `n` months before `iso`. */
function monthStart(iso, offset = 0) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 10)
}

/** Inclusive [from, to] windows covering the period, oldest first. */
function buildBuckets(periodId, startDate, endDate) {
  const plan = bucketPlan(periodId)
  const buckets = []

  if (plan.unit === 'month') {
    // Exactly N whole months back from today — anchoring on the window start
    // would spill into a thirteenth bucket labelled the same as the first.
    let cursor = monthStart(endDate, -(plan.months - 1))
    while (cursor <= endDate) {
      const next = monthStart(cursor, 1)
      buckets.push({
        // The first month is clipped to the window so the bars cover exactly
        // the period the metrics above them describe.
        from: cursor < startDate ? startDate : cursor,
        to: shiftDays(next, -1),
        label: formatMonth(cursor),
      })
      cursor = next
    }
    return buckets
  }

  const span = daysBetween(startDate, endDate)
  for (let offset = 0; offset <= span; offset += plan.size) {
    const from = shiftDays(startDate, offset)
    const to = shiftDays(from, plan.size - 1)
    buckets.push({
      from,
      to: to > endDate ? endDate : to,
      label: formatDayMonth(from),
    })
  }
  return buckets
}

/* -------------------------------------------------------------------------
   Business health — four weighted signals, all derived from real rows
   ------------------------------------------------------------------------- */

function healthScore({ revenue, expenses, overdueAmount, outstandingAmount, budgetUse, runwayMonths }) {
  const margin = revenue > 0 ? (revenue - expenses) / revenue : 0
  // A 30% net margin scores full marks; a loss scores nothing.
  const marginScore = Math.max(0, Math.min(1, margin / 0.3)) * 40

  // What share of what we are owed is late.
  const lateShare = outstandingAmount > 0 ? overdueAmount / outstandingAmount : 0
  const collectionScore = (1 - lateShare) * 25

  // Budget use above 1.0 is overspend; 0.8 or below is full marks.
  const budgetScore = Math.max(0, Math.min(1, (1.2 - budgetUse) / 0.4)) * 20

  // Three months of cover is full marks.
  const runwayScore = Math.max(0, Math.min(1, runwayMonths / 3)) * 15

  const score = Math.round(marginScore + collectionScore + budgetScore + runwayScore)

  const parts = [
    { key: 'margin', got: marginScore, max: 40 },
    { key: 'collection', got: collectionScore, max: 25 },
    { key: 'budget', got: budgetScore, max: 20 },
    { key: 'runway', got: runwayScore, max: 15 },
  ]
  const weakest = parts.sort((a, b) => a.got / a.max - b.got / b.max)[0]

  const advice = {
    margin:
      margin > 0
        ? `Net margin is ${(margin * 100).toFixed(0)}% — trim recurring spend to widen it.`
        : 'Spending outran income this period — review the largest expenses first.',
    collection: `${(lateShare * 100).toFixed(0)}% of your receivables are past due — chase those invoices.`,
    budget:
      budgetUse > 1
        ? `You are ${((budgetUse - 1) * 100).toFixed(0)}% over budget — rebalance before month end.`
        : 'Budget use is close to the line — watch the next few expenses.',
    runway: `Cash covers about ${runwayMonths.toFixed(1)} months of spend — build a deeper reserve.`,
  }

  let label = 'At risk'
  if (score >= 80) label = 'Healthy'
  else if (score >= 60) label = 'Steady'
  else if (score >= 40) label = 'Watch'

  return { score, label, recommendation: advice[weakest.key] }
}

/* -------------------------------------------------------------------------
   The hook
   ------------------------------------------------------------------------- */

export function useDashboardData() {
  const { period, startDate, endDate } = usePeriod()

  return useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const span = daysBetween(startDate, endDate)
    const prevStart = shiftDays(startDate, -(span + 1))
    const prevEnd = shiftDays(startDate, -1)

    const [current, previous, earlier, invoices, budgets, categories, recent] = await Promise.all([
      db.transactions.where('date').between(startDate, endDate, true, true).filter(inProfile).toArray(),
      db.transactions.where('date').between(prevStart, prevEnd, true, true).filter(inProfile).toArray(),
      // Everything up to the start of the window, for the opening balance.
      db.transactions.where('date').below(startDate).filter(inProfile).toArray(),
      db.invoices.filter(inProfile).toArray(),
      db.budgets.filter(inProfile).toArray(),
      db.categories.filter(inProfile).toArray(),
      db.transactions.orderBy('date').reverse().filter(inProfile).limit(8).toArray(),
    ])

    const revenue = sumBy(current, 'income')
    const expenses = sumBy(current, 'expense')
    const prevRevenue = sumBy(previous, 'income')
    const prevExpenses = sumBy(previous, 'expense')

    // Cash on hand counts only what has actually cleared.
    const cleared = (rows) => rows.filter((r) => r.status === 'cleared' && isOperating(r))
    const openingBalance =
      sumBy(cleared(earlier), 'income') - sumBy(cleared(earlier), 'expense')
    const cashBalance =
      openingBalance + sumBy(cleared(current), 'income') - sumBy(cleared(current), 'expense')

    // ---- Chart series -----------------------------------------------------
    const series = buildBuckets(period.id, startDate, endDate).map((bucket) => {
      const rows = current.filter((r) => r.date >= bucket.from && r.date <= bucket.to)
      return { label: bucket.label, revenue: sumBy(rows, 'income'), expenses: sumBy(rows, 'expense') }
    })

    // ---- Receivables ------------------------------------------------------
    const openInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft')
    const overdueInvoices = openInvoices
      .filter((i) => i.status === 'overdue' || i.dueDate < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const outstandingAmount = openInvoices.reduce((t, i) => t + i.total, 0)
    const overdueAmount = overdueInvoices.reduce((t, i) => t + i.total, 0)

    // ---- Budgets ----------------------------------------------------------
    const budgetStatus = await Promise.all(
      budgets.map(async (budget) => {
        const [from, to] = budgetWindow(budget.period, today)
        const rows = await db.transactions.where('date').between(from, to, true, true).filter(inProfile).toArray()
        const spent = rows
          .filter((r) => r.type === 'expense' && r.category === budget.category)
          .reduce((t, r) => t + r.amount, 0)
        return { ...budget, spent, use: budget.amount > 0 ? spent / budget.amount : 0 }
      }),
    )
    const strained = budgetStatus
      .filter((b) => b.use >= 0.9)
      .sort((a, b) => b.use - a.use)

    const totalBudget = budgetStatus.reduce((t, b) => t + b.amount, 0)
    const totalBudgetSpend = budgetStatus.reduce((t, b) => t + b.spent, 0)

    // ---- Attention list ---------------------------------------------------
    const pending = current.filter((r) => r.status === 'pending')
    const attention = [
      ...overdueInvoices.slice(0, 2).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        kind: 'invoice',
        title: `${invoice.invoiceNumber} is overdue`,
        amount: invoice.total,
        detail: `${daysBetween(invoice.dueDate, today)} days past due`,
        to: '/invoices',
      })),
      ...strained.slice(0, 2).map((budget) => ({
        id: `budget-${budget.id}`,
        kind: 'budget',
        title: `${budget.name} at ${(budget.use * 100).toFixed(0)}% of budget`,
        amount: budget.spent,
        detail: PERIOD_WORD[budget.period],
        budgetAmount: budget.amount,
        to: '/budgets',
      })),
      ...(pending.length
        ? [
            {
              id: 'pending',
              kind: 'pending',
              title: `${pending.length} transaction${pending.length > 1 ? 's' : ''} not cleared`,
              amount: pending.reduce((t, r) => t + r.amount, 0),
              detail: 'still pending',
              to: '/transactions',
            },
          ]
        : []),
    ].slice(0, 4)

    // ---- Health -----------------------------------------------------------
    const monthlyBurn = span > 0 ? (expenses / span) * 30 : expenses
    const health = healthScore({
      revenue,
      expenses,
      overdueAmount,
      outstandingAmount,
      budgetUse: totalBudget > 0 ? totalBudgetSpend / totalBudget : 0,
      runwayMonths: monthlyBurn > 0 ? cashBalance / monthlyBurn : 3,
    })

    const categoryIcons = Object.fromEntries(categories.map((c) => [c.name, c.icon]))

    return {
      metrics: {
        cashBalance,
        prevCashBalance: openingBalance,
        revenue,
        prevRevenue,
        expenses,
        prevExpenses,
        netProfit: revenue - expenses,
        prevNetProfit: prevRevenue - prevExpenses,
      },
      series,
      health,
      attention,
      recent,
      categoryIcons,
      overdueCount: overdueInvoices.length,
    }
  }, [period.id, startDate, endDate])
}

export default useDashboardData
