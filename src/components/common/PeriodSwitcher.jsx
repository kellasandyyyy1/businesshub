import { PERIODS, usePeriod } from '../../context/PeriodContext'

/**
 * The period pills, worded in full ("30 days") since they have the row to themselves, bound to the window every page reads from.
 *
 * The topbar carries the same control from 768px up, so this row only shows on
 * a phone — `.bfh-periodpills` handles that and scrolls it sideways.
 */
export default function PeriodSwitcher() {
  const { periodId, setPeriodId } = usePeriod()

  return (
    <div className="bfh-block bfh-periodpills" role="group" aria-label="Reporting period">
      {PERIODS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="bfh-period"
          aria-pressed={periodId === option.id}
          onClick={() => setPeriodId(option.id)}
        >
          {option.name}
        </button>
      ))}
    </div>
  )
}
