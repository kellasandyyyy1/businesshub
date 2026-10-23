import {
  IconArrowsExchange,
  IconChartBar,
  IconCheck,
  IconFileInvoice,
  IconPigMoney,
  IconTarget,
  IconTargetArrow,
  IconTrendingDown,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { categoryIcon } from '../../config/categoryIcons'
import { formatCurrency, formatDate } from '../../lib/format'
import { signedLabel } from '../../lib/txDisplay'

/** How long "Saved." stays up before the card folds away. */
const SAVED_HOLD_MS = 1500

const PERIOD_SUFFIX = { monthly: '/ mo', quarterly: '/ qtr', yearly: '/ yr' }
const PERIOD_WORD = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }
const TYPE_WORD = { income: 'Income', expense: 'Expense', transfer: 'Transfer' }
const SIDE_WORD = { business: 'Business', personal: 'Personal' }

const dayLabel = (iso) => (iso === new Date().toISOString().slice(0, 10) ? 'Today' : formatDate(iso))
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * What each kind of card says. Every card has the same anatomy, an eyebrow,
 * an icon, a title, one line of context and a figure, so the person learns
 * to read one and can read them all.
 */
function describe(card, { symbol, categoryIcons }) {
  const { prefill: p, existing } = card
  const money = (v) => formatCurrency(v, symbol)

  switch (card.type) {
    case 'ADD_TRANSACTION': {
      const amount = Number(p.amount) || 0
      const signed = p.type === 'income' ? amount : p.type === 'expense' ? -amount : 0
      return {
        eyebrow: 'Add transaction',
        Icon: categoryIcon(categoryIcons[p.category]),
        title: p.category || p.description || 'Transaction',
        meta: [p.category && p.description, TYPE_WORD[p.type], dayLabel(p.date), SIDE_WORD[p.profile]],
        figure: amount > 0 ? signedLabel(signed, symbol) : 'Not set',
        saveLabel: 'Save transaction',
      }
    }
    case 'UPDATE_GOAL':
      return {
        eyebrow: existing ? 'Update goal' : 'New goal',
        Icon: IconTarget,
        title: p.name || 'Savings goal',
        meta: [
          existing && Number(existing.target) !== p.target ? `Was ${money(existing.target)}` : null,
          p.deadline ? `By ${formatDate(p.deadline)}` : 'No deadline',
        ],
        figure: p.target ? money(p.target) : 'Not set',
        note: p.current > 0 ? `${money(p.current)} saved so far` : null,
        saveLabel: existing ? 'Update goal' : 'Save goal',
      }
    case 'ADD_SAVINGS_ENTRY':
      return {
        eyebrow: 'Savings deposit',
        Icon: IconPigMoney,
        title: existing ? `Toward ${existing.name}` : p.goalName || 'Savings',
        meta: [dayLabel(p.date), existing && `${money(existing.current ?? 0)} → ${money((Number(existing.current) || 0) + p.amount)}`],
        figure: p.amount ? signedLabel(p.amount, symbol) : 'Not set',
        saveLabel: 'Save deposit',
        fixLabel: 'Create goal',
      }
    case 'SET_BUDGET':
      return {
        eyebrow: existing ? 'Update budget' : 'Set budget',
        Icon: p.category ? categoryIcon(categoryIcons[p.category]) : IconTargetArrow,
        title: p.category || 'Budget',
        meta: [PERIOD_WORD[p.period], 'Business', existing && `Was ${money(existing.amount)}`],
        figure: p.amount ? `${money(p.amount)} ${PERIOD_SUFFIX[p.period]}` : 'Not set',
        saveLabel: existing ? 'Update budget' : 'Save budget',
      }
    case 'ADD_INVOICE':
      return {
        eyebrow: 'New invoice',
        Icon: IconFileInvoice,
        title: p.clientName || 'Client',
        meta: [clip(p.description, 40), `Due ${formatDate(p.dueDate)}`],
        figure: p.rate ? money(p.total) : 'Not set',
        badge: 'Draft',
        note: p.rate && p.tax > 0 ? `${money(p.subtotal)} + ${p.taxRate}% tax` : null,
        saveLabel: 'Save draft',
      }
    case 'ADD_CLIENT':
      return {
        eyebrow: 'Add client',
        Icon: IconUser,
        title: p.name || 'Client',
        meta: [p.company !== p.name && p.company, p.email || p.phone, 'Business'],
        figure: null,
        saveLabel: 'Save client',
      }
    case 'ADD_TRANSFER':
      return {
        eyebrow: 'Transfer',
        Icon: IconArrowsExchange,
        title: 'Business → Personal',
        meta: [dayLabel(p.date), 'Owner draw / salary'],
        figure: p.amount ? money(p.amount) : 'Not set',
        note: 'Recorded on both sides: an expense to the business, income to you.',
        saveLabel: 'Save transfer',
      }
    case 'UPDATE_NET_WORTH':
      return {
        eyebrow: existing ? 'Update net worth' : 'Net worth entry',
        Icon: p.type === 'liability' ? IconTrendingDown : IconChartBar,
        title: p.name || 'Entry',
        meta: [p.category, p.type === 'liability' ? 'Liability' : 'Asset', existing && `Was ${money(existing.amount)}`],
        figure: p.amount ? signedLabel(p.type === 'liability' ? -p.amount : p.amount, symbol) : 'Not set',
        saveLabel: existing ? 'Update entry' : 'Save entry',
      }
    default:
      return null
  }
}

/**
 * What the assistant understood, shown before anything is written. The person
 * reads it, then saves, edits it in the full form, or dismisses it, nothing
 * is stored until they tap Save, and an ignored card simply stays put.
 *
 * `card.status` is owned by the assistant: pending → saving → saved, or
 * dismissed, or error. Folding away after "Saved." is the card's own business.
 * A card with a `problem` cannot be saved as it stands, so its main button
 * opens the form instead of saving a guess.
 */
export default function ActionConfirmCard({ card, symbol, categoryIcons = {}, canEdit, onSave, onEdit, onDismiss }) {
  const { status, problem } = card
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    if (status !== 'saved') return undefined
    const timer = setTimeout(() => setFolded(true), SAVED_HOLD_MS)
    return () => clearTimeout(timer)
  }, [status])

  const view = describe(card, { symbol, categoryIcons })
  if (!view) return null
  const { Icon } = view
  const collapsed = status === 'dismissed' || folded
  const meta = view.meta.filter(Boolean).join(' · ')

  return (
    <div className="bfh-confirm" data-state={collapsed ? 'collapsed' : status} aria-hidden={collapsed || undefined}>
      <div className="bfh-confirm__inner">
        <section className="bfh-confirm__card" aria-label={view.eyebrow}>
          {status === 'saved' ? (
            <p className="bfh-confirm__saved" role="status">
              <IconCheck size={16} stroke={2} aria-hidden="true" />
              Saved.
            </p>
          ) : (
            <>
              <header className="bfh-confirm__head">
                <span className="bfh-confirm__eyebrow">
                  {view.eyebrow}
                  {view.badge && <span className="bfh-confirm__badge">{view.badge}</span>}
                </span>
                <button
                  type="button"
                  className="bfh-confirm__close"
                  onClick={() => onDismiss(card.id)}
                  disabled={status === 'saving'}
                  aria-label="Dismiss, do not save"
                >
                  <IconX size={13} stroke={1.75} aria-hidden="true" />
                </button>
              </header>

              <div className="bfh-confirm__details">
                <span className="bfh-confirm__icon" aria-hidden="true">
                  <Icon size={14} stroke={1.5} />
                </span>
                <span className="bfh-confirm__body">
                  <span className="bfh-confirm__name">{view.title}</span>
                  {meta && <span className="bfh-confirm__meta">{meta}</span>}
                </span>
                {view.figure && <span className="bfh-confirm__amount">{view.figure}</span>}
              </div>

              {view.note && !problem && <p className="bfh-confirm__note">{view.note}</p>}
              {problem && <p className="bfh-confirm__note bfh-confirm__note--warn">{problem}</p>}
              {status === 'error' && (
                <p className="bfh-confirm__note bfh-confirm__note--warn" role="alert">
                  Could not save. Try again{canEdit ? ', or edit it in the form' : ''}.
                </p>
              )}

              <div className="bfh-confirm__actions">
                {status === 'saving' ? (
                  <span className="bfh-confirm__saving" role="status">
                    Saving
                    <span className="bfh-assist__dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </span>
                ) : (
                  <>
                    {canEdit && !problem && (
                      <button type="button" className="bfh-confirm__edit" onClick={() => onEdit(card)}>
                        Edit
                      </button>
                    )}
                    {!problem ? (
                      <button type="button" className="bfh-confirm__save" onClick={() => onSave(card)}>
                        <IconCheck size={13} stroke={2} aria-hidden="true" />
                        {view.saveLabel}
                      </button>
                    ) : canEdit ? (
                      <button type="button" className="bfh-confirm__save" onClick={() => onEdit(card)}>
                        {view.fixLabel ?? 'Complete in form'}
                      </button>
                    ) : (
                      <button type="button" className="bfh-confirm__edit" onClick={() => onDismiss(card.id)}>
                        Dismiss
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
