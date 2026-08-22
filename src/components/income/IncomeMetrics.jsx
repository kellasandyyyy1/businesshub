import MetricCard from '../common/MetricCard'
import { formatAmount, formatPercent, percentChange } from '../../lib/format'

/** An arrowed change badge, or an em dash when there is nothing to compare to. */
function changeBadge(current, previous) {
  const change = percentChange(current, previous)
  if (change === null) return { badge: '—', good: true }
  const up = change >= 0
  return { badge: `${up ? '↑' : '↓'} ${formatPercent(change)}`, good: up }
}

/** The four cards at the top of the Income page. More revenue is better. */
export default function IncomeMetrics({ metrics, symbol }) {
  const revenue = changeBadge(metrics.total, metrics.previousTotal)
  const average = changeBadge(metrics.average, metrics.previousAverage)
  const share = (value) => `${Math.round(value * 100)}%`

  return (
    <div className="bfh-metrics">
      <MetricCard
        label="Total revenue"
        value={formatAmount(metrics.total, symbol)}
        badge={revenue.badge}
        good={revenue.good}
        context="vs last period"
      />
      <MetricCard
        label="Average per month"
        value={formatAmount(metrics.average, symbol)}
        badge={average.badge}
        good={average.good}
        context="monthly avg"
      />
      <MetricCard
        label="Top source"
        value={metrics.topSource ?? '—'}
        badge={metrics.topSource ? share(metrics.topSourceShare) : '—'}
        context="of total revenue"
      />
      <MetricCard
        label="Recurring revenue"
        value={formatAmount(metrics.recurringTotal, symbol)}
        badge={metrics.total > 0 ? share(metrics.recurringShare) : '—'}
        context="recurring"
      />
    </div>
  )
}
