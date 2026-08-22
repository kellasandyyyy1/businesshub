import { IconArrowLeft, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { formatCurrency, formatFullDate } from '../../lib/format'
import useFocusTrap from '../../hooks/useFocusTrap'

function Field({ label, children }) {
  return (
    <div className="bfh-field">
      <span className="bfh-micro">{label}</span>
      <span className="bfh-field__value">{children || '—'}</span>
    </div>
  )
}

export default function DetailPanel({ tx, client, symbol, onClose, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const trapRef = useFocusTrap()

  // A different row means a fresh decision about deleting.
  useEffect(() => setConfirming(false), [tx.id])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const signed = tx.type === 'income' ? tx.amount : -tx.amount

  return (
    <aside className="bfh-panel" ref={trapRef} tabIndex={-1} aria-label="Transaction detail">
      <header className="bfh-panel__head">
        {/* Full screen on a phone, so "back" is the truthful affordance. */}
        <button type="button" className="bfh-panel__back" onClick={onClose}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Transactions
        </button>
        <span className="bfh-micro bfh-panel__title-text">Transaction</span>
        <button
          type="button"
          className="bfh-iconaction bfh-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <IconX size={14} stroke={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="bfh-panel__body">
        <Field label="Description">{tx.description}</Field>
        <Field label="Amount">{formatCurrency(signed, symbol)}</Field>
        <Field label="Date">{formatFullDate(tx.date)}</Field>
        <Field label="Type">{tx.type}</Field>
        <Field label="Category">{tx.category}</Field>
        <Field label="Client">{client ? `${client.company} · ${client.name}` : null}</Field>
        <Field label="Payment method">{tx.paymentMethod}</Field>
        <Field label="Status">{tx.status}</Field>
        <Field label="Notes">{tx.notes}</Field>
      </div>

      <footer className="bfh-panel__foot">
        <button type="button" className="bfh-btn-primary" onClick={() => onEdit(tx)}>
          Edit
        </button>
        <button
          type="button"
          className="bfh-btn-ghost"
          onClick={() => (confirming ? onDelete(tx) : setConfirming(true))}
        >
          {confirming ? 'Confirm delete' : 'Delete'}
        </button>
      </footer>
    </aside>
  )
}
