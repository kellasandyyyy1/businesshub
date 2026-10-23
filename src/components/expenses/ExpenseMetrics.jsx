import MetricCard from '../common/MetricCard'
import { formatAmount, percentChange } from '../../lib/format'
import { monthlyCaption } from '../../lib/ledger'

export default function ExpenseMetrics({ metrics, symbol, period }) {
  const share = (value) => `${Math.round(value * 100)}%`

  return (
    <div className="bfh-metrics">
      <MetricCard
        label="Total spent"
        value={formatAmount(metrics.total, symbol)}
        delta={{ value: percentChange(metrics.total, metrics.previousTotal), goodWhen: 'down' }}
        context={metrics.previousTotal ? `vs previous ${period.name}` : 'nothing earlier to compare'}
      />
      <MetricCard
        label="Biggest category"
        value={metrics.largestCategory ?? 'None yet'}
        badge={
          metrics.largestCategory && metrics.total > 0
            ? share(metrics.largestCategoryValue / metrics.total)
            : null
        }
        context={
          metrics.largestCategory
            ? `${formatAmount(metrics.largestCategoryValue, symbol)} of your spending`
            : 'no spending yet'
        }
      />
      <MetricCard
        label="Per month"
        value={formatAmount(metrics.average, symbol)}
        context={monthlyCaption(period)}
      />
      <MetricCard
        label="Bills & subscriptions"
        value={formatAmount(metrics.recurringTotal, symbol)}
        badge={metrics.total > 0 ? share(metrics.recurringShare) : null}
        context="of spending repeats every month"
      />
    </div>
  )
}
