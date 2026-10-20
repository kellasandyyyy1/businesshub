import { Link } from 'react-router-dom'

import { PERIODS, usePeriod } from '../../context/PeriodContext'

/**
 * What a page shows when the selected window holds nothing: one card that says
 * so in words and offers the two ways forward — record something, or look
 * further back — in place of a row of zero cards and an empty chart.
 *
 * `hasHistory` decides the wording: an account with older records is told the
 * window is empty, a new one is told how to begin. Pass `addTo` for a link or
 * `onAdd` for a button.
 */
export default function EmptyPeriod({
  hasHistory,
  emptyTitle,
  newTitle = 'Nothing recorded yet',
  emptyBody = 'Figures will appear here as soon as something is recorded in this window.',
  newBody,
  addLabel = 'Add a transaction',
  addTo,
  onAdd,
  note,
}) {
  const { period, setPeriodId } = usePeriod()
  const longer = PERIODS[PERIODS.findIndex((p) => p.id === period.id) + 1]

  return (
    <section className="bfh-card bfh-summarycard" data-empty="true">
      <div className="bfh-micro">Last {period.name}</div>
      <h2 className="bfh-summarycard__emptytitle">
        {hasHistory ? (emptyTitle ?? `Nothing recorded in the last ${period.name}`) : newTitle}
      </h2>
      <p className="bfh-summarycard__sentence">{hasHistory ? emptyBody : newBody}</p>
      {note && <p className="bfh-summarycard__note">{note}</p>}

      <div className="bfh-summarycard__actions">
        {addTo ? (
          <Link className="bfh-btn-primary bfh-btn-primary--inline" to={addTo}>
            {addLabel}
          </Link>
        ) : (
          <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={onAdd}>
            {addLabel}
          </button>
        )}
        {hasHistory && longer && (
          <button
            type="button"
            className="bfh-btn-ghost bfh-btn-ghost--solid"
            onClick={() => setPeriodId(longer.id)}
          >
            Show last {longer.name}
          </button>
        )}
      </div>
    </section>
  )
}
