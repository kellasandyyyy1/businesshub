import MetricCard from '../common/MetricCard'
import { formatAmount, formatPercent, percentChange } from '../../lib/format'

/**
 * An arrowed change badge. Spending more is the outcome worth a second look, so
 * a rise gets the dashed hairline and a fall the solid one — the opposite way
 * round from revenue, and still without a colour anywhere.
 */
function spendBadge(current, previous) {
  const change = percentChange(current, previous)
  if (change === null) return { badge: '—', good: true }
  const up = change >= 0
  return { badge: `${up ? '↑' : '↓'} ${formatPercent(change)}`, good: !up }
}

export default function ExpenseMetrics({ metrics, symbol }) {
  const total = spendBadge(metrics.total, metrics.previousTotal)
  const average = spendBadge(metrics.average, metrics.previousAverage)

  return (
    <div className="bfh-metrics">
      <MetricCard
        label="Total expenses"
        value={formatAmount(metrics.total, symbol)}
        badge={total.badge}
        good={total.good}
        context="vs last period"
      />
      <MetricCard
        label="Largest category"
        value={metrics.largestCategory ?? '—'}
        badge={metrics.largestCategory ? formatAmount(metrics.largestCategoryValue, symbol) : '—'}
        context="biggest spend"
      />
      <MetricCard
        label="Monthly average"
        value={formatAmount(metrics.average, symbol)}
        badge={average.badge}
        good={average.good}
        context="monthly avg"
      />
      <MetricCard
        label="Recurring expenses"
        value={formatAmount(metrics.recurringTotal, symbol)}
        badge={metrics.total > 0 ? `${Math.round(metrics.recurringShare * 100)}%` : '—'}
        context="recurring"
      />
    </div>
  )
}
