import { IconPlus, IconSearch, IconUsers } from '@tabler/icons-react'

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
              <span className="bfh-clientrow__name">{client.name}</span>
              <span className="bfh-micro">{client.company}</span>
            </span>
            <span className="bfh-clientrow__revenue">
              {formatAmount(client.revenue, symbol)}
            </span>
          </button>
        ))}

        {clients.length === 0 &&
          (hasAny ? (
            <p className="bfh-empty">No clients match that search.</p>
          ) : (
            <EmptyState
              icon={IconUsers}
              heading="No clients added"
              body="Clients tie invoices and income back to who paid them."
              actionLabel="Add first client"
              onAction={onAdd}
            />
          ))}
      </div>

      <div className="bfh-clientlist__foot">
        <button type="button" className="bfh-btn-ghost bfh-btn-ghost--solid" onClick={onAdd}>
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>Add client</span>
        </button>
      </div>
    </aside>
  )
}
