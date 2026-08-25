import { shiftDays } from './format'

/* -------------------------------------------------------------------------
   Period presets
   ------------------------------------------------------------------------- */

export const PERIOD_PRESETS = [
  { id: 'this-week', label: 'This week' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-6-months', label: 'Last 6 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-year', label: 'Last year' },
  { id: 'custom', label: 'Custom' },
]

const iso = (d) => d.toISOString().slice(0, 10)

/** Monday-start week containing `today`. */
function weekBounds(today) {
  const d = new Date(`${today}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7 // 0 = Monday
  const start = shiftDays(today, -day)
  return [start, shiftDays(start, 6)]
}

function monthBounds(year, month) {
  return [iso(new Date(Date.UTC(year, month, 1))), iso(new Date(Date.UTC(year, month + 1, 0)))]
}

/** Resolves a preset to inclusive ISO bounds plus a slug for the filename. */
export function resolvePeriod(preset, today, custom = {}) {
  const d = new Date(`${today}T00:00:00Z`)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()

  switch (preset) {
    case 'this-week': {
      const [from, to] = weekBounds(today)
      return { from, to, slug: `week-${from}` }
    }
    case 'this-month': {
      const [from, to] = monthBounds(year, month)
      return { from, to, slug: from.slice(0, 7) }
    }
    case 'last-month': {
      const [from, to] = monthBounds(year, month - 1)
      return { from, to, slug: from.slice(0, 7) }
    }
    case 'last-3-months': {
      const [from] = monthBounds(year, month - 2)
      const [, to] = monthBounds(year, month)
      return { from, to, slug: `${from.slice(0, 7)}-to-${to.slice(0, 7)}` }
    }
    case 'last-6-months': {
      const [from] = monthBounds(year, month - 5)
      const [, to] = monthBounds(year, month)
      return { from, to, slug: `${from.slice(0, 7)}-to-${to.slice(0, 7)}` }
    }
    case 'this-year':
      return { from: `${year}-01-01`, to: `${year}-12-31`, slug: String(year) }
    case 'last-year':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, slug: String(year - 1) }
    case 'all-time':
      return { from: '1970-01-01', to: today, slug: 'all-time' }
    default: {
      const from = custom.from || shiftDays(today, -30)
      const to = custom.to || today
      return { from, to, slug: `${from}-to-${to}` }
    }
  }
}

/* -------------------------------------------------------------------------
   CSV
   ------------------------------------------------------------------------- */

/** RFC-4180 escaping: quote anything holding a comma, quote, or newline. */
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCSV(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','))
  return [header, ...body].join('\n')
}

/* -------------------------------------------------------------------------
   XLSX
   ------------------------------------------------------------------------- */

const MAX_COL_CHARS = 40

/**
 * SheetJS is ~190 KB, and most sessions never export a spreadsheet — so it is
 * fetched the first time XLSX is actually chosen, not on page load.
 */
const loadXLSX = () => import('xlsx')

export async function buildXLSX(rows, columns, sheetName = 'Export') {
  const XLSX = await loadXLSX()
  // Arrays-of-arrays keeps each cell's JS type, so amounts stay numeric and
  // Excel can sum them instead of treating them as text.
  const aoa = [columns.map((c) => c.label), ...rows.map((row) => columns.map((c) => row[c.key] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = columns.map((col, i) => {
    const widest = aoa.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 0)
    return { wch: Math.min(Math.max(widest + 2, 10), MAX_COL_CHARS) }
  })

  // Autofilter gives the header row sort/filter controls in Excel and Sheets.
  if (rows.length) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: columns.length - 1 } }),
    }
  }

  // Requested freeze pane. SheetJS's community build does not write pane
  // definitions, so this is inert today and starts working unchanged on a
  // build that supports it — the autofilter above is the working stand-in.
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  return wb
}

/* -------------------------------------------------------------------------
   Download
   ------------------------------------------------------------------------- */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** "dual-transaction-log-2026-08-2026-08-21.csv" */
export function exportFilename(typeId, slug, extension, today) {
  return `dual-${typeId}-${slug}-${today}.${extension}`
}

export function downloadCSV(rows, columns, filename) {
  // The BOM keeps Excel from mangling ₱ and other non-ASCII characters.
  triggerDownload(new Blob([`﻿${buildCSV(rows, columns)}`], { type: 'text/csv;charset=utf-8' }), filename)
}

export async function downloadXLSX(rows, columns, filename, sheetName) {
  const XLSX = await loadXLSX()
  const wb = await buildXLSX(rows, columns, sheetName)
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  triggerDownload(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
}
