import { useState } from 'react'

import BreakdownCard, { BreakdownRow, ShowAll } from '../common/BreakdownCard'
import { categoryIcon } from '../../config/categoryIcons'
import { formatCurrency } from '../../lib/format'

const TOP_N = 6

const TABS = [
  { id: 'category', label: 'Category' },
  { id: 'merchant', label: 'Merchant' },
  { id: 'recurring', label: 'Recurring' },
]

const TITLES = {
  category: 'By category',
  merchant: 'By merchant',
  recurring: 'Recurring',
}

/** One repeating charge: what it costs a month, and what that adds up to a year. */
function RecurringRow({ item, symbol }) {
  return (
    <li className="bfh-breakdown__row bfh-recurring__row">
      <span className="bfh-breakdown__name">
        <span className="bfh-breakdown__label">{item.description}</span>
      </span>

      <span className="bfh-recurring__freq">Monthly</span>

      <span className="bfh-recurring__cost">
        <span className="bfh-breakdown__amount">{formatCurrency(item.monthlyCost, symbol)}</span>
        <span className="bfh-recurring__annual">{formatCurrency(item.annualised, symbol)} / yr</span>
      </span>
    </li>
  )
}

/**
 * Where the money went, by category, by merchant, or the subscriptions that
 * come back every month.
 */
export default function SpendingBreakdown({
  byCategory,
  byMerchant,
  recurring,
  categoryIcons,
  symbol,
}) {
  const [tab, setTab] = useState('category')
  const [expanded, setExpanded] = useState(false)

  const items = tab === 'category' ? byCategory : tab === 'merchant' ? byMerchant : recurring
  const shown = expanded ? items : items.slice(0, TOP_N)
  const max = tab === 'recurring' ? 0 : (items[0]?.value ?? 0)

  const choose = (next) => {
    setTab(next)
    // Each list is a different length; collapsing avoids a jump.
    setExpanded(false)
  }

  return (
    <BreakdownCard
      title={TITLES[tab]}
      tabs={TABS}
      tab={tab}
      onTab={choose}
      footer={
        items.length > TOP_N && (
          <ShowAll
            count={items.length}
            expanded={expanded}
            onToggle={() => setExpanded((open) => !open)}
          />
        )
      }
    >
      {items.length === 0 ? (
        <p className="bfh-empty">
          {tab === 'recurring'
            ? 'No recurring expenses detected yet.'
            : 'No spending in this period.'}
        </p>
      ) : (
        <ul className="bfh-breakdown__list">
          {tab === 'recurring'
            ? shown.map((item) => <RecurringRow key={item.key} item={item} symbol={symbol} />)
            : shown.map((item) => (
                <BreakdownRow
                  key={item.key}
                  // Only categories carry an icon; a merchant is just a name.
                  icon={tab === 'category' ? categoryIcon(categoryIcons[item.name]) : undefined}
                  name={item.name}
                  value={item.value}
                  share={item.share}
                  max={max}
                  symbol={symbol}
                />
              ))}
        </ul>
      )}
    </BreakdownCard>
  )
}
