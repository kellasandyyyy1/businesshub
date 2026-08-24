import { IconPencil } from '@tabler/icons-react'

import { formatCurrency } from '../../lib/format'
import { groupByCategory } from '../../lib/netWorth'

/**
 * One side of the sheet — assets or liabilities — grouped by category.
 *
 * Both sides read the same way on purpose: the eye compares them across the
 * page, and two different list shapes would make that harder than it is.
 */
export default function NetWorthColumn({ title, type, items, symbol, addLabel, onAdd, onEdit }) {
  const groups = groupByCategory(items, type)

  return (
    <section className="bfh-nwcol">
      <header className="bfh-nwcol__head">
        <h2 className="bfh-nwcol__title">{title}</h2>
        <button type="button" className="bfh-micro bfh-link" onClick={onAdd}>
          {addLabel}
        </button>
      </header>

      {groups.length === 0 ? (
        <p className="bfh-empty">Nothing here yet.</p>
      ) : (
        groups.map((group) => (
          <div className="bfh-nwgroup" key={group.category}>
            <div className="bfh-micro bfh-nwgroup__label">{group.category}</div>

            <ul className="bfh-nwlist">
              {group.items.map((item) => (
                <li className="bfh-nwrow" key={item.id}>
                  <button
                    type="button"
                    className="bfh-nwrow__open"
                    onClick={() => onEdit(item)}
                    title={`Edit ${item.name}`}
                  >
                    <span className="bfh-nwrow__name">{item.name}</span>
                    <span className="bfh-nwrow__amount">{formatCurrency(item.amount, symbol)}</span>
                    <IconPencil
                      className="bfh-nwrow__edit"
                      size={13}
                      stroke={1.5}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>

            <div className="bfh-nwgroup__subtotal">
              subtotal {formatCurrency(group.subtotal, symbol)}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
