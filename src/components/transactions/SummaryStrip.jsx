import { formatCurrency } from '../../lib/format'
import { signedLabel } from '../../lib/txDisplay'

/**
 * Three figures for whatever the filters currently select, split by hairlines.
 * The labels say what the money did rather than naming a period, because the
 * date filter can be set to all time.
 */
export default function SummaryStrip({ summary, symbol }) {
  const stats = [
    { label: 'Money in', value: formatCurrency(summary.income, symbol) },
    { label: 'Money out', value: formatCurrency(summary.expenses, symbol) },
    { label: summary.net < 0 ? 'Net — more out than in' : 'Net', value: signedLabel(summary.net, symbol) },
  ]

  return (
    <div className="bfh-summary bfh-summary--triple">
      {stats.map((stat) => (
        <div className="bfh-summary__cell" key={stat.label}>
          <span className="bfh-micro">{stat.label}</span>
          <span className="bfh-summary__value">{stat.value}</span>
        </div>
      ))}
    </div>
  )
}
