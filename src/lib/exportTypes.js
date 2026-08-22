/**
 * The nine export shapes. Each builder takes the raw Dexie tables plus the
 * resolved period and returns `{ columns, rows }`.
 *
 * Amounts are plain numbers throughout — the preview adds a currency symbol,
 * the file never does, so a spreadsheet can sum the column.
 */

import { COST_OF_SALES } from './reports'
import { budgetWindow } from './budget'
import { balanceOf, effectiveStatus, issueDateOf } from './invoice'
import { daysBetween, shiftDays } from './format'

export const GROUPINGS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
]

export const EXPORT_TYPES = [
  { id: 'transaction-log', label: 'Transaction Log', blurb: 'Every transaction in the selected period, one row each.', columns: true },
  { id: 'income-summary', label: 'Income Summary', blurb: 'Revenue grouped by category and client.', grouping: true },
  { id: 'expense-summary', label: 'Expense Summary', blurb: 'Spending grouped by category.', grouping: true },
  { id: 'profit-and-loss', label: 'Profit and Loss', blurb: 'Revenue minus expenses, structured by month.' },
  { id: 'invoice-report', label: 'Invoice Report', blurb: 'All invoices with status, client, and amounts.' },
  { id: 'client-revenue', label: 'Client Revenue', blurb: 'Revenue per client broken down by period.', grouping: true },
  { id: 'budget-vs-actual', label: 'Budget vs Actual', blurb: 'Each budget vs real spending for the period.' },
  { id: 'weekly-digest', label: 'Weekly Digest', blurb: 'One row per week: income, expenses, net, top category.', defaultGrouping: 'week' },
  { id: 'monthly-digest', label: 'Monthly Digest', blurb: 'One row per month: income, expenses, net, top category.' },
]

export const TRANSACTION_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'type', label: 'Type' },
  { key: 'client', label: 'Client' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
]

/* ---- helpers -------------------------------------------------------------- */

const round = (n) => Math.round((Number(n) || 0) * 100) / 100
const inRange = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to)
const sumBy = (rows, type) =>
  rows.filter((r) => r.type === type).reduce((total, r) => total + r.amount, 0)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Bucket key and display label for a date under the chosen grouping. */
function bucketOf(date, grouping) {
  const [y, m, d] = date.split('-')
  switch (grouping) {
    case 'day':
      return { key: date, label: date }
    case 'week': {
      const dt = new Date(`${date}T00:00:00Z`)
      const start = shiftDays(date, -((dt.getUTCDay() + 6) % 7))
      return { key: start, label: `Week of ${start}` }
    }
    case 'quarter': {
      const q = Math.floor((Number(m) - 1) / 3) + 1
      return { key: `${y}-Q${q}`, label: `${y} Q${q}` }
    }
    case 'year':
      return { key: y, label: y }
    default:
      return { key: `${y}-${m}`, label: `${MONTHS[Number(m) - 1]} ${y}`, day: d }
  }
}

/** Ordered buckets present in the data, oldest first. */
function bucketsIn(rows, grouping) {
  const seen = new Map()
  for (const row of rows) {
    const b = bucketOf(row.date, grouping)
    if (!seen.has(b.key)) seen.set(b.key, b.label)
  }
  return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

const topBy = (rows, field) => {
  const totals = new Map()
  for (const r of rows) totals.set(r[field], (totals.get(r[field]) ?? 0) + r.amount)
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? top[0] : ''
}

/* ---- builders ------------------------------------------------------------- */

function transactionLog({ transactions, clientsById, from, to, columns }) {
  const chosen = TRANSACTION_COLUMNS.filter((c) => columns.includes(c.key))
  const rows = inRange(transactions, from, to)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      description: t.description,
      category: t.category,
      amount: round(t.amount),
      type: t.type,
      client: t.clientId ? (clientsById[t.clientId]?.company ?? '') : '',
      paymentMethod: t.paymentMethod ?? '',
      status: t.status,
      notes: t.notes ?? '',
    }))
  return { columns: chosen, rows }
}

function incomeSummary({ transactions, clientsById, from, to, grouping }) {
  const scoped = inRange(transactions, from, to).filter((t) => t.type === 'income')
  const rows = []

  for (const [key, label] of bucketsIn(scoped, grouping)) {
    const slice = scoped.filter((t) => bucketOf(t.date, grouping).key === key)
    const categories = [...new Set(slice.map((t) => t.category))]
    for (const category of categories) {
      const forCategory = slice.filter((t) => t.category === category)
      const named = forCategory
        .filter((t) => t.clientId)
        .map((t) => ({ ...t, client: clientsById[t.clientId]?.company ?? '' }))
      rows.push({
        period: label,
        category,
        totalIncome: round(forCategory.reduce((s, t) => s + t.amount, 0)),
        transactionCount: forCategory.length,
        topClient: named.length ? topBy(named, 'client') : '',
      })
    }
  }

  return {
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'category', label: 'Category' },
      { key: 'totalIncome', label: 'Total Income', numeric: true },
      { key: 'transactionCount', label: 'Transaction Count', numeric: true },
      { key: 'topClient', label: 'Top Client' },
    ],
    rows,
  }
}

function expenseSummary({ transactions, from, to, grouping }) {
  const scoped = inRange(transactions, from, to).filter((t) => t.type === 'expense')
  const total = scoped.reduce((s, t) => s + t.amount, 0)
  const rows = []

  for (const [key, label] of bucketsIn(scoped, grouping)) {
    const slice = scoped.filter((t) => bucketOf(t.date, grouping).key === key)
    for (const category of [...new Set(slice.map((t) => t.category))]) {
      const forCategory = slice.filter((t) => t.category === category)
      const amount = forCategory.reduce((s, t) => s + t.amount, 0)
      rows.push({
        period: label,
        category,
        totalExpenses: round(amount),
        transactionCount: forCategory.length,
        percentOfTotal: total > 0 ? round((amount / total) * 100) : 0,
      })
    }
  }

  return {
    columns: [
      { key: 'period', label: 'Period' },
      { key: 'category', label: 'Category' },
      { key: 'totalExpenses', label: 'Total Expenses', numeric: true },
      { key: 'transactionCount', label: 'Transaction Count', numeric: true },
      { key: 'percentOfTotal', label: 'Percent Of Total', numeric: true },
    ],
    rows,
  }
}

function profitAndLoss({ transactions, from, to }) {
  const scoped = inRange(transactions, from, to)
  const rows = bucketsIn(scoped, 'month').map(([key, label]) => {
    const slice = scoped.filter((t) => bucketOf(t.date, 'month').key === key)
    const revenue = sumBy(slice, 'income')
    const expenses = slice.filter((t) => t.type === 'expense')
    const cogs = expenses.filter((t) => COST_OF_SALES.includes(t.category)).reduce((s, t) => s + t.amount, 0)
    const opex = expenses.filter((t) => !COST_OF_SALES.includes(t.category)).reduce((s, t) => s + t.amount, 0)
    const gross = revenue - cogs
    const net = gross - opex
    return {
      month: label,
      totalRevenue: round(revenue),
      costOfSales: round(cogs),
      grossProfit: round(gross),
      operatingExpenses: round(opex),
      netProfit: round(net),
      marginPercent: revenue > 0 ? round((net / revenue) * 100) : 0,
    }
  })

  return {
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'totalRevenue', label: 'Total Revenue', numeric: true },
      { key: 'costOfSales', label: 'Cost Of Sales', numeric: true },
      { key: 'grossProfit', label: 'Gross Profit', numeric: true },
      { key: 'operatingExpenses', label: 'Operating Expenses', numeric: true },
      { key: 'netProfit', label: 'Net Profit', numeric: true },
      { key: 'marginPercent', label: 'Margin %', numeric: true },
    ],
    rows,
  }
}

function invoiceReport({ invoices, clientsById, from, to, today }) {
  const rows = invoices
    .filter((i) => {
      const issued = issueDateOf(i)
      return issued >= from && issued <= to
    })
    .sort((a, b) => issueDateOf(a).localeCompare(issueDateOf(b)))
    .map((invoice) => {
      const status = effectiveStatus(invoice, today)
      const settled = status === 'paid' || status === 'draft'
      return {
        invoiceNumber: invoice.invoiceNumber,
        client: clientsById[invoice.clientId]?.company ?? '',
        issuedDate: issueDateOf(invoice),
        dueDate: invoice.dueDate,
        status,
        subtotal: round(invoice.subtotal),
        tax: round(invoice.tax),
        discount: round(invoice.discount),
        total: round(invoice.total),
        // Only meaningful while money is still owed.
        daysOutstanding: settled ? 0 : Math.max(daysBetween(invoice.dueDate, today), 0),
      }
    })

  return {
    columns: [
      { key: 'invoiceNumber', label: 'Invoice Number' },
      { key: 'client', label: 'Client' },
      { key: 'issuedDate', label: 'Issued Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'subtotal', label: 'Subtotal', numeric: true },
      { key: 'tax', label: 'Tax', numeric: true },
      { key: 'discount', label: 'Discount', numeric: true },
      { key: 'total', label: 'Total', numeric: true },
      { key: 'daysOutstanding', label: 'Days Outstanding', numeric: true },
    ],
    rows,
  }
}

function clientRevenue({ transactions, invoices, clients, clientsById, from, to, grouping, today, clientId }) {
  const scoped = inRange(transactions, from, to).filter((t) => t.type === 'income' && t.clientId)
  const targets = clientId ? clients.filter((c) => c.id === clientId) : clients
  const rows = []

  for (const client of targets) {
    const mine = scoped.filter((t) => t.clientId === client.id)
    for (const [key, label] of bucketsIn(mine, grouping)) {
      const slice = mine.filter((t) => bucketOf(t.date, grouping).key === key)
      const clientInvoices = invoices.filter((i) => i.clientId === client.id)
      rows.push({
        client: client.company,
        month: label,
        revenue: round(slice.reduce((s, t) => s + t.amount, 0)),
        invoiceCount: clientInvoices.filter((i) => {
          const issued = issueDateOf(i)
          return bucketOf(issued, grouping).key === key
        }).length,
        outstandingBalance: round(
          clientInvoices
            .filter((i) => !['paid', 'draft'].includes(effectiveStatus(i, today)))
            .reduce((s, i) => s + balanceOf(i), 0),
        ),
      })
    }
  }

  return {
    columns: [
      { key: 'client', label: 'Client' },
      { key: 'month', label: 'Period' },
      { key: 'revenue', label: 'Revenue', numeric: true },
      { key: 'invoiceCount', label: 'Invoice Count', numeric: true },
      { key: 'outstandingBalance', label: 'Outstanding Balance', numeric: true },
    ],
    rows: rows.sort((a, b) => a.client.localeCompare(b.client) || a.month.localeCompare(b.month)),
  }
}

function budgetVsActual({ transactions, budgets, today }) {
  const rows = budgets.map((budget) => {
    // A budget is always judged over its own calendar window, not the export
    // period — otherwise "80% used" would mean nothing.
    const [windowFrom, windowTo] = budgetWindow(budget.period, today)
    const spend = inRange(transactions, windowFrom, windowTo)
      .filter((t) => t.type === 'expense' && t.category === budget.category)
      .reduce((s, t) => s + t.amount, 0)
    const remaining = budget.amount - spend
    const used = budget.amount > 0 ? (spend / budget.amount) * 100 : 0
    return {
      budgetName: budget.name,
      category: budget.category,
      budgetAmount: round(budget.amount),
      actualSpend: round(spend),
      remaining: round(remaining),
      percentUsed: round(used),
      status: used > 100 ? 'Over budget' : used > 80 ? 'Near limit' : 'On track',
    }
  })

  return {
    columns: [
      { key: 'budgetName', label: 'Budget Name' },
      { key: 'category', label: 'Category' },
      { key: 'budgetAmount', label: 'Budget Amount', numeric: true },
      { key: 'actualSpend', label: 'Actual Spend', numeric: true },
      { key: 'remaining', label: 'Remaining', numeric: true },
      { key: 'percentUsed', label: 'Percent Used', numeric: true },
      { key: 'status', label: 'Status' },
    ],
    rows,
  }
}

function digest({ transactions, invoices, from, to, today, grouping }) {
  const scoped = inRange(transactions, from, to)
  const weekly = grouping === 'week'

  const rows = bucketsIn(scoped, grouping).map(([key, label]) => {
    const slice = scoped.filter((t) => bucketOf(t.date, grouping).key === key)
    const income = sumBy(slice, 'income')
    const expenses = sumBy(slice, 'expense')
    const expenseRows = slice.filter((t) => t.type === 'expense')
    const incomeRows = slice.filter((t) => t.type === 'income')

    if (weekly) {
      return {
        weekStart: key,
        weekEnd: shiftDays(key, 6),
        totalIncome: round(income),
        totalExpenses: round(expenses),
        net: round(income - expenses),
        topCategory: topBy(expenseRows, 'category'),
        transactionCount: slice.length,
      }
    }

    const monthInvoices = invoices.filter((i) => bucketOf(issueDateOf(i), 'month').key === key)
    return {
      month: label,
      totalIncome: round(income),
      totalExpenses: round(expenses),
      net: round(income - expenses),
      grossMarginPercent: income > 0 ? round(((income - expenses) / income) * 100) : 0,
      topIncomeCategory: topBy(incomeRows, 'category'),
      topExpenseCategory: topBy(expenseRows, 'category'),
      transactionCount: slice.length,
      invoicesPaid: monthInvoices.filter((i) => effectiveStatus(i, today) === 'paid').length,
      invoicesOutstanding: monthInvoices.filter(
        (i) => !['paid', 'draft'].includes(effectiveStatus(i, today)),
      ).length,
    }
  })

  const columns = weekly
    ? [
        { key: 'weekStart', label: 'Week Start' },
        { key: 'weekEnd', label: 'Week End' },
        { key: 'totalIncome', label: 'Total Income', numeric: true },
        { key: 'totalExpenses', label: 'Total Expenses', numeric: true },
        { key: 'net', label: 'Net', numeric: true },
        { key: 'topCategory', label: 'Top Category' },
        { key: 'transactionCount', label: 'Transaction Count', numeric: true },
      ]
    : [
        { key: 'month', label: 'Month' },
        { key: 'totalIncome', label: 'Total Income', numeric: true },
        { key: 'totalExpenses', label: 'Total Expenses', numeric: true },
        { key: 'net', label: 'Net', numeric: true },
        { key: 'grossMarginPercent', label: 'Gross Margin %', numeric: true },
        { key: 'topIncomeCategory', label: 'Top Income Category' },
        { key: 'topExpenseCategory', label: 'Top Expense Category' },
        { key: 'transactionCount', label: 'Transaction Count', numeric: true },
        { key: 'invoicesPaid', label: 'Invoices Paid', numeric: true },
        { key: 'invoicesOutstanding', label: 'Invoices Outstanding', numeric: true },
      ]

  return { columns, rows }
}

/* ------------------------------------------------------------------------- */

export function buildExport(typeId, context) {
  switch (typeId) {
    case 'income-summary':
      return incomeSummary(context)
    case 'expense-summary':
      return expenseSummary(context)
    case 'profit-and-loss':
      return profitAndLoss(context)
    case 'invoice-report':
      return invoiceReport(context)
    case 'client-revenue':
      return clientRevenue(context)
    case 'budget-vs-actual':
      return budgetVsActual(context)
    case 'weekly-digest':
      return digest({ ...context, grouping: 'week' })
    case 'monthly-digest':
      return digest({ ...context, grouping: 'month' })
    default:
      return transactionLog(context)
  }
}
