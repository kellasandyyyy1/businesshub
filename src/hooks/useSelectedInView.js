import { useEffect, useRef } from 'react'

/**
 * Keeps the chosen chip of a sideways-scrolling row on screen. On a phone the
 * default can be the last chip of the row, "Last 12 months", and a choice
 * you cannot see is a choice you cannot tell has been made.
 *
 * Scrolls the row only, never the page. `ready` re-runs it once a page that
 * rendered nothing while its data loaded has drawn the row.
 */
export default function useSelectedInView(selected, ready = true) {
  const ref = useRef(null)

  useEffect(() => {
    const row = ref.current
    const chip = row?.querySelector('[aria-checked="true"], [aria-current="true"]')
    if (!row || !chip) return
    const left = chip.offsetLeft - row.offsetLeft
    const right = left + chip.offsetWidth
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(left - 16, 0), behavior: 'smooth' })
    }
  }, [selected, ready])

  return ref
}
