import { useEffect, useRef, useState } from 'react'

import { BUDGET_PERIODS, db } from '../../db/db'
import { BUSINESS_PROFILE, addBudget } from '../../db/queries'
import { useToast } from '../../context/ToastContext'
import useFocusTrap from '../../hooks/useFocusTrap'
import { removeWithUndo } from '../../lib/softDelete'
import { short } from '../../lib/toastCopy'

const emptyBudget = () => ({ name: '', category: '', amount: '', period: 'monthly' })

export default function BudgetModal({ budget, categories, onClose }) {
  const [form, setForm] = useState(() =>
    budget
      ? {
          name: budget.name,
          category: budget.category,
          amount: String(budget.amount),
          period: budget.period,
        }
      : emptyBudget(),
  )
  const [errors, setErrors] = useState({})
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const isEdit = Boolean(budget?.id)

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
      name: form.name.trim(),
      category: form.category,
      amount,
      period: form.period,
    }

    try {
      if (isEdit) await db.budgets.update(budget.id, record)
      else await addBudget(BUSINESS_PROFILE, record)
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${(/budget/i.test(record.name) ? short(record.name) : `${short(record.name)} budget`)} ${isEdit ? 'updated' : 'created'}`)
    onClose()
  }

  // Straight away, no second tap — the toast that follows carries Undo.
  const remove = async () => {
    onClose()
    await removeWithUndo(
      toast,
      'budgets',
      budget.id,
      `${/budget/i.test(budget.name) ? short(budget.name) : `${short(budget.name)} budget`} removed`,
      'Budget restored',
    )
  }

  // Only expenses have budgets; income categories would never be spent against.
  const options = categories.filter((c) => c.type === 'expense')

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit budget' : 'Add budget'}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">{isEdit ? 'Edit budget' : 'Add budget'}</h2>
          <span className="bfh-micro">{isEdit ? `#${budget.id}` : 'New budget'}</span>
        </header>

        <div className="bfh-form">
          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Name</span>
            <input ref={firstField} value={form.name} onChange={set('name')} />
            {errors.name && <span className="bfh-formerror">{errors.name}</span>}
          </label>

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

          <label className="bfh-formfield">
            <span className="bfh-micro">Amount</span>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} />
            {errors.amount && <span className="bfh-formerror">{errors.amount}</span>}
          </label>

          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Period</span>
            <div className="bfh-toggle" role="group" aria-label="Budget period">
              {BUDGET_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="bfh-toggle__option"
                  aria-pressed={form.period === p}
                  onClick={() => setForm((f) => ({ ...f, period: p }))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="bfh-modal__foot">
          {isEdit && (
            <button
              type="button"
              className="bfh-btn-ghost bfh-modal__delete"
              onClick={remove}
            >
              Delete
            </button>
          )}
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
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
