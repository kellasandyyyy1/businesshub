import { IconArrowRight, IconChevronLeft, IconChevronRight, IconScale } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import BarChart from '../../common/BarChart'
import EmptyState from '../../EmptyState'
import { categoryIcon } from '../../../config/categoryIcons'
import { formatCurrency, formatDate } from '../../../lib/format'
import { STATUS_LABELS, goalStatus } from '../../../lib/goals'
import { splitByType } from '../../../lib/netWorth'

/* ---- Shared pieces ------------------------------------------------------ */

/**
 * The one figure the report exists to answer, with a sentence saying what it
 * means. Everything below it is detail.
 */
function Hero({ label, value, context }) {
  return (
    <div className="bfh-prhero">
      <span className="bfh-micro">{label}</span>
      <span className="bfh-prhero__figure">{value}</span>
      {context && <p className="bfh-prhero__context">{context}</p>}
    </div>
  )
}

/** Two or three supporting figures in one row — never a grid with holes in it. */
function Stats({ stats }) {
  return (
    <dl className="bfh-prstats" data-count={stats.length}>
      {stats.map((stat) => (
        <div className="bfh-prstats__cell" key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="bfh-prsection">
      <header className="bfh-prsection__head">
        <h3 className="bfh-prsection__title">{title}</h3>
        {hint && <p className="bfh-prsection__hint">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

function Bar({ share, target }) {
  return (
    <span className="bfh-prbar" aria-hidden="true">
      <span className="bfh-prbar__fill" style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%` }} />
      {target != null && <span className="bfh-prbar__target" style={{ left: `${target * 100}%` }} />}
    </span>
  )
}

/**
 * The row every list in the reports is made of. Name and figure share the
 * first line — the name gives way with an ellipsis, the figure never does —
 * and anything else drops to a line of its own underneath, so nothing has to
 * scroll sideways or squeeze into a column.
 */
function Row({ icon: Icon, name, value, meta, sub, share, target }) {
  return (
    <li className="bfh-prow">
      {Icon && (
        <span className="bfh-prow__icon" aria-hidden="true">
          <Icon size={16} stroke={1.5} />
        </span>
      )}
      <span className="bfh-prow__main">
        <span className="bfh-prow__line">
          <span className="bfh-prow__name">{name}</span>
          <span className="bfh-prow__value">{value}</span>
        </span>
        {share != null && <Bar share={share} target={target} />}
        {(meta || sub) && (
          <span className="bfh-prow__line bfh-prow__line--meta">
            <span className="bfh-prow__meta">{meta}</span>
            {sub && <span className="bfh-prow__sub">{sub}</span>}
          </span>
        )}
      </span>
    </li>
  )
}

function Rows({ children }) {
  return <ul className="bfh-prows">{children}</ul>
}

function Empty({ children }) {
  return <p className="bfh-empty bfh-prempty">{children}</p>
}

/** "↑ 12% on the previous period", in words for the cases with no arrow. */
function compared(delta, against) {
  if (!delta || delta === '—') return null
  if (delta === 'New') return `Nothing in ${against} to compare with.`
  if (delta === 'Level') return `About the same as ${against}.`
  return `${delta} on ${against}.`
}

/** The short form for a row: "↑ 12% vs before", "new", or nothing. */
function shortDelta(delta, against = 'before') {
  if (!delta || delta === '—') return null
  if (delta === 'New') return against === 'before' ? 'new this period' : `nothing ${against}`
  if (delta === 'Level') return `same as ${against}`
  return `${delta} vs ${against}`
}

const join = (...parts) => parts.filter(Boolean).join(' · ')

const percentOf = (share) => `${Math.round(share * 100)}%`

const hasValues = (series) => series.some((point) => point.value > 0)

/* ---- 1. Spending summary ------------------------------------------------ */

export function SpendingSummary({ view, series, symbol, icons, period }) {
  if (!view.categories.length) return <Empty>No spending in {period.label.toLowerCase()}.</Empty>

  const top = view.categories[0]

  return (
    <>
      <Hero
        label="Total spent"
        value={formatCurrency(view.total, symbol)}
        context={compared(view.delta, 'the previous period')}
      />
      <Stats
        stats={[
          { label: 'A day, on average', value: formatCurrency(view.dailyAverage, symbol) },
          { label: 'Biggest category', value: top.name },
        ]}
      />

      <Section title="By category" hint="Each bar is that category's share of the total.">
        <Rows>
          {view.categories.map((row) => (
            <Row
              key={row.key}
              icon={categoryIcon(icons[row.key])}
              name={row.name}
              value={formatCurrency(row.value, symbol)}
              share={row.share}
              meta={join(`${percentOf(row.share)} of spending`, shortDelta(row.delta))}
            />
          ))}
        </Rows>
      </Section>

      {hasValues(series) && (
        <BarChart
          title="Over time"
          sub={period.label}
          series={series}
          symbol={symbol}
          ariaLabel="Personal spending over time"
        />
      )}

      {view.merchants.length > 0 && (
        <Section title="Where it went" hint="The places and payees you paid the most.">
          <Rows>
            {view.merchants.map((row) => (
              <Row
                key={row.key}
                name={row.name}
                value={formatCurrency(row.value, symbol)}
                meta={`${row.count} payment${row.count === 1 ? '' : 's'}`}
              />
            ))}
          </Rows>
        </Section>
      )}
    </>
  )
}

/* ---- 2. Income breakdown ------------------------------------------------ */

export function IncomeBreakdown({ view, series, months, symbol, icons, period }) {
  const history = [...months].reverse()

  return (
    <>
      {view.sources.length === 0 ? (
        <Empty>No income in {period.label.toLowerCase()}.</Empty>
      ) : (
        <>
          <Hero
            label="Total income"
            value={formatCurrency(view.total, symbol)}
            context={
              view.sourceCount === 1
                ? `All of it from ${view.largest.name}.`
                : `From ${view.sourceCount} sources, most of it from ${view.largest.name}.`
            }
          />

          <Section title="By source">
            <Rows>
              {view.sources.map((row) => (
                <Row
                  key={row.key}
                  icon={categoryIcon(icons[row.key])}
                  name={row.name}
                  value={formatCurrency(row.value, symbol)}
                  share={row.share}
                  meta={join(`${percentOf(row.share)} of income`, `${row.count} payment${row.count === 1 ? '' : 's'}`)}
                />
              ))}
            </Rows>
          </Section>

          {hasValues(series) && (
            <BarChart
              title="Over time"
              sub={period.label}
              series={series}
              symbol={symbol}
              ariaLabel="Personal income over time"
            />
          )}
        </>
      )}

      <Section title="Month by month" hint="The last six months, whichever period is picked above.">
        <Rows>
          {history.map((row) => (
            <Row
              key={row.month}
              name={row.label}
              value={formatCurrency(row.value, symbol)}
              meta={shortDelta(row.delta, 'the month before')}
            />
          ))}
        </Rows>
      </Section>
    </>
  )
}

/* ---- 3. Savings --------------------------------------------------------- */

export function SavingsReport({ view, goals, symbol, today }) {
  const rateSeries = view.rateHistory.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: m.rate ?? 0 }))
  const deficits = view.rateHistory.filter((m) => m.deficit)
  const rate = view.savingsRate === null ? '—' : `${Math.round(view.savingsRate)}%`

  let context
  if (view.income === 0 && view.expenses === 0) context = 'Nothing came in or went out in this period.'
  else if (view.income === 0) context = 'No income recorded in this period, so there is nothing to save from yet.'
  else if (view.leftOver < 0)
    context = `You spent ${formatCurrency(-view.leftOver, symbol)} more than came in.`
  else context = `${rate} of what came in stayed with you.`

  return (
    <>
      <Hero label="Saved" value={formatCurrency(view.saved, symbol)} context={context} />
      <Stats
        stats={[
          { label: 'Came in', value: formatCurrency(view.income, symbol) },
          { label: 'Went out', value: formatCurrency(view.expenses, symbol) },
          { label: 'Savings rate', value: rate },
        ]}
      />

      {hasValues(rateSeries) && (
        <BarChart
          title="Savings rate"
          sub="Last 6 months"
          series={rateSeries}
          unit="percent"
          ariaLabel="Savings rate over time"
          note={
            deficits.length
              ? `${deficits.map((m) => m.label.split(' ')[0]).join(', ')} spent more than came in, shown as 0%.`
              : null
          }
        />
      )}

      <Section title="Goals">
        {goals.length === 0 ? (
          <p className="bfh-empty bfh-prempty">
            No goals yet.{' '}
            <Link className="bfh-link" to="/personal/goals">
              Set one up
            </Link>
          </p>
        ) : (
          <Rows>
            {goals.map((goal) => {
              const target = Number(goal.target) || 0
              const current = Number(goal.current) || 0
              const remaining = Math.max(target - current, 0)
              return (
                <Row
                  key={goal.id}
                  name={goal.name}
                  value={`${formatCurrency(current, symbol)} of ${formatCurrency(target, symbol)}`}
                  share={target > 0 ? current / target : 0}
                  meta={STATUS_LABELS[goalStatus(goal, today)]}
                  sub={remaining > 0 ? `${formatCurrency(remaining, symbol)} to go` : 'Reached'}
                />
              )
            })}
          </Rows>
        )}
      </Section>

      <Section
        title="Needs, wants, savings"
        hint="The 50/30/20 guideline, measured against what came in. The tick marks each guideline."
      >
        <Rows>
          {view.buckets.map((bucket) => (
            <Row
              key={bucket.id}
              name={bucket.label}
              value={formatCurrency(bucket.value, symbol)}
              share={(bucket.share ?? 0) / 100}
              target={bucket.target / 100}
              meta={
                bucket.share === null
                  ? `Guideline ${bucket.target}%`
                  : `${Math.round(bucket.share)}% of income · guideline ${bucket.target}%`
              }
            />
          ))}
        </Rows>
      </Section>
    </>
  )
}

/* ---- 4. Monthly snapshot ------------------------------------------------ */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Four steps of ink, so the darkest days stand out without a colour scale. */
const levelOf = (spent, peak) => (spent > 0 && peak > 0 ? Math.max(Math.ceil((spent / peak) * 4), 1) : 0)

function SpendingCalendar({ grid, symbol }) {
  const days = grid.weeks.flat().filter(Boolean)
  const biggest = days.reduce((best, day) => (day.spent > (best?.spent ?? 0) ? day : best), null)
  const [picked, setPicked] = useState(null)
  const shown = days.find((d) => d.date === picked) ?? null

  let readout
  if (shown) readout = `${formatDate(shown.date)}: ${shown.spent > 0 ? `${formatCurrency(shown.spent, symbol)} spent` : 'nothing spent'}`
  else if (biggest) readout = `Biggest day: ${formatDate(biggest.date)}, ${formatCurrency(biggest.spent, symbol)}`
  else readout = 'Nothing spent this month.'

  return (
    <div className="bfh-prcal">
      <div className="bfh-prcal__grid" role="group" aria-label="Spending by day">
        {WEEKDAYS.map((day) => (
          <span key={day} className="bfh-prcal__weekday" aria-hidden="true">
            {day.slice(0, 1)}
          </span>
        ))}
        {grid.weeks.flat().map((cell, i) =>
          cell ? (
            <button
              key={cell.date}
              type="button"
              className="bfh-prcal__day"
              data-level={levelOf(cell.spent, grid.peak)}
              aria-pressed={picked === cell.date}
              aria-label={`${formatDate(cell.date)}, ${formatCurrency(cell.spent, symbol)} spent`}
              onClick={() => setPicked((p) => (p === cell.date ? null : cell.date))}
            >
              {cell.day}
            </button>
          ) : (
            // eslint-disable-next-line react/no-array-index-key
            <span key={`blank-${i}`} className="bfh-prcal__blank" aria-hidden="true" />
          ),
        )}
      </div>
      <div className="bfh-prcal__foot">
        <p className="bfh-prcal__readout" role="status">
          {readout}
        </p>
        <span className="bfh-prcal__legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="bfh-prcal__swatch" data-level={level} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

export function MonthlySnapshot({ view, symbol, onMonth, month, today }) {
  const atLatest = month >= today.slice(0, 7)
  const rate = view.savingsRate === null ? '—' : `${Math.round(view.savingsRate)}%`

  let context
  if (view.income === 0 && view.expenses === 0) context = 'Nothing recorded this month.'
  else if (view.income === 0) context = 'No income recorded this month, only spending.'
  else if (view.net >= 0) context = `You kept ${rate} of what came in.`
  else context = `You spent ${formatCurrency(-view.net, symbol)} more than came in.`

  return (
    <>
      <div className="bfh-prmonth">
        <button type="button" className="bfh-prmonth__step" aria-label="Previous month" onClick={() => onMonth(-1)}>
          <IconChevronLeft size={18} stroke={1.5} aria-hidden="true" />
        </button>
        <span className="bfh-prmonth__name">{view.label}</span>
        <button
          type="button"
          className="bfh-prmonth__step"
          aria-label="Next month"
          disabled={atLatest}
          onClick={() => onMonth(1)}
        >
          <IconChevronRight size={18} stroke={1.5} aria-hidden="true" />
        </button>
      </div>

      <Hero
        label={view.net < 0 ? 'Overspent' : 'Left over'}
        value={formatCurrency(Math.abs(view.net), symbol)}
        context={context}
      />
      <Stats
        stats={[
          { label: 'Came in', value: formatCurrency(view.income, symbol) },
          { label: 'Went out', value: formatCurrency(view.expenses, symbol) },
          { label: 'Savings rate', value: rate },
        ]}
      />

      <Section title="Day by day" hint="Darker days are the ones you spent more. Tap a day to see it.">
        <SpendingCalendar grid={view.grid} symbol={symbol} />
      </Section>

      <Section title="Went out">
        {view.byExpenseCategory.length === 0 ? (
          <Empty>No spending this month.</Empty>
        ) : (
          <Rows>
            {view.byExpenseCategory.map((row) => (
              <Row
                key={row.key}
                name={row.name}
                value={formatCurrency(row.value, symbol)}
                share={row.share}
                meta={`${percentOf(row.share)} of spending`}
              />
            ))}
          </Rows>
        )}
      </Section>

      <Section title="Came in">
        {view.byIncomeCategory.length === 0 ? (
          <Empty>No income this month.</Empty>
        ) : (
          <Rows>
            {view.byIncomeCategory.map((row) => (
              <Row key={row.key} name={row.name} value={formatCurrency(row.value, symbol)} />
            ))}
          </Rows>
        )}
      </Section>
    </>
  )
}

/* ---- 5. Net worth over time --------------------------------------------- */

const changeText = (change, symbol) =>
  change ? `${change > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(change), symbol)}` : null

export function NetWorthOverTime({ history, items, symbol }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={IconScale}
        heading="No net worth data yet."
        body="Add what you own and what you owe in Net worth to follow it over time."
      />
    )
  }

  const current = history.length ? history[history.length - 1] : null
  const split = splitByType(items)
  const byAmount = (list) => [...list].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
  const assets = current?.assets ?? 0
  const liabilities = current?.liabilities ?? 0

  return (
    <>
      <Hero
        label="Net worth"
        value={formatCurrency(current ? current.net : 0, symbol)}
        context={
          current?.change
            ? `${changeText(current.change, symbol)} since last month.`
            : null
        }
      />
      <Stats
        stats={[
          { label: 'You own', value: formatCurrency(assets, symbol) },
          { label: 'You owe', value: formatCurrency(liabilities, symbol) },
        ]}
      />

      {history.length > 1 && (
        <BarChart
          title="Trend"
          sub="Month by month"
          series={history.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: Math.max(m.net, 0) }))}
          symbol={symbol}
          ariaLabel="Net worth over time"
        />
      )}

      <Section title="Month by month">
        <Rows>
          {[...history].reverse().map((row) => (
            <Row
              key={row.month}
              name={row.label}
              value={formatCurrency(row.net, symbol)}
              meta={`Own ${formatCurrency(row.assets, symbol)} · owe ${formatCurrency(row.liabilities, symbol)}`}
              sub={changeText(row.change, symbol)}
            />
          ))}
        </Rows>
      </Section>

      {[
        { title: 'What you own', list: split.assets, total: assets },
        { title: 'What you owe', list: split.liabilities, total: liabilities },
      ].map((side) =>
        side.list.length ? (
          <Section key={side.title} title={side.title}>
            <Rows>
              {byAmount(side.list).map((item) => (
                <Row
                  key={item.id}
                  name={item.name}
                  value={formatCurrency(item.amount, symbol)}
                  share={side.list.length > 1 && side.total > 0 ? (Number(item.amount) || 0) / side.total : null}
                  meta={item.category}
                />
              ))}
            </Rows>
          </Section>
        ) : null,
      )}

      <Link className="bfh-prlink" to="/personal/net-worth">
        Update these in Net worth
        <IconArrowRight size={14} stroke={1.75} aria-hidden="true" />
      </Link>
    </>
  )
}

/* ---- 6. Subscriptions and recurring ------------------------------------- */

export function Recurring({ view, symbol }) {
  if (view.items.length === 0) {
    return (
      <Empty>
        Nothing repeating yet. A charge counts once it shows up in two of the last three months.
      </Empty>
    )
  }

  return (
    <>
      <Hero
        label="A month"
        value={formatCurrency(view.monthly, symbol)}
        context={
          view.shareOfIncome === null
            ? 'Charges seen in at least two of the last three months.'
            : `That is ${Math.round(view.shareOfIncome)}% of this month's income.`
        }
      />
      <Stats
        stats={[
          { label: 'A year', value: formatCurrency(view.annual, symbol) },
          { label: 'Charges', value: String(view.items.length) },
        ]}
      />

      <Section title="What repeats" hint="Most expensive first, shown as a monthly cost.">
        <Rows>
          {view.items.map((row) => (
            <Row
              key={row.key}
              name={row.description}
              value={formatCurrency(row.monthlyCost, symbol)}
              meta={join(row.category, row.lastCharged && `last ${formatDate(row.lastCharged)}`)}
              sub={`${formatCurrency(row.annualised, symbol)} a year`}
            />
          ))}
        </Rows>
      </Section>
    </>
  )
}

/* ---- 7. Category deep dive ---------------------------------------------- */

export function CategoryDeepDive({ view, categories, selected, onSelect, symbol }) {
  const history = view.history.map((m) => ({ key: m.month, label: m.label.slice(0, 3), value: m.value }))

  return (
    <>
      <label className="bfh-formfield bfh-prpicker">
        <span className="bfh-fieldlabel">Category</span>
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {view.rows.length === 0 ? (
        <Empty>Nothing in {view.category} for this period.</Empty>
      ) : (
        <>
          <Hero
            label={`Spent on ${view.category}`}
            value={formatCurrency(view.total, symbol)}
            context={`Across ${view.count} payment${view.count === 1 ? '' : 's'}.`}
          />
          <Stats
            stats={[
              { label: 'Average', value: formatCurrency(view.average, symbol) },
              { label: 'Largest', value: formatCurrency(view.largest, symbol) },
            ]}
          />

          <Section title="Payments">
            <Rows>
              {view.rows.map((row) => (
                <Row
                  key={row.id}
                  name={row.description || view.category}
                  value={`−${formatCurrency(row.amount, symbol)}`}
                  meta={formatDate(row.date)}
                />
              ))}
            </Rows>
          </Section>
        </>
      )}

      {hasValues(history) && (
        <BarChart
          title="Last 6 months"
          sub={view.category}
          series={history}
          symbol={symbol}
          ariaLabel={`${view.category} over the last six months`}
        />
      )}

      <Section title="Month by month">
        <Rows>
          {[...view.history].reverse().map((row) => (
            <Row
              key={row.month}
              name={row.label}
              value={formatCurrency(row.value, symbol)}
              meta={join(
                `${row.count} payment${row.count === 1 ? '' : 's'}`,
                shortDelta(row.delta, 'the month before'),
              )}
            />
          ))}
        </Rows>
      </Section>
    </>
  )
}
