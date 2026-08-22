import { useState } from 'react'

import AiForecast from '../components/cashflow/AiForecast'
import CashChart from '../components/cashflow/CashChart'
import UpcomingTable from '../components/cashflow/UpcomingTable'
import { putSetting } from '../db/db'
import useCashflowData from '../hooks/useCashflow'
import useSettings from '../hooks/useSettings'
import { HORIZONS } from '../lib/cashflow'
import { formatCurrency } from '../lib/format'

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
        {isSet ? 'Adjust opening balance' : 'Set opening balance →'}
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
        aria-label="Opening bank balance"
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

  const days = HORIZONS.find((h) => h.id === horizon).days
  const data = useCashflowData(days)

  if (!data) return <div className="bfh-page" />

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-tabbar">
        <div>
          <h1 className="bfh-pagetitle">Cash flow</h1>
          <div className="bfh-micro">Projected from invoices, pending entries, and recurring spend</div>
        </div>

        <div className="bfh-periods" role="group" aria-label="Projection horizon">
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              className="bfh-period"
              aria-pressed={horizon === h.id}
              onClick={() => setHorizon(h.id)}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bfh-block">
        <div className="bfh-summary bfh-summary--3">
          <div className="bfh-summary__cell">
            <span className="bfh-micro">Current cash</span>
            <span className="bfh-summary__value bfh-summary__value--lg">
              {formatCurrency(data.currentCash, symbol)}
            </span>
            <OpeningBalancePrompt
              isSet={data.hasOpeningBalance}
              current={data.openingBalance}
            />
          </div>

          <div className="bfh-summary__cell">
            <span className="bfh-micro">Expected income · next 30d</span>
            <span className="bfh-summary__value bfh-summary__value--lg">
              {formatCurrency(data.expectedIncome, symbol)}
            </span>
          </div>

          <div className="bfh-summary__cell">
            <span className="bfh-micro">Projected cash</span>
            <span className="bfh-summary__value bfh-summary__value--lg">
              {formatCurrency(data.projectedCash, symbol)}
            </span>
            <span className="bfh-micro">
              after {formatCurrency(data.expectedExpenses, symbol)} of spend
            </span>
          </div>
        </div>
      </div>

      <div className="bfh-block">
        <section className="bfh-card">
          <h2 className="bfh-panel__title">Projected balance</h2>
          <div className="bfh-micro">
            Next {HORIZONS.find((h) => h.id === horizon).label} · recurring spend continues;
            income counts only invoices already issued
          </div>
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
