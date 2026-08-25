import useElementWidth from '../../hooks/useElementWidth'
import useMediaQuery from '../../hooks/useMediaQuery'
import { LOW_CASH_THRESHOLD } from '../../lib/cashflow'
import { formatAmount, formatDayMonth } from '../../lib/format'

const HEIGHT = 260
const PAD = { top: 12, right: 8, bottom: 24 }
const TICKS = 4
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/**
 * The stylesheet sets the axis type at 9px, and 11px below 1024px so it stays
 * legible on a phone. The geometry here has to follow it: the gutter and the
 * date stride were both sized for 9px, and at 11px the labels outgrew them.
 */
const NARROW_TYPE = '(max-width: 1023px)'

/** Advance of one mono character, including the micro tracking. */
const CHAR = 0.7
/** "25 AUG" — every date label is the same six-character shape. */
const DATE_CHARS = 6
/** Clear air between two labels before they read as one word. */
const GAP = 10
/** More than this many dates and the mono register turns into noise. */
const MAX_DATES = 7

function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.find((s) => value / magnitude <= s) * magnitude
}

export default function CashChart({ series, symbol }) {
  const [ref, width] = useElementWidth(680)
  const charW = (useMediaQuery(NARROW_TYPE) ? 11 : 9) * CHAR

  const balances = series.map((d) => d.balance)
  const lowest = Math.min(...balances, 0)
  const max = niceMax(Math.max(...balances, LOW_CASH_THRESHOLD))
  // A projection that goes negative still needs to be drawn.
  const min = lowest < 0 ? -niceMax(-lowest) : 0

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => min + ((max - min) / TICKS) * i)
  // The gutter is only ever as wide as the widest number it has to hold.
  const padLeft = Math.ceil(
    Math.max(...ticks.map((v) => formatAmount(v, symbol).length)) * charW + 6,
  )

  const plotW = Math.max(width - padLeft - PAD.right, 80)
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const x = (i) => padLeft + (i / Math.max(series.length - 1, 1)) * plotW
  const y = (value) => PAD.top + plotH - ((value - min) / (max - min)) * plotH

  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.balance)}`).join(' ')
  const area = `${line} L ${x(series.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`

  const dipsLow = Math.min(...balances) < LOW_CASH_THRESHOLD
  const thresholdY = y(LOW_CASH_THRESHOLD)

  // How many dates the axis can carry, rather than a fixed six that only ever
  // fitted the desktop width.
  const dateW = Math.ceil(DATE_CHARS * charW)
  const last = series.length - 1
  const fits = Math.min(Math.max(Math.floor(plotW / (dateW + GAP)), 2), MAX_DATES)
  const every = Math.max(Math.ceil(last / Math.max(fits - 1, 1)), 1)

  const marks = []
  for (let i = 0; i < series.length; i += every) marks.push(i)
  if (marks[marks.length - 1] !== last) {
    // The end of the projection is worth naming — but not on top of its neighbour.
    if (x(last) - x(marks[marks.length - 1]) < dateW + GAP) marks.pop()
    marks.push(last)
  }

  return (
    <div ref={ref} className="bfh-cashchart">
      <svg width={width} height={HEIGHT} role="img" aria-label="Projected cash balance">
        <defs>
          <pattern
            id="bfh-hatch-cash"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--b2)" strokeWidth="2.5" />
          </pattern>
        </defs>

        {ticks.map((value, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--b)"
              strokeWidth="0.5"
            />
            <text x={0} y={y(value) + 3} className="bfh-chart__axis">
              {formatAmount(value, symbol)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#bfh-hatch-cash)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.5" />

        {dipsLow && (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={thresholdY}
              y2={thresholdY}
              stroke="var(--ink)"
              strokeWidth="0.75"
              strokeDasharray="4 3"
            />
            <text x={padLeft + 6} y={thresholdY - 5} className="bfh-chart__axis">
              Low cash warning
            </text>
          </g>
        )}

        {marks.map((i) => (
          <text
            key={series[i].date}
            x={x(i)}
            y={HEIGHT - 7}
            textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
            className="bfh-chart__axis"
          >
            {formatDayMonth(series[i].date)}
          </text>
        ))}
      </svg>
    </div>
  )
}
