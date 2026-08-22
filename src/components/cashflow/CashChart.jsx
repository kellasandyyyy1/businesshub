import useElementWidth from '../../hooks/useElementWidth'
import { LOW_CASH_THRESHOLD } from '../../lib/cashflow'
import { formatAmount, formatDayMonth } from '../../lib/format'

const HEIGHT = 260
const PAD = { top: 12, right: 8, bottom: 24, left: 52 }
const TICKS = 4
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.find((s) => value / magnitude <= s) * magnitude
}

export default function CashChart({ series, symbol }) {
  const [ref, width] = useElementWidth(680)

  const plotW = Math.max(width - PAD.left - PAD.right, 80)
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const balances = series.map((d) => d.balance)
  const lowest = Math.min(...balances, 0)
  const max = niceMax(Math.max(...balances, LOW_CASH_THRESHOLD))
  // A projection that goes negative still needs to be drawn.
  const min = lowest < 0 ? -niceMax(-lowest) : 0

  const x = (i) => PAD.left + (i / Math.max(series.length - 1, 1)) * plotW
  const y = (value) => PAD.top + plotH - ((value - min) / (max - min)) * plotH

  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.balance)}`).join(' ')
  const area = `${line} L ${x(series.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`

  const dipsLow = Math.min(...balances) < LOW_CASH_THRESHOLD
  const thresholdY = y(LOW_CASH_THRESHOLD)

  // Six date labels is about as many as the mono register can carry.
  const labelEvery = Math.max(Math.ceil(series.length / 6), 1)

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

        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const value = min + ((max - min) / TICKS) * i
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--b)"
                strokeWidth="0.5"
              />
              <text x={0} y={y(value) + 3} className="bfh-chart__axis">
                {formatAmount(value, symbol)}
              </text>
            </g>
          )
        })}

        <path d={area} fill="url(#bfh-hatch-cash)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.5" />

        {dipsLow && (
          <g>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={thresholdY}
              y2={thresholdY}
              stroke="var(--ink)"
              strokeWidth="0.75"
              strokeDasharray="4 3"
            />
            <text x={PAD.left + 6} y={thresholdY - 5} className="bfh-chart__axis">
              Low cash warning
            </text>
          </g>
        )}

        {series.map((d, i) =>
          i % labelEvery === 0 || i === series.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={HEIGHT - 7}
              textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              className="bfh-chart__axis"
            >
              {formatDayMonth(d.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
