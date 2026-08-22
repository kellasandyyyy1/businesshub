import { formatCurrency } from '../../lib/format'

/**
 * The tabbed "where did it come from / go to" card.
 *
 * The shell owns the heading, the tab row and the show-all control; the caller
 * supplies the rows, because not every tab is a list of proportional bars — the
 * recurring view is a different shape entirely.
 */
export default function BreakdownCard({ title, tabs, tab, onTab, children, footer }) {
  return (
    <section className="bfh-card bfh-breakdown">
      <header className="bfh-breakdown__head">
        <h2 className="bfh-panel__title">{title}</h2>

        <div className="bfh-tabs" role="tablist" aria-label="Breakdown view">
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              className="bfh-tab"
              aria-selected={tab === option.id}
              onClick={() => onTab(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {children}
      {footer}
    </section>
  )
}

/**
 * One proportional row: name, a bar measured against the largest row, the
 * amount and its share. The bar is scaled to the biggest item rather than the
 * total so the list keeps its shape when one source dwarfs the rest.
 */
export function BreakdownRow({ icon: Icon, name, value, share, max, symbol }) {
  return (
    <li className="bfh-breakdown__row">
      <span className="bfh-breakdown__name">
        {Icon && <Icon size={14} stroke={1.5} aria-hidden="true" />}
        <span className="bfh-breakdown__label">{name}</span>
      </span>

      <span className="bfh-breakdown__bar" aria-hidden="true">
        <span
          className="bfh-breakdown__fill"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </span>

      <span className="bfh-breakdown__amount">{formatCurrency(value, symbol)}</span>
      <span className="bfh-breakdown__share">{Math.round(share * 100)}%</span>
    </li>
  )
}

/** The show-all / show-less toggle, shown only when the list is longer than the cap. */
export function ShowAll({ count, expanded, onToggle }) {
  return (
    <button
      type="button"
      className="bfh-micro bfh-link bfh-breakdown__more"
      onClick={onToggle}
    >
      {expanded ? 'Show less' : `Show all ${count}`}
    </button>
  )
}
