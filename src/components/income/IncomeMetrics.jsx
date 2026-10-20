import MetricCard from '../common/MetricCard'
import { formatAmount, percentChange } from '../../lib/format'
import { monthlyCaption } from '../../lib/ledger'

/**
 * The four cards at the top of the Income page. More coming in is better.
 * A business earns revenue; a household earns income — the words follow the
 * profile, the figures do not change.
 */
export default function IncomeMetrics({ metrics, symbol, period, isPersonal }) {
  const share = (value) => `${Math.round(value * 100)}%`
  const noun = isPersonal ? 'income' : 'revenue'

  return (
    <div className="bfh-metrics">
      <MetricCard
        label={isPersonal ? 'Total income' : 'Total revenue'}
        value={formatAmount(metrics.total, symbol)}
        delta={{ value: percentChange(metrics.total, metrics.previousTotal), goodWhen: 'up' }}
        context={metrics.previousTotal ? `vs previous ${period.name}` : 'nothing earlier to compare'}
      />
      <MetricCard
        label="Per month"
        value={formatAmount(metrics.average, symbol)}
        context={monthlyCaption(period)}
      />
      <MetricCard
        label={isPersonal ? 'Main source' : 'Top source'}
        value={metrics.topSource ?? '—'}
        badge={metrics.topSource ? share(metrics.topSourceShare) : null}
        context={metrics.topSource ? `of your ${noun}` : `no ${noun} yet`}
      />
      <MetricCard
        label="Repeats regularly"
        value={formatAmount(metrics.recurringTotal, symbol)}
        badge={metrics.total > 0 ? share(metrics.recurringShare) : null}
        context={`of ${noun} comes in on a schedule`}
      />
    </div>
  )
}
