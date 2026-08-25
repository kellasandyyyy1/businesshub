import { IconArrowsExchange } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'

import { recentTransfers } from '../../db/queries'
import useSettings from '../../hooks/useSettings'
import { formatCurrency, formatDate } from '../../lib/format'

/**
 * The owner draws that were recorded on both sides.
 *
 * Read-only on purpose. Each pair is two rows that have to agree, and the one
 * place that can keep them agreeing is the business transaction itself — so
 * that is where a row sends you rather than offering an edit here that would
 * only change half of it.
 */
export default function TransfersSection() {
  const pairs = useLiveQuery(() => recentTransfers(5), [])
  const { symbol } = useSettings()

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Business → Personal transfers</h2>
      <p className="bfh-settings__note">Transactions recorded on both sides.</p>

      {!pairs ? null : pairs.length === 0 ? (
        <p className="bfh-empty">
          No transfers yet. Tick “Also record as personal income” when you book an owner draw and it
          will show up here.
        </p>
      ) : (
        <ul className="bfh-transferlist">
          {pairs.map(({ business, personal }) => (
            <li key={business.id} className="bfh-transferrow">
              <Link className="bfh-transferrow__link" to={`/transactions?id=${business.id}`}>
                <span className="bfh-transferrow__date">{formatDate(business.date)}</span>
                <span className="bfh-transferrow__desc">{business.description}</span>
                <span className="bfh-transferrow__amount">
                  {formatCurrency(business.amount, symbol)}
                </span>
              </Link>
              <span className="bfh-transferrow__pair">
                <IconArrowsExchange size={11} stroke={1.5} aria-hidden="true" />
                {personal.category} · {formatCurrency(personal.amount, symbol)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
