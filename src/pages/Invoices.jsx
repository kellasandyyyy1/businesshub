import { IconPlus } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import InvoiceDetail from '../components/invoices/InvoiceDetail'
import InvoiceEditor from '../components/invoices/InvoiceEditor'
import useAssistantPrefill from '../hooks/useAssistantPrefill'
import InvoiceTable from '../components/invoices/InvoiceTable'
import ExportButton from '../components/export/ExportButton'
import SummaryCards from '../components/invoices/SummaryCards'
import useSettings from '../hooks/useSettings'
import { filterByTab, summariseInvoices, useInvoicesData } from '../hooks/useInvoices'
import { nextInvoiceNumber, sortForAction } from '../lib/invoice'

/* The statuses in the words a person uses, in the order they act on them. */
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'sent', label: 'Awaiting payment' },
  { id: 'draft', label: 'Drafts' },
  { id: 'paid', label: 'Paid' },
]

export default function Invoices() {
  const data = useInvoicesData()
  const settings = useSettings()

  const [tab, setTab] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | invoice
  useAssistantPrefill('ADD_INVOICE', (record) => setEditing(record ?? {}))
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
  const rows = sortForAction(filterByTab(data.invoices, tab))
  const counts = {
    all: data.invoices.length,
    overdue: summary.overdue.count,
    sent: summary.sent.count + summary.viewed.count,
    draft: summary.draft.count,
    paid: summary.paid.count,
  }
  const selected = data.invoices.find((i) => i.id === selectedId) ?? null

  return (
    <div className="bfh-page bfh-invpage">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Invoices</h1>
          <p className="bfh-pagehead__sub">Bill clients and keep track of who has paid.</p>
        </div>
        <div className="bfh-invpage__actions">
          <ExportButton typeId="invoice-report" label="Export" period="this-year" />
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={() => setEditing({})}
          >
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>New invoice</span>
          </button>
        </div>
      </div>

      {data.invoices.length > 0 && (
        <>
          <div className="bfh-block">
            <SummaryCards summary={summary} symbol={settings.symbol} onShowOverdue={() => setTab('overdue')} />
          </div>

          {/* Filters that carry their own counts, so the totals and the way
              to see each group are the same control. */}
          <div className="bfh-block">
            <div className="bfh-chiprow" role="radiogroup" aria-label="Show invoices">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  className="bfh-choicechip"
                  aria-checked={tab === f.id}
                  onClick={() => setTab(f.id)}
                >
                  {f.label}
                  <span className="bfh-choicechip__count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

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
          today={data.today}
          tab={tab}
          onShowAll={() => setTab('all')}
        />
      </div>

      {/* The editor takes precedence, opening it from the detail panel swaps
          the two rather than stacking them. */}
      {editing ? (
        <InvoiceEditor
          key={editing.id ?? 'new'}
          invoice={editing.id ? editing : null}
          clients={data.clients}
          nextNumber={nextInvoiceNumber(data.invoices, settings.invoicePrefix ?? 'INV-')}
          defaultClientId={editing.presetClientId ?? null}
          defaultItems={editing.presetItems}
          defaultDueDate={editing.presetDueDate}
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
