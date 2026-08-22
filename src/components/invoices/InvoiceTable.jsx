import { IconFileInvoice, IconPencil } from '@tabler/icons-react'

import EmptyState from '../EmptyState'
import { useDevice } from '../../context/BreakpointContext'

import StatusPill from './StatusPill'
import { formatAmount, formatCurrency, formatDate } from '../../lib/format'
import { issueDateOf } from '../../lib/invoice'

/** Client and total lead; the number, status, and due date follow as pills. */
function MobileCard({ invoice, client, symbol, onOpen }) {
  return (
    <button type="button" className="bfh-txcard" onClick={() => onOpen(invoice)}>
      <span className="bfh-txcard__top">
        <span className="bfh-txcard__name">{client?.company ?? '—'}</span>
        <span className="bfh-txcard__amount">{formatAmount(invoice.total, symbol)}</span>
      </span>
      <span className="bfh-txcard__meta">
        <span className="bfh-chip">{invoice.invoiceNumber}</span>
        <StatusPill status={invoice.effectiveStatus} />
        <span className="bfh-chip">Due {formatDate(invoice.dueDate)}</span>
      </span>
    </button>
  )
}

function Row({ invoice, client, symbol, selected, onOpen, onEdit }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(invoice)
    }
  }

  return (
    <tr
      className="bfh-row"
      data-selected={selected ? 'true' : undefined}
      tabIndex={0}
      onClick={() => onOpen(invoice)}
      onKeyDown={onKeyDown}
    >
      <td className="bfh-cell-number">{invoice.invoiceNumber}</td>
      <td className="bfh-cell-client">{client?.company ?? '—'}</td>
      <td className="bfh-cell-date">{formatDate(issueDateOf(invoice))}</td>
      <td className="bfh-cell-date">{formatDate(invoice.dueDate)}</td>
      <td className="bfh-cell-amount">{formatCurrency(invoice.total, symbol)}</td>
      <td className="bfh-cell-pill">
        <StatusPill status={invoice.effectiveStatus} />
      </td>
      <td className="bfh-cell-actions">
        <span className="bfh-row__actions">
          <button
            type="button"
            className="bfh-iconaction"
            aria-label={`Edit ${invoice.invoiceNumber}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(invoice)
            }}
          >
            <IconPencil size={14} stroke={1.5} aria-hidden="true" />
          </button>
        </span>
      </td>
    </tr>
  )
}

export default function InvoiceTable({
  invoices,
  clientsById,
  symbol,
  selectedId,
  onOpen,
  onEdit,
  onAdd,
  filtered,
}) {
  const { isMobile } = useDevice()

  return (
    <section className="bfh-card bfh-table-card">
      {isMobile ? (
        <div className="bfh-cardlist">
          {invoices.map((invoice) => (
            <MobileCard
              key={invoice.id}
              invoice={invoice}
              client={clientsById[invoice.clientId]}
              symbol={symbol}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
      <table className="bfh-table">
        <thead>
          <tr>
            <th scope="col">Invoice #</th>
            <th scope="col">Client</th>
            <th scope="col">Issued</th>
            <th scope="col">Due</th>
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
          {invoices.map((invoice) => (
            <Row
              key={invoice.id}
              invoice={invoice}
              client={clientsById[invoice.clientId]}
              symbol={symbol}
              selected={invoice.id === selectedId}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
      )}

      {invoices.length === 0 &&
        (filtered ? (
          <p className="bfh-empty">No invoices with this status.</p>
        ) : (
          <EmptyState
            icon={IconFileInvoice}
            heading="No invoices created"
            body="Bill a client and track what they owe from here."
            actionLabel="Create first invoice"
            onAction={onAdd}
          />
        ))}
    </section>
  )
}
