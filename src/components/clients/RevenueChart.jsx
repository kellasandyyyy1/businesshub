import BarPlot from '../charts/BarPlot'

/** Twelve months of income from one client. Same marks as the dashboard chart. */
export default function RevenueChart({ series, symbol }) {
  return (
    <div className="bfh-minichart">
      <BarPlot
        data={series.map((d, i) => ({ ...d, key: `${d.label}-${i}` }))}
        bars={[{ key: 'revenue', name: 'Revenue', tone: 'primary' }]}
        height={140}
        symbol={symbol}
        ariaLabel="Monthly revenue from this client"
      />
    </div>
  )
}
