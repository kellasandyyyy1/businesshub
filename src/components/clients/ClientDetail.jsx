import { IconPencil, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ClientOverview from './ClientOverview'
import ClientTransactions from './ClientTransactions'
import ExportButton from '../export/ExportButton'
import InvoiceTable from '../invoices/InvoiceTable'
import { initialsOf } from '../../hooks/useClients'
import { downloadCSV, exportFilename, resolvePeriod } from '../../lib/export'
import { buildExport } from '../../lib/exportTypes'
import { formatCurrency, formatFullDate } from '../../lib/format'
import useExportData from '../../hooks/useExportData'

const TABS = ['overview', 'invoices', 'transactions']

export default function ClientDetail({ client, categoryIcons, symbol, onEdit }) {
  const navigate = useNavigate()
  const exportData = useExportData()

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
    downloadCSV(
      rows,
      columns,
      exportFilename('client-revenue', client.company.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'csv', exportData.today),
    )
  }
  // Local, so selecting another client (which remounts on key) always lands
  // back on the overview rather than a tab left over from the last one.
  const [tab, setTab] = useState('overview')

  const stats = [
    { label: 'Revenue generated', value: formatCurrency(client.revenue, symbol) },
    { label: 'Outstanding', value: formatCurrency(client.outstanding, symbol) },
    { label: 'Invoices', value: String(client.invoiceCount) },
    {
      label: 'Last payment',
      value: client.lastPayment ? formatFullDate(client.lastPayment) : '—',
    },
  ]

  return (
    <div className="bfh-clientdetail">
      <header className="bfh-clienthead">
        <span className="bfh-avatar bfh-avatar--lg" aria-hidden="true">
          {initialsOf(client.name)}
        </span>
        <div className="bfh-clienthead__body">
          <h2 className="bfh-clienthead__name">{client.name}</h2>
          <div className="bfh-micro">{client.company}</div>
        </div>
        <ExportButton
          typeId="client-revenue"
          label="Export history"
          period="this-year"
          clientId={client.id}
          onDirect={exportHistory}
        />

        <button
          type="button"
          className="bfh-iconaction"
          onClick={() => onEdit(client)}
          aria-label={`Edit ${client.name}`}
        >
          <IconPencil size={14} stroke={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="bfh-summary">
        {stats.map((stat) => (
          <div className="bfh-summary__cell" key={stat.label}>
            <span className="bfh-micro">{stat.label}</span>
            <span className="bfh-summary__value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="bfh-tabs" role="tablist" aria-label="Client detail">
        {TABS.map((id) => (
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

      {tab === 'overview' && <ClientOverview client={client} symbol={symbol} />}

      {tab === 'invoices' && (
        <div className="bfh-tabbody">
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={() => navigate(`/invoices?new=1&clientId=${client.id}`)}
          >
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Create invoice for {client.name}</span>
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
