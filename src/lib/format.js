/**
 * Money and date formatting. Everything here takes the currency symbol as an
 * argument rather than reading settings, so it stays usable from non-React
 * code (the health score, the chart axis) as well as components.
 */

const grouped = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })

/** Full precision, grouped: ₱145,000. Used wherever an exact figure matters. */
export function formatCurrency(amount, symbol = '₱') {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${symbol}${grouped.format(Math.abs(Math.round(amount)))}`
}

/**
 * The app's display formatter: exact under ₱100,000, abbreviated above it.
 *
 *   ₱1,234    under 100,000
 *   ₱120.5K   100,000 – 999,999
 *   ₱1.2M     1,000,000 and up
 *
 * Documents that a client will read — the invoice PDF, the report tables —
 * use formatCurrency instead, where an abbreviated total would be wrong.
 */
export function formatAmount(amount, symbol = '₱') {
  const value = Number(amount) || 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 100_000) {
    const thousands = abs / 1000
    // 999,999 would round to "1000.0K"; promote it rather than print four digits.
    if (thousands >= 999.95) return `${sign}${symbol}1.0M`
    return `${sign}${symbol}${thousands.toFixed(1)}K`
  }
  return `${sign}${symbol}${grouped.format(Math.round(abs))}`
}

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Table dates: "Today" and "Yesterday" while they still mean something, then
 * "Aug 21" within the current year and "Aug 21, 2025" beyond it.
 */
export function formatDate(isoDate, today = new Date().toISOString().slice(0, 10)) {
  if (!isoDate) return '—'
  const date = String(isoDate).slice(0, 10)
  if (date === today) return 'Today'
  if (date === shiftDays(today, -1)) return 'Yesterday'

  const [year, month, day] = date.split('-')
  const label = `${SHORT_MONTHS[Number(month) - 1]} ${Number(day)}`
  return year === today.slice(0, 4) ? label : `${label}, ${year}`
}

/** Signed percentage change, or null when the baseline is zero. */
export function percentChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** "12%" — the arrow and the border style carry the direction. */
export function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.abs(value).toFixed(0)}%`
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "19 AUG" — mono micro-label register. */
export function formatDayMonth(isoDate) {
  const [, m, d] = isoDate.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/** "19 AUG 2026" — for table cells, where the year has to be unambiguous. */
export function formatFullDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/** "AUG" */
export function formatMonth(isoDate) {
  return MONTHS[Number(isoDate.split('-')[1]) - 1]
}

/** ISO date `n` days from `iso`. */
export function shiftDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Whole days between two ISO dates. */
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86_400_000)
}
