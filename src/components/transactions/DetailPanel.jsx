import { IconArrowLeft, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect } from 'react'

import PaymentMethodIcon from '../PaymentMethodIcon'
import { useMethodList } from '../../hooks/usePaymentMethods'
import { methodLabel } from '../../lib/paymentMethods'
import { PendingBadge } from '../common/TxList'
import { categoryIcon } from '../../config/categoryIcons'
import { formatFullDate } from '../../lib/format'
import { amountLabel } from '../../lib/txDisplay'
import useDismiss from '../../hooks/useDismiss'
import useFocusTrap from '../../hooks/useFocusTrap'

const TYPE_WORDS = { income: 'Money in', expense: 'Money out', transfer: 'Transfer' }

function Row({ label, children }) {
  if (!children) return null
  return (
    <div className="bfh-detail__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * One transaction, read at a glance: the amount and what it was for lead, the
 * rest is a short list of facts that only shows what was filled in. Deleting
 * is immediate; the toast that follows carries Undo.
 */
export default function DetailPanel({ tx, client, symbol, categoryIcons = {}, onClose, onEdit, onDelete }) {
  const [closing, dismiss] = useDismiss(onClose, 240)
  const method = methodLabel(tx, useMethodList() ?? [])
  const trapRef = useFocusTrap()
  const Icon = categoryIcon(categoryIcons[tx.category])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  return (
    <aside
      className="bfh-panel bfh-detail"
      data-state={closing ? 'closing' : 'open'}
      ref={trapRef}
      tabIndex={-1}
      aria-label="Transaction detail"
    >
      <header className="bfh-panel__head">
        {/* Full screen on a phone, so "back" is the truthful affordance. */}
        <button type="button" className="bfh-panel__back" onClick={dismiss}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Back
        </button>
        <span className="bfh-micro bfh-panel__title-text">{TYPE_WORDS[tx.type] ?? 'Transaction'}</span>
        <button type="button" className="bfh-sheet__close bfh-panel__close" onClick={dismiss} aria-label="Close">
          <IconX size={16} stroke={1.75} aria-hidden="true" />
        </button>
      </header>

      <div className="bfh-panel__body">
        <div className="bfh-detail__hero">
          <span className="bfh-detail__icon" aria-hidden="true">
            <Icon size={20} stroke={1.5} />
          </span>
          <span className="bfh-detail__amount" data-type={tx.type}>
            {amountLabel(tx, symbol)}
          </span>
          <h2 className="bfh-detail__name">{tx.description}</h2>
          <span className="bfh-detail__date">{formatFullDate(tx.date)}</span>
          {tx.status === 'pending' && <PendingBadge tx={tx} />}
        </div>

        <dl className="bfh-detail__list">
          <Row label="Category">{tx.category}</Row>
          <Row label="Type">{TYPE_WORDS[tx.type]}</Row>
          <Row label="Status">{tx.status === 'pending' ? 'Pending' : 'Cleared'}</Row>
          <Row label="Client">{client ? `${client.company} · ${client.name}` : null}</Row>
          <Row label="Paid with">
            {method ? (
              <span className="bfh-detail__method">
                <PaymentMethodIcon name={method.replace(/ · removed$/, '')} size={22} />
                {method}
              </span>
            ) : null}
          </Row>
          <Row label="Notes">{tx.notes}</Row>
        </dl>
      </div>

      <footer className="bfh-panel__foot">
        {/* No "are you sure?" step: the delete happens and the toast that
            follows offers Undo, which is quicker and forgives a slip. */}
        <>
            <button type="button" className="bfh-btn-primary" onClick={() => onEdit(tx)}>
              <IconPencil size={15} stroke={1.75} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className="bfh-btn-outline"
              onClick={() => onDelete(tx)}
              aria-label="Delete transaction"
            >
              <IconTrash size={15} stroke={1.75} aria-hidden="true" />
              Delete
            </button>
        </>
      </footer>
    </aside>
  )
}
