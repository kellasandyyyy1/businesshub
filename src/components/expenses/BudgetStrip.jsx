import { Link } from 'react-router-dom'

import { formatCurrency } from '../../lib/format'
import { CAUTION_AT } from '../../lib/budget'

/**
 * This month's budgets, however far the period switcher has been pushed.
 *
 * A budget is a monthly commitment, so showing 90 days of spending against a
 * one-month limit would report every budget as blown. The window here is always
 * the current calendar month.
 */
export default function BudgetStrip({ usage, symbol }) {
  return (
    <section className="bfh-budgetstrip">
      <header className="bfh-budgetstrip__head">
        <h2 className="bfh-panel__title">Budget status</h2>
        <Link to="/budgets" className="bfh-micro bfh-link">
          Manage budgets →
        </Link>
      </header>

      <div className="bfh-budgetstrip__scroll">
        {usage.map((item) => {
          const pct = Math.round(item.ratio * 100)
          return (
            <article key={item.id} className="bfh-budgetcard">
              <span className="bfh-micro">{item.category}</span>

              <span className="bfh-budgetcard__figures">
                {formatCurrency(item.spent, symbol)} / {formatCurrency(item.limit, symbol)}
              </span>

              <span className="bfh-budgetcard__track" aria-hidden="true">
                <span
                  className="bfh-budgetcard__fill"
                  style={{ width: `${Math.min(item.ratio, 1) * 100}%` }}
                />
              </span>

              {/* Past 80% the figure picks up a dashed underline. No colour,
                  no fill, just enough to make the eye stop on it. */}
              <span className="bfh-budgetcard__pct" data-caution={item.ratio >= CAUTION_AT}>
                {pct}%
              </span>
            </article>
          )
        })}
      </div>
    </section>
  )
}
