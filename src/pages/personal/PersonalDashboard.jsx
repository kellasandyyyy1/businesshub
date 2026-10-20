import { IconArrowsExchange } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import BarChart from '../../components/common/BarChart'
import BreakdownCard, { BreakdownRow } from '../../components/common/BreakdownCard'
import LedgerTable from '../../components/common/LedgerTable'
import { StatusCell } from '../../components/common/TxList'
import MetricCard from '../../components/common/MetricCard'
import PeriodSummary from '../../components/common/PeriodSummary'
import PeriodSwitcher from '../../components/common/PeriodSwitcher'
import GoalsStrip from '../../components/personal/GoalsStrip'
import { categoryIcon } from '../../config/categoryIcons'
import { usePeriod } from '../../context/PeriodContext'
import usePersonalData from '../../hooks/usePersonalData'
import useSettings from '../../hooks/useSettings'
import { formatCurrency, formatDate, formatPercent, percentChange } from '../../lib/format'
import { buildSeries, groupTotals, inRange, periodBounds } from '../../lib/ledger'
import { personalMetrics } from '../../lib/personal'
import { amountLabel } from '../../lib/txDisplay'

const RECENT = 8

const BREAKDOWN_TABS = [
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
]

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

  // The latest activity, whatever the window: an empty week should still show
  // what happened before it.
  const recent = useMemo(() => (transactions ?? []).slice(0, RECENT), [transactions])

  if (!data) return <div className="bfh-page" />

  const { income, expenses, previousIncome, previousExpenses, leftOver, savingsRate } = metrics

  const previousRate =
    previousIncome > 0 ? (Math.max(previousIncome - previousExpenses, 0) / previousIncome) * 100 : null
  // Points, not percent of a percent: 40% to 46% reads as +6, not +15%.
  const rateChange = savingsRate !== null && previousRate !== null ? savingsRate - previousRate : null
  const versus = (previous) => (previous ? `vs previous ${period.name}` : 'nothing earlier to compare')

  const empty = income === 0 && expenses === 0
  const money = (v) => formatCurrency(v, symbol)

  // The headline is whichever figure answers "how did I do?" for this window.
  let summary
  if (income === 0) {
    summary = {
      headline: money(expenses),
      headlineLabel: 'spent',
      sentence: 'No income is recorded in this window, so this spending came from savings or earlier pay.',
      delta: { value: percentChange(expenses, previousExpenses), goodWhen: 'down' },
      sentenceTone: expenses > 0 ? 'warn' : undefined,
    }
  } else if (leftOver < 0) {
    summary = {
      headline: money(-leftOver),
      headlineLabel: 'overspent',
      delta: { value: percentChange(expenses, previousExpenses), goodWhen: 'down' },
      sentenceTone: 'warn',
      sentence: `You spent ${money(expenses)} against ${money(income)} coming in — ${money(-leftOver)} more than you earned.`,
    }
  } else {
    summary = {
      headline: money(leftOver),
      headlineLabel: 'left over',
      delta: { value: percentChange(leftOver, previousIncome - previousExpenses), goodWhen: 'up' },
      sentence: `You earned ${money(income)} and spent ${money(expenses)}, so you kept ${Math.round(savingsRate)}% of your income.`,
    }
  }

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
      render: (tx) => amountLabel(tx, symbol),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'bfh-cell-status',
      render: (tx) => <StatusCell tx={tx} />,
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
        <PeriodSummary
          {...summary}
          inLabel="Money in"
          outLabel="Money out"
          moneyIn={income}
          moneyOut={expenses}
          symbol={symbol}
          empty={empty}
          hasHistory={transactions.length > 0}
          addTo="/personal/transactions?new=1"
        />
      </div>

      {!empty && (
        <>
          <div className="bfh-block">
            <div className="bfh-metrics">
              <MetricCard
                label="Income"
                value={money(income)}
                delta={{ value: percentChange(income, previousIncome), goodWhen: 'up' }}
                context={versus(previousIncome)}
              />
              <MetricCard
                label="Spent"
                value={money(expenses)}
                delta={{ value: percentChange(expenses, previousExpenses), goodWhen: 'down' }}
                context={versus(previousExpenses)}
              />
              <MetricCard
                label="Savings rate"
                value={savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}
                delta={{ value: rateChange, goodWhen: 'up', format: 'points' }}
                context={
                  savingsRate === null
                    ? 'no income this period'
                    : rateChange === null
                      ? 'of your income kept'
                      : versus(previousIncome)
                }
              />
              <MetricCard
                label="Daily spending"
                value={money(expenses / period.days)}
                // Same days in both windows, so this moves exactly as Spent
                // does; the arrow stays, the colour would only repeat it.
                delta={{ value: percentChange(expenses, previousExpenses), goodWhen: 'down', quiet: true }}
                context={previousExpenses ? 'a day, vs before' : 'average per day'}
              />
            </div>
          </div>

          <div className="bfh-block bfh-income__split">
            <BarChart
              title="Spending over time"
              sub={`Last ${period.name}`}
              series={series}
              symbol={symbol}
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
        </>
      )}

      <div className="bfh-block">
        <GoalsStrip goals={data.goals} symbol={symbol} today={today} />
      </div>

      {recent.length > 0 && (
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
            categoryIcons={data.categoryIcons}
            symbol={symbol}
            emptyIcon={IconArrowsExchange}
            emptyHeading="No personal transactions yet"
            emptyBody="Add one to start tracking what comes in and what goes out."
            onOpen={() => {}}
          />
        </div>
      )}
    </div>
  )
}
