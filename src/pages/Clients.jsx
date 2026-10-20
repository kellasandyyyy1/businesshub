import { IconPlus, IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ClientDetail from '../components/clients/ClientDetail'
import ClientList from '../components/clients/ClientList'
import ClientModal from '../components/clients/ClientModal'
import useAssistantPrefill from '../hooks/useAssistantPrefill'
import { useDevice } from '../context/BreakpointContext'
import useDebounced from '../hooks/useDebounced'
import useSettings from '../hooks/useSettings'
import { filterClients, useClientsData } from '../hooks/useClients'
import { formatCurrency } from '../lib/format'

/* Three ways people look for a client: by name, by who owes them, by who matters most. */
const SORTS = [
  { id: 'name', label: 'A–Z', by: (a, b) => a.name.localeCompare(b.name) },
  { id: 'owed', label: 'Owe you', by: (a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name) },
  { id: 'revenue', label: 'Top earners', by: (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name) },
]

export default function Clients() {
  const data = useClientsData()
  const { symbol } = useSettings()
  const { isMobile } = useDevice()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  // Trails the field so filtering never runs per keystroke.
  const debouncedSearch = useDebounced(search, 300)
  const [selectedId, setSelectedId] = useState(null)
  const [sort, setSort] = useState('name')
  const [editing, setEditing] = useState(null) // null | {} | client
  useAssistantPrefill('ADD_CLIENT', (record) => setEditing(record?.id ? record : { prefill: record }))

  if (!data) return <div className="bfh-page" />

  const visible = [...filterClients(data.clients, debouncedSearch)].sort(SORTS.find((x) => x.id === sort).by)
  // Beside the list there is room for a client, so one is always open: the
  // chosen one, or the first in the list rather than an empty half-page.
  const selected =
    data.clients.find((c) => c.id === selectedId) ?? (isMobile ? null : (visible[0] ?? null))
  const owing = data.clients.filter((c) => c.outstanding > 0)
  const owed = owing.reduce((t, c) => t + c.outstanding, 0)

  return (
    <div className="bfh-page bfh-clients">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Clients</h1>
          <p className="bfh-pagehead__sub">
            {data.clients.length === 0
              ? 'Everyone you bill, what they have paid, and what they still owe.'
              : `${data.clients.length} ${data.clients.length === 1 ? 'client' : 'clients'}${
                  owed > 0 ? ` · ${formatCurrency(owed, symbol)} still owed to you` : ' · nobody owes you anything'
                }`}
          </p>
        </div>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline bfh-clients__add"
          onClick={() => setEditing({})}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>Add client</span>
        </button>
      </div>

      <div className="bfh-block bfh-clients__grid">
        <ClientList
          clients={visible}
          search={search}
          onSearch={setSearch}
          selectedId={selected?.id ?? null}
          sorts={SORTS}
          sort={sort}
          onSort={setSort}
          owingCount={owing.length}
          // A phone has no room for a second column, so the detail gets its
          // own route rather than a cramped split view.
          onSelect={(id) => (isMobile ? navigate(`/clients/${id}`) : setSelectedId(id))}
          onAdd={() => setEditing({})}
          symbol={symbol}
          hasAny={data.clients.length > 0}
        />

        {selected ? (
          <ClientDetail
            key={selected.id}
            client={selected}
            categoryIcons={data.categoryIcons}
            symbol={symbol}
            onEdit={(client) => setEditing(client)}
          />
        ) : (
          <div className="bfh-clientempty">
            <IconUsers size={32} stroke={1.25} aria-hidden="true" />
            <p>Select a client</p>
          </div>
        )}
      </div>

      {editing && (
        <ClientModal
          key={editing.id ?? 'new'}
          client={editing.id ? editing : (editing.prefill ?? null)}
          onClose={() => setEditing(null)}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
    </div>
  )
}
