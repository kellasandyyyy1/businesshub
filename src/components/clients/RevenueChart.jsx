import useElementWidth from '../../hooks/useElementWidth'
import { formatAmount } from '../../lib/format'

const HEIGHT = 132
const PAD = { top: 8, right: 2, bottom: 20, left: 44 }

const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(value) {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return STEPS.find((s) => value / magnitude <= s) * magnitude
}

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

/** Twelve months of income from one client. Same marks as the dashboard chart. */
export default function RevenueChart({ series, symbol }) {
  const [ref, width] = useElementWidth(420)

  const plotW = Math.max(width - PAD.left - PAD.right, 60)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...series.map((d) => d.revenue), 0))
  const slot = plotW / series.length
  const barW = Math.max(Math.min(slot - 8, 20), 3)
  const y = (value) => PAD.top + plotH - (value / max) * plotH

  return (
    <div ref={ref} className="bfh-minichart">
      <svg width={width} height={HEIGHT} role="img" aria-label="Monthly revenue from this client">
        {[0, max / 2, max].map((value) => (
          <g key={value}>
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
        ))}

        {series.map((d, i) => {
          const centre = PAD.left + slot * i + slot / 2
          return (
            <g key={d.label + i}>
              <path
                d={topRounded(centre - barW / 2, y(d.revenue), barW, PAD.top + plotH - y(d.revenue), 4)}
                fill="var(--ink)"
              />
              <text x={centre} y={HEIGHT - 6} textAnchor="middle" className="bfh-chart__axis">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
