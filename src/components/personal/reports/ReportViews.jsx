import { IconChevronLeft, IconChevronRight, IconScale, IconTargetArrow } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

import BarChart from '../../common/BarChart'
import NetWorthColumn from '../NetWorthColumn'
import EmptyState from '../../EmptyState'
import { categoryIcon } from '../../../config/categoryIcons'
import { formatCurrency, formatDate } from '../../../lib/format'
import { STATUS_LABELS, goalStatus } from '../../../lib/goals'
import { monthLabel } from '../../../lib/personalReports'
import { splitByType } from '../../../lib/netWorth'

/* ---- Shared pieces ------------------------------------------------------ */

export function Strip({ stats }) {
  return (
    <div className="bfh-summary bfh-preport__strip">
      {stats.map((stat) => (
        <div className="bfh-summary__cell" key={stat.label}>
          <span className="bfh-micro">{stat.label}</span>
          <span className="bfh-summary__value">{stat.value}</span>
        </div>
      ))}
    </div>
  )
}

/** A table that can be read on a phone by scrolling it, not by shrinking it. */
function Table({ head, children }) {
  return (
    <div className="bfh-preport__tablewrap">
      <table className="bfh-preport__table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell.label} className={cell.numeric ? 'bfh-cell-amount' : undefined}>
                {cell.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function MiniBar({ value, max }) {
  return (
    <span className="bfh-minibar" aria-hidden="true">
      <span className="bfh-minibar__fill" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </span>
  )
}

function Empty({ children }) {
  return <p className="bfh-empty">{children}</p>
}

/* ---- 1. Spending summary ------------------------------------------------ */

export function SpendingSummary({ view, series, symbol, icons, period }) {
  return (
    <>
      <Strip
        stats={[
          { label: 'Total spent', value: formatCurrency(view.total, symbol) },
          { label: 'Daily average', value: formatCurrency(view.dailyAverage, symbol) },
          { label: 'Vs last period', value: view.delta },
        ]}
      />

      {view.categories.length === 0 ? (
        <Empty>No spending in this period.</Empty>
      ) : (
        <Table
          head={[
            { label: 'Category' },
            { label: 'Spent', numeric: true },
            { label: '% of total', numeric: true },
            { label: 'Vs last period' },
          ]}
        >
          {view.categories.map((row) => {
            const Icon = categoryIcon(icons[row.key])
            return (
              <tr key={row.key}>
                <td>
                  <span className="bfh-preport__name">
                    <Icon size={14} stroke={1.5} aria-hidden="true" />
                    {row.name}
                  </span>
                </td>
                <td className="bfh-cell-amount">
                  <span className="bfh-preport__amountcell">
                    {formatCurrency(row.value, symbol)}
                    <MiniBar value={row.value} max={view.max} />
                  </span>
                </td>
                <td className="bfh-cell-amount bfh-preport__muted">
                  {Math.round(row.share * 100)}%
                </td>
                <td className="bfh-preport__muted">{row.delta}</td>
              </tr>
            )
          })}
        </Table>
      )}

      <BarChart
        title="Spending over time"
        sub={period.label}
        series={series}
        symbol={symbol}
        variant="hatched"
        ariaLabel="Personal spending over time"
      />

      <h3 className="bfh-preport__heading">Where you spend most</h3>
      {view.merchants.length === 0 ? (
        <Empty>Nothing to rank yet.</Empty>
      ) : (
        <ul className="bfh-preport__rank">
          {view.merchants.map((row, i) => (
            <li key={row.key} className="bfh-preport__rankrow">
              <span className="bfh-preport__ranknum">{String(i + 1).padStart(2, '0')}</span>
              <span className="bfh-preport__rankbody">
                <span className="bfh-preport__rankname">{row.name}</span>
                <span className="bfh-preport__rankmeta">
                  {row.count} transaction{row.count === 1 ? '' : 's'}
                </span>
              </span>
              <span className="bfh-preport__rankvalue">{formatCurrency(row.value, symbol)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ---- 2. Income breakdown ------------------------------------------------ */

export function IncomeBreakdown({ view, series, months, symbol, icons, period }) {
  return (
    <>
      <Strip
        stats={[
          { label: 'Total income', value: formatCurrency(view.total, symbol) },
          { label: 'Sources', value: String(view.sourceCount) },
          { label: 'Largest source', value: view.largest ? view.largest.name : '—' },
        ]}
      />

      {view.sources.length === 0 ? (
        <Empty>No income in this period.</Empty>
      ) : (
        <Table
          head={[
            { label: 'Source' },
            { label: 'Amount', numeric: true },
            { label: '% of income', numeric: true },
            { label: 'Transactions', numeric: true },
          ]}
        >
          {view.sources.map((row) => {
            const Icon = categoryIcon(icons[row.key])
            return (
              <tr key={row.key}>
                <td>
                  <span className="bfh-preport__name">
                    <Icon size={14} stroke={1.5} aria-hidden="true" />
                    {row.name}
                  </span>
                </td>
                <td className="bfh-cell-amount">
                  <span className="bfh-preport__amountcell">
                    {formatCurrency(row.value, symbol)}
                    <MiniBar value={row.value} max={view.max} />
                  </span>
                </td>
                <td className="bfh-cell-amount bfh-preport__muted">
                  {Math.round(row.share * 100)}%
                </td>
                <td className="bfh-cell-amount bfh-preport__muted">{row.count}</td>
              </tr>
            )
          })}
        </Table>
      )}

      <BarChart
        title="Income over time"
        sub={period.label}
        series={series}
        symbol={symbol}
        ariaLabel="Personal income over time"
      />

      <h3 className="bfh-preport__heading">Month by month</h3>
      <p className="bfh-preport__note">The last six months, whichever period is selected.</p>
      <Table
        head={[{ label: 'Month' }, { label: 'Income', numeric: true }, { label: 'Vs prev month' }]}
      >
        {months.map((row) => (
          <tr key={row.month}>
            <td>{row.label}</td>
            <td className="bfh-cell-amount">{formatCurrency(row.value, symbol)}</td>
            <td className="bfh-preport__muted">{row.delta}</td>
          </tr>
        ))}
      </Table>
    </>
  )
}

/* ---- 3. Savings --------------------------------------------------------- */

export function SavingsReport({ view, goals, symbol, today }) {
  const rateSeries = view.rateHistory.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: m.rate ?? 0 }))
  const deficits = view.rateHistory.filter((m) => m.deficit)

  return (
    <>
      <Strip
        stats={[
          { label: 'Income', value: formatCurrency(view.income, symbol) },
          { label: 'Spent', value: formatCurrency(view.expenses, symbol) },
          { label: 'Saved', value: formatCurrency(view.saved, symbol) },
          {
            label: 'Savings rate',
            value: view.savingsRate === null ? '—' : `${Math.round(view.savingsRate)}%`,
          },
        ]}
      />

      <BarChart
        title="Your savings rate over time"
        sub="Last 6 months"
        series={rateSeries}
        symbol=""
        ariaLabel="Savings rate over time"
        note={
          deficits.length
            ? `${deficits.map((m) => m.label.split(' ')[0]).join(', ')} ran a deficit and reads as 0%.`
            : null
        }
      />

      <h3 className="bfh-preport__heading">Goals this period</h3>
      {goals.length === 0 ? (
        <p className="bfh-empty">
          No goals set yet. <Link className="bfh-link" to="/personal/goals">Create one →</Link>
        </p>
      ) : (
        <Table
          head={[
            { label: 'Goal' },
            { label: 'Target', numeric: true },
            { label: 'Saved so far', numeric: true },
            { label: 'Remaining', numeric: true },
            { label: 'On track' },
          ]}
        >
          {goals.map((goal) => {
            const status = goalStatus(goal, today)
            const remaining = Math.max((Number(goal.target) || 0) - (Number(goal.current) || 0), 0)
            return (
              <tr key={goal.id}>
                <td>{goal.name}</td>
                <td className="bfh-cell-amount">{formatCurrency(goal.target ?? 0, symbol)}</td>
                <td className="bfh-cell-amount">{formatCurrency(goal.current ?? 0, symbol)}</td>
                <td className="bfh-cell-amount">{formatCurrency(remaining, symbol)}</td>
                <td>
                  <span className={status === 'completed' ? 'bfh-pill-invert' : 'bfh-goalcard__status'}>
                    {STATUS_LABELS[status]}
                  </span>
                </td>
              </tr>
            )
          })}
        </Table>
      )}

      <h3 className="bfh-preport__heading">Spending breakdown</h3>
      <p className="bfh-preport__note">Based on the 50/30/20 budgeting rule.</p>

      <ul className="bfh-bucketlist">
        {view.buckets.map((bucket) => (
          <li className="bfh-bucket" key={bucket.id}>
            <span className="bfh-bucket__top">
              <span className="bfh-bucket__name">{bucket.label}</span>
              <span className="bfh-bucket__figures">
                {formatCurrency(bucket.value, symbol)}
                <span className="bfh-preport__muted">
                  {' '}
                  · {bucket.share === null ? '—' : `${Math.round(bucket.share)}%`} of{' '}
                  {bucket.target}%
                </span>
              </span>
            </span>
            {/* The track is the whole income; the mark is where the guideline
                sits, so overshooting it is visible rather than implied. */}
            <span className="bfh-bucket__track">
              <span
                className="bfh-bucket__fill"
                style={{ width: `${Math.min(bucket.share ?? 0, 100)}%` }}
              />
              <span className="bfh-bucket__target" style={{ left: `${bucket.target}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="bfh-preport__note">These are guidelines, not rules. Adjust to your situation.</p>
    </>
  )
}

/* ---- 4. Monthly snapshot ------------------------------------------------ */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function MonthlySnapshot({ view, symbol, month, onMonth, today }) {
  const atLatest = month >= today.slice(0, 7)

  return (
    <>
      <div className="bfh-preport__monthpick">
        <button
          type="button"
          className="bfh-iconaction"
          aria-label="Previous month"
          onClick={() => onMonth(-1)}
        >
          <IconChevronLeft size={14} stroke={1.5} aria-hidden="true" />
        </button>
        <span className="bfh-preport__monthname">{view.label}</span>
        <button
          type="button"
          className="bfh-iconaction"
          aria-label="Next month"
          disabled={atLatest}
          onClick={() => onMonth(1)}
        >
          <IconChevronRight size={14} stroke={1.5} aria-hidden="true" />
        </button>
        <span className="bfh-micro">{view.grid.daysInMonth} days</span>
      </div>

      <Strip
        stats={[
          { label: 'Income', value: formatCurrency(view.income, symbol) },
          { label: 'Expenses', value: formatCurrency(view.expenses, symbol) },
          { label: 'Saved', value: formatCurrency(view.saved, symbol) },
          {
            label: 'Savings rate',
            value: view.savingsRate === null ? '—' : `${Math.round(view.savingsRate)}%`,
          },
        ]}
      />

      <h3 className="bfh-preport__heading">Income</h3>
      {view.byIncomeCategory.length === 0 ? (
        <Empty>No income this month.</Empty>
      ) : (
        <Table head={[{ label: 'Category' }, { label: 'Amount', numeric: true }]}>
          {view.byIncomeCategory.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td className="bfh-cell-amount">{formatCurrency(row.value, symbol)}</td>
            </tr>
          ))}
        </Table>
      )}

      <h3 className="bfh-preport__heading">Expenses</h3>
      {view.byExpenseCategory.length === 0 ? (
        <Empty>No spending this month.</Empty>
      ) : (
        <Table head={[{ label: 'Category' }, { label: 'Amount', numeric: true }]}>
          {view.byExpenseCategory.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td className="bfh-cell-amount">{formatCurrency(row.value, symbol)}</td>
            </tr>
          ))}
        </Table>
      )}

      <h3 className="bfh-preport__heading">Daily spending</h3>
      <div className="bfh-heatmap">
        <div className="bfh-heatmap__head">
          {WEEKDAYS.map((day, i) => (
            <span key={`${day}-${i}`} className="bfh-micro" data-weekend={i > 4 ? 'true' : undefined}>
              {day}
            </span>
          ))}
        </div>
        {view.grid.weeks.map((week, w) => (
          <div className="bfh-heatmap__week" key={w}>
            {week.map((cell, i) => (
              <span
                key={cell ? cell.date : `blank-${i}`}
                className="bfh-heatmap__day"
                data-weekend={i > 4 ? 'true' : undefined}
                data-empty={cell ? undefined : 'true'}
                title={cell ? `${formatDate(cell.date)} — ${formatCurrency(cell.spent, symbol)}` : undefined}
              >
                {/* Ink at varying opacity, never a colour scale — the one place
                    in the app where opacity carries a value. */}
                {cell && cell.spent > 0 && (
                  <span
                    className="bfh-heatmap__fill"
                    style={{ opacity: 0.15 + (cell.spent / (view.grid.peak || 1)) * 0.45 }}
                  />
                )}
                {cell && <span className="bfh-heatmap__num">{cell.day}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="bfh-preport__sentence">
        {view.net >= 0
          ? `This month you saved ${formatCurrency(view.net, symbol)}.`
          : `This month you spent ${formatCurrency(Math.abs(view.net), symbol)} more than you earned.`}
      </p>
    </>
  )
}

/* ---- 5. Net worth over time --------------------------------------------- */

export function NetWorthOverTime({ history, items, symbol }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={IconScale}
        heading="No net worth data yet."
        body="Add your assets and liabilities in Net Worth to track changes over time."
      />
    )
  }

  const current = history.length ? history[history.length - 1] : null
  const split = splitByType(items)

  return (
    <>
      <div className="bfh-nwsummary__value">
        <span className="bfh-nwsummary__figure">
          {formatCurrency(current ? current.net : 0, symbol)}
        </span>
        {current && current.net < 0 && <span className="bfh-micro">(deficit)</span>}
      </div>

      <BarChart
        title="Net worth trend"
        sub="Month by month"
        series={history.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: Math.max(m.net, 0) }))}
        symbol={symbol}
        variant="hatched"
        ariaLabel="Net worth over time"
      />

      <Table
        head={[
          { label: 'Month' },
          { label: 'Assets', numeric: true },
          { label: 'Liabilities', numeric: true },
          { label: 'Net worth', numeric: true },
          { label: 'Change', numeric: true },
        ]}
      >
        {history.map((row, i) => (
          <tr key={row.month} data-current={i === history.length - 1 ? 'true' : undefined}>
            <td>{row.label}</td>
            <td className="bfh-cell-amount">{formatCurrency(row.assets, symbol)}</td>
            <td className="bfh-cell-amount">{formatCurrency(row.liabilities, symbol)}</td>
            <td className="bfh-cell-amount">{formatCurrency(row.net, symbol)}</td>
            <td className="bfh-cell-amount bfh-preport__muted">
              {!row.change
                ? '—'
                : `${row.change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(row.change), symbol)}`}
            </td>
          </tr>
        ))}
      </Table>

      <div className="bfh-nwsplit bfh-preport__split">
        <NetWorthColumn
          title="Assets"
          type="asset"
          items={split.assets}
          symbol={symbol}
          addLabel=""
          onAdd={() => {}}
          onEdit={() => {}}
        />
        <NetWorthColumn
          title="Liabilities"
          type="liability"
          items={split.liabilities}
          symbol={symbol}
          addLabel=""
          onAdd={() => {}}
          onEdit={() => {}}
        />
      </div>
    </>
  )
}

/* ---- 6. Subscriptions and recurring ------------------------------------- */

export function Recurring({ view, symbol }) {
  return (
    <>
      <Strip
        stats={[
          { label: 'Monthly cost', value: formatCurrency(view.monthly, symbol) },
          { label: 'Annual cost', value: formatCurrency(view.annual, symbol) },
          { label: 'Count', value: String(view.items.length) },
        ]}
      />

      {view.items.length === 0 ? (
        <Empty>
          Nothing repeating yet. A charge has to appear in two of the last three months before it
          counts as recurring.
        </Empty>
      ) : (
        <>
          <ul className="bfh-preport__rank">
            {view.items.map((row) => (
              <li key={row.key} className="bfh-preport__rankrow">
                <span className="bfh-preport__rankbody">
                  <span className="bfh-preport__rankname">{row.description}</span>
                  <span className="bfh-preport__rankmeta">
                    {row.category}
                    {row.lastCharged ? ` · last ${formatDate(row.lastCharged)}` : ''}
                  </span>
                </span>
                <span className="bfh-preport__rankright">
                  <span className="bfh-preport__rankvalue">
                    {formatCurrency(row.monthlyCost, symbol)}
                  </span>
                  <span className="bfh-preport__rankmeta">
                    {formatCurrency(row.annualised, symbol)} a year
                  </span>
                </span>
                <span className="bfh-goalcard__status">Monthly</span>
              </li>
            ))}
          </ul>

          <span className="bfh-bucket__track bfh-preport__sharebar">
            <span
              className="bfh-bucket__fill"
              style={{ width: `${Math.min(view.shareOfIncome ?? 0, 100)}%` }}
            />
          </span>
          <p className="bfh-preport__note">
            {view.shareOfIncome === null
              ? 'Add some income this month to see what share these take.'
              : `Subscriptions are ${Math.round(view.shareOfIncome)}% of your monthly income.`}
          </p>
        </>
      )}
    </>
  )
}

/* ---- 7. Category deep dive ---------------------------------------------- */

export function CategoryDeepDive({ view, categories, selected, onSelect, symbol }) {
  return (
    <>
      <label className="bfh-formfield bfh-preport__picker">
        <span className="bfh-micro">Category</span>
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <Strip
        stats={[
          { label: 'Total this period', value: formatCurrency(view.total, symbol) },
          { label: 'Transactions', value: String(view.count) },
          { label: 'Average', value: formatCurrency(view.average, symbol) },
          { label: 'Largest', value: formatCurrency(view.largest, symbol) },
        ]}
      />

      {view.rows.length === 0 ? (
        <Empty>Nothing in this category for the selected period.</Empty>
      ) : (
        <Table
          head={[{ label: 'Date' }, { label: 'Description' }, { label: 'Amount', numeric: true }]}
        >
          {view.rows.map((row) => (
            <tr key={row.id}>
              <td className="bfh-cell-date">{formatDate(row.date)}</td>
              <td>{row.description}</td>
              <td className="bfh-cell-amount">−{formatCurrency(row.amount, symbol)}</td>
            </tr>
          ))}
        </Table>
      )}

      <BarChart
        title="Last 6 months"
        sub={view.category}
        series={view.history.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: m.value }))}
        symbol={symbol}
        variant="hatched"
        ariaLabel={`${view.category} over the last six months`}
      />

      <Table
        head={[
          { label: 'Month' },
          { label: 'Amount', numeric: true },
          { label: 'Transactions', numeric: true },
          { label: 'Change' },
        ]}
      >
        {view.history.map((row) => (
          <tr key={row.month}>
            <td>{row.label}</td>
            <td className="bfh-cell-amount">{formatCurrency(row.value, symbol)}</td>
            <td className="bfh-cell-amount bfh-preport__muted">{row.count}</td>
            <td className="bfh-preport__muted">{row.delta}</td>
          </tr>
        ))}
      </Table>
    </>
  )
}

export { monthLabel, IconTargetArrow }
