import { IconDownload, IconFileTypeCsv, IconFileTypeXls } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import useExportData from '../../hooks/useExportData'
import useFocusTrap from '../../hooks/useFocusTrap'
import {
  PERIOD_PRESETS,
  downloadCSV,
  downloadXLSX,
  exportFilename,
  exportWithToast,
  resolvePeriod,
} from '../../lib/export'
import { useToast } from '../../context/ToastContext'
import { EXPORT_TYPES, TRANSACTION_COLUMNS, buildExport } from '../../lib/exportTypes'
import { formatFullDate } from '../../lib/format'
import useSelectedInView from '../../hooks/useSelectedInView'

const ALL_COLUMNS = TRANSACTION_COLUMNS.map((c) => c.key)

const FORMATS = [
  { id: 'csv', name: 'CSV', note: 'Opens anywhere', Icon: IconFileTypeCsv },
  { id: 'xlsx', name: 'Excel', note: 'Excel & Sheets', Icon: IconFileTypeXls },
]

/**
 * The mobile export flow. The type is fixed by whatever opened the sheet,
 * only period and format are choices, and columns fall back to the defaults.
 */
export default function ExportSheet({ typeId, defaultPreset = 'this-month', clientId, onClose }) {
  const data = useExportData()
  const trapRef = useFocusTrap()
  const toast = useToast()
  const [preset, setPreset] = useState(defaultPreset)
  const [format, setFormat] = useState('csv')

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const type = EXPORT_TYPES.find((t) => t.id === typeId) ?? EXPORT_TYPES[0]
  const today = data?.today ?? new Date().toISOString().slice(0, 10)
  const period = resolvePeriod(preset, today)

  const result = useMemo(() => {
    if (!data) return { columns: [], rows: [] }
    return buildExport(typeId, {
      ...data,
      from: period.from,
      to: period.to,
      grouping: type.defaultGrouping ?? 'month',
      columns: ALL_COLUMNS,
      clientId,
    })
  }, [data, typeId, period.from, period.to, type.defaultGrouping, clientId])

  const rowCount = result.rows.length
  const filename = exportFilename(typeId, period.slug, format === 'csv' ? 'csv' : 'xlsx', today)
  // The chosen period may sit past the edge of the row; bring it into view.
  const chipRow = useSelectedInView(preset, Boolean(data))

  const run = () => {
    if (rowCount === 0) return
    exportWithToast(toast, () =>
      format === 'csv'
        ? downloadCSV(result.rows, result.columns, filename)
        : downloadXLSX(result.rows, result.columns, filename, type.label),
    )
    onClose()
  }

  /* Portalled to the body: the entrance animation on `.bfh-block` leaves an
     identity transform behind, which would otherwise become this fixed
     overlay's containing block and strand it mid-page. */
  return createPortal(
    <div className="bfh-exportsheet" role="dialog" aria-modal="true" aria-labelledby="bfh-exportsheet-title">
      <button
        type="button"
        className="bfh-moredrawer__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="bfh-exportsheet__panel" ref={trapRef}>
        <span className="bfh-moredrawer__handle" aria-hidden="true" />

        <div className="bfh-exportsheet__body">
          <header className="bfh-exportsheet__type">
            <span className="bfh-micro">Export</span>
            <h2 className="bfh-exportsheet__typename" id="bfh-exportsheet-title">
              {type.label}
            </h2>
            <span className="bfh-exportsheet__range">
              {formatFullDate(period.from)} – {formatFullDate(period.to)} · {rowCount} row{rowCount === 1 ? '' : 's'}
            </span>
          </header>

          <div className="bfh-exportsheet__group">
            <span className="bfh-fieldlabel" id="bfh-exportsheet-period">
              Time period
            </span>
            {/* One swipeable row with every label whole, squeezing seven
                periods into the sheet's width is what made them overlap. */}
            <div
              className="bfh-chiprow bfh-exportsheet__chips"
              role="radiogroup"
              aria-labelledby="bfh-exportsheet-period"
              ref={chipRow}
            >
              {PERIOD_PRESETS.filter((p) => p.id !== 'custom').map((option) => (
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
          </div>

          <div className="bfh-exportsheet__group">
            <span className="bfh-fieldlabel" id="bfh-exportsheet-format">
              File format
            </span>
            <div className="bfh-exp__formats" role="radiogroup" aria-labelledby="bfh-exportsheet-format">
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
          </div>
        </div>

        <footer className="bfh-exportsheet__foot">
          <button type="button" className="bfh-btn-primary" onClick={run} disabled={rowCount === 0}>
            <IconDownload size={16} stroke={1.75} aria-hidden="true" />
            {rowCount === 0 ? 'Nothing in this period' : `Download ${format === 'csv' ? 'CSV' : 'Excel'}`}
          </button>
          <span className="bfh-exp__filename">{filename}</span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
