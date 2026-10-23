import { IconFileInvoice, IconPencil } from '@tabler/icons-react'

import EmptyState from '../EmptyState'
import { useDevice } from '../../context/BreakpointContext'

import StatusPill from './StatusPill'
import { formatCurrency, formatDate } from '../../lib/format'
import { dueLabel, issueDateOf } from '../../lib/invoice'
import { dueTone } from '../../lib/signal'

const clientName = (client, invoice) => client?.company || client?.name || invoice?.clientName || 'No client'

/**
 * Who and how much on the first line; which invoice and where it stands
 * against its due date on the second, with the status at the end where the
 * eye looks for it.
 */
function MobileCard({ invoice, client, symbol, today, onOpen }) {
  return (
    <button
      type="button"
      className="bfh-invcard"
      data-status={invoice.effectiveStatus}
      onClick={() => onOpen(invoice)}
    >
      <span className="bfh-invcard__top">
        <span className="bfh-invcard__client">{clientName(client, invoice)}</span>
        <span className="bfh-invcard__amount">{formatCurrency(invoice.total, symbol)}</span>
      </span>
      <span className="bfh-invcard__bottom">
        <span className="bfh-invcard__when">
          {invoice.invoiceNumber} ·{' '}
          <span className="bfh-due" data-tone={dueTone(invoice, today) ?? undefined}>
            {dueLabel(invoice, today)}
          </span>
        </span>
        <StatusPill invoice={invoice} today={today} />
      </span>
    </button>
  )
}

function Row({ invoice, client, symbol, today, selected, onOpen, onEdit }) {
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
      <td className="bfh-cell-client">{clientName(client, invoice)}</td>
      <td className="bfh-cell-date">{formatDate(issueDateOf(invoice))}</td>
      <td className="bfh-cell-when bfh-due" data-status={invoice.effectiveStatus} data-tone={dueTone(invoice, today) ?? undefined}>
        {dueLabel(invoice, today)}
      </td>
      <td className="bfh-cell-amount">{formatCurrency(invoice.total, symbol)}</td>
      <td className="bfh-cell-pill">
        <StatusPill invoice={invoice} today={today} />
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

/* An empty filter is usually good news; it says so. */
const EMPTY_FILTER = {
  overdue: 'Nothing is overdue.',
  sent: 'No invoices are waiting to be paid.',
  draft: 'No drafts. Everything has gone out.',
  paid: 'No invoices have been paid yet.',
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
  today,
  tab,
  onShowAll,
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
              today={today}
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
            <th scope="col">When</th>
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
              today={today}
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
          <div className="bfh-empty bfh-empty--action">
            <p>{EMPTY_FILTER[tab] ?? 'No invoices here.'}</p>
            <button type="button" className="bfh-btn-ghost bfh-btn-ghost--solid" onClick={onShowAll}>
              Show all invoices
            </button>
          </div>
        ) : (
          <EmptyState
            icon={IconFileInvoice}
            heading="No invoices yet"
            body="Create an invoice for a client, mark it as sent, and Dual tells you when it is due and when it is late."
            actionLabel="Create your first invoice"
            onAction={onAdd}
          />
        ))}
    </section>
  )
}
