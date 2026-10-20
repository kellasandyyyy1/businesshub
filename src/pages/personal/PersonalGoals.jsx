import { IconPlus, IconTargetArrow } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import EmptyState from '../../components/EmptyState'
import GoalCard from '../../components/personal/GoalCard'
import GoalModal from '../../components/personal/GoalModal'
import { useToast } from '../../context/ToastContext'
import useAssistantPrefill from '../../hooks/useAssistantPrefill'
import useGoals, { contributeToGoal } from '../../hooks/useGoals'
import useSettings from '../../hooks/useSettings'
import { formatCurrency } from '../../lib/format'
import { goalsSummary } from '../../lib/goals'

export default function PersonalGoals() {
  const goals = useGoals()
  const { symbol } = useSettings()
  const toast = useToast()

  const contribute = async (goal, amount) => {
    try {
      await contributeToGoal(goal, amount)
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${formatCurrency(amount, symbol)} added to ${goal.name}`)
  }
  const [editing, setEditing] = useState(null) // null | {} | goal
  useAssistantPrefill('UPDATE_GOAL', (record) => setEditing(record?.id ? record : { prefill: record }))

  const today = new Date().toISOString().slice(0, 10)
  const summary = useMemo(() => goalsSummary(goals ?? [], today), [goals, today])

  if (!goals) return <div className="bfh-page" />

  const overall = summary.totalTarget > 0 ? summary.totalSaved / summary.totalTarget : 0
  const reached = goals.length - summary.active

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-personalhead">
        <h1 className="bfh-personalhead__title">Goals</h1>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => setEditing({})}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bfh-block">
          <EmptyState
            icon={IconTargetArrow}
            heading="No goals yet"
            body="Saving for a laptop, a trip or an emergency fund? Set a target and a date, and Dual works out how much to put aside each month."
            actionLabel="Create first goal"
            onAction={() => setEditing({})}
          />
        </div>
      ) : (
        <>
          {/* All goals at once, as one sentence and one bar: how much is
              put aside against how much is wanted. */}
          <div className="bfh-block">
            <section className="bfh-card bfh-goalhero">
              <span className="bfh-micro">All goals</span>
              <p className="bfh-goalhero__line">
                <span className="bfh-goalhero__figure">{formatCurrency(summary.totalSaved, symbol)}</span>
                <span className="bfh-goalhero__of">saved of {formatCurrency(summary.totalTarget, symbol)}</span>
              </p>
              <span
                className="bfh-goalhero__track"
                role="progressbar"
                aria-valuenow={Math.round(overall * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Saved across all goals"
              >
                <span className="bfh-goalhero__fill" style={{ width: `${overall * 100}%` }} />
              </span>
              <p className="bfh-goalhero__note">
                {Math.round(overall * 100)}% of the way there ·{' '}
                {summary.active} {summary.active === 1 ? 'goal' : 'goals'} in progress
                {reached > 0 && ` · ${reached} reached`}
              </p>
            </section>
          </div>

          <div className="bfh-block">
            <ul className="bfh-goalgrid">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  symbol={symbol}
                  today={today}
                  onEdit={setEditing}
                  onContribute={contribute}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {editing && (
        <GoalModal
          key={editing.id ?? 'new'}
          goal={editing.id ? editing : (editing.prefill ?? null)}
          symbol={symbol}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
