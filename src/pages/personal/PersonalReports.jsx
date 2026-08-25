import { IconTableExport } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import {
  CategoryDeepDive,
  IncomeBreakdown,
  MonthlySnapshot,
  NetWorthOverTime,
  Recurring,
  SavingsReport,
  SpendingSummary,
} from '../../components/personal/reports/ReportViews'
import usePersonalReportsData from '../../hooks/usePersonalReports'
import useSettings from '../../hooks/useSettings'
import { downloadCSV, downloadXLSX } from '../../lib/export'
import { recurringExpenses } from '../../lib/expenses'
import { buildSeries, shiftMonths, sum } from '../../lib/ledger'
import {
  PERIOD_PRESETS,
  categoryDeepDive,
  incomeBreakdown,
  monthlySeries,
  monthlySnapshot,
  netWorthHistory,
  recurringDetail,
  reportExport,
  reportFilename,
  resolveReportPeriod,
  savingsReport,
  spendingSummary,
} from '../../lib/personalReports'

const REPORTS = [
  { id: 'spending', label: 'Spending Summary', short: 'Spending' },
  { id: 'income', label: 'Income Breakdown', short: 'Income' },
  { id: 'savings', label: 'Savings Report', short: 'Savings' },
  { id: 'monthly', label: 'Monthly Snapshot', short: 'Monthly' },
  { id: 'networth', label: 'Net Worth Over Time', short: 'Net Worth' },
  { id: 'recurring', label: 'Subscriptions & Recurring', short: 'Recurring' },
  { id: 'category', label: 'Category Deep Dive', short: 'Deep Dive' },
]

export default function PersonalReports() {
  const data = usePersonalReportsData()
  const { symbol } = useSettings()

  const today = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState('spending')
  const [preset, setPreset] = useState('this-month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  // The snapshot picks one month rather than following the period pills.
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [category, setCategory] = useState('')

  const period = useMemo(
    () => resolveReportPeriod(preset, today, custom),
    [preset, today, custom],
  )

  const transactions = data?.transactions ?? []

  const expenseCategories = useMemo(
    () => (data?.categories ?? []).filter((c) => c.type === 'expense'),
    [data],
  )

  // Whichever category actually has spending, so the report opens on something.
  const activeCategory = useMemo(() => {
    if (category) return category
    const withData = expenseCategories.find((c) =>
      transactions.some((t) => t.type === 'expense' && t.category === c.name),
    )
    return withData?.name ?? expenseCategories[0]?.name ?? ''
  }, [category, expenseCategories, transactions])

  const view = useMemo(() => {
    if (!data) return null
    switch (type) {
      case 'income':
        return incomeBreakdown(transactions, period)
      case 'savings':
        return savingsReport(transactions, period, today)
      case 'monthly':
        return monthlySnapshot(transactions, month)
      case 'networth':
        return { history: netWorthHistory(data.netWorthItems, today), items: data.netWorthItems }
      case 'recurring': {
        const items = recurringDetail(
          recurringExpenses(transactions.filter((t) => t.type === 'expense'), today),
          transactions,
        )
        const monthly = items.reduce((total, r) => total + r.monthlyCost, 0)
        const thisMonthIncome = sum(
          transactions.filter((t) => t.type === 'income' && t.date.slice(0, 7) === today.slice(0, 7)),
        )
        return {
          items,
          monthly,
          annual: monthly * 12,
          shareOfIncome: thisMonthIncome > 0 ? (monthly / thisMonthIncome) * 100 : null,
        }
      }
      case 'category':
        return categoryDeepDive(transactions, period, activeCategory, today)
      default:
        return spendingSummary(transactions, period)
    }
  }, [data, type, transactions, period, today, month, activeCategory])

  const series = useMemo(() => {
    if (!data) return []
    const rows = transactions.filter(
      (t) => t.date >= period.from && t.date <= period.to && t.type === (type === 'income' ? 'income' : 'expense'),
    )
    return buildSeries(rows, preset === 'this-year' ? '12m' : '30d', period)
  }, [data, transactions, period, preset, type])

  const incomeMonths = useMemo(
    () => (data ? monthlySeries(transactions, today, 'income', 6) : []),
    [data, transactions, today],
  )

  if (!data || !view) return <div className="bfh-page" />

  const current = REPORTS.find((r) => r.id === type)
  const periodLabel = type === 'monthly' ? view.label : period.label

  const exportReport = async (extension) => {
    const { columns, rows } = reportExport(type, view, { period, symbol })
    const filename = reportFilename(current.label, periodLabel, extension, today)
    if (extension === 'csv') downloadCSV(rows, columns, filename)
    else await downloadXLSX(rows, columns, filename, current.label)
  }

  return (
    <div className="bfh-page bfh-preports">
      <div className="bfh-block bfh-personalhead">
        <h1 className="bfh-personalhead__title">Personal Reports</h1>

        <div className="bfh-preports__controls">
          <div className="bfh-periods" role="group" aria-label="Reporting period">
            {PERIOD_PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="bfh-period"
                aria-pressed={preset === option.id}
                onClick={() => setPreset(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button type="button" className="bfh-ghostaction" onClick={() => exportReport('csv')}>
            <IconTableExport size={12} stroke={1.5} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="bfh-block bfh-preports__custom">
          <label className="bfh-formfield">
            <span className="bfh-micro">From</span>
            <input
              type="date"
              value={custom.from || period.from}
              max={custom.to || today}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
          </label>
          <label className="bfh-formfield">
            <span className="bfh-micro">To</span>
            <input
              type="date"
              value={custom.to || period.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </label>
        </div>
      )}

      <div className="bfh-block bfh-preports__grid">
        {/* One list, two shapes: a column beside the report on a desktop and a
            scrolling tab row above it on a phone, which the stylesheet does. */}
        <nav className="bfh-preportnav" aria-label="Report types">
          {REPORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="bfh-preportnav__item"
              aria-current={type === item.id ? 'true' : undefined}
              onClick={() => setType(item.id)}
            >
              <span className="bfh-preportnav__dot" aria-hidden="true" />
              <span className="bfh-preportnav__full">{item.label}</span>
              <span className="bfh-preportnav__short">{item.short}</span>
            </button>
          ))}
        </nav>

        <section className="bfh-card bfh-preport">
          <header className="bfh-preport__head">
            <div>
              <h2 className="bfh-preport__title">{current.label}</h2>
              <span className="bfh-micro">{periodLabel}</span>
            </div>
            <div className="bfh-preport__actions">
              <button type="button" className="bfh-ghostaction" onClick={() => exportReport('csv')}>
                Export CSV
              </button>
              <button type="button" className="bfh-ghostaction" onClick={() => exportReport('xlsx')}>
                Export Excel
              </button>
            </div>
          </header>

          {type === 'spending' && (
            <SpendingSummary
              view={view}
              series={series}
              symbol={symbol}
              icons={data.categoryIcons}
              period={period}
            />
          )}
          {type === 'income' && (
            <IncomeBreakdown
              view={view}
              series={series}
              months={incomeMonths}
              symbol={symbol}
              icons={data.categoryIcons}
              period={period}
            />
          )}
          {type === 'savings' && (
            <SavingsReport view={view} goals={data.goals} symbol={symbol} today={today} />
          )}
          {type === 'monthly' && (
            <MonthlySnapshot
              view={view}
              symbol={symbol}
              month={month}
              today={today}
              onMonth={(step) => setMonth((m) => shiftMonths(`${m}-01`, step).slice(0, 7))}
            />
          )}
          {type === 'networth' && (
            <NetWorthOverTime history={view.history} items={view.items} symbol={symbol} />
          )}
          {type === 'recurring' && <Recurring view={view} symbol={symbol} />}
          {type === 'category' && (
            <CategoryDeepDive
              view={view}
              categories={expenseCategories}
              selected={activeCategory}
              onSelect={setCategory}
              symbol={symbol}
            />
          )}
        </section>
      </div>
    </div>
  )
}
