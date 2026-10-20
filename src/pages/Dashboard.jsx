import { Link } from 'react-router-dom'

import AiHint from '../components/AiHint'
import HowToBanner from '../components/HowToBanner'
import InstallBanner from '../components/InstallBanner'
import PeriodSummary from '../components/common/PeriodSummary'
import PeriodSwitcher from '../components/common/PeriodSwitcher'
import { usePeriod } from '../context/PeriodContext'
import { formatCurrency, percentChange } from '../lib/format'
import useDashboardData from '../hooks/useDashboardData'
import useSettings from '../hooks/useSettings'
import HealthScore from '../components/dashboard/HealthScore'
import MetricCard from '../components/dashboard/MetricCard'
import NeedsAttention from '../components/dashboard/NeedsAttention'
import RecentTransactions from '../components/dashboard/RecentTransactions'
import RevenueExpenseChart from '../components/dashboard/RevenueExpenseChart'

/** Context line under each metric: what the badge beside it is measured against. */
function metricContext({ previous, period }) {
  return previous ? `vs previous ${period.name}` : 'nothing earlier to compare'
}

export default function Dashboard() {
  const data = useDashboardData()
  const { period } = usePeriod()
  const { symbol } = useSettings()

  if (!data) return <div className="bfh-page" />

  const { metrics, series, health, attention, recent, categoryIcons } = data
  const periodLabel = `Last ${period.name}`
  const money = (v) => formatCurrency(v, symbol)
  const { revenue, expenses, netProfit } = metrics
  const empty = revenue === 0 && expenses === 0

  // The headline is whichever figure answers "how is the business doing?"
  let summary
  if (revenue === 0) {
    summary = {
      headline: money(expenses),
      headlineLabel: 'spent',
      sentence: 'No revenue is recorded in this window yet, so this is all money going out.',
      delta: { value: percentChange(expenses, metrics.prevExpenses), goodWhen: 'down' },
      sentenceTone: expenses > 0 ? 'warn' : undefined,
    }
  } else if (netProfit < 0) {
    summary = {
      headline: money(-netProfit),
      headlineLabel: 'loss',
      delta: { value: percentChange(netProfit, metrics.prevNetProfit), goodWhen: 'up' },
      sentenceTone: 'warn',
      sentence: `Expenses of ${money(expenses)} ran ahead of ${money(revenue)} in revenue.`,
    }
  } else {
    summary = {
      headline: money(netProfit),
      headlineLabel: 'profit',
      delta: { value: percentChange(netProfit, metrics.prevNetProfit), goodWhen: 'up' },
      sentence: `Revenue of ${money(revenue)} against ${money(expenses)} in expenses — you kept ${Math.round((netProfit / revenue) * 100)}% of every sale.`,
    }
  }

  return (
    <div className="bfh-page">
      <InstallBanner />

      <HowToBanner />

      {/* The topbar switcher is hidden on mobile, so it reappears here. */}
      <PeriodSwitcher />

      <div className="bfh-block">
        <PeriodSummary
          {...summary}
          inLabel="Revenue"
          outLabel="Expenses"
          moneyIn={revenue}
          moneyOut={expenses}
          symbol={symbol}
          empty={empty}
          hasHistory={recent.length > 0}
          addTo="/transactions?new=1"
          note={metrics.cashBalance ? `Cash on hand: ${money(metrics.cashBalance)}` : null}
        />
      </div>

      {/* A brand-new account has nothing to flag and no history to list; the
          summary card above already says what to do first. */}
      {empty ? (
        attention.length > 0 && (
          <div className="bfh-block">
            <NeedsAttention items={attention} symbol={symbol} />
          </div>
        )
      ) : (
        <>
          <div className="bfh-block bfh-metrics">
            <MetricCard
              label="Cash balance"
              value={metrics.cashBalance}
              previous={metrics.prevCashBalance}
              // A balance is compared against where it opened, not against a
              // matching window of its own.
              context={metrics.prevCashBalance ? 'vs start of period' : 'cleared money on hand'}
              to="/cashflow"
              symbol={symbol}
              // Revenue, expenses and profit already say how the period went;
              // a fourth coloured mark would only repeat them.
              quiet
            />
            <MetricCard
              label="Revenue"
              value={revenue}
              previous={metrics.prevRevenue}
              context={metricContext({ previous: metrics.prevRevenue, period })}
              to="/income"
              symbol={symbol}
            />
            <MetricCard
              label="Expenses"
              value={expenses}
              previous={metrics.prevExpenses}
              context={metricContext({ previous: metrics.prevExpenses, period })}
              to="/expenses"
              symbol={symbol}
              goodWhen="down"
            />
            <MetricCard
              label="Net profit"
              value={netProfit}
              previous={metrics.prevNetProfit}
              context={metricContext({ previous: metrics.prevNetProfit, period })}
              to="/reports"
              symbol={symbol}
            />
          </div>

          <div className="bfh-block bfh-split">
            <RevenueExpenseChart series={series} periodLabel={periodLabel} symbol={symbol} />

            <div className="bfh-stack">
              <HealthScore health={health} />
              <NeedsAttention items={attention} symbol={symbol} />
            </div>
          </div>
        </>
      )}

      <div className="bfh-block">
        <AiHint />
      </div>

      {recent.length > 0 && (
        <div className="bfh-block">
          <RecentTransactions
            transactions={recent}
            categoryIcons={categoryIcons}
            symbol={symbol}
          />
        </div>
      )}

      <div className="bfh-block bfh-howto__foot">
        <Link to="/how-it-works" className="bfh-micro bfh-link">
          New here? Learn how it works →
        </Link>
      </div>
    </div>
  )
}
