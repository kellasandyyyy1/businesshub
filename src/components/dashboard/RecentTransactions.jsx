import { IconArrowsExchange } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { categoryIcon } from '../../config/categoryIcons'
import { formatCurrency, formatDate } from '../../lib/format'

export default function RecentTransactions({ transactions, categoryIcons, symbol }) {
  const navigate = useNavigate()

  return (
    <section className="bfh-card bfh-recent">
      <header className="bfh-recent__head">
        <h2 className="bfh-panel__title">Recent transactions</h2>
        <button
          type="button"
          className="bfh-micro bfh-link"
          onClick={() => navigate('/transactions')}
        >
          View all →
        </button>
      </header>

      {transactions.length === 0 ? (
        // A card with a heading and nothing under it reads as broken rather
        // than as empty. Compact, because this sits inside a card.
        <div className="bfh-recent__empty">
          <IconArrowsExchange size={24} stroke={1.5} aria-hidden="true" />
          <p className="bfh-recent__emptyhead">No transactions yet</p>
          <p className="bfh-recent__emptybody">Add your first transaction to start tracking.</p>
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={() => navigate('/transactions?new=1')}
          >
            Add transaction
          </button>
        </div>
      ) : (
      <ul className="bfh-recent__list">
        {transactions.map((tx) => {
          const Icon = categoryIcon(categoryIcons[tx.category])
          // Expenses and transfers leave the account; income adds to it.
          const signed = tx.type === 'income' ? tx.amount : -tx.amount

          return (
            <li key={tx.id}>
              <button
                type="button"
                className="bfh-tx"
                onClick={() => navigate('/transactions')}
              >
                <span className="bfh-iconbox" data-size="30">
                  <Icon size={15} stroke={1.5} aria-hidden="true" />
                </span>

                <span className="bfh-tx__body">
                  <span className="bfh-tx__name">{tx.description}</span>
                  <span className="bfh-micro">
                    {tx.category} · {formatDate(tx.date)}
                  </span>
                </span>

                <span className="bfh-tx__amount">{formatCurrency(signed, symbol)}</span>
                <span className="bfh-status">{tx.status}</span>
              </button>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
