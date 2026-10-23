import Delta from '../Delta'

/**
 * One figure in a metrics grid.
 *
 * A readout rather than a link, the dashboard's MetricCard navigates and always
 * formats its value as money, which neither the Income nor the Expenses grid
 * wants.
 *
 * Two kinds of note can sit under the figure:
 *   delta  a change against before, { value, goodWhen, quiet }, drawn by
 *          <Delta>, the only one that may take a colour
 *   badge  a plain worded fact, such as a share of the total; never coloured
 */
export default function MetricCard({ label, value, delta, badge, context }) {
  return (
    <div className="bfh-metric bfh-metric--static">
      <span className="bfh-micro">{label}</span>
      <span className="bfh-metric__value">{value}</span>

      <span className="bfh-metric__row">
        {delta ? (
          <Delta
            value={delta.value}
            goodWhen={delta.goodWhen}
            format={delta.format}
            quiet={delta.quiet}
            label={context}
            emptyLabel={context}
          />
        ) : (
          <>
            {badge && <span className="bfh-delta">{badge}</span>}
            <span className="bfh-metric__context">{context}</span>
          </>
        )}
      </span>
    </div>
  )
}
