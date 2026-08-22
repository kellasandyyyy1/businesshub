import {
  IconAlertTriangle,
  IconChevronRight,
  IconClockPause,
  IconFileInvoice,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { formatCurrency } from '../../lib/format'

const KIND_ICONS = {
  invoice: IconFileInvoice,
  budget: IconAlertTriangle,
  pending: IconClockPause,
}

export default function NeedsAttention({ items, symbol }) {
  const navigate = useNavigate()

  return (
    <section className="bfh-card bfh-attention">
      <h2 className="bfh-panel__title">Needs attention</h2>

      {items.length === 0 ? (
        <p className="bfh-attention__empty">Nothing overdue or over budget.</p>
      ) : (
        <ul className="bfh-attention__list">
          {items.map((item) => {
            const Icon = KIND_ICONS[item.kind] ?? IconAlertTriangle
            const money = formatCurrency(item.amount, symbol)
            const of = item.budgetAmount ? ` of ${formatCurrency(item.budgetAmount, symbol)}` : ''

            return (
              <li key={item.id}>
                <button type="button" className="bfh-alert" onClick={() => navigate(item.to)}>
                  <span className="bfh-iconbox">
                    <Icon size={15} stroke={1.5} aria-hidden="true" />
                  </span>
                  <span className="bfh-alert__body">
                    <span className="bfh-alert__title">{item.title}</span>
                    <span className="bfh-alert__sub">
                      {money}
                      {of} · {item.detail}
                    </span>
                  </span>
                  <IconChevronRight
                    className="bfh-alert__chevron"
                    size={14}
                    stroke={1.5}
                    aria-hidden="true"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
