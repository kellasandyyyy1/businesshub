import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react'

import { formatCurrency } from '../lib/format'

const ICONS = { up: IconArrowUpRight, down: IconArrowDownRight, flat: IconMinus }
const TONE_CLASS = { pos: 'sig-pos', neg: 'sig-neg', neutral: undefined }

/**
 * The comparison line under a figure.
 *
 * The arrow always gives the direction and the colour says whether that
 * direction is welcome, which depends on the figure: spending ▲ 18% is red,
 * income ▲ 18% is green. A change too small to matter reads as flat and grey.
 * With nothing to compare against there is no arrow at all, only the words.
 *
 *   goodWhen   'up' | 'down', which way is good for this figure
 *   format     'percent' (a % change) | 'points' (a change in a rate, in
 *              percentage points) | 'currency' (an amount)
 *   quiet      keep the arrow but drop the colour, for a figure that only
 *              repeats a signal shown beside it, so a row never holds more
 *              than about three coloured marks
 */
export default function Delta({
  value,
  format = 'percent',
  goodWhen = 'up',
  label,
  neutralBelow = 2,
  symbol,
  emptyLabel = 'nothing earlier to compare',
  quiet = false,
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="bfh-sigdelta">{emptyLabel}</span>
  }

  const small = format === 'currency' ? value === 0 : Math.abs(value) < neutralBelow
  const direction = small || value === 0 ? 'flat' : value > 0 ? 'up' : 'down'
  const tone = direction === 'flat' || quiet ? 'neutral' : direction === goodWhen ? 'pos' : 'neg'
  const Icon = ICONS[direction]

  const size = Math.abs(value)
  const figure =
    format === 'currency'
      ? formatCurrency(size, symbol)
      : format === 'points'
        ? `${Math.round(size)} pts`
        : `${size > 0 && size < 1 ? size.toFixed(1) : Math.round(size)}%`

  const spoken =
    direction === 'flat' ? 'about level' : quiet ? direction : `${direction}, ${tone === 'pos' ? 'better' : 'worse'}`

  return (
    <span className="bfh-sigdelta">
      <span className={['bfh-sigdelta__mark', TONE_CLASS[tone]].filter(Boolean).join(' ')} data-tone={tone}>
        <Icon size={12} stroke={2} aria-hidden="true" />
        <span className="bfh-sr">{spoken}: </span>
        {value === 0 ? 'Level' : figure}
      </span>
      {label && <span className="bfh-sigdelta__label">{label}</span>}
    </span>
  )
}
