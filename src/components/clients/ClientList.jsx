import { IconSearch, IconUsers } from '@tabler/icons-react'

import EmptyState from '../EmptyState'

import { initialsOf } from '../../hooks/useClients'
import { formatAmount } from '../../lib/format'

export default function ClientList({
  clients,
  search,
  onSearch,
  selectedId,
  onSelect,
  onAdd,
  symbol,
  hasAny,
  sorts,
  sort,
  onSort,
  owingCount,
}) {
  return (
    <aside className="bfh-clientlist" aria-label="Clients">
      <div className="bfh-clientlist__search">
        <div className="bfh-search">
          <IconSearch size={14} stroke={1.5} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search clients…"
            aria-label="Search clients"
          />
        </div>
        {hasAny && (
          <div className="bfh-chiprow bfh-clientlist__sorts" role="radiogroup" aria-label="Sort clients">
            {sorts.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                className="bfh-choicechip"
                aria-checked={sort === s.id}
                onClick={() => onSort(s.id)}
              >
                {s.label}
                {s.id === 'owed' && owingCount > 0 && <span className="bfh-choicechip__count">{owingCount}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bfh-clientlist__rows">
        {clients.map((client) => (
          <button
            type="button"
            key={client.id}
            className="bfh-clientrow"
            data-selected={client.id === selectedId ? 'true' : undefined}
            aria-current={client.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(client.id)}
          >
            <span className="bfh-avatar" aria-hidden="true">
              {initialsOf(client.name)}
            </span>
            <span className="bfh-clientrow__body">
              <span className="bfh-clientrow__name">
                {client.overdue > 0 && <span className="dot dot-neg" aria-hidden="true" />}
                <span className="bfh-clientrow__nametext">{client.name}</span>
                {client.overdue > 0 && <span className="bfh-sr">, has an overdue invoice</span>}
              </span>
              {/* A client billed as a person stores their name as the company too;
                  saying it twice tells nobody anything, so the email shows instead. */}
              <span className="bfh-clientrow__sub">
                {client.company && client.company !== client.name ? client.company : client.email || 'Individual'}
              </span>
            </span>
            {/* What they have paid, and, when it matters, what they owe. */}
            <span className="bfh-clientrow__money">
              <span className="bfh-clientrow__revenue">{formatAmount(client.revenue, symbol)}</span>
              <span className="bfh-clientrow__owed" data-owing={client.outstanding > 0 || undefined}>
                {client.outstanding > 0 ? `${formatAmount(client.outstanding, symbol)} owed` : 'earned'}
              </span>
            </span>
          </button>
        ))}

        {clients.length === 0 &&
          (hasAny ? (
            <p className="bfh-empty">No clients match that search.</p>
          ) : (
            <EmptyState
              icon={IconUsers}
              heading="No clients yet"
              body="Add the people and businesses you bill. Invoices and payments then show who paid what, and who still owes you."
              actionLabel="Add your first client"
              onAction={onAdd}
            />
          ))}
      </div>

    </aside>
  )
}
