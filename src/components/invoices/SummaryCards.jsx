import { formatAmount, formatCurrency } from '../../lib/format'

const CARDS = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
]

export default function SummaryCards({ summary, symbol, onSelect }) {
  return (
    <>
      <div className="bfh-inv-cards">
        {CARDS.map((card) => {
          const bucket = summary[card.key]
          // "Sent" folds in viewed invoices, matching the tab of the same name.
          const count = card.key === 'sent' ? bucket.count + summary.viewed.count : bucket.count
          const value = card.key === 'sent' ? bucket.value + summary.viewed.value : bucket.value

          return (
            <button
              type="button"
              key={card.key}
              className="bfh-inv-card"
              onClick={() => onSelect(card.key)}
            >
              <span className="bfh-inv-card__head">
                <span className="bfh-micro">{card.label}</span>
                {card.key === 'overdue' && count > 0 && (
                  <span className="bfh-pill-invert">Needs attention</span>
                )}
              </span>
              <span className="bfh-inv-card__count">{count}</span>
              <span className="bfh-inv-card__value">{formatCurrency(value, symbol)}</span>
            </button>
          )
        })}
      </div>

      <div className="bfh-outstanding">
        <span className="bfh-micro">Total outstanding</span>
        <span className="bfh-outstanding__value" title={formatCurrency(summary.outstanding, symbol)}>
          {formatAmount(summary.outstanding, symbol)}
        </span>
      </div>
    </>
  )
}
