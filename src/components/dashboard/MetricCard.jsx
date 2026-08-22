import { useNavigate } from 'react-router-dom'

import { formatAmount, formatPercent, percentChange } from '../../lib/format'

/**
 * One key metric. The delta badge carries direction without colour: a solid
 * hairline for an improvement, a dashed one for a decline.
 */
export default function MetricCard({ label, value, previous, context, to, symbol, invert = false }) {
  const navigate = useNavigate()
  const change = percentChange(value, previous)

  // For expenses, spending less is the improvement.
  const isUp = change !== null && change >= 0
  const isGood = change === null ? true : invert ? !isUp : isUp

  return (
    <button type="button" className="bfh-metric" onClick={() => navigate(to)}>
      <span className="bfh-micro">{label}</span>
      <span className="bfh-metric__value">{formatAmount(value, symbol)}</span>

      <span className="bfh-metric__row">
        <span className="bfh-delta" data-good={isGood ? 'true' : 'false'}>
          {change === null ? '—' : `${isUp ? '↑' : '↓'} ${formatPercent(change)}`}
        </span>
        <span className="bfh-metric__context">{context}</span>
      </span>
    </button>
  )
}
