import { IconFileTypeCsv, IconFileTypePdf, IconFileTypeXls } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import ReportTable from '../components/reports/ReportTable'
import useReportsData from '../hooks/useReports'
import useSelectedInView from '../hooks/useSelectedInView'
import useSettings from '../hooks/useSettings'
import { REPORT_TYPES, buildReport, downloadCsv, reportToCsv } from '../lib/reports'
import { downloadXLSX, exportWithToast } from '../lib/export'
import { useToast } from '../context/ToastContext'
import { formatCurrency, formatFullDate, shiftDays } from '../lib/format'

const iso = (d) => d.toISOString().slice(0, 10)

/**
 * The windows people actually report on, worked out from today. A report is
 * nearly always "this month", "last month" or "this year"; two date pickers
 * made every one of those a small calculation.
 */
const RANGES = [
  {
    id: 'this-month',
    label: 'This month',
    bounds: (now) => [iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))), iso(now)],
  },
  {
    id: 'last-month',
    label: 'Last month',
    bounds: (now) => [
      iso(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))),
      iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0))),
    ],
  },
  {
    id: 'this-quarter',
    label: 'This quarter',
    bounds: (now) => [iso(new Date(Date.UTC(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1))), iso(now)],
  },
  {
    id: 'this-year',
    label: 'This year',
    bounds: (now) => [`${now.getFullYear()}-01-01`, iso(now)],
  },
  {
    id: 'last-12',
    label: 'Last 12 months',
    bounds: (now) => [shiftDays(iso(now), -365), iso(now)],
  },
  { id: 'custom', label: 'Custom' },
]

const formatValue = (value, format, symbol) =>
  format === 'percent' ? `${(value * 100).toFixed(1)}%` : formatCurrency(value, symbol)

export default function Reports() {
  const data = useReportsData()
  const { symbol } = useSettings()
  const toast = useToast()

  const today = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState('pl')
  const [range, setRange] = useState('last-12')
  const [custom, setCustom] = useState(() => ({ from: shiftDays(today, -365), to: today }))

  const [from, to] = useMemo(() => {
    const preset = RANGES.find((r) => r.id === range)
    return preset?.bounds ? preset.bounds(new Date()) : [custom.from, custom.to]
  }, [range, custom])

  const report = useMemo(
    () => (data ? buildReport(type, { ...data, from, to }) : null),
    [data, type, from, to],
  )

  const rangeRow = useSelectedInView(range, Boolean(report))
  const typeRow = useSelectedInView(type, Boolean(report))

  if (!data || !report) return <div className="bfh-page" />

  // The bottom line, lifted to the top: most people open a report for one
  // number, and it should not be the last thing on the page.
  const grand = [...report.lines].reverse().find((line) => line.kind === 'grand' && line.values)
  // A total with a share beside it leads with the total; an in / out / net
  // line leads with the net, which is the answer the other two add up to.
  const headlineIndex = grand
    ? grand.formats?.includes('percent') || grand.values.length < 3
      ? 0
      : grand.values.length - 1
    : 0

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

  const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const exportExcel = () => {
    const { columns, rows } = asRows()
    exportWithToast(toast, () => downloadXLSX(rows, columns, `dual-${slug}-${from}-to-${to}.xlsx`, report.title))
  }
  const exportCsv = () =>
    exportWithToast(toast, () => downloadCsv(`${slug}-${from}-to-${to}.csv`, reportToCsv(report, { from, to })))

  return (
    <div className="bfh-page bfh-reports">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Reports</h1>
          <p className="bfh-pagehead__sub">Pick a report and a period. Every report can be downloaded.</p>
        </div>
      </div>

      <div className="bfh-block bfh-reports__grid">
        {/* A column of report names beside the report on a desktop; one row
            of chips above it on a tablet or phone, which the stylesheet does. */}
        <nav className="bfh-reportnav" aria-label="Report types">
          <div className="bfh-reportnav__list" ref={typeRow}>
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
        </nav>

        <section className="bfh-card bfh-report">
          <header className="bfh-report__head">
            <h2 className="bfh-report__title">{report.title}</h2>
            <div className="bfh-report__range">
              {formatFullDate(from)} — {formatFullDate(to)}
            </div>
          </header>

          <div className="bfh-chiprow" role="radiogroup" aria-label="Period" ref={rangeRow}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                className="bfh-choicechip"
                aria-checked={range === r.id}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="bfh-report__dates">
              <label className="bfh-formfield">
                <span className="bfh-fieldlabel">From</span>
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </label>
              <label className="bfh-formfield">
                <span className="bfh-fieldlabel">To</span>
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  max={today}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </label>
            </div>
          )}

          {grand && (
            <div className="bfh-report__headline">
              <span className="bfh-report__headlinelabel">{grand.label}</span>
              <span className="bfh-report__headlinevalue">
                {formatValue(grand.values[headlineIndex], grand.formats?.[headlineIndex], symbol)}
              </span>
            </div>
          )}

          <div className="bfh-report__tablewrap">
            <ReportTable report={report} symbol={symbol} />
          </div>

          <footer className="bfh-report__foot">
            <span className="bfh-report__footlabel">Download</span>
            <div className="bfh-report__downloads">
              <button type="button" className="bfh-btn-outline" onClick={() => window.print()}>
                <IconFileTypePdf size={17} stroke={1.5} aria-hidden="true" />
                PDF
              </button>
              <button type="button" className="bfh-btn-outline" onClick={exportCsv}>
                <IconFileTypeCsv size={17} stroke={1.5} aria-hidden="true" />
                CSV
              </button>
              <button type="button" className="bfh-btn-outline" onClick={exportExcel}>
                <IconFileTypeXls size={17} stroke={1.5} aria-hidden="true" />
                Excel
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  )
}
