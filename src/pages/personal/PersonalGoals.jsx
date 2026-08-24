import { IconPlus, IconTargetArrow } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import EmptyState from '../../components/EmptyState'
import GoalCard from '../../components/personal/GoalCard'
import GoalModal from '../../components/personal/GoalModal'
import useGoals, { contributeToGoal } from '../../hooks/useGoals'
import useSettings from '../../hooks/useSettings'
import { formatCurrency } from '../../lib/format'
import { goalsSummary } from '../../lib/goals'

export default function PersonalGoals() {
  const goals = useGoals()
  const { symbol } = useSettings()
  const [editing, setEditing] = useState(null) // null | {} | goal

  const today = new Date().toISOString().slice(0, 10)
  const summary = useMemo(() => goalsSummary(goals ?? [], today), [goals, today])

  if (!goals) return <div className="bfh-page" />

  const stats = [
    { label: 'Active goals', value: String(summary.active) },
    { label: 'Total target', value: formatCurrency(summary.totalTarget, symbol) },
    { label: 'Total saved', value: formatCurrency(summary.totalSaved, symbol) },
  ]

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
            body="Set a savings target to start working towards it."
            actionLabel="Create first goal"
            onAction={() => setEditing({})}
          />
        </div>
      ) : (
        <>
          <div className="bfh-block">
            <div className="bfh-summary">
              {stats.map((stat) => (
                <div className="bfh-summary__cell" key={stat.label}>
                  <span className="bfh-micro">{stat.label}</span>
                  <span className="bfh-summary__value">{stat.value}</span>
                </div>
              ))}
            </div>
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
                  onContribute={contributeToGoal}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {editing && (
        <GoalModal
          key={editing.id ?? 'new'}
          goal={editing.id ? editing : null}
          symbol={symbol}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
