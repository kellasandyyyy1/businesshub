import { IconArrowLeft } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'

import ClientDetail from '../components/clients/ClientDetail'
import ClientModal from '../components/clients/ClientModal'
import useSettings from '../hooks/useSettings'
import { useClientsData } from '../hooks/useClients'
import { useState } from 'react'

/**
 * The mobile route for one client. Reuses the same detail component the
 * two-column layout renders — only the framing differs.
 */
export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useClientsData()
  const { symbol } = useSettings()
  const [editing, setEditing] = useState(null)

  if (!data) return <div className="bfh-page" />

  const client = data.clients.find((c) => c.id === Number(id))

  if (!client) {
    return (
      <div className="bfh-page">
        <button type="button" className="bfh-backlink" onClick={() => navigate('/clients')}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Clients
        </button>
        <p className="bfh-empty">That client no longer exists.</p>
      </div>
    )
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block">
        <button type="button" className="bfh-backlink" onClick={() => navigate('/clients')}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Clients
        </button>
      </div>

      <div className="bfh-block">
        <ClientDetail
          key={client.id}
          client={client}
          categoryIcons={data.categoryIcons}
          symbol={symbol}
          onEdit={(target) => setEditing(target)}
        />
      </div>

      {editing && (
        <ClientModal
          key={editing.id}
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
