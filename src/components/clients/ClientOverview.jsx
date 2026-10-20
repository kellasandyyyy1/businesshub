import { IconMail, IconMapPin, IconPhone } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import RevenueChart from './RevenueChart'
import { db } from '../../db/db'

function ContactRow({ icon: Icon, label, value, href, onAdd }) {
  return (
    <div className="bfh-contact">
      <span className="bfh-iconbox">
        <Icon size={15} stroke={1.5} aria-hidden="true" />
      </span>
      <span className="bfh-contact__body">
        <span className="bfh-micro">{label}</span>
        {value ? (
          href ? (
            <a className="bfh-contact__value bfh-contact__link" href={href}>
              {value}
            </a>
          ) : (
            <span className="bfh-contact__value">{value}</span>
          )
        ) : (
          // A gap is something to fill, not a dash to read past.
          <button type="button" className="bfh-contact__add" onClick={onAdd}>
            Add {label.toLowerCase()}
          </button>
        )}
      </span>
    </div>
  )
}

export default function ClientOverview({ client, symbol, onEdit }) {
  const [notes, setNotes] = useState(client.notes ?? '')
  const [saved, setSaved] = useState(false)

  // Switching clients swaps the draft out from under the textarea.
  useEffect(() => {
    setNotes(client.notes ?? '')
    setSaved(false)
  }, [client.id, client.notes])

  const commit = async () => {
    if (notes === (client.notes ?? '')) return
    await db.clients.update(client.id, { notes })
    setSaved(true)
  }

  return (
    <div className="bfh-overview">
      <section className="bfh-card">
        <h3 className="bfh-panel__title">Contact</h3>
        <div className="bfh-contacts">
          <ContactRow
            icon={IconMail}
            label="Email"
            value={client.email}
            href={client.email ? `mailto:${client.email}` : null}
            onAdd={onEdit}
          />
          <ContactRow
            icon={IconPhone}
            label="Phone"
            value={client.phone}
            href={client.phone ? `tel:${client.phone.replace(/\s/g, '')}` : null}
            onAdd={onEdit}
          />
          <ContactRow icon={IconMapPin} label="Address" value={client.address} onAdd={onEdit} />
        </div>
      </section>

      <section className="bfh-card">
        <h3 className="bfh-panel__title">What they have paid</h3>
        <p className="bfh-clientcard__sub">Month by month, the last 12 months.</p>
        {client.series.some((m) => m.revenue > 0) ? (
          <RevenueChart series={client.series} symbol={symbol} />
        ) : (
          <p className="bfh-empty">No payments from {client.name} in the last 12 months yet.</p>
        )}
      </section>

      <section className="bfh-card">
        <header className="bfh-notes__head">
          <h3 className="bfh-panel__title">Notes</h3>
          <span className="bfh-notes__status">{saved ? 'Saved' : 'Saved automatically'}</span>
        </header>
        <textarea
          className="bfh-notes"
          rows={4}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setSaved(false)
          }}
          onBlur={commit}
          aria-label={`Notes about ${client.name}`}
          placeholder="Payment terms, who to contact, anything worth remembering"
        />
      </section>
    </div>
  )
}
