import { IconArrowLeft, IconCheck, IconFileTypePdf, IconPencil, IconSend, IconX } from '@tabler/icons-react'
import { useEffect } from 'react'

import StatusPill from './StatusPill'
import { useToast } from '../../context/ToastContext'
import { db } from '../../db/db'
import { formatCurrency, formatFullDate } from '../../lib/format'
import { amountPaid, balanceOf, dueLabel, issueDateOf } from '../../lib/invoice'

/**
 * What the invoice is waiting on, as a sentence with the money in it, and
 * the one thing to do about it.
 */
function standing(invoice, balance, money, today) {
  const when = dueLabel(invoice, today)
  switch (invoice.effectiveStatus) {
    case 'draft':
      return { title: 'Draft — not sent yet', body: 'Send it to your client, then mark it as sent so Dual can track the due date.' }
    case 'paid':
      return { title: `${when} in full`, body: `${money(invoice.total)} received. Nothing more to do.` }
    case 'overdue':
      return { title: `${money(balance)} is ${when}`, body: `It was due ${formatFullDate(invoice.dueDate)}. Worth a follow-up with your client.` }
    default:
      return { title: `${money(balance)} · ${when}`, body: `Due ${formatFullDate(invoice.dueDate)}. Mark it as paid when the money arrives.` }
  }
}

export default function InvoiceDetail({ invoice, client, business, symbol, onClose, onEdit }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const money = (v) => formatCurrency(v, symbol)
  const paid = amountPaid(invoice)
  const balance = balanceOf(invoice)
  const payments = invoice.payments ?? []

  const markPaid = async () => {
    const now = new Date().toISOString()
    try {
      await db.invoices.update(invoice.id, {
        status: 'paid',
        paidAt: now,
        // Record the settling payment so the history below reflects reality.
        payments: [
          ...payments,
          { date: now.slice(0, 10), amount: balance, method: 'Recorded manually' },
        ],
      })
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${invoice.invoiceNumber} marked as paid · ${money(balance)}`)
  }

  const markSent = async () => {
    try {
      await db.invoices.update(invoice.id, { status: 'sent', sentAt: invoice.sentAt ?? new Date().toISOString() })
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${invoice.invoiceNumber} marked as sent`)
  }

  const status = invoice.effectiveStatus
  const banner = standing(invoice, balance, money, today)

  return (
    <aside className="bfh-panel bfh-panel--wide bfh-invdetail" aria-label="Invoice detail">
      <header className="bfh-panel__head">
        <button type="button" className="bfh-panel__back" onClick={onClose}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Invoices
        </button>
        <h2 className="bfh-panel__heading">{invoice.invoiceNumber}</h2>
        <span className="bfh-panel__head-right">
          <StatusPill invoice={invoice} today={today} />
          <button
            type="button"
            className="bfh-iconaction bfh-panel__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <IconX size={14} stroke={1.5} aria-hidden="true" />
          </button>
        </span>
      </header>

      <div className="bfh-panel__body">
        <div className="bfh-invdetail__standing" data-status={status} role="status">
          <span className="bfh-invdetail__standingtitle">{banner.title}</span>
          <span className="bfh-invdetail__standingbody">{banner.body}</span>
        </div>

        {/* The printable document. @media print isolates exactly this block. */}
        <article className="bfh-doc">
          <header className="bfh-doc__head">
            <div>
              <div className="bfh-doc__business">{business}</div>
              <div className="bfh-micro">Invoice</div>
            </div>
            <div className="bfh-doc__meta">
              <div className="bfh-doc__number">{invoice.invoiceNumber}</div>
              <div className="bfh-micro">Issued {formatFullDate(issueDateOf(invoice))}</div>
              <div className="bfh-micro">Due {formatFullDate(invoice.dueDate)}</div>
            </div>
          </header>

          <section className="bfh-doc__party">
            <span className="bfh-micro">Billed to</span>
            <div className="bfh-doc__client">{client?.company ?? '—'}</div>
            {client && (
              <div className="bfh-doc__client-meta">
                {client.name}
                {client.email ? ` · ${client.email}` : ''}
              </div>
            )}
          </section>

          <table className="bfh-doc__items">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Qty</th>
                <th scope="col">Unit price</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={index}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.rate, symbol)}</td>
                  <td>{formatCurrency(item.amount ?? item.quantity * item.rate, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="bfh-doc__totals">
            <div>
              <span className="bfh-micro">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, symbol)}</span>
            </div>
            {invoice.discount > 0 && (
              <div>
                <span className="bfh-micro">Discount</span>
                <span>−{formatCurrency(invoice.discount, symbol)}</span>
              </div>
            )}
            <div>
              <span className="bfh-micro">Tax</span>
              <span>{formatCurrency(invoice.tax, symbol)}</span>
            </div>
            <div className="bfh-doc__grand">
              <span className="bfh-micro">Total</span>
              <span>{formatCurrency(invoice.total, symbol)}</span>
            </div>
          </section>

          {invoice.notes && (
            <section className="bfh-doc__notes">
              <span className="bfh-micro">Notes</span>
              <p>{invoice.notes}</p>
            </section>
          )}
        </article>

        {payments.length > 0 && (
          <section className="bfh-payments">
            <h3 className="bfh-panel__title">Payment history</h3>
            <ul>
              {payments.map((payment, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index}>
                  <span className="bfh-micro">{formatFullDate(payment.date)}</span>
                  <span className="bfh-payments__method">{payment.method}</span>
                  <span className="bfh-payments__amount">
                    {formatCurrency(payment.amount, symbol)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="bfh-payments__balance">
              <span className="bfh-micro">Paid {formatCurrency(paid, symbol)}</span>
              <span className="bfh-micro">Balance {formatCurrency(balance, symbol)}</span>
            </div>
          </section>
        )}
      </div>

      {/* The main button is always the next step for this invoice. */}
      <footer className="bfh-panel__foot bfh-invdetail__foot">
        <button type="button" className="bfh-btn-outline" onClick={() => window.print()}>
          <IconFileTypePdf size={17} stroke={1.5} aria-hidden="true" />
          PDF
        </button>
        <button type="button" className="bfh-btn-outline" onClick={() => onEdit(invoice)}>
          <IconPencil size={15} stroke={1.5} aria-hidden="true" />
          Edit
        </button>
        {status === 'draft' && (
          <button type="button" className="bfh-btn-primary" onClick={markSent}>
            <IconSend size={15} stroke={1.75} aria-hidden="true" />
            Mark as sent
          </button>
        )}
        {(status === 'sent' || status === 'viewed' || status === 'overdue') && (
          <button type="button" className="bfh-btn-primary" onClick={markPaid}>
            <IconCheck size={15} stroke={2} aria-hidden="true" />
            Mark as paid
          </button>
        )}
      </footer>
    </aside>
  )
}
