import { useId } from 'react'

import { formatAmount } from '../../lib/format'
import useElementWidth from '../../hooks/useElementWidth'

const HEIGHT = 180
const PAD = { top: 10, right: 4, bottom: 22, left: 46 }
const TICKS = 4

/* Same axis ladder the dashboard chart uses, so every chart reads alike. */
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.find((s) => value / magnitude <= s) * magnitude
}

/** A rect with only its top corners rounded. */
function topRounded(x, y, w, h, r) {
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
 * A single-series bar chart over time buckets. The caller decides the bucketing;
 * this only draws what it is given.
 *
 * `variant` picks the fill: solid ink for money in, the dashboard's hatch for
 * money out, so the two ledgers stay distinguishable without colour.
 */
export default function BarChart({
  title,
  sub,
  series,
  symbol,
  variant = 'solid',
  note,
  ariaLabel,
}) {
  const [ref, width] = useElementWidth()
  // Two charts on one page would otherwise share a pattern id.
  const hatchId = `bfh-hatch-${useId().replace(/:/g, '')}`

  const plotW = Math.max(width - PAD.left - PAD.right, 80)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...series.map((d) => d.value), 0))

  const slot = plotW / Math.max(series.length, 1)
  const barW = Math.max(Math.min(slot - 8, 26), 3)
  const y = (value) => PAD.top + plotH - (value / max) * plotH

  /* A date label needs about 60px to stand clear of its neighbours. Rather than
     shrink the type, drop labels until the survivors have that much room — and
     count back from the newest bucket so the most recent date is always one of
     them. */
  const labelEvery = Math.max(1, Math.ceil(60 / slot))

  const hatched = variant === 'hatched'

  return (
    <section className="bfh-card bfh-chart">
      <header className="bfh-chart__head">
        <div>
          <h2 className="bfh-panel__title">{title}</h2>
          <div className="bfh-micro">{sub}</div>
        </div>
      </header>

      <div ref={ref} className="bfh-chart__plot">
        <svg
          width="100%"
          height={HEIGHT}
          viewBox={`0 0 ${Math.max(width, 1)} ${HEIGHT}`}
          role="img"
          aria-label={ariaLabel ?? title}
        >
          {hatched && (
            <defs>
              {/* Expenses read as texture, not colour. */}
              <pattern
                id={hatchId}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="2.5" />
              </pattern>
            </defs>
          )}

          {Array.from({ length: TICKS + 1 }, (_, i) => {
            const value = (max / TICKS) * i
            const ty = y(value)
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={ty}
                  y2={ty}
                  stroke="var(--b)"
                  strokeWidth="0.5"
                />
                <text x={0} y={ty + 3} className="bfh-chart__axis">
                  {formatAmount(value, symbol)}
                </text>
              </g>
            )
          })}

          {series.map((d, i) => {
            const centre = PAD.left + slot * i + slot / 2
            const barH = PAD.top + plotH - y(d.value)
            const fromEnd = series.length - 1 - i
            // Only the last label needs pulling in; the first has the whole
            // y-axis gutter to its left, and anchoring it to the axis would
            // shove it into its neighbour.
            const anchor = fromEnd === 0 ? 'end' : 'middle'
            const x = fromEnd === 0 ? PAD.left + plotW : centre
            return (
              <g key={d.key}>
                <path
                  d={topRounded(centre - barW / 2, y(d.value), barW, barH, 4)}
                  fill={hatched ? `url(#${hatchId})` : 'var(--ink)'}
                  stroke={hatched ? 'var(--ink)' : undefined}
                  strokeWidth={hatched ? 0.5 : undefined}
                />
                {fromEnd % labelEvery === 0 && (
                  <text x={x} y={HEIGHT - 6} textAnchor={anchor} className="bfh-chart__axis">
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {note && <p className="bfh-micro bfh-chart__note">{note}</p>}
    </section>
  )
}
