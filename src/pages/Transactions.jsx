import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import DetailPanel from '../components/transactions/DetailPanel'
import SummaryStrip from '../components/transactions/SummaryStrip'
import Toolbar from '../components/transactions/Toolbar'
import TransactionModal from '../components/transactions/TransactionModal'
import TransactionTable from '../components/transactions/TransactionTable'
import { useToast } from '../context/ToastContext'
import { useAssistantActions } from '../context/AssistantActionsContext'
import { usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import useDebounced from '../hooks/useDebounced'
import useSettings from '../hooks/useSettings'
import { useMethodList } from '../hooks/usePaymentMethods'
import { shiftDays } from '../lib/format'
import { removeWithUndo } from '../lib/softDelete'
import { txNoun } from '../lib/toastCopy'
import { DATE_RANGES, filterTransactions, summarise, useTransactionsData } from '../hooks/useTransactions'

const PAGE_SIZE = 25

export default function Transactions() {
  // The page is the same for both profiles; the profile decides which rows it
  // reads. That is what lets /personal/transactions render this component.
  const { profile } = useProfile()
  const data = useTransactionsData(profile)
  const { symbol } = useSettings()
  const toast = useToast()
  const { periodId } = usePeriod()
  const { pendingAction, clearAction } = useAssistantActions()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [method, setMethod] = useState('all')
  const methods = useMethodList() ?? []
  const [dateRange, setDateRange] = useState(periodId)
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | transaction

  const debouncedSearch = useDebounced(search, 300)

  // The topbar switcher sets the page's opening range; the dropdown can then
  // take it anywhere.
  useEffect(() => setDateRange(periodId), [periodId])

  // The sidebar's "Add transaction" lands here with ?new=1; the clients page
  // links to a single row with ?id=.
  useEffect(() => {
    const isNew = params.get('new')
    const open = params.get('id')
    if (isNew === null && open === null) return
    if (isNew !== null) setEditing({})
    if (open !== null) setSelectedId(Number(open))
    setParams({}, { replace: true })
  }, [params, setParams])

  // The assistant parks extracted fields here rather than saving them. The
  // form opens filled in and waits for the person to confirm.
  useEffect(() => {
    if (pendingAction?.type !== 'ADD_TRANSACTION') return
    setEditing(pendingAction.prefill)
    clearAction()
  }, [pendingAction, clearAction])

  const today = new Date().toISOString().slice(0, 10)
  const transactions = data?.transactions

  const filtered = useMemo(
    () =>
      transactions
        ? filterTransactions(transactions, {
            search: debouncedSearch,
            type,
            category,
            method,
            dateRange,
            today,
          })
        : [],
    [transactions, debouncedSearch, type, category, method, dateRange, today],
  )

  // Any change to the filters invalidates the page cursor.
  useEffect(() => setPage(1), [debouncedSearch, type, category, method, dateRange])

  if (!data) return <div className="bfh-page" />

  // The export shortcut inherits whatever range the page is showing.
  const activeRange = DATE_RANGES.find((r) => r.id === dateRange)
  const exportRange = activeRange?.days
    ? { from: shiftDays(today, -activeRange.days), to: today }
    : { from: '1970-01-01', to: today }

  const summary = summarise(filtered)
  const filtersActive =
    search.trim() !== '' || type !== 'all' || category !== 'all' || method !== 'all' || dateRange !== periodId
  const clearFilters = () => {
    setSearch('')
    setType('all')
    setCategory('all')
    setMethod('all')
    setDateRange(periodId)
  }
  const changeType = (next) => {
    setType(next)
    // A category from the other side of the ledger would match nothing.
    const kept = data.categories.find((c) => c.name === category)
    if (kept && next !== 'all' && next !== 'transfer' && kept.type !== next) setCategory('all')
  }
  const rangeLabel = activeRange?.label ?? 'All time'
  const count = `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}`
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selected = filtered.find((t) => t.id === selectedId) ?? null

  // Gone from the list at once, with five seconds to take it back.
  const remove = async (tx) => {
    if (selectedId === tx.id) setSelectedId(null)
    await removeWithUndo(toast, 'transactions', tx.id, `${txNoun(tx.type)} deleted`, `${txNoun(tx.type)} restored`)
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Transactions</h1>
          <p className="bfh-pagehead__sub">
            {count} · {rangeLabel}
          </p>
        </div>
      </div>

      <div className="bfh-block">
        <Toolbar
          search={search}
          onSearch={setSearch}
          type={type}
          onType={changeType}
          category={category}
          onCategory={setCategory}
          method={method}
          onMethod={setMethod}
          methods={methods}
          dateRange={dateRange}
          onDateRange={setDateRange}
          categories={data.categories}
          onAdd={() => setEditing({})}
          exportRange={exportRange}
          filtersActive={filtersActive}
          onClear={clearFilters}
        />
      </div>

      <div className="bfh-block">
        <SummaryStrip summary={summary} symbol={symbol} />
      </div>

      <div className="bfh-block">
        <TransactionTable
          rows={rows}
          total={filtered.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          categoryIcons={data.categoryIcons}
          symbol={symbol}
          selectedId={selectedId}
          onOpen={(tx) => setSelectedId(tx.id)}
          onEdit={(tx) => setEditing(tx)}
          onDelete={remove}
          onAdd={() => setEditing({})}
          filtered={transactions.length > 0}
          onClearFilters={filtersActive ? clearFilters : null}
        />
      </div>

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
          // Passed straight through. An object with no id is still a new
          // transaction — the modal decides that on `id` alone — and blanking
          // it here would throw away anything the assistant filled in.
          transaction={editing}
          categories={data.categories}
          clients={data.clients}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
