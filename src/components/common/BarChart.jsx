import BarPlot from '../charts/BarPlot'

const percent = (v) => `${Math.round(v)}%`

/**
 * A single-series bar chart over time buckets, in its card. The caller decides
 * the bucketing; this only draws what it is given. The title names the series,
 * so there is no legend.
 *
 * `unit="percent"` reads values as percentages rather than money.
 */
export default function BarChart({ title, sub, series, symbol, unit, note, ariaLabel }) {
  const isPercent = unit === 'percent'

  return (
    <section className="bfh-card bfh-chart">
      <header className="bfh-chart__head">
        <div>
          <h2 className="bfh-panel__title">{title}</h2>
          <div className="bfh-micro">{sub}</div>
        </div>
      </header>

      <BarPlot
        data={series}
        bars={[{ key: 'value', name: title, tone: 'primary' }]}
        height={190}
        symbol={symbol}
        ariaLabel={ariaLabel ?? title}
        {...(isPercent && { formatTick: percent, formatValue: percent })}
      />

      {note && <p className="bfh-micro bfh-chart__note">{note}</p>}
    </section>
  )
}
