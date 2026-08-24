import { useEffect, useRef, useState } from 'react'

import { db } from '../../db/db'
import { addGoal } from '../../db/queries'
import useFocusTrap from '../../hooks/useFocusTrap'

const TODAY = () => new Date().toISOString().slice(0, 10)

const toForm = (goal) => ({
  name: goal?.name ?? '',
  target: goal?.target != null ? String(goal.target) : '',
  current: goal?.current != null ? String(goal.current) : '',
  deadline: goal?.deadline ?? '',
  notes: goal?.notes ?? '',
  // An existing goal without a date opens with the toggle already off.
  noDeadline: goal ? !goal.deadline : false,
})

export default function GoalModal({ goal, symbol, onClose }) {
  const [form, setForm] = useState(() => toForm(goal))
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const isEdit = Boolean(goal?.id)

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

    const target = Number(form.target)
    if (!form.target || Number.isNaN(target) || target <= 0) next.target = 'Enter an amount above 0'

    const current = form.current === '' ? 0 : Number(form.current)
    if (Number.isNaN(current) || current < 0) next.current = 'Enter 0 or more'

    setErrors(next)
    if (Object.keys(next).length) return

    const record = {
      name: form.name.trim(),
      target,
      current,
      deadline: form.noDeadline ? null : form.deadline || null,
      notes: form.notes.trim(),
    }

    if (isEdit) await db.goals.update(goal.id, record)
    else await addGoal('personal', record)
    onClose()
  }

  const remove = async () => {
    await db.goals.delete(goal.id)
    onClose()
  }

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit goal' : 'New goal'}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">{isEdit ? 'Edit goal' : 'New goal'}</h2>
          <span className="bfh-micro">{isEdit ? `#${goal.id}` : 'Savings target'}</span>
        </header>

        <div className="bfh-form">
          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Goal name</span>
            <input
              ref={firstField}
              value={form.name}
              onChange={set('name')}
              placeholder="What are you saving for?"
            />
            {errors.name && <span className="bfh-formerror">{errors.name}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Target amount</span>
            <span className="bfh-moneyfield">
              <span className="bfh-moneyfield__symbol" aria-hidden="true">
                {symbol}
              </span>
              <input type="number" min="0" step="0.01" value={form.target} onChange={set('target')} />
            </span>
            {errors.target && <span className="bfh-formerror">{errors.target}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Already saved</span>
            <span className="bfh-moneyfield">
              <span className="bfh-moneyfield__symbol" aria-hidden="true">
                {symbol}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.current}
                onChange={set('current')}
                placeholder="0"
              />
            </span>
            <span className="bfh-formhint">How much have you already set aside for this?</span>
            {errors.current && <span className="bfh-formerror">{errors.current}</span>}
          </label>

          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Deadline</span>
            <div className="bfh-goalform__deadline">
              <input
                type="date"
                min={TODAY()}
                value={form.deadline}
                onChange={set('deadline')}
                disabled={form.noDeadline}
                aria-label="Deadline date"
              />
              <label className="bfh-checkline">
                <input
                  type="checkbox"
                  checked={form.noDeadline}
                  onChange={(e) => setForm((f) => ({ ...f, noDeadline: e.target.checked }))}
                />
                <span>No deadline</span>
              </label>
            </div>
          </div>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Notes</span>
            <textarea rows={2} value={form.notes} onChange={set('notes')} />
          </label>
        </div>

        <footer className="bfh-modal__foot">
          {isEdit && (
            <button
              type="button"
              className="bfh-btn-ghost bfh-modal__delete bfh-btn--dashed"
              onClick={() => (confirming ? remove() : setConfirming(true))}
            >
              {confirming ? 'Confirm delete' : 'Delete goal'}
            </button>
          )}
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary">
            Save goal
          </button>
        </footer>
      </form>
    </div>
  )
}
