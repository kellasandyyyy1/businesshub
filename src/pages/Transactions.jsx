import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import DetailPanel from '../components/transactions/DetailPanel'
import SummaryStrip from '../components/transactions/SummaryStrip'
import Toolbar from '../components/transactions/Toolbar'
import TransactionModal from '../components/transactions/TransactionModal'
import TransactionTable from '../components/transactions/TransactionTable'
import { db } from '../db/db'
import { useAssistantActions } from '../context/AssistantActionsContext'
import { usePeriod } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import useDebounced from '../hooks/useDebounced'
import useSettings from '../hooks/useSettings'
import { shiftDays } from '../lib/format'
import { DATE_RANGES, filterTransactions, summarise, useTransactionsData } from '../hooks/useTransactions'

const PAGE_SIZE = 25

export default function Transactions() {
  // The page is the same for both profiles; the profile decides which rows it
  // reads. That is what lets /personal/transactions render this component.
  const { profile } = useProfile()
  const data = useTransactionsData(profile)
  const { symbol } = useSettings()
  const { periodId } = usePeriod()
  const { pendingAction, clearAction } = useAssistantActions()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
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
            dateRange,
            today,
          })
        : [],
    [transactions, debouncedSearch, type, category, dateRange, today],
  )

  // Any change to the filters invalidates the page cursor.
  useEffect(() => setPage(1), [debouncedSearch, type, category, dateRange])

  if (!data) return <div className="bfh-page" />

  // The export shortcut inherits whatever range the page is showing.
  const activeRange = DATE_RANGES.find((r) => r.id === dateRange)
  const exportRange = activeRange?.days
    ? { from: shiftDays(today, -activeRange.days), to: today }
    : { from: '1970-01-01', to: today }

  const summary = summarise(filtered)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selected = filtered.find((t) => t.id === selectedId) ?? null

  const remove = async (tx) => {
    await db.transactions.delete(tx.id)
    if (selectedId === tx.id) setSelectedId(null)
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block">
        <Toolbar
          search={search}
          onSearch={setSearch}
          type={type}
          onType={setType}
          category={category}
          onCategory={setCategory}
          dateRange={dateRange}
          onDateRange={setDateRange}
          categories={data.categories}
          onAdd={() => setEditing({})}
          exportRange={exportRange}
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
          // Passed straight through. An object with no id is still a new
          // transaction — the modal decides that on `id` alone — and blanking
          // it here would throw away anything the assistant filled in.
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
