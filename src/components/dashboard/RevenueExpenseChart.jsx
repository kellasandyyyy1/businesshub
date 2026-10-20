import BarPlot from '../charts/BarPlot'

const BARS = [
  { key: 'revenue', name: 'Revenue', tone: 'primary' },
  { key: 'expenses', name: 'Expenses', tone: 'secondary' },
]

export default function RevenueExpenseChart({ series, periodLabel, symbol }) {
  return (
    <section className="bfh-card bfh-chart">
      <header className="bfh-chart__head">
        <div>
          <h2 className="bfh-panel__title">Revenue vs expenses</h2>
          <div className="bfh-micro">{periodLabel}</div>
        </div>

        <div className="bfh-legend">
          {BARS.map((b) => (
            <span key={b.key} className="bfh-legend__item">
              <span className="bfh-legend__dot" data-tone={b.tone} />
              {b.name}
            </span>
          ))}
        </div>
      </header>

      <BarPlot
        data={series.map((d) => ({ ...d, key: d.label }))}
        bars={BARS}
        height={220}
        symbol={symbol}
        ariaLabel="Revenue against expenses"
      />
    </section>
  )
}
