import { IconChevronRight, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import { formatCurrency } from '../../lib/format'
import SignalBadge from '../SignalBadge'
import { GOAL_SIGNALS } from '../../lib/signal'
import { deadlineLabel, goalProgress, goalStatus, monthlySaveNeeded } from '../../lib/goals'

/**
 * One sentence on what to do next, in the words a person would use. The
 * figures above it say where the goal stands; this says how to finish it.
 */
function planFor(goal, status, perMonth, remaining, money) {
  if (status === 'completed') return 'Goal reached — well done.'
  if (status === 'overdue') return `The deadline has passed with ${money(remaining)} still to go. Set a new date to get a fresh plan.`
  if (!goal.deadline) return 'Add a deadline to get a monthly saving plan.'
  if (!perMonth) return null
  const amount = money(Math.ceil(perMonth))
  if (status === 'behind') return `A little behind — save about ${amount} a month to catch up.`
  if (status === 'not-started') return `Put aside about ${amount} a month to get there on time.`
  return `Keep saving about ${amount} a month to get there on time.`
}

/**
 * One savings goal.
 *
 * The whole card opens the editor, so the add-money control is a button
 * layered above it rather than nested inside — a button inside a button is
 * invalid, and a tap on "Add money" must not also open the editor.
 */
export default function GoalCard({ goal, symbol, today, onEdit, onContribute }) {
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const money = (v) => formatCurrency(v, symbol)
  const status = goalStatus(goal, today)
  const progress = goalProgress(goal)
  const percent = Math.round(progress * 100)
  const perMonth = monthlySaveNeeded(goal, today)
  const complete = status === 'completed'
  const saved = Number(goal.current) || 0
  const target = Number(goal.target) || 0
  const remaining = Math.max(target - saved, 0)
  const plan = planFor(goal, status, perMonth, remaining, money)

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
          {/* On pace is the default and earns no badge; only what needs a
              look, or is worth celebrating, gets one. */}
          {GOAL_SIGNALS[status] && (
            <SignalBadge tone={GOAL_SIGNALS[status].tone}>{GOAL_SIGNALS[status].label}</SignalBadge>
          )}
          <IconChevronRight className="bfh-goalcard__chev" size={16} stroke={1.5} aria-hidden="true" />
        </div>

        <div className="bfh-goalcard__figures">
          <span className="bfh-goalcard__saved">
            <span className="bfh-goalcard__current">{money(saved)}</span>
            <span className="bfh-goalcard__of">saved of {money(target)}</span>
          </span>
          <span className="bfh-goalcard__percent">{percent}%</span>
        </div>

        <span
          className="bfh-goalcard__track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.name}: ${percent}% saved`}
        >
          <span className="bfh-goalcard__fill" style={{ width: `${progress * 100}%` }} />
        </span>

        <div className="bfh-goalcard__facts">
          <span>{complete ? 'Fully funded' : `${money(remaining)} to go`}</span>
          <span>{deadlineLabel(goal)}</span>
        </div>

        {plan && <p className="bfh-goalcard__plan">{plan}</p>}

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
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder={perMonth ? String(Math.ceil(perMonth)) : '0'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label={`Amount to add to ${goal.name}`}
                  autoFocus
                />
              </span>
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline" disabled={saving || !amount}>
                Add
              </button>
              <button type="button" className="bfh-btn-text" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="bfh-goalcard__contribute" onClick={() => setAdding(true)}>
              <IconPlus size={14} stroke={1.75} aria-hidden="true" />
              Add money
            </button>
          ))}
      </div>
    </li>
  )
}
