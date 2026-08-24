import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import { formatCurrency } from '../../lib/format'
import { STATUS_LABELS, deadlineLabel, goalProgress, goalStatus, monthlySaveNeeded } from '../../lib/goals'

/**
 * One savings goal.
 *
 * The whole card opens the editor, so the contribute control is a button
 * layered above it rather than nested inside — a button inside a button is
 * invalid, and a click on "Add savings" must not also open the editor.
 */
export default function GoalCard({ goal, symbol, today, onEdit, onContribute }) {
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const status = goalStatus(goal, today)
  const progress = goalProgress(goal)
  const perMonth = monthlySaveNeeded(goal, today)
  const complete = status === 'completed'

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setSaving(true)
    await onContribute(goal, value)
    setSaving(false)
    setAmount('')
    setAdding(false)
  }

  return (
    <li className="bfh-goalcard" data-status={status}>
      <button
        type="button"
        className="bfh-goalcard__open"
        onClick={() => onEdit(goal)}
        aria-label={`Edit ${goal.name}`}
      />

      <div className="bfh-goalcard__body">
        <div className="bfh-goalcard__top">
          <h3 className="bfh-goalcard__name">{goal.name}</h3>
          <span className={complete ? 'bfh-pill-invert' : 'bfh-goalcard__status'}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <span
          className="bfh-goalcard__track"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.name} progress`}
        >
          <span className="bfh-goalcard__fill" style={{ width: `${progress * 100}%` }} />
        </span>

        <div className="bfh-goalcard__amounts">
          <span className="bfh-goalcard__current">{formatCurrency(goal.current ?? 0, symbol)}</span>
          <span className="bfh-goalcard__target">{formatCurrency(goal.target ?? 0, symbol)}</span>
        </div>

        <div className="bfh-goalcard__foot">
          <span className="bfh-goalcard__rate">
            {complete
              ? 'Goal reached!'
              : perMonth
                ? `Save ${formatCurrency(perMonth, symbol)}/mo to reach goal`
                : ''}
          </span>
          <span className="bfh-goalcard__due">{deadlineLabel(goal)}</span>
        </div>

        {!complete &&
          (adding ? (
            <form className="bfh-goalcard__add" onSubmit={submit}>
              <span className="bfh-moneyfield bfh-moneyfield--sm">
                <span className="bfh-moneyfield__symbol" aria-hidden="true">
                  {symbol}
                </span>
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label={`Amount to add to ${goal.name}`}
                  autoFocus
                />
              </span>
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline" disabled={saving}>
                Add
              </button>
              <button type="button" className="bfh-btn-ghost" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="bfh-goalcard__contribute"
              onClick={() => setAdding(true)}
            >
              <IconPlus size={12} stroke={1.75} aria-hidden="true" />
              Add savings
            </button>
          ))}
      </div>
    </li>
  )
}
