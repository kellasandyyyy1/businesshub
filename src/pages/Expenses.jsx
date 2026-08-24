import { IconTrendingDown } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import BarChart from '../components/common/BarChart'
import LedgerTable from '../components/common/LedgerTable'
import PeriodSwitcher from '../components/common/PeriodSwitcher'
import BudgetStrip from '../components/expenses/BudgetStrip'
import ExpenseMetrics from '../components/expenses/ExpenseMetrics'
import SpendingBreakdown from '../components/expenses/SpendingBreakdown'
import DetailPanel from '../components/transactions/DetailPanel'
import TransactionModal from '../components/transactions/TransactionModal'
import { categoryIcon } from '../config/categoryIcons'
import { usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import { db } from '../db/db'
import useDebounced from '../hooks/useDebounced'
import useExpensesData from '../hooks/useExpenses'
import useSettings from '../hooks/useSettings'
import {
  budgetUsage,
  expenseMetrics,
  merchantKey,
  recurringExpenses,
} from '../lib/expenses'
import { formatCurrency, formatDate, formatPercent, percentChange } from '../lib/format'
import { buildSeries, groupTotals, inRange, periodBounds } from '../lib/ledger'

const PAGE_SIZE = 20

export default function Expenses() {
  const { profile } = useProfile()
  const data = useExpensesData(profile)
  const { symbol } = useSettings()
  const { periodId, period } = usePeriod()

  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | transaction

  const debouncedSearch = useDebounced(search, 300)
  const today = new Date().toISOString().slice(0, 10)
  const expenses = data?.expenses

  const bounds = useMemo(() => periodBounds(periodId, today), [periodId, today])

  const rows = useMemo(
    () => (expenses ? inRange(expenses, bounds.from, bounds.to) : []),
    [expenses, bounds.from, bounds.to],
  )

  const metrics = useMemo(() => {
    if (!data) return null
    return expenseMetrics({
      rows,
      previousRows: inRange(expenses, bounds.prevFrom, bounds.prevTo),
      allExpenses: expenses,
      periodId,
      today,
    })
  }, [data, expenses, rows, bounds, periodId, today])

  const series = useMemo(() => buildSeries(rows, periodId, bounds), [rows, periodId, bounds])

  const byCategory = useMemo(
    () => groupTotals(rows, (r) => r.category ?? '', (key) => key || 'Uncategorised'),
    [rows],
  )

  // Grouping is case-insensitive, so the label has to come back from a real row
  // rather than from the normalised key.
  const byMerchant = useMemo(() => {
    const labels = new Map()
    for (const row of rows) {
      const key = merchantKey(row)
      if (key && !labels.has(key)) labels.set(key, row.description.trim())
    }
    return groupTotals(rows, merchantKey, (key) => labels.get(key) ?? 'Unlabelled')
  }, [rows])

  const recurring = useMemo(
    () => (expenses ? recurringExpenses(expenses, today) : []),
    [expenses, today],
  )

  const usage = useMemo(
    () => (data?.budgets?.length ? budgetUsage(data.budgets, expenses, today) : []),
    [data, expenses, today],
  )

  const tableRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      [r.description, r.category, r.notes, String(r.amount)]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle)),
    )
  }, [rows, debouncedSearch])

  // A new period or a new search invalidates how far the list was scrolled.
  useEffect(() => setVisible(PAGE_SIZE), [periodId, debouncedSearch])

  if (!data) return <div className="bfh-page" />

  const shown = tableRows.slice(0, visible)
  const selected = rows.find((t) => t.id === selectedId) ?? null

  // Stored unsigned, shown as an outflow.
  const outflow = (tx) => `−${formatCurrency(tx.amount, symbol)}`

  const change = percentChange(metrics.total, metrics.previousTotal)
  const note =
    change === null || metrics.previousTotal === 0
      ? null
      : `Spending is ${formatPercent(change)} ${change >= 0 ? 'higher' : 'lower'} than the previous period.`

  const columns = [
    { key: 'date', header: 'Date', className: 'bfh-cell-date', render: (tx) => formatDate(tx.date) },
    {
      key: 'description',
      header: 'Description',
      className: 'bfh-cell-desc',
      render: (tx) => <span className="bfh-row__name">{tx.description}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      className: 'bfh-cell-cat',
      render: (tx) => {
        const Icon = categoryIcon(data.categoryIcons[tx.category])
        return (
          <>
            <Icon size={14} stroke={1.5} aria-hidden="true" />
            <span>{tx.category}</span>
          </>
        )
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'bfh-cell-amount',
      render: outflow,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'bfh-cell-status',
      render: (tx) => <span className="bfh-status-pill">{tx.status}</span>,
    },
  ]

  const remove = async (tx) => {
    await db.transactions.delete(tx.id)
    if (selectedId === tx.id) setSelectedId(null)
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-pagehead">
        <h1 className="bfh-pagehead__title">Expenses</h1>
      </div>

      <PeriodSwitcher />

      <div className="bfh-block">
        <ExpenseMetrics metrics={metrics} symbol={symbol} />
      </div>

      <div className="bfh-block bfh-income__split">
        <BarChart
          title="Spending over time"
          sub={`Last ${period.label}`}
          series={series}
          symbol={symbol}
          variant="hatched"
          note={note}
        />
        <SpendingBreakdown
          byCategory={byCategory}
          byMerchant={byMerchant}
          recurring={recurring}
          categoryIcons={data.categoryIcons}
          symbol={symbol}
        />
      </div>

      {/* Budgets are optional; the Budgets page owns the case where none exist. */}
      {usage.length > 0 && (
        <div className="bfh-block">
          <BudgetStrip usage={usage} symbol={symbol} />
        </div>
      )}

      <div className="bfh-block">
        <LedgerTable
          title="Expense transactions"
          columns={columns}
          rows={shown}
          total={tableRows.length}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search expenses…"
          searchLabel="Search expenses"
          mobileMeta={(tx) => [tx.category].filter(Boolean)}
          amountOf={outflow}
          emptyIcon={IconTrendingDown}
          emptyHeading="No expenses in this period"
          emptyBody="Add an expense to start tracking your spending."
          emptyAction="Add expense"
          noMatchLabel="No expenses match that search."
          onAdd={() => setEditing({ type: 'expense' })}
          searching={debouncedSearch.trim().length > 0}
          selectedId={selectedId}
          onOpen={(tx) => setSelectedId(tx.id)}
          onLoadMore={() => setVisible((n) => n + PAGE_SIZE)}
          hasMore={shown.length < tableRows.length}
          tableClass="bfh-table--expense"
        />
      </div>

      {selected && (
        <DetailPanel
          key={selected.id}
          tx={selected}
          client={data.clientsById[selected.clientId]}
          symbol={symbol}
          onClose={() => setSelectedId(null)}
          onEdit={(tx) => setEditing(tx)}
          onDelete={remove}
        />
      )}

      {editing && (
        <TransactionModal
          key={editing.id ?? 'new-expense'}
          transaction={editing}
          categories={data.categories}
          clients={data.clients}
          paymentMethods={data.paymentMethods}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
