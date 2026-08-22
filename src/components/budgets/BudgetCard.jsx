import { categoryIcon } from '../../config/categoryIcons'
import { CAUTION_AT, PERIOD_SUFFIX } from '../../lib/budget'
import { formatCurrency } from '../../lib/format'

/**
 * Caution is signalled by a dashed underline on the percentage, never by
 * colour — the bar fill stays ink at every level of use.
 */
export default function BudgetCard({ budget, iconName, symbol, onEdit }) {
  const Icon = categoryIcon(iconName)
  const pct = Math.round(budget.use * 100)
  const caution = budget.use > CAUTION_AT
  const overspent = budget.remaining < 0

  return (
    <button type="button" className="bfh-budget" onClick={() => onEdit(budget)}>
      <span className="bfh-budget__head">
        <span className="bfh-budget__title">
          <Icon size={14} stroke={1.5} aria-hidden="true" />
          <span>{budget.name}</span>
        </span>
        <span className="bfh-budget__pct" data-caution={caution ? 'true' : undefined}>
          {pct}%
        </span>
      </span>

      <span className="bfh-budget__amount">
        {formatCurrency(budget.amount, symbol)} / {PERIOD_SUFFIX[budget.period]}
      </span>

      <span className="bfh-budget__split">
        {formatCurrency(budget.spent, symbol)} used ·{' '}
        {overspent
          ? `${formatCurrency(-budget.remaining, symbol)} over`
          : `${formatCurrency(budget.remaining, symbol)} left`}
      </span>

      <span className="bfh-budget__track">
        <span
          className="bfh-budget__fill"
          style={{ width: `${Math.min(budget.use, 1) * 100}%` }}
        />
      </span>

      {caution && (
        <span className="bfh-budget__warn">
          · {pct}% used —{' '}
          {overspent
            ? `${formatCurrency(-budget.remaining, symbol)} over budget`
            : `${formatCurrency(budget.remaining, symbol)} remaining`}
        </span>
      )}

      <span className="bfh-micro bfh-budget__cat">{budget.category}</span>
    </button>
  )
}
