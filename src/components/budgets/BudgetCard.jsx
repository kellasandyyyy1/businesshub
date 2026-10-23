import { IconAlertTriangle } from '@tabler/icons-react'

import SignalBadge from '../SignalBadge'
import { categoryIcon } from '../../config/categoryIcons'
import { PERIOD_SUFFIX } from '../../lib/budget'
import { formatCurrency } from '../../lib/format'
import { budgetTone } from '../../lib/signal'

/**
 * A budget and how much of it is gone. The bar is ink while there is room,
 * amber from 80% and red once it is spent through; a badge says the same in
 * words, so the state never rests on the colour alone.
 */
export default function BudgetCard({ budget, iconName, symbol, onEdit }) {
  const Icon = categoryIcon(iconName)
  const pct = Math.round(budget.use * 100)
  const tone = budgetTone(budget.use, budget)
  const overspent = budget.remaining < 0

  return (
    <button type="button" className="bfh-budget" onClick={() => onEdit(budget)}>
      <span className="bfh-budget__head">
        <span className="bfh-budget__title">
          <Icon size={14} stroke={1.5} aria-hidden="true" />
          <span>{budget.name}</span>
        </span>
        {tone === 'neg' ? (
          <SignalBadge tone="neg">Over</SignalBadge>
        ) : tone === 'warn' ? (
          <SignalBadge tone="warn">Near limit</SignalBadge>
        ) : (
          <span className="bfh-budget__pct">{pct}%</span>
        )}
      </span>

      <span className="bfh-budget__amount">
        {formatCurrency(budget.amount, symbol)} / {PERIOD_SUFFIX[budget.period]}
      </span>

      <span className="bfh-budget__track">
        <span
          className="bfh-budget__fill"
          data-tone={tone ?? undefined}
          style={{ width: `${Math.min(budget.use, 1) * 100}%` }}
        />
      </span>

      <span className="bfh-budget__split">
        <span>
          {formatCurrency(budget.spent, symbol)} used · {pct}%
        </span>
        <span className="bfh-budget__caption" data-tone={overspent ? 'neg' : undefined}>
          {overspent && <IconAlertTriangle size={12} stroke={2} aria-hidden="true" />}
          {overspent
            ? `${formatCurrency(-budget.remaining, symbol)} over`
            : `${formatCurrency(budget.remaining, symbol)} left`}
        </span>
      </span>

      {/* Only when it adds something: a budget named after its category would
          otherwise say the same word twice. */}
      {(budget.match || budget.name !== budget.category) && (
        <span className="bfh-micro bfh-budget__cat">
          {budget.category}
          {budget.match ? ` · only “${budget.match}”` : ''}
        </span>
      )}
    </button>
  )
}
