/**
 * Geometry and labelling shared by every chart in the app, so a bar on the
 * dashboard and a bar on a report are drawn by the same rules.
 */

/**
 * Rounds an axis top up to a readable step. The ladder is finer than the usual
 * 1/2/5 so the tallest bar fills most of the plot instead of half of it.
 */
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

export function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.find((s) => value / magnitude <= s) * magnitude
}

/** A rect with only its top corners rounded — the data end, not the baseline. */
export function topRounded(x, y, w, h, r) {
  if (h <= 0) return ''
  const radius = Math.min(r, w / 2, h)
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `A ${radius} ${radius} 0 0 1 ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ')
}

/**
 * Axis ticks only need to be read at a glance: ₱0, ₱25K, ₱1.5M. The exact
 * figure lives in the tooltip.
 */
export function formatAxis(value, symbol = '₱') {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  // Two decimals where a step needs them (₱1.45M), none where it does not
  // (₱1.5M) — one decimal turned a 50K step into two ticks both reading 1.4M.
  const trim = (n) => String(Number(n.toFixed(2)))
  if (abs >= 1_000_000) return `${sign}${symbol}${trim(abs / 1_000_000)}M`
  if (abs >= 1000) return `${sign}${symbol}${trim(abs / 1000)}K`
  return `${sign}${symbol}${Math.round(abs)}`
}

/**
 * Rough advance of one axis character, as a fraction of the font size. Geist's
 * tabular figures and capitals sit near 0.6em; the extra covers the tracking.
 */
const CHAR = 0.64

export function textWidth(text, fontSize) {
  return Math.ceil(String(text).length * fontSize * CHAR)
}

/** The axis type size, read from the same media query the stylesheet uses. */
export const NARROW_TYPE = '(max-width: 1023px)'
export const axisFontSize = (narrow) => (narrow ? 11 : 10)

/**
 * Where a tooltip goes for a mark at `x` that is `halfWidth` wide: to its
 * right while the mark is in the left half of the plot, to its left after.
 */
export function tipPlacement(x, halfWidth, width) {
  const offset = halfWidth + 8
  return x < width / 2 ? { left: x + offset, side: 'right' } : { left: x - offset, side: 'left' }
}
