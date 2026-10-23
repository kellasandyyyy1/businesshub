import {
  IconBox,
  IconBuildingBank,
  IconChartLine,
  IconChevronRight,
  IconCreditCard,
  IconHome,
  IconPigMoney,
  IconPlus,
  IconReceipt,
} from '@tabler/icons-react'

import { formatCurrency } from '../../lib/format'
import { categoriesFor, fallbackCategory } from '../../lib/netWorth'

/** A picture for each fixed category, so a row is recognised before it is read. */
const CATEGORY_ICONS = {
  'Cash & Savings': IconPigMoney,
  Investments: IconChartLine,
  Property: IconHome,
  Other: IconBox,
  Loans: IconBuildingBank,
  'Credit Cards': IconCreditCard,
  'Other Debt': IconReceipt,
}

/**
 * One side of the sheet, what is owned, or what is owed.
 *
 * A flat list, largest first, with each row's category as a caption under
 * its name rather than a heading above it: most households have one or two
 * things per category, and a heading over a single row is furniture. The
 * whole row is the button that opens it.
 *
 * Both sides read the same way on purpose, the eye compares them across the
 * page, and two different list shapes would make that harder.
 */
export default function NetWorthColumn({ eyebrow, title, hint, type, items, total, symbol, addLabel, onAdd, onEdit }) {
  const known = categoriesFor(type)
  // What is owed reads as a subtraction, in ink, a debt is not an error.
  const owed = type === 'liability' ? '−' : ''
  const rows = [...items].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))

  return (
    <section className="bfh-card bfh-nwcol">
      <header className="bfh-nwcol__head">
        <div>
          <span className="bfh-micro">{eyebrow}</span>
          <h2 className="bfh-nwcol__title">{title}</h2>
        </div>
        <button type="button" className="bfh-nwcol__add" onClick={onAdd}>
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          {addLabel}
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="bfh-nwcol__empty">{hint}</p>
      ) : (
        <ul className="bfh-nwlist">
          {rows.map((item) => {
            const category = known.includes(item.category) ? item.category : fallbackCategory(type)
            const Icon = CATEGORY_ICONS[category] ?? IconBox
            return (
              <li key={item.id}>
                <button type="button" className="bfh-nwrow" onClick={() => onEdit(item)}>
                  <span className="bfh-nwrow__icon" aria-hidden="true">
                    <Icon size={16} stroke={1.5} />
                  </span>
                  <span className="bfh-nwrow__body">
                    <span className="bfh-nwrow__name">{item.name}</span>
                    <span className="bfh-nwrow__category">{category}</span>
                  </span>
                  <span className="bfh-nwrow__amount">{owed}{formatCurrency(item.amount, symbol)}</span>
                  <IconChevronRight className="bfh-nwrow__chev" size={16} stroke={1.5} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="bfh-nwcol__total">
          <span>Total</span>
          <span>
            {owed}
            {formatCurrency(total, symbol)}
          </span>
        </div>
      )}
    </section>
  )
}
