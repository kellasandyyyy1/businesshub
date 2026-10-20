import SignalBadge from '../SignalBadge'
import { categoryIcon } from '../../config/categoryIcons'
import { useMethodList } from '../../hooks/usePaymentMethods'
import { methodLabel } from '../../lib/paymentMethods'
import { formatDate } from '../../lib/format'
import { pendingTone } from '../../lib/signal'
import { amountLabel, signedAmount, signedLabel } from '../../lib/txDisplay'

/**
 * The phone ledger: rows grouped under the day they happened, each with its
 * category icon, a one-line context and a signed amount. This is how people
 * read a bank statement — scan down by day, glance right for the money — so
 * it reads at once without a column header to decode.
 *
 * Rows arrive newest first; grouping keeps that order. Status only shows when
 * it says something: a cleared row is the default and carries no tag.
 */
export default function TxList({ rows, onOpen, categoryIcons = {}, symbol, metaOf, selectedId }) {
  const methods = useMethodList() ?? []
  const days = []
  for (const tx of rows) {
    const last = days[days.length - 1]
    if (last && last.date === tx.date) last.rows.push(tx)
    else days.push({ date: tx.date, rows: [tx] })
  }

  return (
    <div className="bfh-txlist">
      {days.map((day) => {
        const net = day.rows.reduce((t, tx) => t + signedAmount(tx), 0)
        return (
          <section key={day.date} className="bfh-txlist__day">
            <header className="bfh-txlist__dayhead">
              <span>{formatDate(day.date)}</span>
              {day.rows.length > 1 && <span>{signedLabel(net, symbol)}</span>}
            </header>

            <ul className="bfh-txlist__rows">
              {day.rows.map((tx) => {
                const Icon = categoryIcon(categoryIcons[tx.category])
                const meta = (metaOf ? metaOf(tx) : [tx.category]).filter(Boolean)
                const method = methodLabel(tx, methods)
                return (
                  <li key={tx.id}>
                    <button
                      type="button"
                      className="bfh-txitem"
                      data-selected={tx.id === selectedId || undefined}
                      onClick={() => onOpen(tx)}
                    >
                      <span className="bfh-txitem__icon" aria-hidden="true">
                        <Icon size={16} stroke={1.5} />
                      </span>
                      <span className="bfh-txitem__body">
                        <span className="bfh-txitem__name">{tx.description}</span>
                        <span className="bfh-txitem__meta">
                          {meta.join(' · ')}
                          {method && <span className="bfh-txmethod"> · {method}</span>}
                          {tx.status === 'pending' && <PendingBadge tx={tx} />}
                        </span>
                      </span>
                      <span className="bfh-txitem__amount" data-type={tx.type}>
                        {amountLabel(tx, symbol)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * Pending, as a badge. Amber only once it has waited more than a week —
 * a payment still clearing after a day or two is normal and stays grey.
 */
export function PendingBadge({ tx }) {
  const today = new Date().toISOString().slice(0, 10)
  return <SignalBadge tone={pendingTone(tx, today)}>Pending</SignalBadge>
}

/** A status tag only when it is worth reading: pending stands out, cleared is quiet. */
export function StatusCell({ tx }) {
  return tx.status === 'pending' ? <PendingBadge tx={tx} /> : <span className="bfh-status-quiet">Cleared</span>
}
