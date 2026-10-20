import { IconPencil, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ClientOverview from './ClientOverview'
import ClientTransactions from './ClientTransactions'
import ExportButton from '../export/ExportButton'
import InvoiceTable from '../invoices/InvoiceTable'
import { initialsOf } from '../../hooks/useClients'
import { downloadCSV, exportFilename, exportWithToast, resolvePeriod } from '../../lib/export'
import { useToast } from '../../context/ToastContext'
import { buildExport } from '../../lib/exportTypes'
import { formatCurrency, formatFullDate } from '../../lib/format'
import useExportData from '../../hooks/useExportData'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'transactions', label: 'Payments' },
]

export default function ClientDetail({ client, categoryIcons, symbol, onEdit }) {
  const navigate = useNavigate()
  const exportData = useExportData()
  const toast = useToast()

  /* One client's history is a filter the Export Center cannot express, so
     this exports directly rather than redirecting there. */
  const exportHistory = () => {
    if (!exportData) return
    const period = resolvePeriod('all-time', exportData.today)
    const { columns, rows } = buildExport('client-revenue', {
      ...exportData,
      from: period.from,
      to: period.to,
      grouping: 'month',
      clientId: client.id,
    })
    if (rows.length === 0) return
    exportWithToast(toast, () =>
      downloadCSV(
        rows,
        columns,
        exportFilename('client-revenue', client.company.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'csv', exportData.today),
      ),
    )
  }
  // Local, so selecting another client (which remounts on key) always lands
  // back on the overview rather than a tab left over from the last one.
  const [tab, setTab] = useState('overview')

  const overdue = client.invoices.filter((i) => i.effectiveStatus === 'overdue')
  const stats = [
    { label: 'Paid you so far', value: formatCurrency(client.revenue, symbol) },
    {
      label: 'Still owes you',
      value: formatCurrency(client.outstanding, symbol),
      note: overdue.length ? `${overdue.length} overdue` : client.outstanding > 0 ? 'Nothing late' : null,
    },
    { label: 'Invoices', value: String(client.invoiceCount) },
    {
      label: 'Last paid',
      value: client.lastPayment ? formatFullDate(client.lastPayment) : 'Not yet',
    },
  ]
  const counts = { overview: null, invoices: client.invoices.length, transactions: client.transactions.length }
  const newInvoice = () => navigate(`/invoices?new=1&clientId=${client.id}`)

  return (
    <div className="bfh-clientdetail">
      <header className="bfh-clienthead">
        <span className="bfh-avatar bfh-avatar--lg" aria-hidden="true">
          {initialsOf(client.name)}
        </span>
        <div className="bfh-clienthead__body">
          <h2 className="bfh-clienthead__name">{client.name}</h2>
          <div className="bfh-clienthead__sub">
            {client.company && client.company !== client.name ? client.company : 'Individual client'}
          </div>
        </div>
        {/* The thing people come to a client to do is bill them, so that leads. */}
        <div className="bfh-clienthead__actions">
          <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={newInvoice}>
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>New invoice</span>
          </button>
          <button type="button" className="bfh-btn-outline" onClick={() => onEdit(client)}>
            <IconPencil size={14} stroke={1.5} aria-hidden="true" />
            Edit
          </button>
          <ExportButton
            typeId="client-revenue"
            label="Export"
            period="this-year"
            clientId={client.id}
            onDirect={exportHistory}
          />
        </div>
      </header>

      <div className="bfh-summary">
        {stats.map((stat) => (
          <div className="bfh-summary__cell" key={stat.label}>
            <span className="bfh-clientstat__label">{stat.label}</span>
            <span className="bfh-summary__value">{stat.value}</span>
            {stat.note && <span className="bfh-clientstat__note">{stat.note}</span>}
          </div>
        ))}
      </div>

      <div className="bfh-segment bfh-clientdetail__tabs" role="tablist" aria-label="Client detail">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="bfh-segment__option"
            aria-checked={tab === t.id}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {counts[t.id] != null && <span className="bfh-choicechip__count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <ClientOverview client={client} symbol={symbol} onEdit={() => onEdit(client)} />}

      {tab === 'invoices' && (
        <div className="bfh-tabbody">
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={newInvoice}
          >
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>New invoice for {client.name}</span>
          </button>

          <InvoiceTable
            invoices={client.invoices}
            clientsById={{ [client.id]: client }}
            symbol={symbol}
            selectedId={null}
            onOpen={(invoice) => navigate(`/invoices?id=${invoice.id}`)}
            onEdit={(invoice) => navigate(`/invoices?edit=${invoice.id}`)}
          />
        </div>
      )}

      {tab === 'transactions' && (
        <ClientTransactions
          transactions={client.transactions}
          categoryIcons={categoryIcons}
          symbol={symbol}
        />
      )}
    </div>
  )
}
