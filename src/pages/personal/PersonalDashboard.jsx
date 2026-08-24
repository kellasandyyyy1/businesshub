import { IconArrowsExchange } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import BarChart from '../../components/common/BarChart'
import BreakdownCard, { BreakdownRow } from '../../components/common/BreakdownCard'
import LedgerTable from '../../components/common/LedgerTable'
import MetricCard from '../../components/common/MetricCard'
import PeriodSwitcher from '../../components/common/PeriodSwitcher'
import GoalsStrip from '../../components/personal/GoalsStrip'
import { categoryIcon } from '../../config/categoryIcons'
import { usePeriod } from '../../context/PeriodContext'
import usePersonalData from '../../hooks/usePersonalData'
import useSettings from '../../hooks/useSettings'
import { formatCurrency, formatDate, formatPercent, percentChange } from '../../lib/format'
import { buildSeries, groupTotals, inRange, periodBounds } from '../../lib/ledger'
import { personalMetrics } from '../../lib/personal'

const RECENT = 8

const BREAKDOWN_TABS = [
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
]

/**
 * An arrowed change against the previous period, the same shape the business
 * metric cards use. formatPercent drops the sign, so the arrow is what carries
 * direction and the hairline says whether that direction is welcome — earning
 * more is good, spending more is the one worth a second look.
 */
function changeBadge(current, previous, upIsGood) {
  const change = percentChange(current, previous)
  if (change === null) return { badge: '—', good: true }
  const up = change > 0
  return { badge: `${up ? '↑' : '↓'} ${formatPercent(change)}`, good: upIsGood ? up : !up }
}

export default function PersonalDashboard() {
  const data = usePersonalData()
  const { symbol } = useSettings()
  const { periodId, period } = usePeriod()
  const [tab, setTab] = useState('expense')

  const today = new Date().toISOString().slice(0, 10)
  const transactions = data?.transactions

  const bounds = useMemo(() => periodBounds(periodId, today), [periodId, today])

  const rows = useMemo(
    () => (transactions ? inRange(transactions, bounds.from, bounds.to) : []),
    [transactions, bounds.from, bounds.to],
  )

  const metrics = useMemo(
    () =>
      personalMetrics({
        rows,
        previousRows: transactions ? inRange(transactions, bounds.prevFrom, bounds.prevTo) : [],
      }),
    [rows, transactions, bounds.prevFrom, bounds.prevTo],
  )

  // The chart follows spending, so it is built from the expense rows alone.
  const series = useMemo(
    () => buildSeries(rows.filter((r) => r.type === 'expense'), periodId, bounds),
    [rows, periodId, bounds],
  )

  const breakdown = useMemo(
    () =>
      groupTotals(
        rows.filter((r) => r.type === tab),
        (r) => r.category ?? '',
        (key) => key || 'Uncategorised',
      ),
    [rows, tab],
  )

  const recent = useMemo(() => rows.slice(0, RECENT), [rows])

  if (!data) return <div className="bfh-page" />

  const { income, expenses, previousIncome, previousExpenses, leftOver, saved, savingsRate } =
    metrics

  const incomeBadge = changeBadge(income, previousIncome, true)
  const spentBadge = changeBadge(expenses, previousExpenses, false)

  const spendChange = percentChange(expenses, previousExpenses)
  const note =
    spendChange === null || previousExpenses === 0
      ? null
      : `Spending is ${formatPercent(spendChange)} ${spendChange >= 0 ? 'higher' : 'lower'} than the previous period.`

  const columns = [
    { key: 'date', header: 'Date', className: 'bfh-cell-date', render: (tx) => formatDate(tx.date) },
    {
      key: 'description',
      header: 'Description',
      className: 'bfh-cell-desc',
      render: (tx) => <span className="bfh-row__name">{tx.description}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      className: 'bfh-cell-cat',
      render: (tx) => {
        const Icon = categoryIcon(data.categoryIcons[tx.category])
        return (
          <>
            <Icon size={14} stroke={1.5} aria-hidden="true" />
            <span>{tx.category}</span>
          </>
        )
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'bfh-cell-amount',
      // Direction is carried by the sign, never by colour.
      render: (tx) =>
        `${tx.type === 'expense' ? '−' : ''}${formatCurrency(tx.amount, symbol)}`,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'bfh-cell-status',
      render: (tx) => <span className="bfh-status-pill">{tx.status}</span>,
    },
  ]

  const max = breakdown.length ? breakdown[0].value : 0

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-personalhead">
        <h1 className="bfh-personalhead__title">Personal Finance</h1>
      </div>

      {/* Phone-only by design: from 768px up the topbar carries the same
          control, which is where the period sits on every other page. */}
      <PeriodSwitcher />

      <div className="bfh-block">
        <div className="bfh-metrics">
          <MetricCard
            label="Take-home income"
            value={formatCurrency(income, symbol)}
            badge={incomeBadge.badge}
            good={incomeBadge.good}
            context="total income"
          />
          <MetricCard
            label="Total spent"
            value={formatCurrency(expenses, symbol)}
            badge={spentBadge.badge}
            good={spentBadge.good}
            context="total spent"
          />
          <MetricCard
            label="Saved"
            value={formatCurrency(saved, symbol)}
            badge={savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}
            // With no income there is nothing to have saved from, so the card
            // stays quiet rather than flagging an empty period as a problem.
            good={savingsRate === null || saved > 0}
            context="savings rate"
          />
          <MetricCard
            label="Left over"
            value={formatCurrency(leftOver, symbol)}
            badge={leftOver < 0 ? 'deficit' : 'surplus'}
            good={leftOver >= 0}
            context="this period"
          />
        </div>
      </div>

      <div className="bfh-block bfh-income__split">
        <BarChart
          title="Spending over time"
          sub={`Last ${period.label}`}
          series={series}
          symbol={symbol}
          variant="hatched"
          note={note}
          ariaLabel="Personal spending over time"
        />

        <BreakdownCard title="By category" tabs={BREAKDOWN_TABS} tab={tab} onTab={setTab}>
          {breakdown.length === 0 ? (
            <p className="bfh-empty">
              No {tab === 'expense' ? 'spending' : 'income'} in this period.
            </p>
          ) : (
            <ul className="bfh-breakdown__list">
              {breakdown.map((entry) => (
                <BreakdownRow
                  key={entry.key}
                  icon={categoryIcon(data.categoryIcons[entry.key])}
                  name={entry.name}
                  value={entry.value}
                  share={entry.share}
                  max={max}
                  symbol={symbol}
                />
              ))}
            </ul>
          )}
        </BreakdownCard>
      </div>

      <div className="bfh-block">
        <GoalsStrip goals={data.goals} symbol={symbol} today={today} />
      </div>

      <div className="bfh-block">
        <LedgerTable
          title="Recent transactions"
          headerAction={
            <Link className="bfh-micro bfh-link" to="/personal/transactions">
              View all →
            </Link>
          }
          columns={columns}
          rows={recent}
          total={recent.length}
          mobileMeta={(tx) => [tx.category].filter(Boolean)}
          amountOf={(tx) =>
            `${tx.type === 'expense' ? '−' : ''}${formatCurrency(tx.amount, symbol)}`
          }
          emptyIcon={IconArrowsExchange}
          emptyHeading="No personal transactions yet"
          emptyBody="Add one to start tracking what comes in and what goes out."
          onOpen={() => {}}
        />
      </div>
    </div>
  )
}
