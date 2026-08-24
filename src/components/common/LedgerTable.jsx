import { IconSearch } from '@tabler/icons-react'

import EmptyState from '../EmptyState'
import { formatDate } from '../../lib/format'
import { useDevice } from '../../context/BreakpointContext'

/**
 * A searchable list of transactions, as a table on a desktop and as cards on a
 * phone.
 *
 * The columns are passed in because the two ledgers do not show the same
 * things: income names the client it came from, expenses carry a minus sign.
 * Everything else — the search field, the empty state, load-more, the row
 * click — is identical, so it lives here once.
 */
export default function LedgerTable({
  title,
  columns,
  rows,
  total,
  search,
  onSearch,
  searchPlaceholder,
  searchLabel,
  headerAction,
  mobileMeta,
  amountOf,
  emptyIcon,
  emptyHeading,
  emptyBody,
  emptyAction,
  onAdd,
  noMatchLabel,
  searching,
  selectedId,
  onOpen,
  onLoadMore,
  hasMore,
  tableClass = '',
}) {
  const { isMobile } = useDevice()

  const openOnKey = (e, tx) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(tx)
    }
  }

  return (
    <section className="bfh-card bfh-table-card">
      <header className="bfh-ledger__head">
        <h2 className="bfh-panel__title">{title}</h2>

        {/* A table showing a fixed slice — the dashboard's last eight — has
            nothing to search, so it puts a link through to the full list in
            the same slot instead. */}
        {onSearch ? (
          <div className="bfh-search bfh-search--sm">
            <IconSearch size={14} stroke={1.5} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
            />
          </div>
        ) : (
          headerAction ?? null
        )}
      </header>

      {rows.length === 0 ? (
        searching ? (
          <p className="bfh-empty">{noMatchLabel}</p>
        ) : (
          <EmptyState
            icon={emptyIcon}
            heading={emptyHeading}
            body={emptyBody}
            actionLabel={emptyAction}
            onAction={onAdd}
          />
        )
      ) : isMobile ? (
        <div className="bfh-cardlist">
          {rows.map((tx) => (
            <button
              key={tx.id}
              type="button"
              className="bfh-txcard"
              onClick={() => onOpen(tx)}
            >
              <span className="bfh-txcard__top">
                <span className="bfh-txcard__name">{tx.description}</span>
                <span className="bfh-txcard__amount">{amountOf(tx)}</span>
              </span>
              <span className="bfh-txcard__meta">
                {mobileMeta(tx).map((chip) => (
                  <span key={chip} className="bfh-chip">
                    {chip}
                  </span>
                ))}
                <span className="bfh-chip">{formatDate(tx.date)}</span>
                <span className="bfh-chip">{tx.status}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <table className={`bfh-table ${tableClass}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((tx) => (
              <tr
                key={tx.id}
                className="bfh-row"
                data-selected={tx.id === selectedId ? 'true' : undefined}
                tabIndex={0}
                onClick={() => onOpen(tx)}
                onKeyDown={(e) => openOnKey(e, tx)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render(tx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasMore && (
        <footer className="bfh-pager">
          <span className="bfh-micro">
            {rows.length} of {total}
          </span>
          <button type="button" className="bfh-btn-ghost bfh-btn-ghost--solid" onClick={onLoadMore}>
            Load more
          </button>
        </footer>
      )}
    </section>
  )
}
