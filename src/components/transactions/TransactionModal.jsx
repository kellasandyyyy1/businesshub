import { useEffect, useRef, useState } from 'react'

import { IconArrowsExchange, IconChevronDown, IconX } from '@tabler/icons-react'

import CategorySuggestion, { recordCategorization } from '../ai/CategorySuggestion'
import useDismiss from '../../hooks/useDismiss'
import useFocusTrap from '../../hooks/useFocusTrap'
import useSettings from '../../hooks/useSettings'
import { useProfile } from '../../context/ProfileContext'
import { useToast } from '../../context/ToastContext'
import usePaymentMethods from '../../hooks/usePaymentMethods'
import { matchMethod, methodLabel } from '../../lib/paymentMethods'
import PaymentMethodPicker, { KEEP } from './PaymentMethodPicker'
import { OWNER_DRAW_CATEGORY } from '../../db/defaults'
import { addTransaction, addTransactionWithDraw, updateTransactionWithDraw } from '../../db/queries'
import { formatCurrency } from '../../lib/format'
import { txNoun } from '../../lib/toastCopy'

/* Worded the way people think about money, in the order they reach for it. */
const TYPE_CHOICES = [
  { value: 'expense', label: 'Money out' },
  { value: 'income', label: 'Money in' },
  { value: 'transfer', label: 'Transfer' },
]

const STATUS_CHOICES = [
  { value: 'cleared', label: 'Cleared' },
  { value: 'pending', label: 'Pending' },
]

const TODAY = () => new Date().toISOString().slice(0, 10)

const emptyTransaction = () => ({
  description: '',
  amount: '',
  type: 'expense',
  category: '',
  date: TODAY(),
  clientId: '',
  paymentMethod: '',
  paymentMethodId: '',
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
    paymentMethodId: tx.paymentMethodId ?? '',
    notes: tx.notes ?? '',
    status: tx.status ?? 'cleared',
  }
}

export default function TransactionModal({
  transaction,
  categories,
  clients,
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
  const toast = useToast()
  const methods = usePaymentMethods(profile)

  const isEdit = Boolean(transaction?.id)

  // Once the saved methods have loaded, settle what the picker starts on:
  //   editing          the method it was saved with (or its old label, kept)
  //   assistant text   the saved method it names. Exact, or the only close
  //                    one; anything else is left empty, never invented
  //   new entry        whichever method this profile used last
  const settled = useRef(false)
  useEffect(() => {
    if (!methods || settled.current) return
    settled.current = true
    setForm((f) => {
      if (f.paymentMethodId) {
        return methods.all.some((m) => m.id === f.paymentMethodId) ? f : { ...f, paymentMethodId: KEEP }
      }
      if (f.paymentMethod) {
        const match = matchMethod(f.paymentMethod, methods.active, { partial: !isEdit })
        if (match) return { ...f, paymentMethodId: match.id }
        return isEdit ? { ...f, paymentMethodId: KEEP } : { ...f, paymentMethod: '' }
      }
      if (!isEdit && methods.lastUsed) return { ...f, paymentMethodId: methods.lastUsed }
      return f
    })
  }, [methods, isEdit])

  // Active methods, plus the one this entry already uses if it has since been
  // switched off. An edit should never silently drop it.
  const pickable = methods
    ? [
        ...methods.active,
        ...methods.all.filter((m) => !m.active && m.id === form.paymentMethodId),
      ]
    : []
  const keepLabel = transaction && form.paymentMethodId === KEEP ? methodLabel(transaction, methods?.all ?? []) : null
  const title = isEdit
    ? 'Edit transaction'
    : isPersonal
      ? 'New personal transaction'
      : 'New transaction'
  const [closing, dismiss] = useDismiss(onClose)
  // Extra fields start folded away on a new entry, and open on an edit that
  // already uses them so nothing saved is hidden.
  const [showMore, setShowMore] = useState(() =>
    Boolean(
      transaction?.notes ||
        transaction?.paymentMethod ||
        transaction?.clientId ||
        transaction?.status === 'pending',
    ),
  )

  // The amount is what people type first. On a mouse-and-keyboard screen it
  // takes focus once the sheet has settled; on a phone the keyboard stays shut
  // until a field is tapped, so it does not shove the sheet mid-animation.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return undefined
    const t = setTimeout(() => firstField.current?.focus(), 260)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

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
    if (!form.description.trim()) next.description = 'Add a short description'
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount above 0'
    if (!form.date) next.date = 'Pick a date'
    if (!form.category) next.category = 'Pick a category'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // The id and name snapshot to store: the picked method as it is named now,
  // the entry's own older label when that was kept, or nothing.
  const methodFieldsFor = (value) => {
    if (value === KEEP) {
      return { paymentMethodId: transaction?.paymentMethodId ?? null, paymentMethod: transaction?.paymentMethod ?? '' }
    }
    const picked = methods?.all.find((m) => m.id === value)
    return picked ? { paymentMethodId: picked.id, paymentMethod: picked.name } : { paymentMethodId: null, paymentMethod: '' }
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
      ...methodFieldsFor(form.paymentMethodId),
      notes: form.notes.trim(),
      status: form.status,
    }

    const pair = !isEdit && showDrawToggle && alsoPersonal
    try {
      if (isEdit) {
        // Keeps the personal half in step when this row is part of a pair.
        await updateTransactionWithDraw(transaction.id, record)
      } else if (pair) {
        await addTransactionWithDraw({ ...record, receiptUrl: null }, { alsoPersonal: true })
      } else {
        await addTransaction(profile, {
          ...record,
          receiptUrl: null,
        })
      }
    } catch {
      setSaving(false)
      toast.error("Couldn't save. Try again.")
      return
    }
    // Every save is a confirmed categorisation, whether the user accepted a
    // suggestion or picked the category themselves. Losing one only costs a
    // future suggestion, so it never blocks the save.
    await recordCategorization(record).catch(() => {})
    // Named for what it is, with the amount, so the right entry is confirmed:
    // "Income added · ₱24,635", "Expense updated", "Transfer recorded · ₱5,000".
    const noun = pair ? 'Transfer' : txNoun(record.type)
    const amount = formatCurrency(record.amount, symbol)
    toast.success(
      isEdit ? `${noun} updated` : noun === 'Transfer' ? `Transfer recorded · ${amount}` : `${noun} added · ${amount}`,
    )
    dismiss()
  }

  const submitLabel = isEdit
    ? 'Save changes'
    : form.type === 'income'
      ? 'Add money in'
      : form.type === 'expense'
        ? 'Add money out'
        : 'Add transfer'

  const chooseType = (t) =>
    setForm((f) => ({
      ...f,
      type: t,
      // The old category may not belong to the new ledger.
      category: categories.some((c) => c.name === f.category && (t === 'transfer' || c.type === t))
        ? f.category
        : '',
    }))

  return (
    <div
      className="bfh-modal bfh-sheet"
      data-state={closing ? 'closing' : 'open'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bfh-txsheet-title"
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={dismiss} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit} noValidate>
        <header className="bfh-sheet__head">
          <h2 id="bfh-txsheet-title" className="bfh-sheet__title">
            {title}
          </h2>
          <button type="button" className="bfh-sheet__close" aria-label="Close" onClick={dismiss}>
            <IconX size={16} stroke={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="bfh-sheet__body">
          {/* What kind of money this is decides everything below it, so it
              comes first and is one tap. */}
          <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-label="Transaction type">
            {TYPE_CHOICES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                className="bfh-segment__option"
                aria-checked={form.type === t.value}
                onClick={() => chooseType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="bfh-amountfield" data-invalid={errors.amount ? 'true' : undefined}>
            <span className="bfh-fieldlabel">Amount</span>
            <span className="bfh-amountfield__box">
              <span className="bfh-amountfield__symbol" aria-hidden="true">
                {form.type === 'income' ? '+' : form.type === 'expense' ? '−' : ''}
                {symbol}
              </span>
              <input
                ref={firstField}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={set('amount')}
              />
            </span>
            {errors.amount && <span className="bfh-formerror">{errors.amount}</span>}
          </label>

          <label className="bfh-formfield" data-invalid={errors.description ? 'true' : undefined}>
            <span className="bfh-fieldlabel">
              {form.type === 'income' ? 'Where did it come from?' : form.type === 'expense' ? 'What was it for?' : 'Description'}
            </span>
            <input
              value={form.description}
              onChange={set('description')}
              placeholder={form.type === 'income' ? 'e.g. Salary, client payment' : 'e.g. Groceries, rent, software'}
              autoComplete="off"
            />
            {errors.description && <span className="bfh-formerror">{errors.description}</span>}
          </label>

          <div className="bfh-sheet__pair">
            <label className="bfh-formfield" data-invalid={errors.category ? 'true' : undefined}>
              <span className="bfh-fieldlabel">Category</span>
              <select value={form.category} onChange={set('category')}>
                <option value="">Choose…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <span className="bfh-formerror">{errors.category}</span>}
            </label>

            <label className="bfh-formfield" data-invalid={errors.date ? 'true' : undefined}>
              <span className="bfh-fieldlabel">Date</span>
              <input type="date" value={form.date} onChange={set('date')} />
              {errors.date && <span className="bfh-formerror">{errors.date}</span>}
            </label>
          </div>

          {!form.category && (
            <CategorySuggestion
              description={form.description}
              amount={form.amount}
              type={form.type}
              categories={categories}
              onAccept={(category) => setForm((f) => ({ ...f, category }))}
            />
          )}

          {/* Paying yourself is the one business expense that is also personal
              income. Offered only on that category, and only on a new row,
              an existing pair is already linked, and one that is not should
              not gain a second record retrospectively. */}
          {showDrawToggle && (
            <div className="bfh-formfield bfh-drawlink">
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

          <button
            type="button"
            className="bfh-sheet__more"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            <span>More details</span>
            <span className="bfh-sheet__morehint">
              {isPersonal ? 'Status, payment method, notes' : 'Client, status, payment method, notes'}
            </span>
            <IconChevronDown size={16} stroke={1.5} aria-hidden="true" />
          </button>

          {showMore && (
            <div className="bfh-sheet__extra">
              <div className="bfh-formfield">
                <span className="bfh-fieldlabel">Status</span>
                <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-label="Status">
                  {STATUS_CHOICES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      className="bfh-segment__option"
                      aria-checked={form.status === s.value}
                      onClick={() => setForm((f) => ({ ...f, status: s.value }))}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="bfh-fieldhint">
                  {form.status === 'pending'
                    ? 'Not in your account yet. It will not count toward your cash balance.'
                    : 'The money has already moved.'}
                </span>
              </div>

              {!isPersonal && (
                <label className="bfh-formfield">
                  <span className="bfh-fieldlabel">Client</span>
                  <select value={form.clientId} onChange={set('clientId')}>
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <PaymentMethodPicker
                value={form.paymentMethodId}
                onChange={(next) => setForm((f) => ({ ...f, paymentMethodId: next }))}
                methods={methods ? pickable : null}
                keep={keepLabel}
              />

              <label className="bfh-formfield">
                <span className="bfh-fieldlabel">Notes</span>
                <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering" />
              </label>
            </div>
          )}
        </div>

        <footer className="bfh-sheet__foot">
          <button type="button" className="bfh-btn-text" onClick={dismiss}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary bfh-sheet__submit" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </footer>
      </form>
    </div>
  )
}
