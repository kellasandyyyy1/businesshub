import { IconPlus, IconTrendingUp } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import DetailPanel from '../components/transactions/DetailPanel'
import TransactionModal from '../components/transactions/TransactionModal'
import IncomeMetrics from '../components/income/IncomeMetrics'
import BarChart from '../components/common/BarChart'
import EmptyPeriod from '../components/common/EmptyPeriod'
import LedgerTable from '../components/common/LedgerTable'
import { StatusCell } from '../components/common/TxList'
import PeriodSwitcher from '../components/common/PeriodSwitcher'
import RevenueBreakdown from '../components/income/RevenueBreakdown'
import { usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import { useToast } from '../context/ToastContext'
import useDebounced from '../hooks/useDebounced'
import useIncomeData from '../hooks/useIncome'
import useSettings from '../hooks/useSettings'
import { categoryIcon } from '../config/categoryIcons'
import { formatCurrency, formatDate } from '../lib/format'
import { incomeMetrics } from '../lib/income'
import { removeWithUndo } from '../lib/softDelete'
import { txNoun } from '../lib/toastCopy'
import { buildSeries, groupTotals, inRange, periodBounds } from '../lib/ledger'

const PAGE_SIZE = 20

export default function Income() {
  const { profile, isPersonal } = useProfile()
  const data = useIncomeData(profile)
  const { symbol } = useSettings()
  const toast = useToast()
  const { periodId, period } = usePeriod()

  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | transaction
  const [params, setParams] = useSearchParams()

  // The + button lands here with ?new=1 and opens this page's own form, already
  // set to income, rather than leaving for Transactions with a blank one.
  useEffect(() => {
    if (params.get('new') === null) return
    setEditing({ type: 'income' })
    setParams({}, { replace: true })
  }, [params, setParams])

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
  // Nothing in the window: one card that says so replaces the empty cards,
  // chart, breakdown and table that would otherwise stack up below it.
  const empty = rows.length === 0
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
            render: (tx) => clientOf(tx) || '',
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
      render: (tx) => <StatusCell tx={tx} />,
    },
  ]

  // Gone from the list at once, with five seconds to take it back.
  const remove = async (tx) => {
    if (selectedId === tx.id) setSelectedId(null)
    await removeWithUndo(toast, 'transactions', tx.id, `${txNoun(tx.type)} deleted`, `${txNoun(tx.type)} restored`)
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Income</h1>
          <p className="bfh-pagehead__sub">
            {rows.length} {rows.length === 1 ? 'payment' : 'payments'} received · Last {period.name}
          </p>
        </div>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline bfh-pagehead__action"
          onClick={() => setEditing({ type: 'income' })}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>Add income</span>
        </button>
      </div>

      <PeriodSwitcher />

      {empty ? (
        <div className="bfh-block">
          <EmptyPeriod
            hasHistory={income.length > 0}
            emptyTitle={`No income in the last ${period.name}`}
            newTitle="No income recorded yet"
            newBody="Add a payment you received and this page will show where your money comes from and how steady it is."
            addLabel="Add income"
            onAdd={() => setEditing({ type: 'income' })}
          />
        </div>
      ) : (
        <>
          <div className="bfh-block">
            <IncomeMetrics metrics={metrics} symbol={symbol} period={period} isPersonal={isPersonal} />
          </div>

          <div className="bfh-block bfh-income__split">
            <BarChart
              title={isPersonal ? 'Income over time' : 'Revenue over time'}
              sub={`Last ${period.name}`}
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
              categoryIcons={data.categoryIcons}
              symbol={symbol}
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
        </>
      )}

      {selected && (
        <DetailPanel
          key={selected.id}
          tx={selected}
          client={data.clientsById[selected.clientId]}
          symbol={symbol}
          categoryIcons={data.categoryIcons}
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
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
