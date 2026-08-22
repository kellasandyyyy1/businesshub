import { IconFileSpreadsheet, IconFileText } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useDevice } from '../context/BreakpointContext'
import useDebounced from '../hooks/useDebounced'
import useExportData from '../hooks/useExportData'
import useSettings from '../hooks/useSettings'
import {
  PERIOD_PRESETS,
  downloadCSV,
  downloadXLSX,
  exportFilename,
  resolvePeriod,
} from '../lib/export'
import {
  EXPORT_TYPES,
  GROUPINGS,
  TRANSACTION_COLUMNS,
  buildExport,
} from '../lib/exportTypes'
import { formatCurrency, formatFullDate } from '../lib/format'

const ALL_COLUMN_KEYS = TRANSACTION_COLUMNS.map((c) => c.key)

export default function Export() {
  const data = useExportData()
  const { symbol } = useSettings()
  const { isMobile, isTablet } = useDevice()
  const [params, setParams] = useSearchParams()

  const [typeId, setTypeId] = useState('transaction-log')
  const [preset, setPreset] = useState('this-month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [grouping, setGrouping] = useState('month')
  const [columns, setColumns] = useState(ALL_COLUMN_KEYS)
  const [format, setFormat] = useState('csv')

  // Shortcuts elsewhere in the app land here pre-configured.
  useEffect(() => {
    const type = params.get('type')
    const period = params.get('period')
    const from = params.get('from')
    const to = params.get('to')
    if (!type && !period && !from) return

    if (type && EXPORT_TYPES.some((t) => t.id === type)) {
      setTypeId(type)
      const match = EXPORT_TYPES.find((t) => t.id === type)
      if (match?.defaultGrouping) setGrouping(match.defaultGrouping)
    }
    if (period && PERIOD_PRESETS.some((p) => p.id === period)) setPreset(period)
    if (from && to) {
      setPreset('custom')
      setCustom({ from, to })
    }
    setParams({}, { replace: true })
  }, [params, setParams])

  const type = EXPORT_TYPES.find((t) => t.id === typeId) ?? EXPORT_TYPES[0]
  const today = data?.today ?? new Date().toISOString().slice(0, 10)
  const period = resolvePeriod(preset, today, custom)

  // Recomputing on every keystroke of a custom date would rebuild the whole
  // dataset; the preview trails by 200ms instead.
  const settings = useDebounced(
    JSON.stringify({ typeId, from: period.from, to: period.to, grouping, columns }),
    200,
  )

  const result = useMemo(() => {
    if (!data) return { columns: [], rows: [] }
    const parsed = JSON.parse(settings)
    return buildExport(parsed.typeId, {
      ...data,
      from: parsed.from,
      to: parsed.to,
      grouping: parsed.grouping,
      columns: parsed.columns,
    })
  }, [data, settings])

  if (!data) return <div className="bfh-page" />

  const rowCount = result.rows.length
  const canExport = rowCount > 0 && result.columns.length > 0
  const previewRows = result.rows.slice(0, isTablet ? 5 : 10)

  const runExport = () => {
    if (!canExport) return
    const filename = exportFilename(typeId, period.slug, format === 'csv' ? 'csv' : 'xlsx', today)
    if (format === 'csv') downloadCSV(result.rows, result.columns, filename)
    else downloadXLSX(result.rows, result.columns, filename, type.label)
  }

  const toggleColumn = (key) =>
    setColumns((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...ALL_COLUMN_KEYS].filter((k) => current.includes(k) || k === key),
    )

  return (
    <div className="bfh-page">
      <div className="bfh-block">
        <h1 className="bfh-pagetitle">Export center</h1>
        <div className="bfh-micro">Download your financial data as CSV or Excel</div>
      </div>

      <div className="bfh-block bfh-export__grid">
        <div className="bfh-card bfh-export__builder">
          {/* ---- 1. What to export ---- */}
          <section className="bfh-export__section">
            <span className="bfh-micro">What to export</span>
            <div className="bfh-export__types" role="radiogroup" aria-label="Export type">
              {EXPORT_TYPES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={typeId === option.id}
                  className="bfh-export__type"
                  onClick={() => {
                    setTypeId(option.id)
                    setGrouping(option.defaultGrouping ?? 'month')
                  }}
                >
                  <span className="bfh-export__typename">{option.label}</span>
                  <span className="bfh-export__typeblurb">{option.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ---- 2. Time period ---- */}
          <section className="bfh-export__section">
            <span className="bfh-micro">Time period</span>
            <div className="bfh-export__pills" role="group" aria-label="Time period">
              {PERIOD_PRESETS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="bfh-period"
                  aria-pressed={preset === option.id}
                  onClick={() => setPreset(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="bfh-export__dates">
                <label className="bfh-formfield">
                  <span className="bfh-micro">From</span>
                  <input
                    type="date"
                    value={custom.from || period.from}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  />
                </label>
                <label className="bfh-formfield">
                  <span className="bfh-micro">To</span>
                  <input
                    type="date"
                    value={custom.to || period.to}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  />
                </label>
              </div>
            )}
          </section>

          {/* ---- 3. Group by ---- */}
          {type.grouping && (
            <section className="bfh-export__section">
              <span className="bfh-micro">Group by</span>
              <div className="bfh-export__pills" role="group" aria-label="Group by">
                {GROUPINGS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="bfh-period"
                    aria-pressed={grouping === option.id}
                    onClick={() => setGrouping(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ---- 4. Columns ---- */}
          {type.columns && (
            <section className="bfh-export__section">
              <span className="bfh-micro">Include columns</span>
              <div className="bfh-export__checks">
                {TRANSACTION_COLUMNS.map((column) => (
                  <label className="bfh-check" key={column.key}>
                    <input
                      type="checkbox"
                      checked={columns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    <span className="bfh-check__box" aria-hidden="true" />
                    <span className="bfh-check__label">{column.label}</span>
                  </label>
                ))}
              </div>
              <div className="bfh-export__checkactions">
                <button type="button" className="bfh-ai-note__link" onClick={() => setColumns(ALL_COLUMN_KEYS)}>
                  Select all
                </button>
                <button type="button" className="bfh-ai-note__link" onClick={() => setColumns([])}>
                  Clear all
                </button>
              </div>
            </section>
          )}

          {/* ---- 5. Format ---- */}
          <section className="bfh-export__section">
            <span className="bfh-micro">Format</span>
            <div className="bfh-export__formats" role="radiogroup" aria-label="File format">
              <button
                type="button"
                role="radio"
                aria-checked={format === 'csv'}
                className="bfh-export__format"
                onClick={() => setFormat('csv')}
              >
                <IconFileText size={18} stroke={1.5} aria-hidden="true" />
                <span className="bfh-export__formatname">CSV</span>
                <span className="bfh-micro">Universal</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={format === 'xlsx'}
                className="bfh-export__format"
                onClick={() => setFormat('xlsx')}
              >
                <IconFileSpreadsheet size={18} stroke={1.5} aria-hidden="true" />
                <span className="bfh-export__formatname">XLSX</span>
                <span className="bfh-micro">Excel / Sheets</span>
              </button>
            </div>
          </section>

          <div className="bfh-export__submit">
            <button
              type="button"
              className="bfh-btn-primary"
              onClick={runExport}
              disabled={!canExport}
            >
              {canExport
                ? `Export ${rowCount} row${rowCount === 1 ? '' : 's'} as ${format.toUpperCase()}`
                : 'No data to export'}
            </button>
            <span className="bfh-micro">Opens in Excel, Google Sheets, or Numbers</span>
            {isMobile && <span className="bfh-micro">Preview available on larger screens.</span>}
          </div>
        </div>

        {/* ---- Live preview ---- */}
        {!isMobile && (
          <section className="bfh-card bfh-export__preview">
            <header className="bfh-export__previewhead">
              <span className="bfh-micro">Preview</span>
              <span className="bfh-export__previewmeta">
                {rowCount === 0
                  ? 'No data for this period'
                  : `Showing first ${previewRows.length} of ${rowCount} rows`}
              </span>
              <span className="bfh-micro">
                {formatFullDate(period.from)} — {formatFullDate(period.to)}
              </span>
            </header>

            {rowCount === 0 ? (
              <p className="bfh-empty">No data for this period</p>
            ) : (
              <div className="bfh-export__scroll">
                <table className="bfh-export__table">
                  <thead>
                    <tr>
                      {result.columns.map((column) => (
                        <th key={column.key} className={column.numeric ? 'bfh-export__num' : undefined}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      // Export rows are generated, not stored — position is identity.
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={index}>
                        {result.columns.map((column) => (
                          <td key={column.key} className={column.numeric ? 'bfh-export__num' : undefined}>
                            {/* The preview shows currency; the file keeps plain
                                numbers so a spreadsheet can add them up. */}
                            {column.numeric && !/percent|count|days|%/i.test(column.label)
                              ? formatCurrency(row[column.key], symbol)
                              : String(row[column.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
