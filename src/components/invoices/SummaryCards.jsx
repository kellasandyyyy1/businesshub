import { IconAlertTriangle } from '@tabler/icons-react'

import { formatCurrency } from '../../lib/format'

/**
 * The one answer the invoices page owes: how much is still owed, and whether
 * any of it is late. Counts per status live on the filter chips below, so
 * they are not repeated here as a wall of cards.
 */
export default function SummaryCards({ summary, symbol, onShowOverdue }) {
  const awaiting = summary.sent.count + summary.viewed.count + summary.overdue.count
  const money = (v) => formatCurrency(v, symbol)

  return (
    <section className="bfh-card bfh-invhero">
      <span className="bfh-micro">Waiting to be paid</span>
      <p className="bfh-invhero__line">
        <span className="bfh-invhero__figure">{money(summary.outstanding)}</span>
        <span className="bfh-invhero__of">
          {awaiting === 0
            ? 'nothing outstanding'
            : `across ${awaiting} ${awaiting === 1 ? 'invoice' : 'invoices'}`}
        </span>
      </p>

      {summary.overdue.count > 0 ? (
        <button type="button" className="bfh-invhero__alert" onClick={onShowOverdue}>
          <IconAlertTriangle size={16} stroke={1.75} aria-hidden="true" />
          <span>
            {/* The late count is the one red figure here; the amount and the
                advice stay ink. Nothing overdue means nothing red at all. */}
            <span className="dot dot-neg" aria-hidden="true" />{' '}
            <strong>
              <span className="sig-neg">{summary.overdue.count} overdue</span> · {money(summary.overdue.value)}
            </strong>. Follow these up first.
          </span>
          <span className="bfh-invhero__alertgo" aria-hidden="true">
            View
          </span>
        </button>
      ) : (
        <p className="bfh-invhero__note">
          {awaiting > 0 ? 'Nothing is overdue.' : 'Every sent invoice has been paid.'}
          {summary.paid.count > 0 && ` ${money(summary.paid.value)} collected so far.`}
        </p>
      )}
    </section>
  )
}
