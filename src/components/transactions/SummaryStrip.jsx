import { formatCurrency } from '../../lib/format'

/** Three figures for whatever the filters currently select, split by hairlines. */
export default function SummaryStrip({ summary, symbol }) {
  const stats = [
    { label: 'Income this period', value: summary.income },
    { label: 'Expenses this period', value: summary.expenses },
    { label: 'Net', value: summary.net },
  ]

  return (
    <div className="bfh-summary">
      {stats.map((stat) => (
        <div className="bfh-summary__cell" key={stat.label}>
          <span className="bfh-micro">{stat.label}</span>
          <span className="bfh-summary__value">{formatCurrency(stat.value, symbol)}</span>
        </div>
      ))}
    </div>
  )
}
