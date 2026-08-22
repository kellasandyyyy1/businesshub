import { usePeriod } from '../context/PeriodContext'

/**
 * Stand-in for a route that has no widgets yet. Each child of `.bfh-page` is a
 * `.bfh-block`, so it picks up the staggered entrance the real pages will use.
 */
export default function PagePlaceholder({ title, note }) {
  const { period, startDate, endDate } = usePeriod()

  return (
    <div className="bfh-page">
      <div className="bfh-block">
        <h1 className="bfh-page__title">{title.toLowerCase()}</h1>
      </div>

      <div className="bfh-block bfh-card">
        <div className="bfh-micro">Period</div>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--ink2)' }}>
          Showing the last {period.label} — {startDate} to {endDate}.
        </p>
      </div>

      <div className="bfh-block bfh-card">
        <div className="bfh-micro">Next up</div>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--ink2)' }}>
          {note}
        </p>
      </div>
    </div>
  )
}
