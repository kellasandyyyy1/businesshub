import { useEffect, useRef, useState } from 'react'

import { db } from '../../db/db'
import { addNetWorthEntry } from '../../db/queries'
import { useToast } from '../../context/ToastContext'
import useFocusTrap from '../../hooks/useFocusTrap'
import { removeWithUndo } from '../../lib/softDelete'
import { short } from '../../lib/toastCopy'
import { NET_WORTH_TYPES, categoriesFor } from '../../lib/netWorth'

const toForm = (item, defaultType) => ({
  type: item?.type ?? defaultType ?? 'asset',
  name: item?.name ?? '',
  category: item?.category ?? '',
  amount: item?.amount != null ? String(item.amount) : '',
  notes: item?.notes ?? '',
})

export default function NetWorthModal({ item, defaultType, symbol, onClose }) {
  const [form, setForm] = useState(() => toForm(item, defaultType))
  const [errors, setErrors] = useState({})
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const isEdit = Boolean(item?.id)

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

  const options = categoriesFor(form.type)

  const onSubmit = async (e) => {
    e.preventDefault()

    const next = {}
    if (!form.name.trim()) next.name = 'Required'
    if (!form.category) next.category = 'Pick a category'

    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount above 0'

    setErrors(next)
    if (Object.keys(next).length) return

    const record = {
      type: form.type,
      name: form.name.trim(),
      category: form.category,
      amount,
      notes: form.notes.trim(),
    }

    // A balance that has not been re-stated is stale, so every save restamps it
    // — that timestamp is what the summary's "updated" line reports.
    try {
      if (isEdit) await db.netWorth.update(item.id, { ...record, updatedAt: new Date().toISOString() })
      else await addNetWorthEntry('personal', record)
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    const side = record.type === 'liability' ? 'debts' : 'assets'
    toast.success(isEdit ? `${short(record.name)} updated` : `${short(record.name)} added to ${side}`)
    onClose()
  }

  // Straight away, no second tap — the toast that follows carries Undo.
  const remove = async () => {
    onClose()
    await removeWithUndo(
      toast,
      'netWorth',
      item.id,
      `${short(item.name)} removed from ${item.type === 'liability' ? 'debts' : 'assets'}`,
      `${short(item.name)} restored`,
    )
  }

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit item' : 'Add item'}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">
            {isEdit ? 'Edit' : 'Add'} {form.type === 'liability' ? 'a debt' : 'an asset'}
          </h2>
        </header>

        <div className="bfh-form">
          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-fieldlabel">Is this…</span>
            <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-label="Item type">
              {NET_WORTH_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  className="bfh-segment__option"
                  aria-checked={form.type === t}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      type: t,
                      // The two sides have different categories, so a choice
                      // made on one cannot survive a switch to the other.
                      category: categoriesFor(t).includes(f.category) ? f.category : '',
                    }))
                  }
                >
                  {t === 'liability' ? 'Something I owe' : 'Something I own'}
                </button>
              ))}
            </div>
          </div>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-fieldlabel">Name</span>
            <input
              ref={firstField}
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. BDO Savings Account"
            />
            {errors.name && <span className="bfh-formerror">{errors.name}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">Category</span>
            <select value={form.category} onChange={set('category')}>
              <option value="">Select…</option>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && <span className="bfh-formerror">{errors.category}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">Amount</span>
            <span className="bfh-moneyfield">
              <span className="bfh-moneyfield__symbol" aria-hidden="true">
                {symbol}
              </span>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} />
            </span>
            {errors.amount && <span className="bfh-formerror">{errors.amount}</span>}
          </label>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-fieldlabel">Notes</span>
            <textarea rows={2} value={form.notes} onChange={set('notes')} />
          </label>
        </div>

        <footer className="bfh-modal__foot">
          {isEdit && (
            <button
              type="button"
              className="bfh-btn-ghost bfh-modal__delete bfh-btn--dashed"
              onClick={remove}
            >
              Remove
            </button>
          )}
          <button type="button" className="bfh-btn-text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary">
            Save
          </button>
        </footer>
      </form>
    </div>
  )
}
