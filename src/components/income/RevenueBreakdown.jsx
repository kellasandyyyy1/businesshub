import { useState } from 'react'

import BreakdownCard, { BreakdownRow, ShowAll } from '../common/BreakdownCard'

const TOP_N = 6

const CATEGORY_TAB = { id: 'category', label: 'Category' }
const CLIENT_TAB = { id: 'client', label: 'Client' }

/**
 * Where the revenue came from, by category or by client.
 *
 * A personal profile has no clients, so it gets the category list alone,
 * titled "By source", since with one tab the word "category" is already on the
 * tab itself and the heading can say something more useful.
 */
export default function RevenueBreakdown({ byCategory, byClient, showClients = true, symbol }) {
  const [tab, setTab] = useState('category')
  const [expanded, setExpanded] = useState(false)

  const TABS = showClients ? [CATEGORY_TAB, CLIENT_TAB] : [CATEGORY_TAB]
  const items = tab === 'category' || !showClients ? byCategory : byClient
  const shown = expanded ? items : items.slice(0, TOP_N)
  const max = items[0]?.value ?? 0

  const choose = (next) => {
    setTab(next)
    // The other list is a different length; collapsing avoids a jump.
    setExpanded(false)
  }

  return (
    <BreakdownCard
      title={!showClients ? 'By source' : `By ${tab === 'category' ? 'category' : 'client'}`}
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
        <p className="bfh-empty">No revenue in this period.</p>
      ) : (
        <ul className="bfh-breakdown__list">
          {shown.map((item) => (
            <BreakdownRow
              key={item.key}
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
