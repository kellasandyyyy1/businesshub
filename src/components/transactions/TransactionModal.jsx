import { useEffect, useRef, useState } from 'react'

import { IconArrowsExchange } from '@tabler/icons-react'

import CategorySuggestion, { recordCategorization } from '../ai/CategorySuggestion'
import useFocusTrap from '../../hooks/useFocusTrap'
import useSettings from '../../hooks/useSettings'
import { useProfile } from '../../context/ProfileContext'
import { TRANSACTION_STATUSES, TRANSACTION_TYPES, db } from '../../db/db'
import { OWNER_DRAW_CATEGORY } from '../../db/defaults'
import { addTransaction, addTransactionWithDraw, updateTransactionWithDraw } from '../../db/queries'
import { formatCurrency } from '../../lib/format'

const TODAY = () => new Date().toISOString().slice(0, 10)

const emptyTransaction = () => ({
  description: '',
  amount: '',
  type: 'expense',
  category: '',
  date: TODAY(),
  clientId: '',
  paymentMethod: '',
  notes: '',
  status: 'cleared',
})

/** Dexie rows carry numbers and nulls; form state carries strings. */
function toForm(tx) {
  if (!tx) return emptyTransaction()
  return {
    description: tx.description ?? '',
    amount: String(tx.amount ?? ''),
    type: tx.type ?? 'expense',
    category: tx.category ?? '',
    date: tx.date ?? TODAY(),
    clientId: tx.clientId ? String(tx.clientId) : '',
    paymentMethod: tx.paymentMethod ?? '',
    notes: tx.notes ?? '',
    status: tx.status ?? 'cleared',
  }
}

export default function TransactionModal({
  transaction,
  categories,
  clients,
  paymentMethods,
  onClose,
}) {
  // A household has no clients to bill, so that field is not shown and the
  // saved row carries no client id. The profile also decides which set of
  // books the transaction lands in.
  const { profile, isPersonal } = useProfile()
  const { symbol } = useSettings()
  const [form, setForm] = useState(() => toForm(transaction))
  // Off unless asked for. Recording money twice by accident is a worse mistake
  // than having to tick a box.
  const [alsoPersonal, setAlsoPersonal] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const firstField = useRef(null)
  const trapRef = useFocusTrap()

  const isEdit = Boolean(transaction?.id)
  const title = isEdit
    ? 'Edit transaction'
    : isPersonal
      ? 'Add personal transaction'
      : 'Add transaction'

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // A transfer belongs to neither ledger, so it may pick from any category.
  // A draw is a business expense booked to the owner-draw category. Personal
  // mode has no business to draw from, and an edit is left alone.
  const showDrawToggle =
    !isPersonal && !isEdit && form.type === 'expense' && form.category === OWNER_DRAW_CATEGORY

  const options =
    form.type === 'transfer' ? categories : categories.filter((c) => c.type === form.type)

  const validate = () => {
    const next = {}
    if (!form.description.trim()) next.description = 'Required'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount above 0'
    if (!form.date) next.date = 'Required'
    if (!form.category) next.category = 'Pick a category'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    const record = {
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      clientId: isPersonal || !form.clientId ? null : Number(form.clientId),
      paymentMethod: form.paymentMethod.trim(),
      notes: form.notes.trim(),
      status: form.status,
    }

    if (isEdit) {
      // Keeps the personal half in step when this row is part of a pair.
      await updateTransactionWithDraw(transaction.id, record)
    } else if (showDrawToggle && alsoPersonal) {
      await addTransactionWithDraw({ ...record, receiptUrl: null }, { alsoPersonal: true })
    } else {
      await addTransaction(profile, {
        ...record,
        receiptUrl: null,
      })
    }
    // Every save is a confirmed categorisation, whether the user accepted a
    // suggestion or picked the category themselves.
    await recordCategorization(record)
    onClose()
  }

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">{title}</h2>
          <span className="bfh-micro">{isEdit ? `#${transaction.id}` : 'New entry'}</span>
        </header>

        <div className="bfh-form">
          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Description</span>
            <input ref={firstField} value={form.description} onChange={set('description')} />
            {errors.description && <span className="bfh-formerror">{errors.description}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
            />
            {errors.amount && <span className="bfh-formerror">{errors.amount}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Date</span>
            <input type="date" value={form.date} onChange={set('date')} />
            {errors.date && <span className="bfh-formerror">{errors.date}</span>}
          </label>

          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Type</span>
            <div className="bfh-toggle" role="group" aria-label="Transaction type">
              {TRANSACTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="bfh-toggle__option"
                  aria-pressed={form.type === t}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      type: t,
                      // The old category may not belong to the new ledger.
                      category: categories.some((c) => c.name === f.category && (t === 'transfer' || c.type === t))
                        ? f.category
                        : '',
                    }))
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="bfh-formfield">
            <span className="bfh-micro">Category</span>
            <select value={form.category} onChange={set('category')}>
              <option value="">Select…</option>
              {options.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && <span className="bfh-formerror">{errors.category}</span>}
          </label>

          {!form.category && (
            <div className="bfh-formfield bfh-formfield--wide">
              <CategorySuggestion
                description={form.description}
                amount={form.amount}
                type={form.type}
                categories={categories}
                onAccept={(category) => setForm((f) => ({ ...f, category }))}
              />
            </div>
          )}

          {!isPersonal && (
            <label className="bfh-formfield">
              <span className="bfh-micro">Client (optional)</span>
              <select value={form.clientId} onChange={set('clientId')}>
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="bfh-formfield">
            <span className="bfh-micro">Payment method</span>
            <input
              value={form.paymentMethod}
              onChange={set('paymentMethod')}
              list="bfh-payment-methods"
            />
            <datalist id="bfh-payment-methods">
              {paymentMethods.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Status</span>
            <select value={form.status} onChange={set('status')}>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Notes</span>
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>

          {/* Paying yourself is the one business expense that is also personal
              income. Offered only on that category, and only on a new row —
              an existing pair is already linked, and one that is not should
              not gain a second record retrospectively. */}
          {showDrawToggle && (
            <div className="bfh-formfield bfh-formfield--wide bfh-drawlink">
              <button
                type="button"
                className="bfh-drawlink__toggle"
                aria-pressed={alsoPersonal}
                onClick={() => setAlsoPersonal((on) => !on)}
              >
                <span className="bfh-drawlink__dot" aria-hidden="true" />
                Also record as personal income
              </button>

              {alsoPersonal && (
                <p className="bfh-drawlink__note">
                  <IconArrowsExchange size={12} stroke={1.5} aria-hidden="true" />
                  This will also add {formatCurrency(Number(form.amount) || 0, symbol)} as income in
                  Personal Finance.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="bfh-modal__foot">
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary" disabled={saving}>
            Save
          </button>
        </footer>
      </form>
    </div>
  )
}
