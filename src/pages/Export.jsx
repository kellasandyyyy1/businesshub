import { IconCheck, IconDownload, IconFileTypeCsv, IconFileTypeXls } from '@tabler/icons-react'
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
  exportWithToast,
  resolvePeriod,
} from '../lib/export'
import { useToast } from '../context/ToastContext'
import {
  EXPORT_TYPES,
  GROUPINGS,
  TRANSACTION_COLUMNS,
  buildExport,
} from '../lib/exportTypes'
import { formatCurrency, formatFullDate } from '../lib/format'

const ALL_COLUMN_KEYS = TRANSACTION_COLUMNS.map((c) => c.key)

const FORMATS = [
  { id: 'csv', name: 'CSV', note: 'Opens anywhere', Icon: IconFileTypeCsv },
  { id: 'xlsx', name: 'Excel', note: 'Excel & Sheets', Icon: IconFileTypeXls },
]

/** One numbered step of the builder. */
function Step({ id, number, title, hint, children }) {
  return (
    <section className="bfh-exp__step" aria-labelledby={`bfh-exp-${id}`}>
      <h2 className="bfh-exp__steptitle" id={`bfh-exp-${id}`}>
        <span className="bfh-exp__stepnum" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {hint && <p className="bfh-exp__hint">{hint}</p>}
      {children}
    </section>
  )
}

export default function Export() {
  const data = useExportData()
  const { symbol } = useSettings()
  const toast = useToast()
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
  // Enough to recognise the file without turning the page into the file.
  const previewRows = result.rows.slice(0, isMobile ? 3 : isTablet ? 5 : 8)

  const extension = format === 'csv' ? 'csv' : 'xlsx'
  const filename = exportFilename(typeId, period.slug, extension, today)

  const runExport = () => {
    if (!canExport) return
    exportWithToast(toast, () =>
      format === 'csv'
        ? downloadCSV(result.rows, result.columns, filename)
        : downloadXLSX(result.rows, result.columns, filename, type.label),
    )
  }

  const toggleColumn = (key) =>
    setColumns((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...ALL_COLUMN_KEYS].filter((k) => current.includes(k) || k === key),
    )
  const range = `${formatFullDate(period.from)} – ${formatFullDate(period.to)}`
  const rowsLabel = `${rowCount} row${rowCount === 1 ? '' : 's'}`

  // Each step is numbered in the order it is read; the ones a report does not
  // use are left out, so the numbers never skip.
  const steps = ['type', 'period', type.grouping && 'grouping', type.columns && 'columns', 'format'].filter(Boolean)
  const stepNo = (id) => steps.indexOf(id) + 1

  const preview = (
    <section className="bfh-card bfh-exp__preview" aria-label="Preview">
      <header className="bfh-exp__previewhead">
        <div>
          <h2 className="bfh-exp__previewtitle">Preview</h2>
          <p className="bfh-exp__hint">
            {rowCount === 0
              ? `Nothing in ${range}.`
              : `First ${previewRows.length} of ${rowsLabel} · ${range}`}
          </p>
        </div>
      </header>

      {rowCount === 0 ? (
        <p className="bfh-empty bfh-exp__empty">
          No {type.label.toLowerCase()} data in this period. Try a longer one.
        </p>
      ) : result.columns.length === 0 ? (
        <p className="bfh-empty bfh-exp__empty">Pick at least one column to include.</p>
      ) : (
        <div className="bfh-exp__scroll" tabIndex={0} aria-label="Preview table, scrolls sideways">
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
                // Export rows are generated, not stored, position is identity.
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
  )

  return (
    <div className="bfh-page bfh-exp">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Export</h1>
          <p className="bfh-pagehead__sub">Download your records as a spreadsheet, pick what, when, and how.</p>
        </div>
      </div>

      <div className="bfh-block bfh-exp__layout">
        <div className="bfh-card bfh-exp__builder">
          <Step id="type" number={stepNo('type')} title="What to export">
            <div className="bfh-exp__types" role="radiogroup" aria-label="Export type">
              {EXPORT_TYPES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={typeId === option.id}
                  className="bfh-exp__type"
                  onClick={() => {
                    setTypeId(option.id)
                    setGrouping(option.defaultGrouping ?? 'month')
                  }}
                >
                  <span className="bfh-exp__radio" aria-hidden="true" />
                  <span className="bfh-exp__typebody">
                    <span className="bfh-exp__typename">{option.label}</span>
                    <span className="bfh-exp__typeblurb">{option.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </Step>

          <Step id="period" number={stepNo('period')} title="Time period" hint={range}>
            <div className="bfh-chiprow bfh-exp__chips" role="radiogroup" aria-label="Time period">
              {PERIOD_PRESETS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  className="bfh-choicechip"
                  aria-checked={preset === option.id}
                  onClick={() => setPreset(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="bfh-exp__dates">
                <label className="bfh-formfield">
                  <span className="bfh-fieldlabel">From</span>
                  <input
                    type="date"
                    value={custom.from || period.from}
                    max={custom.to || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  />
                </label>
                <label className="bfh-formfield">
                  <span className="bfh-fieldlabel">To</span>
                  <input
                    type="date"
                    value={custom.to || period.to}
                    min={custom.from || undefined}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  />
                </label>
              </div>
            )}
          </Step>

          {type.grouping && (
            <Step id="grouping" number={stepNo('grouping')} title="Group rows by">
              <div className="bfh-segment bfh-segment--fill bfh-exp__segment" role="radiogroup" aria-label="Group by">
                {GROUPINGS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    className="bfh-segment__option"
                    aria-checked={grouping === option.id}
                    onClick={() => setGrouping(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Step>
          )}

          {type.columns && (
            <Step id="columns" number={stepNo('columns')} title="Columns" hint={`${columns.length} of ${ALL_COLUMN_KEYS.length} included`}>
              <div className="bfh-exp__cols" role="group" aria-label="Columns to include">
                {TRANSACTION_COLUMNS.map((column) => {
                  const on = columns.includes(column.key)
                  return (
                    <button
                      key={column.key}
                      type="button"
                      className="bfh-exp__col"
                      aria-pressed={on}
                      onClick={() => toggleColumn(column.key)}
                    >
                      <IconCheck className="bfh-exp__coltick" size={14} stroke={2.25} aria-hidden="true" />
                      {column.label}
                    </button>
                  )
                })}
              </div>
              <div className="bfh-exp__colactions">
                <button
                  type="button"
                  className="bfh-btn-text"
                  onClick={() => setColumns(ALL_COLUMN_KEYS)}
                  disabled={columns.length === ALL_COLUMN_KEYS.length}
                >
                  Select all
                </button>
                <button type="button" className="bfh-btn-text" onClick={() => setColumns([])} disabled={columns.length === 0}>
                  Clear
                </button>
              </div>
            </Step>
          )}

          <Step id="format" number={stepNo('format')} title="File format">
            <div className="bfh-exp__formats" role="radiogroup" aria-label="File format">
              {FORMATS.map(({ id, name, note, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={format === id}
                  className="bfh-exp__format"
                  onClick={() => setFormat(id)}
                >
                  <Icon size={22} stroke={1.5} aria-hidden="true" />
                  <span className="bfh-exp__formatbody">
                    <span className="bfh-exp__formatname">{name}</span>
                    <span className="bfh-exp__formatnote">{note}</span>
                  </span>
                </button>
              ))}
            </div>
          </Step>

          {/* Sticky on a phone, so the button is always a thumb away; part of
              the card on anything larger. */}
          <footer className="bfh-exp__submit">
            <div className="bfh-exp__summary">
              <span className="bfh-exp__summarymain">
                {canExport ? `${rowsLabel} · ${format.toUpperCase()}` : 'Nothing to export yet'}
              </span>
              <span className="bfh-exp__filename" title={filename}>
                {filename}
              </span>
            </div>
            <button type="button" className="bfh-btn-primary bfh-exp__go" onClick={runExport} disabled={!canExport}>
              <IconDownload size={16} stroke={1.75} aria-hidden="true" />
              Download
            </button>
          </footer>
        </div>

        {preview}
      </div>
    </div>
  )
}
