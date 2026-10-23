import { useState } from 'react'

import AiForecast from '../components/cashflow/AiForecast'
import Delta from '../components/Delta'
import SignalBadge from '../components/SignalBadge'
import CashChart from '../components/cashflow/CashChart'
import UpcomingTable from '../components/cashflow/UpcomingTable'
import { putSetting } from '../db/db'
import useCashflowData from '../hooks/useCashflow'
import useSettings from '../hooks/useSettings'
import { HORIZONS, LOW_CASH_THRESHOLD } from '../lib/cashflow'
import { formatCurrency, formatFullDate } from '../lib/format'
import useSelectedInView from '../hooks/useSelectedInView'
import { runwayTone } from '../lib/signal'

/**
 * Inline prompt for the opening bank balance. Once set, it stays available as
 * a quieter "adjust" affordance so the figure never becomes unchangeable.
 */
function OpeningBalancePrompt({ isSet, current }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(isSet ? String(current) : '')

  const save = async (e) => {
    e.preventDefault()
    const amount = Number(value)
    if (value === '' || Number.isNaN(amount)) return
    await putSetting('openingBalance', amount)
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="bfh-inline-prompt" onClick={() => setOpen(true)}>
        {isSet ? 'Adjust starting balance' : 'Set your bank balance'}
      </button>
    )
  }

  return (
    <form className="bfh-inline-form" onSubmit={save}>
      <input
        type="number"
        step="0.01"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        aria-label="Bank balance before you started using Dual"
        placeholder="0.00"
      />
      <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
        Save
      </button>
    </form>
  )
}

export default function CashFlow() {
  const [horizon, setHorizon] = useState('90d')
  const [tab, setTab] = useState('income')
  const { symbol } = useSettings()

  const span = HORIZONS.find((h) => h.id === horizon)
  const data = useCashflowData(span.days)
  const horizonRow = useSelectedInView(horizon, Boolean(data))

  if (!data) return <div className="bfh-page" />

  const money = (v) => formatCurrency(v, symbol)
  const change = data.projectedCash - data.currentCash
  const dipsLow = data.lowest && data.lowest.balance < LOW_CASH_THRESHOLD
  const runway = runwayTone(data.runwayMonths)
  const dipsBelowToday = data.lowest && data.lowest.balance < data.currentCash && data.lowest.date !== data.today

  return (
    <div className="bfh-page bfh-cashpage">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Cash flow</h1>
          <p className="bfh-pagehead__sub">
            Where your cash is heading, counting unpaid invoices, pending entries and bills that repeat.
          </p>
        </div>
      </div>

      <div className="bfh-block">
        <div className="bfh-chiprow" role="radiogroup" aria-label="Look ahead" ref={horizonRow}>
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              role="radio"
              className="bfh-choicechip"
              aria-checked={horizon === h.id}
              onClick={() => setHorizon(h.id)}
            >
              Next {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* The answer first, where the money will be, then how it gets there. */}
      <div className="bfh-block">
        <section className="bfh-card bfh-cashhero">
          <div className="bfh-cashhero__top">
            <span className="bfh-micro">In {span.name}</span>
            {runway === 'neg' && <SignalBadge tone="neg">Low runway</SignalBadge>}
            {runway === 'warn' && <SignalBadge tone="warn">Short runway</SignalBadge>}
          </div>
          <p className="bfh-cashhero__line">
            <span className="bfh-cashhero__figure">{money(data.projectedCash)}</span>
            <Delta value={change} format="currency" goodWhen="up" symbol={symbol} label="from today" />
          </p>
          {data.runwayMonths !== null && (
            <p className="bfh-cashhero__runway">
              Cash today covers about {data.runwayMonths.toFixed(1)} months of spending at the recent pace.
            </p>
          )}

          <dl className="bfh-cashhero__steps">
            <div>
              <dt>Cash today</dt>
              <dd>{money(data.currentCash)}</dd>
            </div>
            <div>
              <dt>Coming in</dt>
              <dd>{data.expectedIncome > 0 ? '+' : ''}{money(data.expectedIncome)}</dd>
            </div>
            <div>
              <dt>Going out</dt>
              <dd>{data.expectedExpenses > 0 ? '−' : ''}{money(data.expectedExpenses)}</dd>
            </div>
          </dl>

          {dipsLow ? (
            <p className="bfh-cashhero__warn" role="status">
              Cash drops to {money(data.lowest.balance)} around {formatFullDate(data.lowest.date)}, below the{' '}
              {money(LOW_CASH_THRESHOLD)} safety line. Chase invoices or move a bill before then.
            </p>
          ) : dipsBelowToday ? (
            <p className="bfh-cashhero__note">
              Lowest point: {money(data.lowest.balance)} around {formatFullDate(data.lowest.date)}.
            </p>
          ) : null}

          {/* Today's cash is only what has been recorded here; without a
              starting bank balance it can be far from the real figure. */}
          <div className="bfh-cashhero__opening">
            {!data.hasOpeningBalance && (
              <span>
                Today's cash only counts what you have recorded in Dual. Add your bank balance for a true
                starting point.
              </span>
            )}
            <OpeningBalancePrompt isSet={data.hasOpeningBalance} current={data.openingBalance} />
          </div>
        </section>
      </div>

      <div className="bfh-block">
        <section className="bfh-card">
          <h2 className="bfh-panel__title">Your balance, day by day</h2>
          <p className="bfh-cashchart__sub">
            Next {span.label}. Hover or tap the line to read any day.
          </p>
          <CashChart series={data.series} symbol={symbol} />
        </section>
      </div>

      <div className="bfh-block">
        <AiForecast symbol={symbol} />
      </div>

      <div className="bfh-block">
        <UpcomingTable
          income={data.income}
          expenses={data.expenses}
          tab={tab}
          onTab={setTab}
          symbol={symbol}
        />
      </div>
    </div>
  )
}
