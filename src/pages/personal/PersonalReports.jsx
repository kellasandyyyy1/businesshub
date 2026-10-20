import { IconFileTypeCsv, IconFileTypeXls } from '@tabler/icons-react'
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
import { downloadCSV, downloadXLSX, exportWithToast } from '../../lib/export'
import { useToast } from '../../context/ToastContext'
import useSelectedInView from '../../hooks/useSelectedInView'
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

/**
 * Each report says in one line what question it answers. `period` marks the
 * ones the period chips apply to — the rest pick a month, or describe today,
 * and showing chips that change nothing would be a control that lies.
 */
const REPORTS = [
  { id: 'spending', label: 'Spending', blurb: 'Where your money went.', period: true },
  { id: 'income', label: 'Income', blurb: 'What came in, and from where.', period: true },
  { id: 'savings', label: 'Savings', blurb: 'How much you kept, and how your goals are doing.', period: true },
  { id: 'monthly', label: 'Month in review', short: 'Month', blurb: 'One month, start to finish.' },
  { id: 'networth', label: 'Net worth', blurb: 'What you own less what you owe, over time.' },
  { id: 'recurring', label: 'Subscriptions', blurb: 'Charges that repeat every month.' },
  { id: 'category', label: 'One category', short: 'Category', blurb: 'Every payment in a single category.', period: true },
]

export default function PersonalReports() {
  const data = usePersonalReportsData()
  const { symbol } = useSettings()
  const toast = useToast()

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

  const transactions = useMemo(() => data?.transactions ?? [], [data])

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

  const ready = Boolean(data && view)
  // The period row comes and goes with the report, so it re-centres on each return.
  const presetRow = useSelectedInView(preset, ready && `${type}`)
  const reportRow = useSelectedInView(type, ready)

  if (!data || !view) return <div className="bfh-page" />

  const current = REPORTS.find((r) => r.id === type)
  const periodLabel = current.period ? period.label : type === 'monthly' ? view.label : 'As of today'

  const exportReport = async (extension) => {
    const { columns, rows } = reportExport(type, view, { period, symbol })
    const filename = reportFilename(current.label, periodLabel, extension, today)
    await exportWithToast(toast, () =>
      extension === 'csv' ? downloadCSV(rows, columns, filename) : downloadXLSX(rows, columns, filename, current.label),
    )
  }

  return (
    <div className="bfh-page bfh-preports">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Reports</h1>
          <p className="bfh-pagehead__sub">Pick a report to see where you stand.</p>
        </div>
      </div>

      <div className="bfh-block bfh-preports__grid">
        {/* One list, two shapes: a column beside the report on a desktop and a
            scrolling tab row above it on a phone, which the stylesheet does. */}
        <nav className="bfh-preportnav" aria-label="Reports" ref={reportRow}>
          {REPORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="bfh-preportnav__item"
              aria-current={type === item.id ? 'true' : undefined}
              onClick={() => setType(item.id)}
            >
              <span className="bfh-preportnav__full">{item.label}</span>
              <span className="bfh-preportnav__short">{item.short ?? item.label}</span>
            </button>
          ))}
        </nav>

        <section className="bfh-card bfh-preport" aria-labelledby="bfh-preport-title">
          <header className="bfh-preport__head">
            <h2 className="bfh-preport__title" id="bfh-preport-title">
              {current.label}
            </h2>
            <p className="bfh-preport__blurb">
              {current.blurb}
              {!current.period && type !== 'monthly' && <span> {periodLabel}.</span>}
            </p>
          </header>

          {/* The period belongs to the report it changes, so it sits inside
              it — and only on the reports it actually changes. */}
          {current.period && (
            <div className="bfh-preport__period">
              <div className="bfh-chiprow" role="radiogroup" aria-label="Period" ref={presetRow}>
                {PERIOD_PRESETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    className="bfh-choicechip"
                    aria-checked={preset === option.id}
                    onClick={() => setPreset(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {preset === 'custom' ? (
                <div className="bfh-preports__custom">
                  <label className="bfh-formfield">
                    <span className="bfh-fieldlabel">From</span>
                    <input
                      type="date"
                      value={custom.from || period.from}
                      max={custom.to || today}
                      onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                    />
                  </label>
                  <label className="bfh-formfield">
                    <span className="bfh-fieldlabel">To</span>
                    <input
                      type="date"
                      value={custom.to || period.to}
                      min={custom.from || undefined}
                      onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <span className="bfh-preport__range">{period.label}</span>
              )}
            </div>
          )}

          <div className="bfh-preport__body">
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
          </div>

          {/* Last, after the report has been read, and saying what it saves. */}
          <footer className="bfh-preport__downloads">
            <span className="bfh-preport__downloadlabel">
              Download {current.label.toLowerCase()} · {periodLabel}
            </span>
            <div className="bfh-preport__actions">
              <button type="button" className="bfh-btn-outline" onClick={() => exportReport('csv')}>
                <IconFileTypeCsv size={17} stroke={1.5} aria-hidden="true" />
                CSV
              </button>
              <button type="button" className="bfh-btn-outline" onClick={() => exportReport('xlsx')}>
                <IconFileTypeXls size={17} stroke={1.5} aria-hidden="true" />
                Excel
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  )
}
