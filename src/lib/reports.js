/**
 * Report builders. Each returns a plain shape — `{ title, columns, lines }` —
 * so the table renderer and the CSV export read from exactly the same numbers.
 *
 * Line kinds:
 *   section  — a heading with no figures
 *   row      — an indented detail line
 *   subtotal — the sum of the rows above it
 *   total    — a single-hairline result (gross profit)
 *   grand    — the double-hairline bottom line (net profit)
 */

import { budgetWindow } from './budget'
import { formatMonth } from './format'

/**
 * The schema has no cost-of-sales flag, so delivery costs are identified by
 * category. Anything not listed here is an operating expense.
 */
export const COST_OF_SALES = ['Salaries & Contractors', 'Professional Services']

export const REPORT_TYPES = [
  { id: 'pl', label: 'Profit and Loss' },
  { id: 'expenses', label: 'Expense Report' },
  { id: 'revenue', label: 'Revenue Report' },
  { id: 'cashflow', label: 'Cash Flow Report' },
  { id: 'clients', label: 'Client Revenue' },
  { id: 'budgets', label: 'Budget Performance' },
  { id: 'monthly', label: 'Monthly Summary' },
]

const inRange = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to)

/** Category → total, largest first. */
function byCategory(rows, type) {
  const totals = new Map()
  for (const row of rows) {
    if (row.type !== type) continue
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

/** Calendar months spanned by the range, oldest first. */
function monthsBetween(from, to) {
  const months = []
  const cursor = new Date(`${from}T00:00:00Z`)
  cursor.setUTCDate(1)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const start = cursor.toISOString().slice(0, 10)
    const next = new Date(cursor)
    next.setUTCMonth(next.getUTCMonth() + 1)
    months.push({
      from: start,
      to: new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10),
      label: `${formatMonth(start)} ${start.slice(0, 4)}`,
    })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

const sum = (entries) => entries.reduce((total, [, amount]) => total + amount, 0)

/* ------------------------------------------------------------------------- */

function profitAndLoss(rows) {
  const revenue = byCategory(rows, 'income')
  const expenses = byCategory(rows, 'expense')
  const cogs = expenses.filter(([name]) => COST_OF_SALES.includes(name))
  const opex = expenses.filter(([name]) => !COST_OF_SALES.includes(name))

  const revenueTotal = sum(revenue)
  const cogsTotal = sum(cogs)
  const grossProfit = revenueTotal - cogsTotal
  const opexTotal = sum(opex)

  return {
    title: 'Profit and Loss',
    columns: ['Amount'],
    lines: [
      { kind: 'section', label: 'Revenue' },
      ...revenue.map(([label, amount]) => ({ kind: 'row', label, values: [amount] })),
      { kind: 'subtotal', label: 'Total revenue', values: [revenueTotal] },

      { kind: 'section', label: 'Cost of sales' },
      ...cogs.map(([label, amount]) => ({ kind: 'row', label, values: [amount] })),
      { kind: 'subtotal', label: 'Total cost of sales', values: [cogsTotal] },

      { kind: 'total', label: 'Gross profit', values: [grossProfit] },

      { kind: 'section', label: 'Operating expenses' },
      ...opex.map(([label, amount]) => ({ kind: 'row', label, values: [amount] })),
      { kind: 'subtotal', label: 'Total operating expenses', values: [opexTotal] },

      { kind: 'grand', label: 'Net profit', values: [grossProfit - opexTotal] },
    ],
  }
}

function categoryReport(rows, type, title, heading) {
  const entries = byCategory(rows, type)
  const total = sum(entries)

  return {
    title,
    columns: ['Amount', 'Share'],
    lines: [
      { kind: 'section', label: heading },
      ...entries.map(([label, amount]) => ({
        kind: 'row',
        label,
        values: [amount, total > 0 ? amount / total : 0],
        formats: ['currency', 'percent'],
      })),
      { kind: 'grand', label: `Total ${heading.toLowerCase()}`, values: [total, total > 0 ? 1 : 0], formats: ['currency', 'percent'] },
    ],
  }
}

function cashFlowReport(rows, from, to) {
  const months = monthsBetween(from, to)
  let inTotal = 0
  let outTotal = 0

  const lines = [{ kind: 'section', label: 'Money movement by month' }]
  for (const month of months) {
    const slice = inRange(rows, month.from, month.to)
    const moneyIn = slice.filter((r) => r.type === 'income').reduce((t, r) => t + r.amount, 0)
    const moneyOut = slice.filter((r) => r.type === 'expense').reduce((t, r) => t + r.amount, 0)
    inTotal += moneyIn
    outTotal += moneyOut
    lines.push({ kind: 'row', label: month.label, values: [moneyIn, moneyOut, moneyIn - moneyOut] })
  }
  lines.push({ kind: 'grand', label: 'Net movement', values: [inTotal, outTotal, inTotal - outTotal] })

  return { title: 'Cash Flow Report', columns: ['In', 'Out', 'Net'], lines }
}

function clientRevenue(rows, clients) {
  const byClient = new Map()
  for (const row of rows) {
    if (row.type !== 'income') continue
    const key = row.clientId ?? 'none'
    byClient.set(key, (byClient.get(key) ?? 0) + row.amount)
  }

  const named = [...byClient.entries()]
    .map(([id, amount]) => ({
      label: id === 'none' ? 'Unassigned income' : (clients.find((c) => c.id === id)?.company ?? `Client #${id}`),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  const total = named.reduce((t, c) => t + c.amount, 0)

  return {
    title: 'Client Revenue',
    columns: ['Revenue', 'Share'],
    lines: [
      { kind: 'section', label: 'Revenue by client' },
      ...named.map((c) => ({
        kind: 'row',
        label: c.label,
        values: [c.amount, total > 0 ? c.amount / total : 0],
        formats: ['currency', 'percent'],
      })),
      { kind: 'grand', label: 'Total revenue', values: [total, total > 0 ? 1 : 0], formats: ['currency', 'percent'] },
    ],
  }
}

function budgetPerformance(transactions, budgets, today) {
  const lines = [{ kind: 'section', label: 'Budgets against their own period' }]
  let budgeted = 0
  let spent = 0

  for (const budget of budgets) {
    const [from, to] = budgetWindow(budget.period, today)
    const used = inRange(transactions, from, to)
      .filter((t) => t.type === 'expense' && t.category === budget.category)
      .reduce((total, t) => total + t.amount, 0)
    budgeted += budget.amount
    spent += used
    lines.push({
      kind: 'row',
      label: `${budget.name} (${budget.period})`,
      values: [budget.amount, used, budget.amount - used],
    })
  }

  lines.push({ kind: 'grand', label: 'All budgets', values: [budgeted, spent, budgeted - spent] })

  return { title: 'Budget Performance', columns: ['Budgeted', 'Spent', 'Variance'], lines }
}

function monthlySummary(rows, from, to) {
  const months = monthsBetween(from, to)
  const lines = [{ kind: 'section', label: 'Month by month' }]
  let income = 0
  let expenses = 0

  for (const month of months) {
    const slice = inRange(rows, month.from, month.to)
    const monthIncome = slice.filter((r) => r.type === 'income').reduce((t, r) => t + r.amount, 0)
    const monthExpenses = slice.filter((r) => r.type === 'expense').reduce((t, r) => t + r.amount, 0)
    income += monthIncome
    expenses += monthExpenses
    lines.push({
      kind: 'row',
      label: month.label,
      values: [monthIncome, monthExpenses, monthIncome - monthExpenses],
    })
  }

  lines.push({ kind: 'grand', label: 'Period total', values: [income, expenses, income - expenses] })

  return { title: 'Monthly Summary', columns: ['Income', 'Expenses', 'Net'], lines }
}

/* ------------------------------------------------------------------------- */

export function buildReport(type, { transactions, clients, budgets, from, to, today }) {
  const rows = inRange(transactions, from, to)

  switch (type) {
    case 'expenses':
      return categoryReport(rows, 'expense', 'Expense Report', 'Expenses by category')
    case 'revenue':
      return categoryReport(rows, 'income', 'Revenue Report', 'Revenue by category')
    case 'cashflow':
      return cashFlowReport(rows, from, to)
    case 'clients':
      return clientRevenue(rows, clients)
    case 'budgets':
      return budgetPerformance(transactions, budgets, today)
    case 'monthly':
      return monthlySummary(rows, from, to)
    default:
      return profitAndLoss(rows)
  }
}

/** A report as CSV, with the same figures the table shows. */
export function reportToCsv(report, { from, to }) {
  const escape = (value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = [
    [report.title],
    [`${from} to ${to}`],
    [],
    ['Line', ...report.columns],
    ...report.lines.map((line) => [
      line.kind === 'row' ? `  ${line.label}` : line.label,
      ...(line.values ?? []).map((value, i) =>
        line.formats?.[i] === 'percent' ? `${(value * 100).toFixed(1)}%` : value,
      ),
    ]),
  ]

  return lines.map((row) => row.map(escape).join(',')).join('\n')
}

/** Hands the browser a file without a round trip to any server. */
export function downloadCsv(filename, csv) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
