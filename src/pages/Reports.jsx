import { useMemo, useState } from 'react'

import ReportTable from '../components/reports/ReportTable'
import useReportsData from '../hooks/useReports'
import useSettings from '../hooks/useSettings'
import { REPORT_TYPES, buildReport, downloadCsv, reportToCsv } from '../lib/reports'
import { downloadXLSX } from '../lib/export'
import { formatFullDate, shiftDays } from '../lib/format'

export default function Reports() {
  const data = useReportsData()
  const { symbol } = useSettings()

  const today = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState('pl')
  const [from, setFrom] = useState(() => shiftDays(today, -365))
  const [to, setTo] = useState(today)

  const report = useMemo(
    () => (data ? buildReport(type, { ...data, from, to }) : null),
    [data, type, from, to],
  )

  if (!data || !report) return <div className="bfh-page" />

  /** The report's own line model, flattened into spreadsheet rows. */
  const asRows = () => {
    const columns = [
      { key: 'line', label: 'Line' },
      ...report.columns.map((c, i) => ({ key: `v${i}`, label: c, numeric: true })),
    ]
    const rows = report.lines.map((line) => {
      const row = { line: line.kind === 'row' ? `  ${line.label}` : line.label }
      report.columns.forEach((_, i) => {
        row[`v${i}`] = line.values ? line.values[i] : ''
      })
      return row
    })
    return { columns, rows }
  }

  const exportExcel = () => {
    const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { columns, rows } = asRows()
    downloadXLSX(rows, columns, `dual-${slug}-${from}-to-${to}.xlsx`, report.title)
  }

  const exportCsv = () => {
    const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadCsv(`${slug}-${from}-to-${to}.csv`, reportToCsv(report, { from, to }))
  }

  return (
    <div className="bfh-page bfh-reports">
      <div className="bfh-block bfh-reports__grid">
        <aside className="bfh-reportnav" aria-label="Report types">
          <div className="bfh-reportnav__list">
            {REPORT_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="bfh-reportnav__item"
                aria-current={type === item.id ? 'true' : undefined}
                onClick={() => setType(item.id)}
              >
                <span className="bfh-reportnav__dot" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="bfh-reportnav__dates">
            <label className="bfh-formfield">
              <span className="bfh-micro">From</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="bfh-formfield">
              <span className="bfh-micro">To</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        </aside>

        <section className="bfh-card bfh-report">
          <header className="bfh-report__head">
            <h1 className="bfh-report__title">{report.title}</h1>
            <div className="bfh-micro">
              {formatFullDate(from)} — {formatFullDate(to)}
            </div>
          </header>

          <ReportTable report={report} symbol={symbol} />

          <footer className="bfh-report__foot">
            <button type="button" className="bfh-ghostaction" onClick={() => window.print()}>
              Export PDF
            </button>
            <button type="button" className="bfh-ghostaction" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="bfh-ghostaction" onClick={exportExcel}>
              Export Excel
            </button>
          </footer>
        </section>
      </div>
    </div>
  )
}
