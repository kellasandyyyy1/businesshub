/**
 * Derives plain-language observations from the ledger. Every insight is
 * suppressed unless the data can actually support it — a single client is
 * always 100% of revenue, and that says nothing worth reading.
 *
 * Each returns `{ id, title, body, tag, severity }`. Severity only decides
 * ordering and which single insight earns the inverted tag.
 */

import { detectRecurring } from './cashflow'
import { balanceOf, effectiveStatus } from './invoice'
import { budgetWindow } from './budget'
import { daysBetween, formatCurrency, shiftDays } from './format'

const sumBy = (rows, type) =>
  rows.filter((r) => r.type === type).reduce((total, r) => total + r.amount, 0)

const between = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to)

const pct = (value) => `${Math.round(value * 100)}%`

/** Rolling 30-day windows, avoiding the distortion of a part-finished month. */
function windowPair(transactions, today) {
  const recentFrom = shiftDays(today, -29)
  const priorFrom = shiftDays(today, -59)
  return {
    recent: between(transactions, recentFrom, today),
    prior: between(transactions, priorFrom, shiftDays(recentFrom, -1)),
  }
}

/* ---- 1. Client concentration --------------------------------------------- */

function clientConcentration({ transactions, clients, money }) {
  const income = transactions.filter((t) => t.type === 'income')
  const total = income.reduce((sum, t) => sum + t.amount, 0)
  if (total <= 0) return null

  const byClient = new Map()
  for (const t of income) {
    if (!t.clientId) continue
    byClient.set(t.clientId, (byClient.get(t.clientId) ?? 0) + t.amount)
  }
  // With one paying client the figure is trivially 100% and tells you nothing.
  if (byClient.size < 2) return null

  const [topId, topAmount] = [...byClient.entries()].sort((a, b) => b[1] - a[1])[0]
  const share = topAmount / total
  if (share <= 0.35) return null

  const name = clients.find((c) => c.id === topId)?.company ?? 'One client'
  return {
    id: 'client-concentration',
    title: `${name} is ${pct(share)} of your income`,
    body: `Of the ${money(total)} that came in, ${money(topAmount)} came from ${name}. If that relationship paused, most of your income would pause with it. Winning one or two more clients of a similar size would spread the risk.`,
    tag: 'Concentration',
    severity: share > 0.5 ? 9 : 6,
  }
}

/* ---- 2. Expense spike ------------------------------------------------------ */

function expenseSpike({ transactions, today, money }) {
  const { recent, prior } = windowPair(transactions, today)

  const totalsFor = (rows) => {
    const map = new Map()
    for (const r of rows) {
      if (r.type !== 'expense') continue
      map.set(r.category, (map.get(r.category) ?? 0) + r.amount)
    }
    return map
  }

  const now = totalsFor(recent)
  const before = totalsFor(prior)

  let worst = null
  for (const [category, amount] of now) {
    const previous = before.get(category) ?? 0
    // Ignore small bases, where any change looks dramatic in percentage terms.
    if (previous < 3000) continue
    const change = (amount - previous) / previous
    if (change > 0.15 && (!worst || change > worst.change)) {
      worst = { category, amount, previous, change }
    }
  }
  if (!worst) return null

  return {
    id: 'expense-spike',
    // The window is a rolling 30 days, so the title says so rather than
    // implying a calendar month.
    title: `${worst.category} is up ${pct(worst.change)} in the last 30 days`,
    body: `You spent ${money(worst.amount)} on ${worst.category.toLowerCase()} in the last 30 days, against ${money(worst.previous)} in the 30 days before. Worth checking whether that is a one-off or the new normal.`,
    tag: 'Spending',
    severity: worst.change > 0.5 ? 7 : 5,
  }
}

/* ---- 3. Margin trend ------------------------------------------------------- */

function marginTrend({ transactions, today }) {
  const recent = between(transactions, shiftDays(today, -89), today)
  const prior = between(transactions, shiftDays(today, -179), shiftDays(today, -90))

  const marginOf = (rows) => {
    const income = sumBy(rows, 'income')
    return income > 0 ? (income - sumBy(rows, 'expense')) / income : null
  }

  const now = marginOf(recent)
  const before = marginOf(prior)
  if (now === null || before === null) return null

  const delta = now - before
  if (Math.abs(delta) < 0.03) return null

  const falling = delta < 0
  return {
    id: 'margin-trend',
    title: `You are keeping ${pct(Math.abs(delta))} ${falling ? 'less' : 'more'} of what you earn`,
    body: `Over the last three months you kept ${pct(now)} of your income after costs, against ${pct(before)} in the three months before that. ${
      falling
        ? 'Costs are growing faster than income — worth finding which ones moved.'
        : 'Income is outpacing costs, which is the direction you want.'
    }`,
    tag: 'Profitability',
    severity: falling ? 7 : 3,
  }
}

/* ---- 4. Invoice slowdown --------------------------------------------------- */

function paymentDays(invoices) {
  return invoices
    .filter((i) => i.paidAt && i.sentAt)
    .map((i) => ({
      paidAt: i.paidAt,
      days: daysBetween(i.sentAt.slice(0, 10), i.paidAt.slice(0, 10)),
    }))
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
}

function invoiceSlowdown({ invoices }) {
  const paid = paymentDays(invoices)
  // Two on each side of the split, or the comparison is noise.
  if (paid.length < 4) return null

  const half = Math.floor(paid.length / 2)
  const older = paid.slice(0, half)
  const newer = paid.slice(half)
  const average = (rows) => rows.reduce((total, r) => total + r.days, 0) / rows.length

  const now = Math.round(average(newer))
  const before = Math.round(average(older))
  const delta = now - before
  if (Math.abs(delta) < 3) return null

  const slower = delta > 0
  return {
    id: 'invoice-speed',
    title: `Clients are paying ${Math.abs(delta)} days ${slower ? 'slower' : 'faster'}`,
    body: `Your recent invoices took ${now} days to be paid, against ${before} days earlier on. ${
      slower
        ? 'Money arriving later means you carry costs for longer — a payment reminder a few days before the due date usually helps.'
        : 'That is money reaching you sooner, which takes pressure off everything else.'
    }`,
    tag: 'Getting paid',
    severity: slower ? 6 : 2,
  }
}

/* ---- 5. Cash runway -------------------------------------------------------- */

function cashRunway({ runwayMonths, currentCash, money }) {
  if (runwayMonths === null) return null

  const short = runwayMonths < 3
  return {
    id: 'runway',
    title: `Your cash covers about ${runwayMonths.toFixed(1)} months`,
    body: `You are holding ${money(currentCash)}. At your recent rate of spending, that would last roughly ${runwayMonths.toFixed(1)} months if nothing else came in. ${
      short
        ? 'That is thinner than the three months most advisers suggest keeping back.'
        : 'That is a comfortable buffer.'
    }`,
    tag: 'Runway',
    severity: short ? 10 : 3,
  }
}

/* ---- 6. Subscription creep -------------------------------------------------- */

function subscriptionCreep({ transactions, today, money }) {
  const recurring = detectRecurring(transactions, today)
  if (recurring.length === 0) return null

  let worst = null
  for (const item of recurring) {
    const history = transactions
      .filter((t) => t.description.trim().toLowerCase() === item.description.trim().toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date))
    if (history.length < 3) continue

    const first = history[0].amount
    const last = history[history.length - 1].amount
    if (first <= 0) continue
    const change = (last - first) / first
    if (change > 0.1 && (!worst || change > worst.change)) {
      worst = { ...item, first, last, change }
    }
  }

  const monthlyTotal = recurring.reduce((total, r) => total + r.amount, 0)

  if (!worst) {
    return {
      id: 'subscriptions',
      title: `${recurring.length} regular payments cost you ${money(monthlyTotal)} a month`,
      body: `These repeat every month whether or not you use them: ${recurring
        .map((r) => r.description)
        .slice(0, 3)
        .join(', ')}${recurring.length > 3 ? ', and others' : ''}. That is ${money(monthlyTotal * 12)} a year committed before you do anything else.`,
      tag: 'Recurring',
      severity: 4,
    }
  }

  return {
    id: 'subscriptions',
    title: `${worst.description} has crept up ${pct(worst.change)}`,
    body: `It started at ${money(worst.first)} and now costs ${money(worst.last)} each time. Across all ${recurring.length} of your regular payments you are committed to ${money(monthlyTotal)} a month before any other spending.`,
    tag: 'Recurring',
    severity: 6,
  }
}

/* ---- 7. Top revenue source --------------------------------------------------- */

function topRevenueSource({ transactions, money }) {
  const income = transactions.filter((t) => t.type === 'income')
  const total = income.reduce((sum, t) => sum + t.amount, 0)
  if (total <= 0) return null

  const byCategory = new Map()
  for (const t of income) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  if (byCategory.size < 2) return null

  const [category, amount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    id: 'top-source',
    title: `${category} brings in most of your money`,
    body: `${money(amount)} of your ${money(total)} income came from ${category.toLowerCase()} — ${pct(amount / total)} of the total. It is the part of the business worth protecting first.`,
    tag: 'Revenue',
    severity: 2,
  }
}

/* ---- 8. Budget burn rate ------------------------------------------------------ */

function budgetBurn({ transactions, budgets, today, money }) {
  const overspending = []

  for (const budget of budgets) {
    const [from, to] = budgetWindow(budget.period, today)
    const spent = between(transactions, from, to)
      .filter((t) => t.type === 'expense' && t.category === budget.category)
      .reduce((total, t) => total + t.amount, 0)

    const length = daysBetween(from, to) + 1
    const elapsed = Math.min(daysBetween(from, today) + 1, length)
    if (elapsed < 5 || budget.amount <= 0) continue

    const projected = (spent / elapsed) * length
    if (projected > budget.amount * 1.05) {
      overspending.push({ ...budget, spent, projected, over: projected - budget.amount })
    }
  }

  if (overspending.length === 0) return null
  const worst = overspending.sort((a, b) => b.over - a.over)[0]

  return {
    id: 'budget-burn',
    title: `${worst.name} is on course to go over by ${money(worst.over)}`,
    body: `You have spent ${money(worst.spent)} of the ${money(worst.amount)} set aside. At the pace so far you would finish the ${worst.period.replace('ly', '')} at about ${money(worst.projected)}${overspending.length > 1 ? `, and ${overspending.length - 1} other budget${overspending.length > 2 ? 's are' : ' is'} heading the same way` : ''}.`,
    tag: 'Budgets',
    severity: 8,
  }
}

/* ------------------------------------------------------------------------------ */

export function buildInsights({ transactions, invoices, clients, budgets, currentCash, today, symbol }) {
  const money = (value) => formatCurrency(value, symbol)

  // Recent burn drives both the runway insight and the stat strip.
  const last90 = between(transactions, shiftDays(today, -89), today)
  const monthlyBurn = sumBy(last90, 'expense') / 3
  const runwayMonths = monthlyBurn > 0 ? currentCash / monthlyBurn : null

  const context = { transactions, invoices, clients, budgets, today, money, currentCash, runwayMonths }

  const insights = [
    clientConcentration(context),
    budgetBurn(context),
    cashRunway(context),
    expenseSpike(context),
    marginTrend(context),
    invoiceSlowdown(context),
    subscriptionCreep(context),
    topRevenueSource(context),
  ].filter(Boolean)

  insights.sort((a, b) => b.severity - a.severity)

  // At most one inverted tag on the page, and only when it is genuinely urgent.
  const insightsWithPriority = insights.map((insight, index) => ({
    ...insight,
    priority: index === 0 && insight.severity >= 7,
  }))

  const paid = paymentDays(invoices)
  const avgPaymentDays = paid.length
    ? Math.round(paid.reduce((total, p) => total + p.days, 0) / paid.length)
    : null

  const expenseTotals = new Map()
  for (const t of last90) {
    if (t.type !== 'expense') continue
    expenseTotals.set(t.category, (expenseTotals.get(t.category) ?? 0) + t.amount)
  }
  const topExpense = [...expenseTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  const outstanding = invoices
    .filter((i) => !['paid', 'draft'].includes(effectiveStatus(i, today)))
    .reduce((total, i) => total + balanceOf(i), 0)

  return {
    insights: insightsWithPriority,
    stats: {
      avgPaymentDays,
      topExpenseCategory: topExpense ? topExpense[0] : null,
      topExpenseAmount: topExpense ? topExpense[1] : 0,
      runwayMonths,
      outstanding,
    },
  }
}
