import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lets an overlay play its exit before it unmounts. `dismiss()` flips the
 * overlay into its closing state, the stylesheet animates that, and calls
 * `onClose` once the animation has had time to finish.
 *
 * A timer rather than `animationend`: the event never fires when motion is
 * reduced to nothing or the element is hidden, and a sheet that will not
 * close is worse than one that closes a frame early.
 */
export default function useDismiss(onClose, duration = 220) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)

  const dismiss = useCallback(() => {
    if (timer.current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setClosing(true)
    timer.current = setTimeout(onClose, reduce ? 0 : duration)
  }, [onClose, duration])

  useEffect(() => () => clearTimeout(timer.current), [])

  return [closing, dismiss]
}
