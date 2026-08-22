import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Keeps Tab inside an overlay and restores focus to whatever opened it.
 * Attach the returned ref to the element that should contain focus.
 */
export function useFocusTrap(active = true) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    if (!node) return undefined

    const previous = document.activeElement

    // Focus the first control, or the container itself if it has none.
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!node.contains(document.activeElement)) {
      const [first] = focusables()
      if (first) first.focus()
      else node.focus?.()
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [active])

  return ref
}

export default useFocusTrap
