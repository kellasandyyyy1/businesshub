/**
 * One figure in a metrics grid.
 *
 * A readout rather than a link — the dashboard's MetricCard navigates and always
 * formats its value as money, which neither the Income nor the Expenses grid
 * wants. The badge is passed in already worded, because some cards carry a
 * change against last period and others carry a share of the total.
 *
 * `good` picks the badge's hairline: solid reads as an improvement, dashed as
 * one worth a second look. Direction is never colour.
 */
export default function MetricCard({ label, value, badge, good = true, context }) {
  return (
    <div className="bfh-metric bfh-metric--static">
      <span className="bfh-micro">{label}</span>
      <span className="bfh-metric__value">{value}</span>

      <span className="bfh-metric__row">
        <span className="bfh-delta" data-good={good ? 'true' : 'false'}>
          {badge}
        </span>
        <span className="bfh-metric__context">{context}</span>
      </span>
    </div>
  )
}
