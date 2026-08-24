import { IconTrendingUp } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import DetailPanel from '../components/transactions/DetailPanel'
import TransactionModal from '../components/transactions/TransactionModal'
import IncomeMetrics from '../components/income/IncomeMetrics'
import BarChart from '../components/common/BarChart'
import LedgerTable from '../components/common/LedgerTable'
import PeriodSwitcher from '../components/common/PeriodSwitcher'
import RevenueBreakdown from '../components/income/RevenueBreakdown'
import { usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import { db } from '../db/db'
import useDebounced from '../hooks/useDebounced'
import useIncomeData from '../hooks/useIncome'
import useSettings from '../hooks/useSettings'
import { categoryIcon } from '../config/categoryIcons'
import { formatCurrency, formatDate } from '../lib/format'
import { incomeMetrics } from '../lib/income'
import { buildSeries, groupTotals, inRange, periodBounds } from '../lib/ledger'

const PAGE_SIZE = 20

export default function Income() {
  const { profile, isPersonal } = useProfile()
  const data = useIncomeData(profile)
  const { symbol } = useSettings()
  const { periodId, period } = usePeriod()

  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | transaction

  const debouncedSearch = useDebounced(search, 300)
  const today = new Date().toISOString().slice(0, 10)
  const income = data?.income

  const bounds = useMemo(() => periodBounds(periodId, today), [periodId, today])

  const rows = useMemo(
    () => (income ? inRange(income, bounds.from, bounds.to) : []),
    [income, bounds.from, bounds.to],
  )

  const metrics = useMemo(() => {
    if (!data) return null
    return incomeMetrics({
      rows,
      previousRows: inRange(income, bounds.prevFrom, bounds.prevTo),
      allIncome: income,
      clientName: (id) => data.clientsById[id]?.name ?? 'Unknown client',
      periodId,
    })
  }, [data, income, rows, bounds, periodId])

  const series = useMemo(() => buildSeries(rows, periodId, bounds), [rows, periodId, bounds])

  const byCategory = useMemo(
    () => groupTotals(rows, (r) => r.category ?? '', (key) => key || 'Uncategorised'),
    [rows],
  )

  const byClient = useMemo(
    () =>
      data
        ? groupTotals(
            rows,
            (r) => (r.clientId ? String(r.clientId) : 'none'),
            (key) => (key === 'none' ? 'No client' : (data.clientsById[Number(key)]?.name ?? 'Unknown client')),
          )
        : [],
    [rows, data],
  )

  // Already newest-first from the hook; search narrows without reordering.
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
  const clientOf = (tx) => (tx.clientId ? (data.clientsById[tx.clientId]?.name ?? '') : '')

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
    // Personal income has no client behind it, so the column would be a row of
    // em dashes taking up a fifth of the table.
    ...(isPersonal
      ? []
      : [
          {
            key: 'client',
            header: 'Client',
            className: 'bfh-cell-client',
            render: (tx) => clientOf(tx) || '—',
          },
        ]),
    {
      key: 'amount',
      header: 'Amount',
      className: 'bfh-cell-amount',
      // Every row here is money in, so the figure carries no sign.
      render: (tx) => formatCurrency(tx.amount, symbol),
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
        <h1 className="bfh-pagehead__title">Income</h1>
      </div>

      <PeriodSwitcher />

      <div className="bfh-block">
        <IncomeMetrics metrics={metrics} symbol={symbol} />
      </div>

      <div className="bfh-block bfh-income__split">
        <BarChart
          title="Revenue over time"
          sub={`Last ${period.label}`}
          series={series}
          symbol={symbol}
        />
        {/* Personal income has no clients to break down by, so that tab is
            dropped rather than shown empty. */}
        <RevenueBreakdown
          byCategory={byCategory}
          byClient={byClient}
          showClients={!isPersonal}
          symbol={symbol}
        />
      </div>

      <div className="bfh-block">
        <LedgerTable
          title="Income transactions"
          columns={columns}
          rows={shown}
          total={tableRows.length}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search income…"
          searchLabel="Search income"
          mobileMeta={(tx) => [tx.category, clientOf(tx)].filter(Boolean)}
          amountOf={(tx) => formatCurrency(tx.amount, symbol)}
          emptyIcon={IconTrendingUp}
          emptyHeading="No income in this period"
          emptyBody={
            isPersonal
              ? 'Add an income transaction to start tracking what comes in.'
              : 'Add an income transaction to start tracking revenue.'
          }
          emptyAction="Add income"
          noMatchLabel="No income matches that search."
          onAdd={() => setEditing({ type: 'income' })}
          searching={debouncedSearch.trim().length > 0}
          selectedId={selectedId}
          onOpen={(tx) => setSelectedId(tx.id)}
          onLoadMore={() => setVisible((n) => n + PAGE_SIZE)}
          hasMore={shown.length < tableRows.length}
          tableClass="bfh-table--income"
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
          key={editing.id ?? 'new-income'}
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
