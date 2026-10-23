import { IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { db } from '../../db/db'
import { addGoal } from '../../db/queries'
import useDismiss from '../../hooks/useDismiss'
import { useToast } from '../../context/ToastContext'
import useFocusTrap from '../../hooks/useFocusTrap'
import { removeWithUndo } from '../../lib/softDelete'
import { short } from '../../lib/toastCopy'
import { formatCurrency } from '../../lib/format'
import { deadlineLabel, monthlySaveNeeded } from '../../lib/goals'

const TODAY = () => new Date().toISOString().slice(0, 10)

/** What people most often save for. One tap fills the name. */
const IDEAS = ['Emergency fund', 'Travel', 'New phone', 'Education', 'House down payment', 'Wedding']

function monthsFromToday(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Dates people think in, rather than a calendar to page through. */
const QUICK_DATES = [
  { label: 'In 3 months', date: () => monthsFromToday(3) },
  { label: 'In 6 months', date: () => monthsFromToday(6) },
  { label: 'In 1 year', date: () => monthsFromToday(12) },
  { label: 'End of year', date: () => `${new Date().getFullYear()}-12-31` },
]

const toForm = (goal) => ({
  name: goal?.name ?? '',
  target: goal?.target != null ? String(goal.target) : '',
  current: goal?.current ? String(goal.current) : '',
  deadline: goal?.deadline ?? '',
  notes: goal?.notes ?? '',
  // An existing goal without a date opens on "No deadline".
  noDeadline: goal?.id ? !goal.deadline : false,
})

/**
 * Creating or editing a savings goal.
 *
 * The form works out the plan while it is being filled in: as soon as there
 * is a target and a date, it says what has to go in each month. The number
 * that tells someone whether the goal is realistic before they commit to it.
 */
export default function GoalModal({ goal, symbol, onClose }) {
  const [form, setForm] = useState(() => toForm(goal))
  const [errors, setErrors] = useState({})
  const [closing, dismiss] = useDismiss(onClose)
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const isEdit = Boolean(goal?.id)
  const money = (v) => formatCurrency(v, symbol)

  // Focus once the sheet has settled, and only where there is a keyboard,
  // on a phone it would raise the keyboard mid-animation.
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

  const target = Number(form.target) || 0
  const current = Number(form.current) || 0
  const deadline = form.noDeadline ? null : form.deadline || null
  const draft = { target, current, deadline }
  const perMonth = monthlySaveNeeded(draft, TODAY())
  const by = deadline ? deadlineLabel(draft).replace(/^Due /, '') : null

  // One sentence on what this goal asks for, updated as the fields change.
  let plan = null
  if (target > 0 && current >= target) plan = 'You have already saved enough for this. It will show as reached.'
  else if (target > 0 && deadline && perMonth)
    plan = `Save about ${money(Math.ceil(perMonth))} a month to reach ${money(target)} by ${by}.`
  else if (target > 0 && !deadline) plan = 'No deadline means no monthly plan. You can add a date any time.'

  const onSubmit = async (e) => {
    e.preventDefault()

    const next = {}
    if (!form.name.trim()) next.name = 'Give the goal a name'
    if (!(target > 0)) next.target = 'How much do you want to save?'
    if (form.current !== '' && (Number.isNaN(Number(form.current)) || Number(form.current) < 0)) {
      next.current = 'Enter 0 or more'
    }
    if (!form.noDeadline && !form.deadline) next.deadline = 'Pick a date, or choose No deadline'

    setErrors(next)
    if (Object.keys(next).length) return

    const record = {
      name: form.name.trim(),
      target,
      current,
      deadline,
      notes: form.notes.trim(),
    }

    try {
      if (isEdit) await db.goals.update(goal.id, record)
      else await addGoal('personal', record)
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${short(record.name)} goal ${isEdit ? 'updated' : 'created'}`)
    dismiss()
  }

  // Straight away, no second tap. The toast that follows carries Undo.
  const remove = async () => {
    dismiss()
    await removeWithUndo(toast, 'goals', goal.id, `${short(goal.name)} goal deleted`, 'Goal restored')
  }

  return (
    <div
      className="bfh-modal bfh-sheet"
      data-state={closing ? 'closing' : 'open'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bfh-goalsheet-title"
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={dismiss} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit} noValidate>
        <header className="bfh-sheet__head">
          <h2 id="bfh-goalsheet-title" className="bfh-sheet__title">
            {isEdit ? 'Edit goal' : 'New savings goal'}
          </h2>
          <button type="button" className="bfh-sheet__close" aria-label="Close" onClick={dismiss}>
            <IconX size={16} stroke={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="bfh-sheet__body">
          <label className="bfh-formfield" data-invalid={errors.name ? 'true' : undefined}>
            <span className="bfh-fieldlabel">What are you saving for?</span>
            <input
              ref={firstField}
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. New laptop"
              autoComplete="off"
            />
            {errors.name && <span className="bfh-formerror">{errors.name}</span>}
          </label>

          {!isEdit && !form.name && (
            <div className="bfh-goalform__ideas" aria-label="Ideas">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="bfh-assist__chip"
                  onClick={() => setForm((f) => ({ ...f, name: idea }))}
                >
                  {idea}
                </button>
              ))}
            </div>
          )}

          <div className="bfh-sheet__pair bfh-goalform__amounts">
            <label className="bfh-formfield" data-invalid={errors.target ? 'true' : undefined}>
              <span className="bfh-fieldlabel">Target</span>
              <span className="bfh-moneyfield">
                <span className="bfh-moneyfield__symbol" aria-hidden="true">
                  {symbol}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="50,000"
                  value={form.target}
                  onChange={set('target')}
                />
              </span>
              {errors.target && <span className="bfh-formerror">{errors.target}</span>}
            </label>

            <label className="bfh-formfield" data-invalid={errors.current ? 'true' : undefined}>
              <span className="bfh-fieldlabel">
                Saved so far <span className="bfh-fieldlabel__optional">optional</span>
              </span>
              <span className="bfh-moneyfield">
                <span className="bfh-moneyfield__symbol" aria-hidden="true">
                  {symbol}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={form.current}
                  onChange={set('current')}
                />
              </span>
              {errors.current && <span className="bfh-formerror">{errors.current}</span>}
            </label>
          </div>

          <div className="bfh-formfield" data-invalid={errors.deadline ? 'true' : undefined}>
            <span className="bfh-fieldlabel">When do you need it?</span>
            <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-label="Deadline">
              {[
                { value: false, label: 'By a date' },
                { value: true, label: 'No deadline' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  className="bfh-segment__option"
                  aria-checked={form.noDeadline === o.value}
                  onClick={() => setForm((f) => ({ ...f, noDeadline: o.value }))}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {!form.noDeadline && (
              <div className="bfh-goalform__when">
                <div className="bfh-goalform__quick">
                  {QUICK_DATES.map((q) => {
                    const date = q.date()
                    return (
                      <button
                        key={q.label}
                        type="button"
                        className="bfh-assist__chip"
                        aria-pressed={form.deadline === date}
                        onClick={() => setForm((f) => ({ ...f, deadline: date }))}
                      >
                        {q.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="date"
                  min={TODAY()}
                  value={form.deadline}
                  onChange={set('deadline')}
                  aria-label="Deadline date"
                />
              </div>
            )}
            {errors.deadline && <span className="bfh-formerror">{errors.deadline}</span>}
          </div>

          {plan && (
            <p className="bfh-goalform__plan" role="status">
              {plan}
            </p>
          )}

          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">
              Notes <span className="bfh-fieldlabel__optional">optional</span>
            </span>
            <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything to remember" />
          </label>
        </div>

        <footer className="bfh-sheet__foot">
          {isEdit && (
            <button
              type="button"
              className="bfh-btn-text bfh-goalform__delete"
              onClick={remove}
            >
              Delete goal
            </button>
          )}
          <button type="button" className="bfh-btn-text" onClick={dismiss}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary bfh-sheet__submit">
            {isEdit ? 'Save changes' : 'Create goal'}
          </button>
        </footer>
      </form>
    </div>
  )
}
