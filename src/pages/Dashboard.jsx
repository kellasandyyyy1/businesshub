import { Link } from 'react-router-dom'

import AiHint from '../components/AiHint'
import HowToBanner from '../components/HowToBanner'
import InstallBanner from '../components/InstallBanner'
import { PERIODS, usePeriod } from '../context/PeriodContext'
import useDashboardData from '../hooks/useDashboardData'
import useSettings from '../hooks/useSettings'
import HealthScore from '../components/dashboard/HealthScore'
import MetricCard from '../components/dashboard/MetricCard'
import NeedsAttention from '../components/dashboard/NeedsAttention'
import RecentTransactions from '../components/dashboard/RecentTransactions'
import RevenueExpenseChart from '../components/dashboard/RevenueExpenseChart'

/** Context line under each metric, chosen from the figure itself. */
function metricContext({ value, previous, invert = false }) {
  if (!previous) return 'no prior period'
  // A fifth above the previous window is worth calling out either way — as a
  // high-water mark for income, as a warning for spend.
  if (value > previous * 1.2) return invert ? 'review now' : 'best in period'
  return 'vs last period'
}

export default function Dashboard() {
  const data = useDashboardData()
  const { period, periodId, setPeriodId } = usePeriod()
  const { symbol } = useSettings()

  if (!data) return <div className="bfh-page" />

  const { metrics, series, health, attention, recent, categoryIcons } = data
  const periodLabel = `Last ${period.label}`

  return (
    <div className="bfh-page">
      <InstallBanner />

      <HowToBanner />

      {/* The topbar switcher is hidden on mobile, so it reappears here. */}
      <div className="bfh-block bfh-periodpills" role="group" aria-label="Reporting period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="bfh-period"
            aria-pressed={periodId === p.id}
            onClick={() => setPeriodId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bfh-block bfh-metrics">
        <MetricCard
          label="Cash balance"
          value={metrics.cashBalance}
          previous={metrics.prevCashBalance}
          // A balance is compared against where it opened, not against a
          // matching window of its own.
          context={metrics.prevCashBalance ? 'vs period start' : 'opening balance'}
          to="/cashflow"
          symbol={symbol}
        />
        <MetricCard
          label="Revenue"
          value={metrics.revenue}
          previous={metrics.prevRevenue}
          context={metricContext({ value: metrics.revenue, previous: metrics.prevRevenue })}
          to="/income"
          symbol={symbol}
        />
        <MetricCard
          label="Expenses"
          value={metrics.expenses}
          previous={metrics.prevExpenses}
          context={metricContext({
            value: metrics.expenses,
            previous: metrics.prevExpenses,
            invert: true,
          })}
          to="/expenses"
          symbol={symbol}
          invert
        />
        <MetricCard
          label="Net profit"
          value={metrics.netProfit}
          previous={metrics.prevNetProfit}
          context={metricContext({ value: metrics.netProfit, previous: metrics.prevNetProfit })}
          to="/reports"
          symbol={symbol}
        />
      </div>

      <div className="bfh-block">
        <AiHint />
      </div>

      <div className="bfh-block bfh-split">
        <RevenueExpenseChart series={series} periodLabel={periodLabel} symbol={symbol} />

        <div className="bfh-stack">
          <HealthScore health={health} />
          <NeedsAttention items={attention} symbol={symbol} />
        </div>
      </div>

      <div className="bfh-block">
        <RecentTransactions
          transactions={recent}
          categoryIcons={categoryIcons}
          symbol={symbol}
        />
      </div>

      <div className="bfh-block bfh-howto__foot">
        <Link to="/how-it-works" className="bfh-micro bfh-link">
          New here? Learn how it works →
        </Link>
      </div>
    </div>
  )
}
