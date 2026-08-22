import { IconArrowsExchange } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import EmptyState from '../EmptyState'

import { categoryIcon } from '../../config/categoryIcons'
import { formatCurrency, formatDate } from '../../lib/format'

/**
 * The client's ledger. Same row anatomy as the transactions table, plus the
 * running total the client view needs at the bottom.
 */
export default function ClientTransactions({ transactions, categoryIcons, symbol }) {
  const navigate = useNavigate()

  const net = transactions.reduce(
    (total, t) => total + (t.type === 'income' ? t.amount : -t.amount),
    0,
  )

  return (
    <section className="bfh-card bfh-table-card">
      <table className="bfh-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col" className="bfh-cell-amount">
              Amount
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const Icon = categoryIcon(categoryIcons[tx.category])
            const signed = tx.type === 'income' ? tx.amount : -tx.amount

            return (
              <tr
                key={tx.id}
                className="bfh-row"
                tabIndex={0}
                onClick={() => navigate(`/transactions?id=${tx.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/transactions?id=${tx.id}`)
                  }
                }}
              >
                <td className="bfh-cell-date">{formatDate(tx.date)}</td>
                <td className="bfh-cell-desc">
                  <span className="bfh-tx__inline">
                    <span className="bfh-iconbox" data-size="30">
                      <Icon size={15} stroke={1.5} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="bfh-row__name">{tx.description}</span>
                      <span className="bfh-chip">{tx.category}</span>
                    </span>
                  </span>
                </td>
                <td className="bfh-cell-amount">{formatCurrency(signed, symbol)}</td>
                <td className="bfh-cell-status">{tx.status}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {transactions.length === 0 ? (
        <EmptyState
          icon={IconArrowsExchange}
          heading="No transactions for this client"
          body="Money received from or paid to this client will appear here."
        />
      ) : (
        <footer className="bfh-runningtotal">
          <span className="bfh-micro">
            Running total · {transactions.length} transaction
            {transactions.length === 1 ? '' : 's'}
          </span>
          <span className="bfh-runningtotal__value">{formatCurrency(net, symbol)}</span>
        </footer>
      )}
    </section>
  )
}
