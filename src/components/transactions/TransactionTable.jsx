import {
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'

import EmptyState from '../EmptyState'
import TxList, { StatusCell } from '../common/TxList'
import { useDevice } from '../../context/BreakpointContext'

import { categoryIcon } from '../../config/categoryIcons'
import { useMethodList } from '../../hooks/usePaymentMethods'
import { methodLabel } from '../../lib/paymentMethods'
import { formatDate } from '../../lib/format'
import { amountLabel } from '../../lib/txDisplay'

function Row({ tx, method, categoryIcons, symbol, selected, onOpen, onEdit, onDelete }) {
  const Icon = categoryIcon(categoryIcons[tx.category])

  // Keyboard users get the same detail panel the click opens.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(tx)
    }
  }

  return (
    <tr
      className="bfh-row"
      data-selected={selected ? 'true' : undefined}
      tabIndex={0}
      onClick={() => onOpen(tx)}
      onKeyDown={onKeyDown}
    >
      <td className="bfh-cell-date">{formatDate(tx.date)}</td>

      <td className="bfh-cell-desc">
        <span className="bfh-row__name">{tx.description}</span>
        {method && <span className="bfh-txmethod bfh-row__method">{method}</span>}
        <span className="bfh-chip">{tx.category}</span>
      </td>

      <td className="bfh-cell-cat">
        <Icon size={14} stroke={1.5} aria-hidden="true" />
        <span>{tx.category}</span>
      </td>

      <td className="bfh-cell-amount" data-type={tx.type}>{amountLabel(tx, symbol)}</td>

      <td className="bfh-cell-status">
        <StatusCell tx={tx} />
      </td>

      <td className="bfh-cell-actions">
        <span className="bfh-row__actions">
          <button
            type="button"
            className="bfh-iconaction"
            aria-label={`Edit ${tx.description}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(tx)
            }}
          >
            <IconPencil size={14} stroke={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="bfh-iconaction"
            aria-label={`Delete ${tx.description}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(tx)
            }}
          >
            <IconTrash size={14} stroke={1.5} aria-hidden="true" />
          </button>
        </span>
      </td>
    </tr>
  )
}

export default function TransactionTable({
  rows,
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  categoryIcons,
  symbol,
  selectedId,
  onOpen,
  onEdit,
  onDelete,
  onAdd,
  filtered,
  onClearFilters,
}) {
  const { isMobile } = useDevice()
  const methods = useMethodList() ?? []
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <section className="bfh-card bfh-table-card">
      {isMobile ? (
        <TxList
          rows={rows}
          onOpen={onOpen}
          categoryIcons={categoryIcons}
          symbol={symbol}
          selectedId={selectedId}
        />
      ) : (
      <table className="bfh-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col" className="bfh-cell-cat">
              Category
            </th>
            <th scope="col" className="bfh-cell-amount">
              Amount
            </th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((tx) => (
            <Row
              key={tx.id}
              tx={tx}
              method={methodLabel(tx, methods)}
              categoryIcons={categoryIcons}
              symbol={symbol}
              selected={tx.id === selectedId}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
      )}

      {rows.length === 0 &&
        (filtered ? (
          <div className="bfh-empty bfh-empty--action">
            <p>No transactions match these filters.</p>
            {onClearFilters && (
              <button type="button" className="bfh-btn-ghost bfh-btn-ghost--solid" onClick={onClearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <EmptyState
            icon={IconArrowsExchange}
            heading="No transactions yet"
            body="Every payment in and out is recorded here."
            actionLabel="Add first transaction"
            onAction={onAdd}
          />
        ))}

      {pageCount > 1 && (
        <footer className="bfh-pager">
          <span className="bfh-micro">
            {first}–{last} of {total}
          </span>
          <span className="bfh-pager__controls">
            <button
              type="button"
              className="bfh-iconaction"
              onClick={() => onPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <IconChevronLeft size={14} stroke={1.5} aria-hidden="true" />
            </button>
            <span className="bfh-micro">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="bfh-iconaction"
              onClick={() => onPage(page + 1)}
              disabled={page === pageCount}
              aria-label="Next page"
            >
              <IconChevronRight size={14} stroke={1.5} aria-hidden="true" />
            </button>
          </span>
        </footer>
      )}
    </section>
  )
}
