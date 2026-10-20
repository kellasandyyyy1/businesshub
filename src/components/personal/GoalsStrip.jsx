import { Link } from 'react-router-dom'

import SignalBadge from '../SignalBadge'
import { formatCurrency } from '../../lib/format'
import { goalDeadlineLabel, goalProgress } from '../../lib/personal'

/**
 * The savings goals, as a row that scrolls sideways.
 *
 * With no goals set this is a single line of text rather than an empty card:
 * the dashboard already has enough surfaces, and an outlined box saying
 * "no goals" would take a section's worth of room to say nothing.
 */
export default function GoalsStrip({ goals, symbol, today }) {
  if (!goals?.length) {
    return (
      <Link className="bfh-micro bfh-link bfh-goals__prompt" to="/personal/goals">
        Set a savings goal →
      </Link>
    )
  }

  return (
    <section className="bfh-goals">
      <header className="bfh-goals__head">
        <h2 className="bfh-goals__title">Goals</h2>
        <Link className="bfh-micro bfh-link" to="/personal/goals">
          View all →
        </Link>
      </header>

      <ul className="bfh-goals__rail">
        {goals.map((goal) => {
          const progress = goalProgress(goal)
          const deadline = goalDeadlineLabel(goal, today)

          return (
            <li key={goal.id} className="bfh-goal">
              <span className="bfh-goal__name">
                {goal.name}
                {progress >= 1 && <SignalBadge tone="pos">Reached</SignalBadge>}
              </span>

              <span
                className="bfh-goal__track"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${goal.name} progress`}
              >
                <span
                  className="bfh-goal__fill"
                  data-complete={progress >= 1 || undefined}
                  style={{ width: `${progress * 100}%` }}
                />
              </span>

              <span className="bfh-goal__row">
                <span className="bfh-goal__amounts">
                  {formatCurrency(goal.current ?? 0, symbol)} / {formatCurrency(goal.target ?? 0, symbol)}
                </span>
                <span className="bfh-goal__pct">{Math.round(progress * 100)}%</span>
              </span>

              {deadline && <span className="bfh-goal__due">{deadline}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
