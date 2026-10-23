import { useEffect, useRef, useState } from 'react'

import useElementWidth from '../../hooks/useElementWidth'
import useMediaQuery from '../../hooks/useMediaQuery'
import { formatCurrency } from '../../lib/format'
import {
  NARROW_TYPE,
  tipPlacement,
  axisFontSize,
  formatAxis,
  niceMax,
  textWidth,
  topRounded,
} from './chartMath'

const PAD = { top: 8, right: 2, bottom: 26 }
/** Clear air between neighbouring bars in one bucket. */
const BAR_GAP = 2
/** Clear air between two x labels before they read as one word. */
const LABEL_GAP = 14

/**
 * The bar plot every bar chart in the app draws with: one or more series per
 * time bucket, a recessive grid, and a tooltip on hover, tap or arrow key.
 *
 * `bars` names the series in draw order, `[{ key, name, tone }]`, where tone
 * is `primary` (solid ink) or `secondary` (a light tint of it). Each item in
 * `data` carries a value under every bar's key, plus `key` and `label`, and an
 * optional longer `title` for the tooltip.
 */
export default function BarPlot({
  data,
  bars,
  height = 200,
  symbol,
  formatTick = (v) => formatAxis(v, symbol),
  formatValue = (v) => formatCurrency(v, symbol),
  ariaLabel,
}) {
  const [ref, width] = useElementWidth()
  const fontSize = axisFontSize(useMediaQuery(NARROW_TYPE))
  const [active, setActive] = useState(null)
  const touchRef = useRef(false)

  const max = niceMax(Math.max(...data.flatMap((d) => bars.map((b) => d[b.key] || 0)), 0))
  const tickCount = height < 160 ? 2 : 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (max / tickCount) * i)

  // The gutter is only ever as wide as the widest number it has to hold.
  const padLeft = Math.max(...ticks.map((v) => textWidth(formatTick(v), fontSize))) + 10
  const plotW = Math.max(width - padLeft - PAD.right, 60)
  const plotH = height - PAD.top - PAD.bottom
  const baseY = PAD.top + plotH
  const y = (value) => baseY - (Math.max(value, 0) / max) * plotH

  const slot = plotW / Math.max(data.length, 1)
  const n = bars.length
  // Bars take a little over half the slot, so the gaps between buckets read
  // as the rhythm and a single month never looks like a wall.
  const barW = Math.max(Math.min((slot * 0.6 - BAR_GAP * (n - 1)) / n, n > 1 ? 16 : 28), 3)
  const groupW = barW * n + BAR_GAP * (n - 1)
  const centre = (i) => padLeft + slot * i + slot / 2

  /* Drop x labels until the survivors stand clear of each other, counting back
     from the newest bucket so the most recent date is always named. */
  const widest = Math.max(...data.map((d) => textWidth(d.label, fontSize)), 1)
  const labelEvery = Math.max(1, Math.ceil((widest + LABEL_GAP) / slot))
  const last = data.length - 1

  const indexAt = (clientX, svg) => {
    const x = clientX - svg.getBoundingClientRect().left - padLeft
    return Math.min(Math.max(Math.floor(x / slot), 0), last)
  }

  // A tapped tooltip stays up until the next tap somewhere else.
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
      setActive((i) => (i === null ? last : Math.min(Math.max(i + step, 0), last)))
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  const point = active !== null ? data[active] : null
  // The tooltip sits beside its bucket, inside the plot, on whichever side
  // has the room, never over the title or the legend.
  const tip = point ? tipPlacement(centre(active), Math.min(slot, groupW + 16) / 2, width) : null

  return (
    <div
      ref={ref}
      className="bfh-plot"
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use the arrow keys to read each value.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
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
        {ticks.map((value, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y(value)}
              y2={y(value)}
              className={i === 0 ? 'bfh-plot__baseline' : 'bfh-plot__grid'}
            />
            <text
              x={padLeft - 10}
              y={y(value)}
              dy="0.35em"
              textAnchor="end"
              className="bfh-chart__axis"
            >
              {formatTick(value)}
            </text>
          </g>
        ))}

        {point && (
          <rect
            className="bfh-plot__band"
            x={centre(active) - Math.min(slot, groupW + 16) / 2}
            y={PAD.top}
            width={Math.min(slot, groupW + 16)}
            height={plotH}
            rx="6"
          />
        )}

        {data.map((d, i) => {
          const left = centre(i) - groupW / 2
          const dim = active !== null && active !== i
          return (
            <g key={d.key} className="bfh-plot__group" data-dim={dim || undefined}>
              {bars.map((b, j) => {
                const value = d[b.key] || 0
                return (
                  <path
                    key={b.key}
                    className="bfh-plot__bar"
                    data-tone={b.tone}
                    d={topRounded(left + j * (barW + BAR_GAP), y(value), barW, baseY - y(value), 4)}
                  />
                )
              })}
              {(last - i) % labelEvery === 0 && (
                <text
                  // The newest label sits against the right edge, so it
                  // anchors inwards rather than spilling past the plot.
                  x={i === last && slot < widest ? padLeft + plotW : centre(i)}
                  y={height - 8}
                  textAnchor={i === last && slot < widest ? 'end' : 'middle'}
                  className="bfh-chart__axis"
                  data-active={active === i || undefined}
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {point && (
        <div className="bfh-tip" style={{ left: tip.left, top: PAD.top }} data-side={tip.side} role="status">
          <div className="bfh-tip__title">{point.title ?? point.label}</div>
          {n === 1 ? (
            <div className="bfh-tip__value">{formatValue(point[bars[0].key] || 0)}</div>
          ) : (
            bars.map((b) => (
              <div key={b.key} className="bfh-tip__row">
                <span className="bfh-tip__swatch" data-tone={b.tone} aria-hidden="true" />
                <span className="bfh-tip__name">{b.name}</span>
                <span className="bfh-tip__num">{formatValue(point[b.key] || 0)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
