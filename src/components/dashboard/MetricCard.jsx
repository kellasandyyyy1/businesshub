import { useNavigate } from 'react-router-dom'

import Delta from '../Delta'
import { formatAmount, percentChange } from '../../lib/format'

/**
 * One key metric. The figure stays ink; only the comparison under it takes a
 * colour, and only to say whether the change is welcome for this figure.
 */
export default function MetricCard({ label, value, previous, context, to, symbol, goodWhen = 'up', quiet }) {
  const navigate = useNavigate()
  const change = percentChange(value, previous)

  return (
    <button type="button" className="bfh-metric" onClick={() => navigate(to)}>
      <span className="bfh-micro">{label}</span>
      <span className="bfh-metric__value">{formatAmount(value, symbol)}</span>

      <span className="bfh-metric__row">
        <Delta value={change} goodWhen={goodWhen} label={context} emptyLabel={context} quiet={quiet} />
      </span>
    </button>
  )
}
