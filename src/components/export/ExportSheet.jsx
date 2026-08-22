import { IconFileSpreadsheet, IconFileText } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import useExportData from '../../hooks/useExportData'
import useFocusTrap from '../../hooks/useFocusTrap'
import {
  PERIOD_PRESETS,
  downloadCSV,
  downloadXLSX,
  exportFilename,
  resolvePeriod,
} from '../../lib/export'
import { EXPORT_TYPES, TRANSACTION_COLUMNS, buildExport } from '../../lib/exportTypes'

const ALL_COLUMNS = TRANSACTION_COLUMNS.map((c) => c.key)

/**
 * The mobile export flow. The type is fixed by whatever opened the sheet —
 * only period and format are choices, and columns fall back to the defaults.
 */
export default function ExportSheet({ typeId, defaultPreset = 'this-month', clientId, onClose }) {
  const data = useExportData()
  const trapRef = useFocusTrap()
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

  const run = () => {
    if (rowCount === 0) return
    const filename = exportFilename(typeId, period.slug, format === 'csv' ? 'csv' : 'xlsx', today)
    if (format === 'csv') downloadCSV(result.rows, result.columns, filename)
    else downloadXLSX(result.rows, result.columns, filename, type.label)
    onClose()
  }

  /* Portalled to the body: the entrance animation on `.bfh-block` leaves an
     identity transform behind, which would otherwise become this fixed
     overlay's containing block and strand it mid-page. */
  return createPortal(
    <div className="bfh-exportsheet" role="dialog" aria-modal="true" aria-label="Export">
      <button
        type="button"
        className="bfh-moredrawer__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="bfh-exportsheet__panel" ref={trapRef}>
        <span className="bfh-moredrawer__handle" aria-hidden="true" />

        <div className="bfh-exportsheet__body">
          <div className="bfh-exportsheet__type">
            <span className="bfh-micro">Exporting</span>
            <span className="bfh-exportsheet__typename">{type.label}</span>
          </div>

          <div>
            <span className="bfh-micro">Period</span>
            <div className="bfh-exportsheet__pills" role="group" aria-label="Time period">
              {PERIOD_PRESETS.filter((p) => p.id !== 'custom').map((option) => (
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
          </div>

          <div>
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
          </div>
        </div>

        <footer className="bfh-exportsheet__foot">
          <button type="button" className="bfh-btn-primary" onClick={run} disabled={rowCount === 0}>
            {rowCount === 0
              ? 'No data to export'
              : `Export ${rowCount} row${rowCount === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
