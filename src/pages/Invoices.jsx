import { IconPlus } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import InvoiceDetail from '../components/invoices/InvoiceDetail'
import InvoiceEditor from '../components/invoices/InvoiceEditor'
import InvoiceTable from '../components/invoices/InvoiceTable'
import ExportButton from '../components/export/ExportButton'
import SummaryCards from '../components/invoices/SummaryCards'
import useSettings from '../hooks/useSettings'
import { STATUS_TABS, filterByTab, summariseInvoices, useInvoicesData } from '../hooks/useInvoices'
import { nextInvoiceNumber } from '../lib/invoice'

export default function Invoices() {
  const data = useInvoicesData()
  const settings = useSettings()

  const [tab, setTab] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | invoice
  const [params, setParams] = useSearchParams()

  // Deep links from the clients page: open an invoice, edit one, or start a
  // new one already addressed to a client.
  useEffect(() => {
    if (!data) return
    const open = params.get('id')
    const edit = params.get('edit')
    const isNew = params.get('new')
    if (!open && !edit && !isNew) return

    if (open) setSelectedId(Number(open))
    if (edit) {
      const invoice = data.invoices.find((i) => i.id === Number(edit))
      if (invoice) setEditing(invoice)
    }
    if (isNew) {
      const clientId = params.get('clientId')
      setEditing({ presetClientId: clientId ? Number(clientId) : null })
    }
    setParams({}, { replace: true })
  }, [params, setParams, data])

  if (!data) return <div className="bfh-page" />

  const summary = summariseInvoices(data.invoices)
  const rows = filterByTab(data.invoices, tab)
  const selected = data.invoices.find((i) => i.id === selectedId) ?? null

  return (
    <div className="bfh-page">
      <div className="bfh-block">
        <SummaryCards summary={summary} symbol={settings.symbol} onSelect={setTab} />
      </div>

      <div className="bfh-block bfh-tabbar">
        <div className="bfh-tabs" role="tablist" aria-label="Invoice status">
          {STATUS_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="bfh-tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {id}
            </button>
          ))}
        </div>

        <ExportButton typeId="invoice-report" label="Export invoices" period="this-year" />

        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => setEditing({})}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>New invoice</span>
        </button>
      </div>

      <div className="bfh-block">
        <InvoiceTable
          invoices={rows}
          clientsById={data.clientsById}
          symbol={settings.symbol}
          selectedId={selectedId}
          onOpen={(invoice) => setSelectedId(invoice.id)}
          onEdit={(invoice) => setEditing(invoice)}
          onAdd={() => setEditing({})}
          filtered={data.invoices.length > 0}
        />
      </div>

      {/* The editor takes precedence — opening it from the detail panel swaps
          the two rather than stacking them. */}
      {editing ? (
        <InvoiceEditor
          key={editing.id ?? 'new'}
          invoice={editing.id ? editing : null}
          clients={data.clients}
          nextNumber={nextInvoiceNumber(data.invoices, settings.invoicePrefix ?? 'INV-')}
          defaultClientId={editing.presetClientId ?? null}
          defaultTaxRate={(settings.taxRate ?? 0.12) * 100}
          symbol={settings.symbol}
          onClose={() => setEditing(null)}
        />
      ) : (
        selected && (
          <InvoiceDetail
            key={selected.id}
            invoice={selected}
            client={data.clientsById[selected.clientId]}
            business={settings.businessName}
            symbol={settings.symbol}
            onClose={() => setSelectedId(null)}
            onEdit={(invoice) => setEditing(invoice)}
          />
        )
      )}
    </div>
  )
}
