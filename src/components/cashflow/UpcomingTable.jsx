import { IconFileInvoice, IconHourglass, IconRepeat } from '@tabler/icons-react'

import { formatCurrency, formatDate } from '../../lib/format'

const TABS = [
  { id: 'income', label: 'Coming in' },
  { id: 'expenses', label: 'Going out' },
]

/** Where each expected amount comes from, in words and with a picture. */
const SOURCES = {
  invoice: { label: 'Unpaid invoice', Icon: IconFileInvoice },
  pending: { label: 'Pending entry', Icon: IconHourglass },
  recurring: { label: 'Repeats monthly', Icon: IconRepeat },
}

/**
 * The money behind the line on the chart: what is expected to arrive and
 * what is expected to leave, each with when, why, and how much. One list
 * that reads the same on a phone as on a desktop, rather than a table that
 * has to be squeezed.
 */
export default function UpcomingTable({ income, expenses, tab, onTab, symbol }) {
  const rows = tab === 'income' ? income : expenses
  const sum = (list) => list.reduce((total, r) => total + r.amount, 0)
  const totals = { income: sum(income), expenses: sum(expenses) }

  return (
    <section className="bfh-card bfh-upcoming">
      <header className="bfh-upcoming__head">
        <h2 className="bfh-panel__title">What is behind the line</h2>
        <div className="bfh-segment" role="radiogroup" aria-label="Upcoming money">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              className="bfh-segment__option"
              aria-checked={tab === t.id}
              onClick={() => onTab(t.id)}
            >
              {t.label} · {formatCurrency(totals[t.id], symbol)}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="bfh-empty">
          {tab === 'income'
            ? 'Nothing is expected to come in during this window. Unpaid invoices you have sent show up here.'
            : 'Nothing is scheduled to go out. Bills that repeat every month show up here once Dual has seen them three times.'}
        </p>
      ) : (
        <ul className="bfh-upcoming__list">
          {rows.map((row, index) => {
            const source = SOURCES[row.source] ?? SOURCES.pending
            const { Icon } = source
            return (
              // Projected rows have no database identity of their own.
              // eslint-disable-next-line react/no-array-index-key
              <li key={`${row.date}-${row.description}-${index}`} className="bfh-upcoming__row">
                <span className="bfh-upcoming__icon" aria-hidden="true">
                  <Icon size={16} stroke={1.5} />
                </span>
                <span className="bfh-upcoming__body">
                  <span className="bfh-upcoming__name">{row.description}</span>
                  <span className="bfh-upcoming__meta">
                    {formatDate(row.date)} · {source.label}
                  </span>
                </span>
                <span className="bfh-upcoming__amount" data-type={tab}>
                  {tab === 'income' ? '+' : '−'}
                  {formatCurrency(row.amount, symbol)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
