/**
 * Business health. The filled pill is the one inverted element on the page,
 * everything else earns emphasis through type and hairlines.
 */
export default function HealthScore({ health }) {
  return (
    <section className="bfh-card bfh-health">
      <div className="bfh-micro">Business health</div>

      <div className="bfh-health__row">
        <div className="bfh-health__score">
          <span className="bfh-health__number">{health.score}</span>
          <span className="bfh-health__total">/100</span>
        </div>
        {/* One inverted chip is the design system's whole emphasis budget, so
            it is spent only on a score that has earned it. Below 80 the label
            is a plain bordered pill. */}
        <span className={health.score >= 80 ? 'bfh-pill-invert' : 'bfh-pill-quiet'}>
          {health.label}
        </span>
      </div>

      <div
        className="bfh-meter"
        role="meter"
        aria-valuenow={health.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Business health score"
      >
        <span className="bfh-meter__fill" style={{ width: `${health.score}%` }} />
      </div>

      <p className="bfh-health__note">{health.recommendation}</p>
    </section>
  )
}
