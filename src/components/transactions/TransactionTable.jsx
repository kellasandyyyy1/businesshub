import {
  IconArrowsExchange,
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'

import EmptyState from '../EmptyState'
import { useDevice } from '../../context/BreakpointContext'

import { categoryIcon } from '../../config/categoryIcons'
import { formatAmount, formatCurrency, formatDate } from '../../lib/format'

/** Same row, restated as a card — a six-column table cannot fit a phone. */
function MobileCard({ tx, symbol, onOpen }) {
  const signed = tx.type === 'income' ? tx.amount : -tx.amount
  return (
    <button type="button" className="bfh-txcard" onClick={() => onOpen(tx)}>
      <span className="bfh-txcard__top">
        <span className="bfh-txcard__name">{tx.description}</span>
        <span className="bfh-txcard__amount">{formatAmount(signed, symbol)}</span>
      </span>
      <span className="bfh-txcard__meta">
        <span className="bfh-chip">{tx.category}</span>
        <span className="bfh-chip">{formatDate(tx.date)}</span>
        <span className="bfh-chip">{tx.status}</span>
      </span>
    </button>
  )
}

function Row({ tx, categoryIcons, symbol, selected, onOpen, onEdit, onDelete }) {
  const Icon = categoryIcon(categoryIcons[tx.category])
  const signed = tx.type === 'income' ? tx.amount : -tx.amount

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
        <span className="bfh-chip">{tx.category}</span>
      </td>

      <td className="bfh-cell-cat">
        <Icon size={14} stroke={1.5} aria-hidden="true" />
        <span>{tx.category}</span>
      </td>

      <td className="bfh-cell-amount">{formatCurrency(signed, symbol)}</td>

      <td className="bfh-cell-status">{tx.status}</td>

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
}) {
  const { isMobile } = useDevice()
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <section className="bfh-card bfh-table-card">
      {isMobile ? (
        <div className="bfh-cardlist">
          {rows.map((tx) => (
            <MobileCard key={tx.id} tx={tx} symbol={symbol} onOpen={onOpen} />
          ))}
        </div>
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
          <p className="bfh-empty">No transactions match these filters.</p>
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
