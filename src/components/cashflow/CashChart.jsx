import { useEffect, useId, useRef, useState } from 'react'

import useElementWidth from '../../hooks/useElementWidth'
import useMediaQuery from '../../hooks/useMediaQuery'
import { LOW_CASH_THRESHOLD } from '../../lib/cashflow'
import { formatCurrency, formatDayMonth } from '../../lib/format'
import { NARROW_TYPE, axisFontSize, formatAxis, niceMax, textWidth, tipPlacement } from '../charts/chartMath'

const HEIGHT = 260
const PAD = { top: 14, right: 10, bottom: 26 }
const TICKS = 4
/** Clear air between two date labels before they read as one word. */
const GAP = 14
/** More than this many dates and the axis turns into noise. */
const MAX_DATES = 7

/** The smallest round step that covers `size`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(size) {
  const magnitude = 10 ** Math.floor(Math.log10(size))
  return [1, 2, 2.5, 5, 10].map((s) => s * magnitude).find((s) => s >= size)
}

/**
 * Where the axis runs. From zero when the balance comes anywhere near it, so
 * a dip toward empty looks like one. When cash stays comfortably high, the
 * axis closes in on the band the balance moves in, otherwise ₱1.5M drifting
 * to ₱1.55M is drawn as a flat line and the chart says nothing.
 */
function axisRange(balances) {
  const lowest = Math.min(...balances)
  const highest = Math.max(...balances)

  if (lowest < 0) return { min: -niceMax(-lowest), max: niceMax(Math.max(highest, LOW_CASH_THRESHOLD)) }
  if (lowest < LOW_CASH_THRESHOLD * 1.5 || lowest < highest * 0.5) {
    return { min: 0, max: niceMax(Math.max(highest, LOW_CASH_THRESHOLD)) }
  }

  const pad = Math.max((highest - lowest) * 0.5, highest * 0.04)
  const step = niceStep((highest - lowest + pad * 2) / TICKS)
  const min = Math.max(Math.floor((lowest - pad) / step) * step, 0)
  return { min, max: min + step * TICKS }
}

/**
 * The projected balance as a line over a soft area, with the low-cash line
 * drawn only when the projection actually crosses it. Hover, tap or arrow
 * keys read off any day.
 */
export default function CashChart({ series, symbol }) {
  const [ref, width] = useElementWidth(680)
  const fontSize = axisFontSize(useMediaQuery(NARROW_TYPE))
  const gradientId = `bfh-cash-${useId().replace(/:/g, '')}`
  const [active, setActive] = useState(null)
  const touchRef = useRef(false)

  const balances = series.map((d) => d.balance)
  const { min, max } = axisRange(balances)

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => min + ((max - min) / TICKS) * i)
  const padLeft = Math.max(...ticks.map((v) => textWidth(formatAxis(v, symbol), fontSize))) + 10

  const plotW = Math.max(width - padLeft - PAD.right, 80)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const last = series.length - 1

  const x = (i) => padLeft + (i / Math.max(last, 1)) * plotW
  const y = (value) => PAD.top + plotH - ((value - min) / (max - min)) * plotH

  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.balance)}`).join(' ')
  const area = `${line} L ${x(last)} ${y(min)} L ${x(0)} ${y(min)} Z`

  const dipsLow = Math.min(...balances) < LOW_CASH_THRESHOLD
  const thresholdY = y(LOW_CASH_THRESHOLD)

  // How many dates the axis can carry at this width.
  const dateW = textWidth('25 AUG', fontSize)
  const fits = Math.min(Math.max(Math.floor(plotW / (dateW + GAP)), 2), MAX_DATES)
  const every = Math.max(Math.ceil(last / Math.max(fits - 1, 1)), 1)

  const marks = []
  for (let i = 0; i < series.length; i += every) marks.push(i)
  if (marks[marks.length - 1] !== last) {
    // The end of the projection is worth naming, but not on top of its neighbour.
    if (x(last) - x(marks[marks.length - 1]) < dateW + GAP) marks.pop()
    marks.push(last)
  }

  const indexAt = (clientX, svg) => {
    const px = clientX - svg.getBoundingClientRect().left - padLeft
    return Math.min(Math.max(Math.round((px / plotW) * last), 0), last)
  }

  // A tapped reading stays up until the next tap somewhere else.
  useEffect(() => {
    if (active === null || !touchRef.current) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active, ref])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      setActive((i) => (i === null ? 0 : Math.min(Math.max(i + step, 0), last)))
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  const point = active !== null ? series[active] : null
  const tip = point ? tipPlacement(x(active), 4, width) : null
  const end = series[last]

  return (
    <div
      ref={ref}
      className="bfh-cashchart bfh-plot"
      tabIndex={0}
      role="group"
      aria-label="Projected cash balance. Use the arrow keys to read each day."
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Projected cash balance"
        onPointerMove={(e) => {
          touchRef.current = e.pointerType !== 'mouse'
          setActive(indexAt(e.clientX, e.currentTarget))
        }}
        onPointerDown={(e) => {
          touchRef.current = e.pointerType !== 'mouse'
          setActive(indexAt(e.clientX, e.currentTarget))
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setActive(null)
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="bfh-plot__areastop" stopOpacity="0.14" />
            <stop offset="100%" className="bfh-plot__areastop" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((value, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y(value)}
              y2={y(value)}
              className={value === 0 ? 'bfh-plot__baseline' : 'bfh-plot__grid'}
            />
            <text
              x={padLeft - 10}
              y={y(value)}
              dy="0.35em"
              textAnchor="end"
              className="bfh-chart__axis"
            >
              {formatAxis(value, symbol)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />

        {dipsLow && (
          <g>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={thresholdY}
              y2={thresholdY}
              className="bfh-plot__threshold"
            />
            <text
              x={padLeft + plotW}
              y={thresholdY - 6}
              textAnchor="end"
              className="bfh-chart__axis bfh-chart__axis--strong"
            >
              Low cash
            </text>
          </g>
        )}

        <path d={line} className="bfh-plot__line" />

        {point ? (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="bfh-plot__crosshair"
            />
            <circle cx={x(active)} cy={y(point.balance)} r="4.5" className="bfh-plot__dot" />
          </g>
        ) : (
          end && <circle cx={x(last)} cy={y(end.balance)} r="3.5" className="bfh-plot__dot" />
        )}

        {marks.map((i) => (
          <text
            key={series[i].date}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
            className="bfh-chart__axis"
          >
            {formatDayMonth(series[i].date)}
          </text>
        ))}
      </svg>

      {point && (
        <div className="bfh-tip" style={{ left: tip.left, top: PAD.top }} data-side={tip.side} role="status">
          <div className="bfh-tip__title">{formatDayMonth(point.date)}</div>
          <div className="bfh-tip__value">{formatCurrency(point.balance, symbol)}</div>
        </div>
      )}
    </div>
  )
}
