import { formatAmount } from '../../lib/format'
import useElementWidth from '../../hooks/useElementWidth'

const HEIGHT = 210
const PAD = { top: 10, right: 4, bottom: 22, left: 46 }
const TICKS = 4

/**
 * Rounds an axis top up to a readable step. The ladder is finer than the usual
 * 1/2/5 so the tallest bar fills most of the plot instead of half of it.
 */
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  return STEPS.find((s) => normalised <= s) * magnitude
}

/** A rect with only its top corners rounded. */
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, Math.max(h, 0))
  if (h <= 0) return ''
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

export default function RevenueExpenseChart({ series, periodLabel, symbol }) {
  const [ref, width] = useElementWidth()

  const plotW = Math.max(width - PAD.left - PAD.right, 80)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...series.flatMap((d) => [d.revenue, d.expenses]), 0))

  const slot = plotW / Math.max(series.length, 1)
  const barW = Math.max(Math.min(slot / 2 - 5, 22), 4)

  /* Twelve months across a phone puts every label shoulder to shoulder and the
     axis reads as one long word. A label needs roughly 60px to stand clear, so
     below that they thin out — counting back from the newest bucket, which is
     the one worth keeping. */
  const labelEvery = Math.max(1, Math.ceil(60 / slot))
  const y = (value) => PAD.top + plotH - (value / max) * plotH

  return (
    <section className="bfh-card bfh-chart">
      <header className="bfh-chart__head">
        <div>
          <h2 className="bfh-panel__title">Revenue vs expenses</h2>
          <div className="bfh-micro">{periodLabel}</div>
        </div>

        <div className="bfh-legend">
          <span className="bfh-legend__item">
            <span className="bfh-legend__dot" data-variant="revenue" />
            <span className="bfh-micro">Revenue</span>
          </span>
          <span className="bfh-legend__item">
            <span className="bfh-legend__dot" data-variant="expenses" />
            <span className="bfh-micro">Expenses</span>
          </span>
        </div>
      </header>

      <div ref={ref} className="bfh-chart__plot">
        <svg width={width} height={HEIGHT} role="img" aria-label="Revenue against expenses">
          <defs>
            {/* Expenses read as texture, not colour. */}
            <pattern
              id="bfh-hatch"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--b2)" strokeWidth="2.5" />
            </pattern>
          </defs>

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
            const revX = centre - barW - 2
            const expX = centre + 2
            return (
              <g key={d.label}>
                <path
                  d={topRounded(revX, y(d.revenue), barW, PAD.top + plotH - y(d.revenue), 4)}
                  fill="var(--ink)"
                />
                <path
                  d={topRounded(expX, y(d.expenses), barW, PAD.top + plotH - y(d.expenses), 4)}
                  fill="url(#bfh-hatch)"
                  stroke="var(--b2)"
                  strokeWidth="0.5"
                />
                {(series.length - 1 - i) % labelEvery === 0 && (
                  <text
                    // The newest label sits against the right edge, so it
                    // anchors inwards rather than spilling past the plot.
                    x={i === series.length - 1 ? PAD.left + plotW : centre}
                    y={HEIGHT - 6}
                    textAnchor={i === series.length - 1 ? 'end' : 'middle'}
                    className="bfh-chart__axis"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
