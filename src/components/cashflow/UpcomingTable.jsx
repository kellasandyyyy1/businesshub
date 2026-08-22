import { formatCurrency, formatDate } from '../../lib/format'

const TABS = [
  { id: 'income', label: 'Expected income' },
  { id: 'expenses', label: 'Expected expenses' },
]

export default function UpcomingTable({ income, expenses, tab, onTab, symbol }) {
  const rows = tab === 'income' ? income : expenses
  const total = rows.reduce((sum, r) => sum + r.amount, 0)

  return (
    <section className="bfh-card bfh-table-card">
      <div className="bfh-tabs bfh-tabs--flush" role="tablist" aria-label="Upcoming money">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="bfh-tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="bfh-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col" className="bfh-cell-amount">
              Amount
            </th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Projected rows have no database identity of their own.
            // eslint-disable-next-line react/no-array-index-key
            <tr key={`${row.date}-${row.description}-${index}`}>
              <td className="bfh-cell-date">{formatDate(row.date)}</td>
              <td className="bfh-cell-desc">
                <span className="bfh-row__name">{row.description}</span>
              </td>
              <td className="bfh-cell-amount">
                {tab === 'income' ? '' : '−'}
                {formatCurrency(row.amount, symbol)}
              </td>
              <td className="bfh-cell-pill">
                <span className="bfh-chip">{row.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <p className="bfh-empty">
          Nothing {tab === 'income' ? 'expected to arrive' : 'scheduled to leave'} in this window.
        </p>
      ) : (
        <footer className="bfh-runningtotal">
          <span className="bfh-micro">
            {rows.length} expected {tab === 'income' ? 'receipt' : 'payment'}
            {rows.length === 1 ? '' : 's'}
          </span>
          <span className="bfh-runningtotal__value">{formatCurrency(total, symbol)}</span>
        </footer>
      )}
    </section>
  )
}
