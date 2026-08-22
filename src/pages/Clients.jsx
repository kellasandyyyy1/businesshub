import { IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ClientDetail from '../components/clients/ClientDetail'
import ClientList from '../components/clients/ClientList'
import ClientModal from '../components/clients/ClientModal'
import { useDevice } from '../context/BreakpointContext'
import useDebounced from '../hooks/useDebounced'
import useSettings from '../hooks/useSettings'
import { filterClients, useClientsData } from '../hooks/useClients'

export default function Clients() {
  const data = useClientsData()
  const { symbol } = useSettings()
  const { isMobile } = useDevice()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  // Trails the field so filtering never runs per keystroke.
  const debouncedSearch = useDebounced(search, 300)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | client

  if (!data) return <div className="bfh-page" />

  const visible = filterClients(data.clients, debouncedSearch)
  const selected = data.clients.find((c) => c.id === selectedId) ?? null

  return (
    <div className="bfh-page bfh-clients">
      <div className="bfh-block bfh-clients__grid">
        <ClientList
          clients={visible}
          search={search}
          onSearch={setSearch}
          selectedId={selectedId}
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
          client={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
    </div>
  )
}
